import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";
import { ENV } from "../config/config.module";
import { type Env } from "../config/env";
import { imageOutputFormat } from "../config/limits";
import type { ModelAlias } from "../models/model-registry";
import type { ProviderEnv } from "../models/providers";
import { envKey } from "../models/providers";
import { AiConfigService } from "../ai-config/ai-config.service";
import { builtinProvider, compatEnvName, envCompatIds, isCompatId } from "./provider-catalog";
import { type RuntimeDef, type RuntimeEnv, RUNTIME_DEFS, defaultRuntimeValue, fromEnvValue, runtimeDef, runtimeValueError, toEnvValue } from "./runtime-keys";
import { openSecret, secretIkm } from "./secret-box";
import { EMPTY_SETTINGS, type ProviderRow, SETTINGS_STORE, type SettingsData, type SettingsStore, type StoredSecret, type StoredTier } from "./settings-store";
import type { RoutingKey, RuntimeValue, Source } from "./settings-types";

/** Studio changes reach every instance within this long (the instance that saved reloads at once). */
export const SETTINGS_CACHE_MS = 60_000;

export interface KeyInfo {
	state: "set" | "env" | "none" | "needs-reentry";
	/** the key in use: the saved one, else the env one */
	value: string | null;
	last4: string | null;
	setBy: string | null;
	setAt: Date | null;
}

export interface RuntimeEffective {
	value: RuntimeValue;
	source: Source;
	default: RuntimeValue;
}

const nonBlank = (value: string | undefined): string | undefined => (value && value.trim() ? value : undefined);

/**
 * Prime Studio's AI settings (ai-platform's own database) merged with env and code defaults:
 * Studio -> env -> default. Reads are synchronous from a 60 s cache (`version()` changes whenever the content
 * did, so derived objects such as provider factories know when to rebuild); a stale cache refreshes in the
 * background, never on the request path. Secrets are decrypted here and never leave this class's callers
 * (provider factories, the connection test); no view carries them.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
	private readonly logger = new Logger(SettingsService.name);
	private cache: SettingsData = EMPTY_SETTINGS;
	private signature = JSON.stringify(EMPTY_SETTINGS);
	private loadedAt = 0;
	private inflight: Promise<void> | null = null;
	private versionNo = 0;
	private memo: { version: number; overlay?: Record<string, string | undefined>; runtime?: RuntimeEnv } = { version: -1 };

	constructor(
		@Inject(ENV) readonly env: Env,
		@Inject(SETTINGS_STORE) readonly store: SettingsStore,
		@Optional() readonly config?: Pick<AiConfigService, "models">,
		readonly vars: Record<string, string | undefined> = process.env,
		private readonly clock: () => number = Date.now,
	) {}

	async onModuleInit(): Promise<void> {
		await this.reload();
	}

	private memoFor() {
		if (this.memo.version !== this.versionNo) this.memo = { version: this.versionNo };
		return this.memo;
	}

	/** Changes whenever the loaded settings did. */
	version(): number {
		return this.versionNo;
	}

	data(): SettingsData {
		if (!this.inflight && this.clock() - this.loadedAt >= SETTINGS_CACHE_MS) void this.reload();
		return this.cache;
	}

	/** Reloads from the database now. Never throws: a failed read keeps the last copy. */
	reload(): Promise<void> {
		this.inflight ??= this.store
			.load()
			.then((data) => {
				const signature = JSON.stringify(data);
				if (signature !== this.signature) {
					this.signature = signature;
					this.cache = data;
					this.versionNo++;
				}
			})
			.catch((error: unknown) => {
				this.logger.warn(`ai settings not refreshed (keeping the last copy): ${error instanceof Error ? error.message : String(error)}`);
			})
			.finally(() => {
				this.loadedAt = this.clock();
				this.inflight = null;
			});
		return this.inflight;
	}

	/** Awaits a reload when the copy is stale (or one is running): for request entry points on serverless instances. */
	async refreshIfStale(): Promise<void> {
		if (this.inflight || this.clock() - this.loadedAt >= SETTINGS_CACHE_MS) await this.reload();
	}

	/** After a write: reload and make sure derived objects rebuild. */
	async reloadAfterWrite(): Promise<void> {
		while (this.inflight) await this.inflight;
		await this.reload();
	}

	// --- secrets -----------------------------------------------------------------------------------------------

	unseal(slot: string, secret: StoredSecret | null | undefined): string | null {
		return secret ? openSecret(secret, secretIkm(this.env), slot) : null;
	}

	row(id: string): ProviderRow | undefined {
		return this.data().providers.find((row) => row.id === id);
	}

	private envValue(name: string | undefined): string | undefined {
		return name ? nonBlank(this.vars[name]) : undefined;
	}

	/** The key of a provider: saved in Studio, else from env. A saved key sealed under another secret is "needs-reentry". */
	keyInfo(id: string): KeyInfo {
		const secret = this.row(id)?.secret;
		const envName = builtinProvider(id)?.keyEnv ?? (isCompatId(id) ? compatEnvName(id, "API_KEY") : undefined);
		const fromEnv = this.envValue(envName) ?? null;
		if (secret) {
			const value = this.unseal(`provider:${id}`, secret);
			const meta = { last4: secret.last4, setBy: secret.setBy, setAt: secret.setAt };
			return value ? { state: "set", value, ...meta } : { state: "needs-reentry", value: fromEnv, ...meta };
		}
		return { state: fromEnv ? "env" : "none", value: fromEnv, last4: null, setBy: null, setAt: null };
	}

	gatewayToken(): { state: "set" | "env" | "none" | "needs-reentry"; value: string | null; last4: string | null; setBy: string | null; setAt: Date | null } {
		const secret = this.data().gateway?.token;
		const fromEnv = this.envValue("AI_GATEWAY_TOKEN") ?? this.env.AI_GATEWAY_TOKEN ?? null;
		if (secret) {
			const value = this.unseal("gateway:token", secret);
			const meta = { last4: secret.last4, setBy: secret.setBy, setAt: secret.setAt };
			return value ? { state: "set", value, ...meta } : { state: "needs-reentry", value: fromEnv, ...meta };
		}
		return { state: fromEnv ? "env" : "none", value: fromEnv, last4: null, setBy: null, setAt: null };
	}

	// --- providers ---------------------------------------------------------------------------------------------

	isProviderEnabled(id: string): boolean {
		return this.row(id)?.enabled !== false;
	}

	/** Compat endpoints that exist: saved in Studio or defined in env. */
	compatIds(): string[] {
		const ids = new Set(envCompatIds(this.vars));
		for (const row of this.data().providers) if (row.kind === "compat") ids.add(row.id);
		return [...ids].sort();
	}

	/** process env + Studio values mapped onto the env names the provider factories read. Studio wins. */
	overlayVars(): Record<string, string | undefined> {
		const data = this.data();
		const memo = this.memoFor();
		if (memo.overlay) return memo.overlay;
		const out: Record<string, string | undefined> = { ...this.vars };
		const put = (name: string, value: string | null | undefined) => {
			if (value !== null && value !== undefined && value !== "") out[name] = value;
		};
		for (const row of data.providers) {
			const builtin = builtinProvider(row.id);
			const key = this.keyInfo(row.id);
			if (builtin) {
				if (key.state === "set") put(builtin.keyEnv, key.value);
				put(builtin.baseUrlEnv, row.baseUrl);
			} else if (row.kind === "compat") {
				if (key.state === "set") put(compatEnvName(row.id, "API_KEY"), key.value);
				put(compatEnvName(row.id, "BASE_URL"), row.baseUrl);
				if (row.options.reasoning !== undefined) out[compatEnvName(row.id, "REASONING")] = String(row.options.reasoning);
				if (row.options.structuredOutputs !== undefined) out[compatEnvName(row.id, "STRUCTURED_OUTPUTS")] = String(row.options.structuredOutputs);
			}
		}
		const gateway = data.gateway;
		put("AI_GATEWAY_BASE_URL", gateway?.baseUrl);
		const token = this.gatewayToken();
		if (token.state === "set") put("AI_GATEWAY_TOKEN", token.value);
		for (const [provider, path] of Object.entries(gateway?.paths ?? {})) put(`AI_GATEWAY_PATH_${envKey(provider)}`, path);
		memo.overlay = out;
		return out;
	}

	/** Connection settings for the provider factories (gateway included), Studio values over env. */
	providerEnv(vars: Record<string, string | undefined> = this.overlayVars()): ProviderEnv {
		return { gatewayBaseUrl: nonBlank(vars.AI_GATEWAY_BASE_URL) ?? this.env.AI_GATEWAY_BASE_URL, gatewayToken: nonBlank(vars.AI_GATEWAY_TOKEN) ?? this.env.AI_GATEWAY_TOKEN, vars };
	}

	// --- routing -----------------------------------------------------------------------------------------------

	studioTier(key: RoutingKey): StoredTier | undefined {
		return this.data().routing[key];
	}

	/** Chains to try for a tier, in order: Studio, Payload's `models` (legacy), env. Duplicates dropped. */
	chainCandidates(key: RoutingKey): Array<{ source: Source; chain: string }> {
		const studio = this.studioTier(key)?.chain ?? [];
		const payload = this.config?.models()[key];
		const envChain = this.env[({ fast: "AI_MODEL_FAST", balanced: "AI_MODEL_BALANCED", quality: "AI_MODEL_QUALITY", image: "AI_MODEL_IMAGE" } as const)[key]];
		const envSource: Source = this.envValue(`AI_MODEL_${key.toUpperCase()}`) ? "env" : "default";
		const all: Array<{ source: Source; chain: string }> = [];
		if (studio.length > 0) all.push({ source: "studio", chain: studio.join(", ") });
		if (payload) all.push({ source: "env", chain: payload });
		all.push({ source: envSource, chain: envChain });
		return all.filter((entry, index) => all.findIndex((other) => other.chain === entry.chain) === index);
	}

	/** Effort of a tier set in Studio: `null` = send none; undefined = not set in Studio. */
	studioEffort(alias: ModelAlias): { value: string | null } | undefined {
		const tier = this.studioTier(alias);
		return tier && tier.effort !== undefined ? { value: tier.effort } : undefined;
	}

	/** Per-attempt model timeout of a tier: its Studio value, else the runtime model timeout. */
	tierTimeoutMs(alias: ModelAlias): number {
		return this.studioTier(alias)?.timeoutMs ?? this.runtimeEnv().AI_MODEL_TIMEOUT_MS;
	}

	imageTimeoutMs(): number {
		return this.studioTier("image")?.timeoutMs ?? this.env.AI_IMAGE_TIMEOUT_MS;
	}

	imageFormat(): "png" | "jpeg" | "webp" | undefined {
		const studio = this.studioTier("image")?.format;
		return (studio as "png" | "jpeg" | "webp" | undefined) ?? imageOutputFormat(this.env);
	}

	/** The tier a task runs on: its Studio override, else the catalog's. */
	taskTier(taskId: string, catalogTier: ModelAlias): ModelAlias {
		const tier = this.data().tasks[taskId];
		return tier === "fast" || tier === "balanced" || tier === "quality" ? tier : catalogTier;
	}

	// --- runtime knobs -----------------------------------------------------------------------------------------

	/** `stored` = the Studio value to assume (default: the saved one), to preview a change. */
	runtimeEffective(def: RuntimeDef, stored: unknown = this.data().runtime[def.key]): RuntimeEffective {
		const fallback = defaultRuntimeValue(def);
		if (stored !== undefined && runtimeValueError(def, stored) === null) return { value: stored as RuntimeValue, source: "studio", default: fallback };
		const envValue = fromEnvValue(def, this.env[def.envName]);
		const explicit = this.envValue(def.envName) !== undefined || envValue !== fallback;
		return { value: envValue, source: explicit ? "env" : "default", default: fallback };
	}

	runtimeValue(key: string): RuntimeValue | undefined {
		const def = runtimeDef(key);
		return def ? this.runtimeEffective(def).value : undefined;
	}

	/** The runtime knobs under their env names (Studio -> env -> default): what the services read. */
	runtimeEnv(): RuntimeEnv {
		this.data();
		const memo = this.memoFor();
		if (memo.runtime) return memo.runtime;
		const out: Record<string, unknown> = {};
		for (const def of RUNTIME_DEFS) out[def.envName] = toEnvValue(def, this.runtimeEffective(def).value);
		const runtime = out as unknown as RuntimeEnv;
		memo.runtime = runtime;
		return runtime;
	}
}

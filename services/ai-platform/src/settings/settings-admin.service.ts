import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { GATEWAY_PATHS } from "../models/providers";
import { TASK_DEFINITIONS } from "../tasks/catalog";
import { builtinProvider, COMPAT_PREFIX, compatEnvName, isCompatId } from "./provider-catalog";
import { ProviderTester } from "./provider-tester";
import { REQUEST_BUDGET_MS, RUNTIME_DEFS, runtimeDef, runtimeValueError } from "./runtime-keys";
import { sealSecret, secretIkm } from "./secret-box";
import {
	EndpointBody,
	fail,
	GatewayBody,
	HistoryQuery,
	KeyBody,
	parseBody,
	ProviderBody,
	RoutingBody,
	RuntimeBody,
	TasksBody,
	TestBody,
	TestRateLimitedError,
} from "./settings-schemas";
import { changeToRestore, snapshotOf } from "./settings-snapshot";
import { applyChange, type GatewayRow, type ProviderRow, type RoutingStored, type SettingsChange, type StoredSecret, type StoredTier } from "./settings-store";
import type { SettingsService } from "./settings.service";
import { buildSettingsView } from "./settings-view";
import type { Actor, HistoryArea, HistoryEntry, RoutingKey, SettingsView, TestResult } from "./settings-types";

const TEST_LIMIT = 10;
const TEST_WINDOW_MS = 60_000;
const TIER_LABEL: Record<RoutingKey, string> = { fast: "Fast", balanced: "Balanced", quality: "Quality", image: "Image" };
/** Built-in providers by name, endpoints by their full id ("compat-local"), as they appear in Routing. */
const historyName = (id: string) => builtinProvider(id)?.label ?? id;
/** "compat-local:cx/gpt-6 → anthropic:claude-haiku-5-5": full refs, so two providers serving the same model id stay apart. */
const chainText = (chain: readonly string[]) => (chain.length > 0 ? chain.join(" → ") : "none");
const seconds = (ms: number) => `${Math.round(ms / 100) / 10}s`;

/**
 * Every write of the internal admin API: validate, apply as one transaction together with its history entry
 * (plain-English summary + the non-secret state after it), reload the settings cache, answer the new view.
 */
@Injectable()
export class SettingsAdminService {
	private readonly tests = new Map<string, number[]>();

	constructor(
		private readonly settings: SettingsService,
		private readonly tester: ProviderTester = new ProviderTester(settings),
		private readonly clock: () => number = Date.now,
		private readonly newId: () => string = randomUUID,
	) {}

	// --- reads -------------------------------------------------------------------------------------------------

	async view(): Promise<SettingsView> {
		await this.settings.reloadAfterWrite();
		return buildSettingsView(this.settings);
	}

	async history(query: unknown): Promise<{ entries: HistoryEntry[] }> {
		const { area, limit } = parseBody(HistoryQuery, query);
		const records = await this.settings.store.listHistory({ ...(area ? { area: area as HistoryArea } : {}), limit });
		return { entries: records.map((record) => ({ id: record.id, at: record.at.toISOString(), actor: record.actor, area: record.area, summary: record.summary, restorable: record.restorable })) };
	}

	// --- providers & keys --------------------------------------------------------------------------------------

	private requireProvider(id: string): void {
		if (!builtinProvider(id) && !(isCompatId(id) && this.settings.compatIds().includes(id))) fail(["id"], "Unknown provider");
	}

	private rowFor(id: string, actor: Actor): ProviderRow {
		return (
			this.settings.row(id) ?? { id, kind: builtinProvider(id) ? "builtin" : "compat", enabled: null, baseUrl: null, options: {}, secret: null, lastTest: null, updatedBy: actor.email, updatedAt: new Date(this.clock()) }
		);
	}

	private secretOf(value: string, slot: string, actor: Actor): StoredSecret {
		return { ...sealSecret(value, secretIkm(this.settings.env), slot), setBy: actor.email, setAt: new Date(this.clock()) };
	}

	async setProvider(id: string, body: unknown, actor: Actor): Promise<SettingsView> {
		const input = parseBody(ProviderBody, body);
		await this.fresh();
		this.requireProvider(id);
		const row = this.rowFor(id, actor);
		const next: ProviderRow = { ...row, updatedBy: actor.email };
		const label = historyName(id);
		const parts: string[] = [];
		if (input.enabled !== undefined && input.enabled !== row.enabled) {
			next.enabled = input.enabled;
			parts.push(`${label} ${input.enabled === null ? "back to default (on)" : input.enabled ? "turned on" : "turned off"}`);
		}
		if (input.baseUrl !== undefined && input.baseUrl !== row.baseUrl) {
			next.baseUrl = input.baseUrl;
			parts.push(`${label} base URL ${input.baseUrl ? `set to ${input.baseUrl}` : "reset"}`);
		}
		if (input.options) {
			if (builtinProvider(id)) fail(["options"], "Only custom endpoints have options");
			const merged = { ...row.options, ...input.options };
			if (JSON.stringify(merged) !== JSON.stringify(row.options)) {
				next.options = merged;
				parts.push(`${label} options changed`);
			}
		}
		if (next.kind === "compat" && !next.baseUrl && !this.settings.overlayVars()[compatEnvName(id, "BASE_URL")]) {
			fail(["baseUrl"], "A custom endpoint needs a base URL");
		}
		if (parts.length === 0) return this.view();
		return this.commit(actor, "providers", parts.join("; "), { providers: { upsert: [next] } });
	}

	async setKey(id: string, body: unknown, actor: Actor): Promise<SettingsView> {
		const { apiKey } = parseBody(KeyBody, body);
		await this.fresh();
		this.requireProvider(id);
		const row = this.rowFor(id, actor);
		const next: ProviderRow = { ...row, secret: this.secretOf(apiKey, `provider:${id}`, actor), lastTest: null, updatedBy: actor.email };
		return this.commit(actor, "keys", `${historyName(id)} key ${row.secret ? "replaced" : "added"}`, { providers: { upsert: [next] } }, false);
	}

	async deleteKey(id: string, actor: Actor): Promise<SettingsView> {
		await this.fresh();
		this.requireProvider(id);
		const row = this.settings.row(id);
		if (!row?.secret) return fail(["id"], "No key is saved in Studio for this provider");
		const next: ProviderRow = { ...row, secret: null, lastTest: null, updatedBy: actor.email };
		return this.commit(actor, "keys", `${historyName(id)} key removed`, { providers: { upsert: [next] } }, false);
	}

	async createEndpoint(body: unknown, actor: Actor): Promise<SettingsView> {
		const input = parseBody(EndpointBody, body);
		await this.fresh();
		const id = `${COMPAT_PREFIX}${input.name}`;
		if (this.settings.compatIds().includes(id)) fail(["name"], "An endpoint with this name already exists");
		const row: ProviderRow = {
			id,
			kind: "compat",
			enabled: null,
			baseUrl: input.baseUrl,
			options: { reasoning: input.reasoning, structuredOutputs: input.structuredOutputs },
			secret: input.apiKey ? this.secretOf(input.apiKey, `provider:${id}`, actor) : null,
			lastTest: null,
			updatedBy: actor.email,
			updatedAt: new Date(this.clock()),
		};
		return this.commit(actor, "endpoints", `Endpoint "${input.name}" added`, { providers: { upsert: [row] } });
	}

	async deleteEndpoint(name: string, actor: Actor): Promise<SettingsView> {
		await this.fresh();
		const id = `${COMPAT_PREFIX}${name}`;
		const row = this.settings.row(id);
		if (!row || row.kind !== "compat") return fail(["name"], "Unknown endpoint (endpoints defined only in the environment cannot be removed here)");
		return this.commit(actor, "endpoints", `Endpoint "${name}" removed`, { providers: { remove: [id] } });
	}

	// --- gateway / routing / tasks / runtime -------------------------------------------------------------------

	async setGateway(body: unknown, actor: Actor): Promise<SettingsView> {
		const input = parseBody(GatewayBody, body);
		await this.fresh();
		const current = this.settings.data().gateway;
		const parts: string[] = [];
		const next: GatewayRow = { baseUrl: current?.baseUrl ?? null, paths: current?.paths ?? {}, token: current?.token ?? null, updatedBy: actor.email, updatedAt: new Date(this.clock()) };
		if (input.baseUrl !== next.baseUrl) {
			next.baseUrl = input.baseUrl;
			parts.push(input.baseUrl ? `Gateway address set to ${input.baseUrl}` : "Gateway address cleared");
		}
		if (input.token !== undefined) {
			parts.push(input.token ? `Gateway token ${next.token ? "replaced" : "added"}` : "Gateway token removed");
			next.token = input.token ? this.secretOf(input.token, "gateway:token", actor) : null;
		}
		if (input.paths) {
			// only what differs from the code default is kept, so the rest follows future defaults
			const paths = Object.fromEntries(Object.entries(input.paths).filter(([id, path]) => path !== GATEWAY_PATHS[id]));
			if (JSON.stringify(paths) !== JSON.stringify(next.paths)) {
				next.paths = paths;
				parts.push("Gateway paths changed");
			}
		}
		if (parts.length === 0) return this.view();
		return this.commit(actor, "gateway", parts.join("; "), { gateway: next });
	}

	async setRouting(body: unknown, actor: Actor): Promise<SettingsView> {
		const { tiers } = parseBody(RoutingBody, body);
		await this.fresh();
		const routing: RoutingStored = { ...this.settings.data().routing };
		// compare with what actually runs now (env values included), so the history says what changed and only that
		const running = buildSettingsView(this.settings).routing.tiers;
		const parts: string[] = [];
		for (const key of Object.keys(tiers) as RoutingKey[]) {
			const wanted = tiers[key];
			if (wanted === undefined) continue;
			const label = TIER_LABEL[key];
			const old = routing[key];
			if (wanted === null) {
				if (old) parts.push(`${label} reset to the environment settings`);
				delete routing[key];
				continue;
			}
			const tier: StoredTier = { chain: wanted.chain, timeoutMs: wanted.timeoutMs ?? null };
			if ("effort" in wanted && wanted.effort !== undefined) tier.effort = wanted.effort;
			if ("format" in wanted && wanted.format) tier.format = wanted.format;
			routing[key] = tier;
			const now = running[key] as { chain: string[]; effort?: string | null; timeoutMs: number; format?: string | null };
			const before = parts.length;
			if (tier.chain.length > 0 && JSON.stringify(now.chain) !== JSON.stringify(tier.chain)) {
				parts.push(`${label} models: ${chainText(tier.chain)} (was ${chainText(now.chain)})`);
			} else if (tier.chain.length === 0 && old?.chain?.length) parts.push(`${label} models back to the environment`);
			if (key !== "image" && tier.effort !== undefined && (now.effort ?? null) !== (tier.effort ?? null)) {
				parts.push(`${label} effort: ${tier.effort ?? "provider default"} (was ${now.effort ?? "provider default"})`);
			}
			if (tier.timeoutMs != null && now.timeoutMs !== tier.timeoutMs) parts.push(`${label} timeout: ${seconds(tier.timeoutMs)} (was ${seconds(now.timeoutMs)})`);
			if (key === "image" && tier.format && (now.format ?? null) !== tier.format) parts.push(`Image format: ${tier.format} (was ${now.format ?? "default"})`);
			if (parts.length === before && JSON.stringify(old ?? null) !== JSON.stringify(tier)) parts.push(`${label} saved in Studio (what runs is unchanged)`);
		}
		if (parts.length === 0) return this.view();
		return this.commit(actor, "routing", parts.join("; "), { routing });
	}

	async setTasks(body: unknown, actor: Actor): Promise<SettingsView> {
		const { overrides } = parseBody(TasksBody, body);
		await this.fresh();
		const current = this.settings.data().tasks;
		const set: Record<string, string> = {};
		const remove: string[] = [];
		const parts: string[] = [];
		for (const [id, tier] of Object.entries(overrides)) {
			if (!(id in TASK_DEFINITIONS)) fail(["overrides", id], "Unknown task");
			if (tier === null) {
				if (id in current) {
					remove.push(id);
					parts.push(`Task ${id} back to its default tier`);
				}
			} else if (current[id] !== tier) {
				set[id] = tier;
				parts.push(`Task ${id} runs on ${TIER_LABEL[tier]}`);
			}
		}
		if (parts.length === 0) return this.view();
		return this.commit(actor, "tasks", parts.join("; "), { tasks: { set, remove } });
	}

	async setRuntime(body: unknown, actor: Actor): Promise<SettingsView> {
		const { values } = parseBody(RuntimeBody, body);
		await this.fresh();
		const stored = { ...this.settings.data().runtime };
		const parts: string[] = [];
		const set: Record<string, unknown> = {};
		const remove: string[] = [];
		for (const [key, value] of Object.entries(values)) {
			const def = runtimeDef(key);
			if (!def) return fail(["values", key], "Unknown setting");
			const before = this.settings.runtimeEffective(def).value;
			if (value === null) {
				if (key in stored) {
					remove.push(key);
					delete stored[key];
					parts.push(`${def.label} back to ${this.settings.runtimeEffective(def, null).source === "env" ? "the environment value" : "the default"}`);
				}
				continue;
			}
			const problem = runtimeValueError(def, value);
			if (problem) fail(["values", key], problem);
			if (stored[key] !== value) {
				set[key] = value;
				stored[key] = value;
				parts.push(`${def.label}: ${before} → ${value}`);
			}
		}
		const after = (key: string) => this.settings.runtimeEffective(RUNTIME_DEFS.find((def) => def.key === key) as (typeof RUNTIME_DEFS)[number], stored[key] ?? null).value as number;
		if (after("queueMaxWaitMs") + after("runBudgetMs") > REQUEST_BUDGET_MS) {
			fail(["values", "queueMaxWaitMs" in values ? "queueMaxWaitMs" : "runBudgetMs"], `Queue wait plus run budget must stay within ${REQUEST_BUDGET_MS} ms`);
		}
		if (parts.length === 0) return this.view();
		return this.commit(actor, "runtime", parts.join("; "), { runtime: { set, remove } });
	}

	// --- history -----------------------------------------------------------------------------------------------

	async restore(id: string, actor: Actor): Promise<SettingsView> {
		await this.fresh();
		const entry = await this.settings.store.getHistory(id);
		if (!entry) return fail(["id"], "Unknown history entry");
		if (!entry.restorable) return fail(["id"], "This entry cannot be restored (saved keys are never restored)");
		const change = changeToRestore(entry.snapshot, this.settings.data(), actor.email);
		if (!change) return fail(["id"], "This entry has no usable snapshot");
		const day = entry.at.toISOString().slice(0, 16).replace("T", " ");
		return this.commit(actor, "restore", `Restored the settings as of ${day} UTC (${entry.summary})`, change);
	}

	// --- connection test ---------------------------------------------------------------------------------------

	async test(id: string, body: unknown): Promise<TestResult> {
		const input = parseBody(TestBody, body);
		await this.fresh();
		this.requireProvider(id);
		const now = this.clock();
		const recent = (this.tests.get(id) ?? []).filter((at) => now - at < TEST_WINDOW_MS);
		if (recent.length >= TEST_LIMIT) throw new TestRateLimitedError();
		this.tests.set(id, [...recent, now]);
		const result = await this.tester.run(id, input);
		// a key that is not saved is tested, never remembered
		if (!input.apiKey) {
			const row = this.settings.row(id);
			const next: ProviderRow = row ? { ...row, lastTest: result } : { id, kind: builtinProvider(id) ? "builtin" : "compat", enabled: null, baseUrl: null, options: {}, secret: null, lastTest: result, updatedBy: null, updatedAt: new Date(now) };
			await this.settings.store.apply({ providers: { upsert: [next] } });
			await this.settings.reloadAfterWrite();
		}
		return result;
	}

	// --- plumbing ----------------------------------------------------------------------------------------------

	private async fresh(): Promise<void> {
		await this.settings.reloadAfterWrite();
	}

	private async commit(actor: Actor, area: HistoryArea, summary: string, change: SettingsChange, restorable = true): Promise<SettingsView> {
		const at = new Date(this.clock());
		const after = applyChange(this.settings.data(), change, at);
		await this.settings.store.apply(change, { id: this.newId(), at, actor, area, summary: summary.slice(0, 500), snapshot: snapshotOf(after), restorable });
		await this.settings.reloadAfterWrite();
		return buildSettingsView(this.settings);
	}
}

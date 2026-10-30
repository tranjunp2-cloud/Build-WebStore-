import { knownPricedModels } from "../ledger/price-book";
import { DEFAULT_TIER_EFFORT, parseModelChain } from "../models/model-registry";
import { createImageFactory, createProviderFactory, envKey, GATEWAY_PATHS } from "../models/providers";
import { TASK_DEFINITIONS } from "../tasks/catalog";
import { BUILTIN_PROVIDERS, builtinProvider, compatEnvName, providerLabel } from "./provider-catalog";
import { RUNTIME_DEFS } from "./runtime-keys";
import type { SettingsService } from "./settings.service";
import {
	type HealthView,
	type ImageTierView,
	type ProviderView,
	ROUTING_KEYS,
	type RoutingKey,
	type SettingsView,
	type SkipReason,
	type Source,
	TIER_NAMES,
	type TierName,
	type TierView,
} from "./settings-types";

const isoOrNull = (date: Date | null | undefined) => (date ? date.toISOString() : null);
const IMAGE_PROVIDERS = new Set(["openai", "google"]);

function refsOf(chain: string): string[] {
	try {
		return parseModelChain(chain).map((ref) => `${ref.provider}:${ref.modelId}`);
	} catch {
		return [];
	}
}

/** Why a chain member cannot serve right now, or null when it can. Mirrors what the registry skips. */
export function skipReason(settings: SettingsService, provider: string, modelId: string, image: boolean): SkipReason | null {
	if (provider === "mock") return settings.env.NODE_ENV === "production" ? "unknown-provider" : null;
	const builtin = builtinProvider(provider);
	const known = builtin ? builtin.chat : settings.compatIds().includes(provider);
	if (!known || (image && !IMAGE_PROVIDERS.has(provider) && !provider.startsWith("compat-"))) return "unknown-provider";
	if (!settings.isProviderEnabled(provider)) return "disabled";
	const providerEnv = settings.providerEnv();
	const usable = image ? createImageFactory(provider, providerEnv) : createProviderFactory(provider, providerEnv);
	if (!usable) return settings.keyInfo(provider).state === "needs-reentry" ? "needs-reentry" : "no-key";
	const test = settings.row(provider)?.lastTest;
	if (test && !test.ok && (test.code !== "not-found" || test.model === modelId)) return "last-test-failed";
	return null;
}

function healthOf(settings: SettingsService, key: RoutingKey): HealthView {
	const skipped: HealthView["skipped"] = [];
	let serving: string | null = null;
	let first = false;
	const candidates = settings.chainCandidates(key);
	// like the registry: the first chain that has a usable member serves; later chains are not consulted
	for (const [chainIndex, candidate] of candidates.entries()) {
		for (const [index, ref] of refsOf(candidate.chain).entries()) {
			const provider = ref.slice(0, ref.indexOf(":"));
			const reason = skipReason(settings, provider, ref.slice(provider.length + 1), key === "image");
			if (reason) skipped.push({ model: ref, reason });
			else if (!serving) {
				serving = ref;
				first = chainIndex === 0 && index === 0;
			}
		}
		if (serving) break;
	}
	return { serving, state: serving ? (first ? "first-choice" : "fallback") : "down", skipped };
}

function tierView(settings: SettingsService, alias: TierName): TierView {
	const [chain] = settings.chainCandidates(alias);
	const studio = settings.studioEffort(alias);
	const envEffort = settings.env[({ fast: "AI_EFFORT_FAST", balanced: "AI_EFFORT_BALANCED", quality: "AI_EFFORT_QUALITY" } as const)[alias]];
	const timeout = settings.runtimeEffective(RUNTIME_DEFS.find((def) => def.key === "modelTimeoutMs") as (typeof RUNTIME_DEFS)[number]);
	const studioTimeout = settings.studioTier(alias)?.timeoutMs;
	return {
		chain: refsOf(chain?.chain ?? ""),
		chainSource: chain?.source ?? "none",
		effort: studio ? studio.value : (envEffort ?? DEFAULT_TIER_EFFORT[alias]),
		effortSource: studio ? "studio" : envEffort ? "env" : "default",
		timeoutMs: studioTimeout ?? settings.tierTimeoutMs(alias),
		timeoutSource: studioTimeout != null ? "studio" : timeout.source,
	};
}

function imageView(settings: SettingsService): ImageTierView {
	const [chain] = settings.chainCandidates("image");
	const studio = settings.studioTier("image");
	const envTimeoutSet = Boolean(settings.vars.AI_IMAGE_TIMEOUT_MS?.trim()) || settings.env.AI_IMAGE_TIMEOUT_MS !== 150_000;
	const format = settings.imageFormat() ?? null;
	const formatSource: Source = studio?.format ? "studio" : settings.env.AI_IMAGE_OUTPUT_FORMAT ? "env" : format ? "default" : "none";
	return {
		chain: refsOf(chain?.chain ?? ""),
		chainSource: chain?.source ?? "none",
		timeoutMs: settings.imageTimeoutMs(),
		timeoutSource: studio?.timeoutMs != null ? "studio" : envTimeoutSet ? "env" : "default",
		format,
		formatSource,
	};
}

function modelsOf(settings: SettingsService, id: string, chainRefs: string[]): string[] {
	const prefix = `${id}:`;
	const found = new Set<string>();
	for (const ref of [...knownPricedModels(), ...chainRefs]) if (ref.startsWith(prefix)) found.add(ref.slice(prefix.length));
	for (const model of builtinProvider(id)?.catalog ?? []) found.add(model);
	for (const model of settings.row(id)?.lastTest?.models ?? []) found.add(model);
	return [...found].sort();
}

function providerView(settings: SettingsService, id: string, chainRefs: string[]): ProviderView {
	const builtin = builtinProvider(id);
	const row = settings.row(id);
	const key = settings.keyInfo(id);
	const vars = settings.vars;
	const envBaseUrl = (builtin ? vars[builtin.baseUrlEnv] : vars[compatEnvName(id, "BASE_URL")])?.trim() || null;
	const studioBaseUrl = row?.baseUrl ?? null;
	const defaultBaseUrl = builtin?.defaultBaseUrl ?? null;
	const baseUrl = studioBaseUrl ?? envBaseUrl ?? defaultBaseUrl;
	const baseUrlSource: Source = studioBaseUrl ? "studio" : envBaseUrl ? "env" : defaultBaseUrl ? "default" : "none";
	const options = builtin
		? {}
		: {
				reasoning: row?.options.reasoning ?? vars[compatEnvName(id, "REASONING")] === "true",
				structuredOutputs: row?.options.structuredOutputs ?? vars[compatEnvName(id, "STRUCTURED_OUTPUTS")] !== "false",
			};
	return {
		id,
		label: providerLabel(id),
		kind: builtin ? "builtin" : "compat",
		enabled: row?.enabled !== false,
		enabledSource: row?.enabled != null ? "studio" : "default",
		key: { state: key.state, last4: key.state === "env" ? null : key.last4, setBy: key.setBy, setAt: isoOrNull(key.setAt) },
		baseUrl,
		baseUrlSource,
		defaultBaseUrl,
		options,
		lastTest: row?.lastTest ?? null,
		models: modelsOf(settings, id, chainRefs),
	};
}

/** Task id prefix → the group name an admin reads in Studio. */
const TASK_GROUPS: Record<string, string> = {
	content: "Content",
	copy: "Copywriting",
	seo: "SEO",
	i18n: "Translation",
	catalog: "Catalog",
	site: "Site info",
	sitegen: "Website setup",
	migration: "Migration from PW1",
};
/** Words a plain id-to-text conversion gets wrong. */
const TASK_WORDS: Record<string, string> = { seo: "SEO", pw1: "", ai: "AI", url: "URL" };

function taskViews(settings: SettingsService): SettingsView["tasks"] {
	const overrides = settings.data().tasks;
	return Object.entries(TASK_DEFINITIONS).map(([id, definition]) => {
		const [prefix = id, ...rest] = id.split(".");
		const words = (rest.join("-") || prefix).split(/[-_]/).map((word) => TASK_WORDS[word] ?? word).filter(Boolean);
		const text = words.join(" ");
		const label = text.charAt(0).toUpperCase() + text.slice(1);
		return { id, group: TASK_GROUPS[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1), label, defaultTier: definition.alias, override: overrides[id] ?? null };
	});
}

function gatewayView(settings: SettingsService): SettingsView["gateway"] {
	const studio = settings.data().gateway;
	const envBaseUrl = settings.vars.AI_GATEWAY_BASE_URL?.trim() || settings.env.AI_GATEWAY_BASE_URL || null;
	const token = settings.gatewayToken();
	const paths: Record<string, string> = {};
	for (const provider of BUILTIN_PROVIDERS) {
		const path = studio?.paths[provider.id] ?? settings.vars[`AI_GATEWAY_PATH_${envKey(provider.id)}`]?.trim() ?? GATEWAY_PATHS[provider.id];
		if (path) paths[provider.id] = path;
	}
	return {
		baseUrl: studio?.baseUrl ?? envBaseUrl,
		tokenSet: token.value !== null,
		paths,
		source: studio?.baseUrl ? "studio" : envBaseUrl ? "env" : "none",
	};
}

/** The whole Studio picture: what is in effect (and where each value comes from), health per tier, tasks, runtime knobs. Never a secret. */
export function buildSettingsView(settings: SettingsService): SettingsView {
	const chainRefs = ROUTING_KEYS.flatMap((key) => settings.chainCandidates(key).flatMap((candidate) => refsOf(candidate.chain)));
	const ids = [...BUILTIN_PROVIDERS.map((provider) => provider.id), ...settings.compatIds()];
	const tiers = Object.fromEntries(TIER_NAMES.map((alias) => [alias, tierView(settings, alias)])) as Record<TierName, TierView>;
	return {
		updatedAt: isoOrNull(settings.data().updatedAt),
		providers: ids.map((id) => providerView(settings, id, chainRefs)),
		gateway: gatewayView(settings),
		routing: { tiers: { ...tiers, image: imageView(settings) } },
		health: Object.fromEntries(ROUTING_KEYS.map((key) => [key, healthOf(settings, key)])) as SettingsView["health"],
		tasks: taskViews(settings),
		runtime: RUNTIME_DEFS.map((def) => {
			const effective = settings.runtimeEffective(def);
			return {
				key: def.key,
				label: def.label,
				help: def.help,
				type: def.type,
				...(def.min !== undefined ? { min: def.min } : {}),
				...(def.max !== undefined ? { max: def.max } : {}),
				...(def.options ? { options: def.options } : {}),
				value: effective.value,
				source: effective.source,
				default: effective.default,
				envName: def.envName,
			};
		}),
	};
}

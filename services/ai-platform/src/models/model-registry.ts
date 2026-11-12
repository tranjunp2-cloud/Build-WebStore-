import type { ImageModel, LanguageModel } from "ai";
import type { Env } from "../config/env";
import { createDevCopilotModel } from "./dev-copilot-model";
import type { SettingsService } from "../settings/settings.service";
import { acceptsReasoningEffort, createImageFactory, createProviderFactory, type ProviderEnv, type ProviderFactory, type ReasoningEffort, withReasoningEffort } from "./providers";

/** Features ask for a capability tier, never for a model id. */
/** `quality` is the site generator's tier (whole-page JSON from long composed prompts). */
export type ModelAlias = "fast" | "balanced" | "quality";

export interface ResolvedModel {
	model: LanguageModel;
	provider: string;
	modelId: string;
}

export interface ResolvedImageModel {
	model: ImageModel;
	provider: string;
	modelId: string;
}

export interface ModelRegistry {
	/**
	 * Ordered fallback chain for an alias — only providers configured here. `effort` replaces the tier's
	 * effort for this call (a task whose long JSON answer must fit its token limit runs without thinking).
	 */
	resolveChain(alias: ModelAlias, options?: { effort?: ReasoningEffort }): ResolvedModel[];
	/** Picture models (`AI_MODEL_IMAGE`), configured providers only; empty = generation off. */
	resolveImageChain?(): ResolvedImageModel[];
}

/**
 * Tier efforts when AI_EFFORT_* is unset: no thinking for the small fast tasks (a tiny JSON answer gains nothing from
 * adaptive thinking, and Claude's thinking made it slow and sometimes unparsable), deeper for the copilot and site generation.
 */
export const DEFAULT_TIER_EFFORT: Record<ModelAlias, ReasoningEffort> = { fast: "none", balanced: "medium", quality: "high" };

export class ModelUnavailableError extends Error {}

export function parseModelChain(value: string): { provider: string; modelId: string }[] {
	return value
		.split(",")
		.map((ref) => ref.trim())
		.filter(Boolean)
		.map((ref) => {
			const index = ref.indexOf(":");
			if (index <= 0 || index === ref.length - 1) throw new Error(`Invalid model ref "${ref}" (expected provider:model).`);
			return { provider: ref.slice(0, index), modelId: ref.slice(index + 1) };
		});
}

/**
 * `AI_MODEL_<ALIAS>` is a comma-separated chain, e.g.
 * `openai:gpt-4.1-mini, anthropic:claude-haiku-4-5, compat-sealion:sea-lion-v4`.
 * Candidates without credentials in this environment are skipped.
 *
 * With `settings` (Prime Studio), provider credentials, endpoints and the gateway come from the env vars overlaid
 * with Studio's values, disabled providers are skipped, and a tier's chain / effort come from Studio first
 * (then Payload's `models`, then env). Provider factories are rebuilt when the settings change.
 */
export function createModelRegistry(
	env: Env,
	vars: Record<string, string | undefined> = process.env,
	/** Prime-web's model chains (Payload); they replace the env chain of an alias when present. */
	config?: { models(): Partial<Record<ModelAlias | "image", string>> },
	settings?: SettingsService,
): ModelRegistry {
	let cached: { version: number; vars: Record<string, string | undefined>; providerEnv: ProviderEnv; factories: Map<string, ProviderFactory> } | null = null;
	const state = () => {
		settings?.data(); // a stale copy starts its background refresh
		const version = settings?.version() ?? 0;
		if (!cached || cached.version !== version) {
			const current = settings ? settings.overlayVars() : vars;
			const providerEnv = settings ? settings.providerEnv(current) : { gatewayBaseUrl: env.AI_GATEWAY_BASE_URL, gatewayToken: env.AI_GATEWAY_TOKEN, vars: current };
			cached = { version, vars: current, providerEnv, factories: new Map() };
		}
		return cached;
	};
	const enabled = (provider: string) => settings?.isProviderEnabled(provider) ?? true;
	const factoryFor = (provider: string) => {
		if (!enabled(provider)) return null;
		const current = state();
		if (!current.factories.has(provider)) current.factories.set(provider, createProviderFactory(provider, current.providerEnv));
		return current.factories.get(provider) ?? null;
	};
	const envChains: Record<ModelAlias | "image", string> = {
		fast: env.AI_MODEL_FAST,
		balanced: env.AI_MODEL_BALANCED,
		quality: env.AI_MODEL_QUALITY,
		image: env.AI_MODEL_IMAGE,
	};
	const efforts: Record<ModelAlias, Env["AI_EFFORT_FAST"]> = { fast: env.AI_EFFORT_FAST, balanced: env.AI_EFFORT_BALANCED, quality: env.AI_EFFORT_QUALITY };
	/** The effort a candidate gets: Studio's, else the env value, else the tier default (DeepSeek only on an explicit value). */
	const effortFor = (alias: ModelAlias, provider: string): ReasoningEffort | undefined => {
		const studio = settings?.studioEffort(alias);
		const explicit = studio ? (studio.value ?? "default") : efforts[alias];
		if (explicit === "default") return undefined;
		if (explicit) return explicit as ReasoningEffort;
		return provider === "deepseek" ? undefined : DEFAULT_TIER_EFFORT[alias];
	};
	// resolved per call from the current config; parsed chains are memoized by their string
	const parsed = new Map<string, { provider: string; modelId: string }[]>();
	const parseChain = (value: string) => {
		let chain = parsed.get(value);
		if (!chain) {
			chain = parseModelChain(value);
			parsed.set(value, chain);
		}
		return chain;
	};
	/** Studio's chain first, then Payload's, then the env chain: a chain naming only providers this environment lacks must not turn AI off. */
	const chainsFor = (alias: ModelAlias | "image") => {
		const studio = settings?.studioTier(alias)?.chain ?? [];
		const wanted = [studio.length > 0 ? studio.join(", ") : undefined, config?.models()[alias], envChains[alias]];
		return wanted.filter((value, index): value is string => Boolean(value) && wanted.indexOf(value) === index).map(parseChain);
	};
	const resolveLanguage = (alias: ModelAlias, chain: { provider: string; modelId: string }[], effortOverride?: ReasoningEffort) => {
		const resolved: ResolvedModel[] = [];
		for (const { provider, modelId } of chain) {
			if (provider === "mock") {
				if (env.NODE_ENV !== "production") resolved.push({ model: createDevCopilotModel(), provider, modelId });
				continue;
			}
			const factory = factoryFor(provider);
			if (!factory) continue;
			const effort = effortOverride ?? effortFor(alias, provider);
			const model = factory(modelId);
			const applyEffort = effort != null && acceptsReasoningEffort(provider, modelId, state().vars);
			resolved.push({ model: applyEffort ? withReasoningEffort(model, provider, effort) : model, provider, modelId });
		}
		return resolved;
	};

	return {
		resolveChain(alias, options) {
			for (const chain of chainsFor(alias)) {
				const resolved = resolveLanguage(alias, chain, options?.effort);
				if (resolved.length > 0) return resolved;
			}
			throw new ModelUnavailableError(`No configured provider for model alias "${alias}".`);
		},
		resolveImageChain() {
			for (const chain of chainsFor("image")) {
				const resolved = chain.flatMap(({ provider, modelId }) => {
					const factory = enabled(provider) ? createImageFactory(provider, state().providerEnv) : null;
					return factory ? [{ model: factory(modelId), provider, modelId }] : [];
				});
				if (resolved.length > 0) return resolved;
			}
			return [];
		},
	};
}

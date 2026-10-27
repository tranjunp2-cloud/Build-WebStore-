import type { ImageModel, LanguageModel } from "ai";
import type { Env } from "../config/env";
import { createDevCopilotModel } from "./dev-copilot-model";
import { createImageFactory, createProviderFactory, type ProviderFactory } from "./providers";

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
	/** Ordered fallback chain for an alias — only providers configured here. */
	resolveChain(alias: ModelAlias): ResolvedModel[];
	/** Picture models (`AI_MODEL_IMAGE`), configured providers only; empty = generation off. */
	resolveImageChain?(): ResolvedImageModel[];
}

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
 */
export function createModelRegistry(
	env: Env,
	vars: Record<string, string | undefined> = process.env,
	/** Prime-web's model chains (Payload); they replace the env chain of an alias when present. */
	config?: { models(): Partial<Record<ModelAlias | "image", string>> },
): ModelRegistry {
	const providerEnv = { gatewayBaseUrl: env.AI_GATEWAY_BASE_URL, gatewayToken: env.AI_GATEWAY_TOKEN, vars };
	const factories = new Map<string, ProviderFactory>();
	const factoryFor = (provider: string) => {
		if (!factories.has(provider)) factories.set(provider, createProviderFactory(provider, providerEnv));
		return factories.get(provider) ?? null;
	};
	const envChains: Record<ModelAlias | "image", string> = {
		fast: env.AI_MODEL_FAST,
		balanced: env.AI_MODEL_BALANCED,
		quality: env.AI_MODEL_QUALITY,
		image: env.AI_MODEL_IMAGE,
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
	/** Payload's chain first, then the env chain: Payload naming only providers this environment lacks must not turn AI off. */
	const chainsFor = (alias: ModelAlias | "image") => {
		const override = config?.models()[alias];
		return override && override !== envChains[alias] ? [parseChain(override), parseChain(envChains[alias])] : [parseChain(envChains[alias])];
	};
	const resolveLanguage = (chain: { provider: string; modelId: string }[]) => {
		const resolved: ResolvedModel[] = [];
		for (const { provider, modelId } of chain) {
			if (provider === "mock") {
				if (env.NODE_ENV !== "production") resolved.push({ model: createDevCopilotModel(), provider, modelId });
				continue;
			}
			const factory = factoryFor(provider);
			if (factory) resolved.push({ model: factory(modelId), provider, modelId });
		}
		return resolved;
	};

	return {
		resolveChain(alias) {
			for (const chain of chainsFor(alias)) {
				const resolved = resolveLanguage(chain);
				if (resolved.length > 0) return resolved;
			}
			throw new ModelUnavailableError(`No configured provider for model alias "${alias}".`);
		},
		resolveImageChain() {
			for (const chain of chainsFor("image")) {
				const resolved = chain.flatMap(({ provider, modelId }) => {
					const factory = createImageFactory(provider, providerEnv);
					return factory ? [{ model: factory(modelId), provider, modelId }] : [];
				});
				if (resolved.length > 0) return resolved;
			}
			return [];
		},
	};
}

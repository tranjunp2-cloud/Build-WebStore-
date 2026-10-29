import type { ImageModel, LanguageModel } from "ai";
import type { Env } from "../config/env";
import { createDevCopilotModel } from "./dev-copilot-model";
import { createImageFactory, createProviderFactory, type ProviderFactory, acceptsReasoningEffort, withReasoningEffort } from "./providers";

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
export function createModelRegistry(env: Env, vars: Record<string, string | undefined> = process.env): ModelRegistry {
	const providerEnv = { gatewayBaseUrl: env.AI_GATEWAY_BASE_URL, gatewayToken: env.AI_GATEWAY_TOKEN, vars };
	const factories = new Map<string, ProviderFactory>();
	const factoryFor = (provider: string) => {
		if (!factories.has(provider)) factories.set(provider, createProviderFactory(provider, providerEnv));
		return factories.get(provider) ?? null;
	};
	const chains: Record<ModelAlias, string> = { fast: env.AI_MODEL_FAST, balanced: env.AI_MODEL_BALANCED, quality: env.AI_MODEL_QUALITY };
	const efforts: Record<ModelAlias, Env["AI_EFFORT_FAST"]> = { fast: env.AI_EFFORT_FAST, balanced: env.AI_EFFORT_BALANCED, quality: env.AI_EFFORT_QUALITY };

	return {
		resolveChain(alias) {
			const resolved: ResolvedModel[] = [];
			for (const { provider, modelId } of parseModelChain(chains[alias])) {
				if (provider === "mock") {
					if (env.NODE_ENV !== "production") resolved.push({ model: createDevCopilotModel(), provider, modelId });
					continue;
				}
				const factory = factoryFor(provider);
				if (!factory) continue;
				const effort = efforts[alias];
				const model = factory(modelId);
				const applyEffort = effort != null && acceptsReasoningEffort(provider, modelId, vars);
				resolved.push({ model: applyEffort ? withReasoningEffort(model, provider, effort) : model, provider, modelId });
			}
			if (resolved.length === 0) {
				throw new ModelUnavailableError(`No configured provider for model alias "${alias}".`);
			}
			return resolved;
		},
		resolveImageChain() {
			return parseModelChain(env.AI_MODEL_IMAGE).flatMap(({ provider, modelId }) => {
				const factory = createImageFactory(provider, providerEnv);
				return factory ? [{ model: factory(modelId), provider, modelId }] : [];
			});
		},
	};
}

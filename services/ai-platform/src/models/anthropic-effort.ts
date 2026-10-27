import type { ModelAlias, ResolvedModel } from "./model-registry";

type Effort = "low" | "medium";

/** Cheapest sensible thinking effort per tier; quality (site generation) keeps the model's default. */
const EFFORT_BY_ALIAS: Partial<Record<ModelAlias, Effort>> = { fast: "low", balanced: "medium" };

/**
 * Claude Haiku 5.5 / Sonnet 5.5 think adaptively on every call; `effort` is the only lever (the SDK
 * drops `budgetTokens` and `thinking: disabled` for them, so neither is ever sent). Other providers
 * and older Claude models get no options.
 */
export function anthropicEffortOptions(
	model: Pick<ResolvedModel, "provider" | "modelId">,
	alias: ModelAlias,
): { providerOptions?: { anthropic: { effort: Effort } } } {
	const effort = EFFORT_BY_ALIAS[alias];
	if (!effort || model.provider !== "anthropic" || !/claude-(?:haiku|sonnet)-5-5/.test(model.modelId)) return {};
	return { providerOptions: { anthropic: { effort } } };
}

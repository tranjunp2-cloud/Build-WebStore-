import type { SystemModelMessage } from "ai";

/**
 * System instructions in the shape that caches best on each provider.
 * DeepSeek, OpenAI and Gemini cache identical prompt prefixes implicitly, so
 * the text goes as-is. Anthropic only caches up to an explicit breakpoint: the
 * system message carries `cache_control: ephemeral`, which caches tools +
 * system (prompts under the model's minimum cacheable length are just not cached).
 */
export function cacheableInstructions(text: string, provider: string): string | SystemModelMessage {
	if (provider !== "anthropic") return text;
	return { role: "system", content: text, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } };
}

import type { ModelMessage, SystemModelMessage } from "ai";

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

/**
 * The run's history with Anthropic's second breakpoint on its newest message, so each later step and
 * model call reads everything before it from the cache instead of paying for it again (the system
 * breakpoint only covers tools + system). Older breakpoints are removed: Anthropic allows four, and the
 * cache finds an earlier prefix by itself. Other providers cache prefixes implicitly: unchanged.
 */
export function cacheableHistory(messages: ModelMessage[], provider: string): ModelMessage[] {
	if (provider !== "anthropic" || messages.length === 0) return messages;
	const last = messages.length - 1;
	return messages.map((message, index) => {
		const anthropic = message.providerOptions?.anthropic as Record<string, unknown> | undefined;
		if (index !== last && !anthropic?.cacheControl) return message;
		const { cacheControl: _old, ...rest } = anthropic ?? {};
		const next = index === last ? { ...rest, cacheControl: { type: "ephemeral" } } : rest;
		return { ...message, providerOptions: { ...message.providerOptions, anthropic: next } } as ModelMessage;
	});
}

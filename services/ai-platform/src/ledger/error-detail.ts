import { describeModelError } from "../models/fallback";

/** Longest error detail kept on a usage row (Studio / Payload show it as is). */
export const MAX_ERROR_DETAIL = 400;

/** Key-like strings a provider may echo back in its error ("Incorrect API key provided: sk-…"). */
const SECRETS: ReadonlyArray<[RegExp, string]> = [
	[/\bsk-[A-Za-z0-9_-]{8,}/g, "sk-[redacted]"],
	[/\bAIza[0-9A-Za-z_-]{20,}/g, "AIza[redacted]"],
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
	[/\b(api[_-]?key|access[_-]?token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1$2[redacted]"],
];

/** `text` with key-like strings masked, on one line, at most MAX_ERROR_DETAIL characters. */
export function redactErrorDetail(text: string): string {
	let out = text.replace(/\s+/g, " ").trim();
	for (const [pattern, replacement] of SECRETS) out = out.replace(pattern, replacement);
	return out.length > MAX_ERROR_DETAIL ? `${out.slice(0, MAX_ERROR_DETAIL - 1)}…` : out;
}

/**
 * Why a call or run failed, for the usage row: error name, HTTP status and the provider's message
 * (e.g. "AI_APICallError 400: This model does not support assistant message prefill"). Never the prompt.
 */
export function errorDetailOf(error: unknown): string {
	return redactErrorDetail(describeModelError(error));
}

import { generateText, type LanguageModel } from "ai";
import { wrongReplyLanguage } from "./message-language";

export const REPLY_LANGUAGE_TASK = "agent.reply-language";

/** A one-off rewrite on the FAST model: it never holds the stream open for long. */
export const REPLY_LANGUAGE_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 700;
/** A rewrite much longer than the reply is the model talking, not translating. */
const MAX_GROWTH = 2.5;

export const REPLY_LANGUAGE_SYSTEM = [
	"You fix the language of a shop assistant's reply to a shop owner.",
	"Rewrite the reply the user sends in the language they name. Keep the meaning, the order, the length, every number, name, product name and quoted text exactly; keep line breaks and markdown.",
	"Do not add, explain or answer anything. Reply with the rewritten text only.",
].join(" ");

export interface RewrittenReply {
	text: string;
	inputTokens?: number;
	outputTokens?: number;
}

/**
 * The reply the merchant would have got had the model followed the language of their message. Only when the
 * model's reply is clearly in another language than the message (see `wrongReplyLanguage`): one call, no tools,
 * on the fast model. Returns null when the reply is fine, or the rewrite failed or is not clearly better: the
 * original reply is then kept (a wrong language beats no reply).
 */
export async function replyInLanguageOf(options: {
	prompt: string;
	reply: string;
	model: LanguageModel;
	abortSignal?: AbortSignal;
}): Promise<RewrittenReply | null> {
	const wanted = wrongReplyLanguage(options.prompt, options.reply);
	if (wanted === null) return null;
	const result = await generateText({
		model: options.model,
		instructions: REPLY_LANGUAGE_SYSTEM,
		messages: [{ role: "user", content: `Language: ${wanted}\n\nReply to rewrite:\n${options.reply}` }],
		maxOutputTokens: MAX_OUTPUT_TOKENS,
		timeout: { totalMs: REPLY_LANGUAGE_TIMEOUT_MS },
		maxRetries: 0,
		...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
	});
	const text = result.text.trim();
	const usage = { inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens };
	if (!text || text.length > options.reply.length * MAX_GROWTH + 40) return null;
	// still clearly in the wrong language: no better than the original
	if (wrongReplyLanguage(options.prompt, text) !== null) return null;
	return { text, ...usage };
}

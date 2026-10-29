import type { ModelMessage } from "ai";

/**
 * Tool calls of the run that never got a result. The model API refuses the
 * next call when one is left open (`AI_MissingToolResultsError`): the merchant
 * answered the question card and the run died with "The AI could not complete
 * this request". It happens when the model asked twice in one step (only the
 * first `ask_user` is answered) or asked after it had already staged a draft.
 */
export function openToolCalls(messages: readonly ModelMessage[]): Array<{ toolCallId: string; toolName: string }> {
	const answered = new Set<string>();
	const calls: Array<{ toolCallId: string; toolName: string }> = [];
	for (const message of messages) {
		if (!Array.isArray(message.content)) continue;
		for (const part of message.content as Array<{ type: string; toolCallId?: string; toolName?: string }>) {
			if (part.type === "tool-call" && part.toolCallId) calls.push({ toolCallId: part.toolCallId, toolName: part.toolName ?? "" });
			if (part.type === "tool-result" && part.toolCallId) answered.add(part.toolCallId);
		}
	}
	return calls.filter((call) => !answered.has(call.toolCallId));
}

/** A tool result for every open call, telling the model why it got none (appended in place). */
export function closeOpenToolCalls(messages: ModelMessage[], why: (call: { toolCallId: string; toolName: string }) => string): number {
	const open = openToolCalls(messages);
	if (open.length === 0) return 0;
	messages.push({
		role: "tool",
		content: open.map((call) => ({
			type: "tool-result" as const,
			toolCallId: call.toolCallId,
			toolName: call.toolName,
			output: { type: "error-text" as const, value: why(call) },
		})),
	});
	return open.length;
}

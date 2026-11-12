import { type LanguageModelUsage, NoObjectGeneratedError } from "ai";
import type { TokenUsage } from "./price-book";

/** The ledger's token columns from an AI SDK usage (cache reads and writes are shares of the input total). */
export function tokenUsageOf(usage: LanguageModelUsage | undefined): TokenUsage {
	if (!usage) return {};
	return {
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
		cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens,
	};
}

/** What a failed model call still billed, when the error carries it (a reply that did not match the schema). */
export function errorUsage(error: unknown): TokenUsage {
	return NoObjectGeneratedError.isInstance(error) ? tokenUsageOf(error.usage) : {};
}

/** Tokens of the steps a failed attempt finished before it threw (each step was billed). */
export class UsageTally {
	private usage: Required<TokenUsage> = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, images: 0 };
	private seen = false;

	add(step: LanguageModelUsage | undefined): void {
		if (!step) return;
		this.seen = true;
		const u = tokenUsageOf(step);
		this.usage.inputTokens += u.inputTokens ?? 0;
		this.usage.outputTokens += u.outputTokens ?? 0;
		this.usage.cachedInputTokens += u.cachedInputTokens ?? 0;
		this.usage.cacheWriteTokens += u.cacheWriteTokens ?? 0;
	}

	/** The finished steps' usage, else what the error itself carries; empty when nothing was billed. */
	forFailure(error: unknown): TokenUsage {
		if (!this.seen) return errorUsage(error);
		const { images: _images, ...tokens } = this.usage;
		return tokens;
	}
}

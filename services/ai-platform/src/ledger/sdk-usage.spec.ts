import { NoObjectGeneratedError } from "ai";
import { describe, expect, it } from "vitest";
import { errorUsage, tokenUsageOf, UsageTally } from "./sdk-usage";

// TC-AIPRC-06 — what the ledger reads from the AI SDK, and what a failed attempt still billed.

const usage = (input: number, output: number, read?: number, write?: number) =>
	({
		inputTokens: input,
		outputTokens: output,
		totalTokens: input + output,
		inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: read, cacheWriteTokens: write },
		outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
	}) as never;

describe("tokenUsageOf", () => {
	it("reads input, output, cache reads and cache writes", () => {
		expect(tokenUsageOf(usage(100, 20, 30, 40))).toEqual({ inputTokens: 100, outputTokens: 20, cachedInputTokens: 30, cacheWriteTokens: 40 });
		expect(tokenUsageOf(undefined)).toEqual({});
	});
});

describe("failed attempts [TC-AIPRC-06]", () => {
	const noObject = (u?: ReturnType<typeof usage>) =>
		new NoObjectGeneratedError({ message: "bad", response: { id: "r", timestamp: new Date(), modelId: "m" }, usage: u as never, finishReason: "stop" });

	it("NoObjectGeneratedError carries what the provider billed", () => {
		expect(errorUsage(noObject(usage(500, 80, 0, 450)))).toMatchObject({ inputTokens: 500, outputTokens: 80, cacheWriteTokens: 450 });
	});

	it("other errors carry nothing", () => {
		expect(errorUsage(new Error("boom"))).toEqual({});
	});

	it("the tally sums finished steps and wins over the error's usage; empty falls to the error", () => {
		const tally = new UsageTally();
		expect(tally.forFailure(new Error("x"))).toEqual({});
		expect(tally.forFailure(noObject(usage(7, 1)))).toMatchObject({ inputTokens: 7 });
		tally.add(usage(100, 10, 20, 30));
		tally.add(usage(200, 5, 50, 0));
		expect(tally.forFailure(noObject(usage(7, 1)))).toEqual({ inputTokens: 300, outputTokens: 15, cachedInputTokens: 70, cacheWriteTokens: 30 });
	});
});

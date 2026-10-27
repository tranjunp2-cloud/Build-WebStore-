import { afterEach, describe, expect, it } from "vitest";
import { UNPRICED_FALLBACK_RATES, estimateCostMicros, fallbackCostMicros, setPriceOverrides } from "./price-book";

// TC-AIPRC-01..04 — one price book: Anthropic rates, dated ids, Haiku 5.5 long-prompt tier, cache writes, Payload override order.

afterEach(() => setPriceOverrides({}));
const M = 1_000_000;

describe("Anthropic rates [TC-AIPRC-01]", () => {
	it.each([
		["claude-haiku-5-5", 0.1, 0.5],
		["claude-haiku-4-5", 1, 5],
		["claude-sonnet-5-5", 2, 10],
		["claude-sonnet-5", 2, 10],
		["claude-sonnet-4-6", 3, 15],
		["claude-opus-5-5", 4, 20],
		["claude-opus-5", 5, 25],
		["claude-opus-4-8", 5, 25],
		["claude-opus-4-7", 5, 25],
		["claude-opus-4-6", 5, 25],
		["claude-fable-5-1", 10, 50],
		["claude-fable-5", 10, 50],
	])("%s: input %d / output %d per 1M", (model, input, output) => {
		// 100K tokens: the most Haiku 5.5 bills at its base rates
		expect(estimateCostMicros("anthropic", model, { inputTokens: 100_000, outputTokens: 0 })).toBe(Math.round(input * 100_000));
		expect(estimateCostMicros("anthropic", model, { inputTokens: 0, outputTokens: 100_000 })).toBe(Math.round(output * 100_000));
	});

	it("prices cache reads per model", () => {
		expect(estimateCostMicros("anthropic", "claude-sonnet-5-5", { inputTokens: M, cachedInputTokens: M })).toBe(200_000);
		expect(estimateCostMicros("anthropic", "claude-fable-5", { inputTokens: M, cachedInputTokens: M })).toBe(1_000_000);
	});

	it("prices OpenAI gpt-5.4-mini and Gemini 2.5 flash(-lite) from their official pages", () => {
		expect(estimateCostMicros("openai", "gpt-5.4-mini", { inputTokens: M, outputTokens: M })).toBe(5_250_000);
		expect(estimateCostMicros("google", "gemini-2.5-flash", { inputTokens: M, outputTokens: M })).toBe(2_800_000);
		expect(estimateCostMicros("google", "gemini-2.5-flash-lite", { inputTokens: M, outputTokens: M })).toBe(500_000);
	});

	it("is null for a model with no price", () => {
		expect(estimateCostMicros("anthropic", "claude-unknown-9", { inputTokens: 10 })).toBeNull();
		expect(estimateCostMicros("acme", "x", { inputTokens: 10 })).toBeNull();
	});
});

describe("model id matching [TC-AIPRC-02]", () => {
	it("strips a date / snapshot / latest suffix when the exact id has no price", () => {
		const exact = estimateCostMicros("anthropic", "claude-haiku-4-5", { inputTokens: M });
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5-20251001", { inputTokens: M })).toBe(exact);
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5@20251001", { inputTokens: M })).toBe(exact);
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5-latest", { inputTokens: M })).toBe(exact);
	});

	it("prefers the exact id (typesafe jev-latest has its own price)", () => {
		expect(estimateCostMicros("typesafe", "jev-latest", { inputTokens: M })).toBe(42_000);
	});
});

describe("Haiku 5.5 long prompt tier [TC-AIPRC-03]", () => {
	it("charges 5x on every rate when the prompt is over 100K tokens", () => {
		const usage = { inputTokens: 100_001, cachedInputTokens: 50_000, cacheWriteTokens: 10_000, outputTokens: 1_000 };
		const fresh = 40_001;
		const expected = fresh * 0.5 + 50_000 * 0.05 + 10_000 * 0.625 + 1_000 * 2.5;
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", usage)).toBe(Math.round(expected));
	});

	it("keeps the base rates at exactly 100K", () => {
		const usage = { inputTokens: 100_000, cachedInputTokens: 50_000, cacheWriteTokens: 10_000, outputTokens: 1_000 };
		const expected = 40_000 * 0.1 + 50_000 * 0.01 + 10_000 * 0.125 + 1_000 * 0.5;
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", usage)).toBe(Math.round(expected));
	});
});

describe("cache writes [TC-AIPRC-04]", () => {
	it("bills writes at 1.25x input and takes them out of fresh input", () => {
		// sonnet-5-5: 2.00 input -> 2.50 write; 1M total = 400K fresh + 100K read + 500K written
		const cost = estimateCostMicros("anthropic", "claude-sonnet-5-5", { inputTokens: M, cachedInputTokens: 100_000, cacheWriteTokens: 500_000 });
		expect(cost).toBe(Math.round(400_000 * 2 + 100_000 * 0.2 + 500_000 * 2.5));
	});

	it("providers without a write price bill them as input", () => {
		const withWrites = estimateCostMicros("openai", "gpt-4.1-mini", { inputTokens: 1000, cacheWriteTokens: 400 });
		expect(withWrites).toBe(estimateCostMicros("openai", "gpt-4.1-mini", { inputTokens: 1000 }));
	});

	it("never goes negative when reads + writes exceed the total", () => {
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", { inputTokens: 10, cachedInputTokens: 10, cacheWriteTokens: 10 })).toBeGreaterThanOrEqual(0);
	});

	it("the unpriced fallback counts only stored columns: writes are fresh input", () => {
		const r = UNPRICED_FALLBACK_RATES;
		expect(fallbackCostMicros({ inputTokens: 1000, cachedInputTokens: 200, outputTokens: 100 })).toBe(Math.round(800 * r.input + 200 * r.cachedInput + 100 * r.output));
		expect(fallbackCostMicros({ inputTokens: null, cachedInputTokens: null, outputTokens: null })).toBe(0);
	});
});

describe("Payload overrides [TC-AIPRC-05]", () => {
	it("an override wins over the built-in table (exact, then suffix-stripped); the rest stays built-in", () => {
		setPriceOverrides({ prices: { "anthropic:claude-haiku-4-5": { input: 9, cachedInput: 1, cacheWrite: 11, output: 20 } } });
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5", { inputTokens: M })).toBe(9_000_000);
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5-20251001", { inputTokens: M, cacheWriteTokens: M })).toBe(11_000_000);
		expect(estimateCostMicros("anthropic", "claude-sonnet-5-5", { inputTokens: M })).toBe(2_000_000);
	});

	it("an override can price a model the table does not know, and pictures", () => {
		setPriceOverrides({ prices: { "acme:x1": { input: 1, cachedInput: 1, output: 2 } }, images: { "openai:gpt-image-2": 0.5 } });
		expect(estimateCostMicros("acme", "x1", { inputTokens: M, outputTokens: M })).toBe(3_000_000);
		expect(estimateCostMicros("openai", "gpt-image-2", { images: 2 })).toBe(1_000_000);
		expect(estimateCostMicros("openai", "gpt-image-1", { images: 1 })).toBe(42_000);
	});
});

import { describe, expect, it } from "vitest";
import { estimateCostMicros } from "./price-book";

describe("price book — current default models", () => {
	it("[TC-AIEFF-08] Claude Haiku 5.5 is priced, with the long-context rates above 100K prompt tokens", () => {
		// Arrange — 50K fresh + 10K cached input, 2K output
		const short = { inputTokens: 60_000, cachedInputTokens: 10_000, outputTokens: 2_000 };
		const long = { inputTokens: 150_000, cachedInputTokens: 10_000, outputTokens: 2_000 };

		// Act + Assert — 50K×$0.10 + 10K×$0.01 + 2K×$0.50 per MTok = $0.0061
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", short)).toBe(6_100);
		// 140K×$0.50 + 10K×$0.05 + 2K×$2.50 per MTok = $0.0755
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", long)).toBe(75_500);
	});

	it("[TC-AIEFF-09] the fallback OpenAI models and other current Claude models are priced", () => {
		const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
		expect(estimateCostMicros("openai", "gpt-5.4-nano", usage)).toBe(1_450_000);
		expect(estimateCostMicros("openai", "gpt-5.4-mini", usage)).toBe(5_250_000);
		expect(estimateCostMicros("anthropic", "claude-sonnet-5-5", usage)).toBe(12_000_000);
		expect(estimateCostMicros("anthropic", "claude-opus-5-5", usage)).toBe(24_000_000);
		expect(estimateCostMicros("anthropic", "claude-haiku-4-5", usage)).toBe(6_000_000);
	});

	it("[TC-AIEFF-10] an unknown model still records no cost rather than a guess", () => {
		expect(estimateCostMicros("anthropic", "claude-unknown-9", { inputTokens: 1_000 })).toBeNull();
	});
});

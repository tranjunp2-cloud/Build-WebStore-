import { describe, expect, it } from "vitest";
import { anthropicEffortOptions } from "./anthropic-effort";

// TC-AIPRC-07 — thinking effort for the 5.5 models: low for fast, medium for copilot; never budget_tokens / disabled.

describe("anthropicEffortOptions [TC-AIPRC-07]", () => {
	const haiku = { provider: "anthropic", modelId: "claude-haiku-5-5" };

	it("fast = low, balanced = medium, quality = model default", () => {
		expect(anthropicEffortOptions(haiku, "fast")).toEqual({ providerOptions: { anthropic: { effort: "low" } } });
		expect(anthropicEffortOptions(haiku, "balanced")).toEqual({ providerOptions: { anthropic: { effort: "medium" } } });
		expect(anthropicEffortOptions({ provider: "anthropic", modelId: "claude-sonnet-5-5" }, "quality")).toEqual({});
	});

	it("only Haiku 5.5 / Sonnet 5.5 on anthropic; never a thinking option", () => {
		expect(anthropicEffortOptions({ provider: "openai", modelId: "gpt-4.1-mini" }, "fast")).toEqual({});
		expect(anthropicEffortOptions({ provider: "anthropic", modelId: "claude-haiku-4-5" }, "fast")).toEqual({});
		expect(JSON.stringify(anthropicEffortOptions(haiku, "fast"))).not.toMatch(/thinking|budget/i);
	});
});

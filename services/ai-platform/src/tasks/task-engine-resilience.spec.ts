import { APICallError, RetryError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import { isProviderBillingError } from "../models/fallback";
import type { ModelRegistry, ResolvedModel } from "../models/model-registry";
import { TASK_DEFINITIONS } from "./catalog";
import { chainBudgetFor, DEFAULT_CHAIN_DEADLINE_MS, TaskEngine } from "./task-engine.service";

const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const apiError = (statusCode: number, message: string, responseBody?: string) =>
	new APICallError({ message, url: "https://x", requestBodyValues: {}, statusCode, responseBody });

function failing(error: Error) {
	return new MockLanguageModelV4({
		doGenerate: async () => {
			throw error;
		},
	});
}

function setup(chain: ResolvedModel[]) {
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = {
		record: async (event) => void recorded.push(event),
		countSince: async () => 0,
	};
	const models: ModelRegistry = { resolveChain: () => chain };
	const engine = new TaskEngine(
		models,
		ledger,
		parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" }),
	);
	return { engine, recorded };
}

const run = (engine: TaskEngine) => engine.run(ctx, "content.translate", { targetLocale: "ms-MY", fields: { name: "Batik scarf" } });

describe("provider billing detection [TC-AIWB-89]", () => {
	it.each([
		["OpenAI insufficient_quota (429)", apiError(429, "You exceeded your current quota, please check your plan and billing details.")],
		["OpenAI error code in the body", apiError(429, "Rate limit", '{"error":{"type":"insufficient_quota","code":"insufficient_quota"}}')],
		["DeepSeek Insufficient Balance (402)", apiError(402, "Insufficient Balance")],
		["Anthropic credit balance (400)", apiError(400, "Your credit balance is too low to access the Anthropic API.")],
	])("recognises %s", (_label, error) => {
		expect(isProviderBillingError(error)).toBe(true);
	});

	it("sees through the SDK retry wrapper", () => {
		const wrapped = new RetryError({ message: "failed after retries", reason: "maxRetriesExceeded", errors: [apiError(429, "insufficient_quota")] });
		expect(isProviderBillingError(wrapped)).toBe(true);
	});

	it.each([
		["a plain rate limit", apiError(429, "Rate limit reached for requests per minute")],
		["a per-minute quota metric", apiError(429, "Quota exceeded for quota metric 'Generate Content API requests per minute'")],
		["an outage", apiError(503, "service unavailable")],
		["a bad request", apiError(400, "invalid schema")],
		["a non-API error", new Error("insufficient_quota")],
	])("does not mistake %s for exhausted credit", (_label, error) => {
		expect(isProviderBillingError(error)).toBe(false);
	});
});

describe("TaskEngine provider credit exhaustion [TC-AIWB-90]", () => {
	it("answers 402 with a stable code when every provider refused for billing, and ledgers the code", async () => {
		const { engine, recorded } = setup([
			{ provider: "openai", modelId: "gpt-4.1-nano", model: failing(apiError(429, "You exceeded your current quota")) },
			{ provider: "deepseek", modelId: "deepseek-chat", model: failing(apiError(402, "Insufficient Balance")) },
		]);

		await expect(run(engine)).rejects.toMatchObject({ status: 402, code: "provider_insufficient_quota" });
		expect(recorded.map((e) => e.errorCode)).toEqual(["provider_insufficient_quota", "provider_insufficient_quota"]);
	});

	it("keeps the generic 503 when a billing failure is mixed with an outage", async () => {
		const { engine } = setup([
			{ provider: "openai", modelId: "gpt-4.1-nano", model: failing(apiError(429, "You exceeded your current quota")) },
			{ provider: "anthropic", modelId: "claude-haiku-4-5", model: failing(apiError(503, "down")) },
		]);

		await expect(run(engine)).rejects.toMatchObject({ status: 503 });
	});

	it("still falls back to a provider with credit before giving up", async () => {
		const { engine } = setup([
			{ provider: "openai", modelId: "gpt-4.1-nano", model: failing(apiError(429, "You exceeded your current quota")) },
			{
				provider: "anthropic",
				modelId: "claude-haiku-4-5",
				model: new MockLanguageModelV4({
					doGenerate: async () => ({
						content: [{ type: "text", text: JSON.stringify({ fields: { name: "Selendang" } }) }],
						finishReason: { unified: "stop", raw: undefined },
						usage,
						warnings: [],
					}),
				}),
			},
		]);

		const result = await run(engine);
		expect(result.output).toEqual({ fields: { name: "Selendang" } });
		expect(result.usage.fallbacks).toHaveLength(1);
	});
});

describe("whole-chain deadline [TC-AIWB-91]", () => {
	it("gives site-plan an explicit cap that fits one full attempt plus a fallback, below the 90 s client timeout", () => {
		const plan = TASK_DEFINITIONS["sitegen.site-plan"];
		expect(plan.deadlineMs).toBe(60_000);
		expect(plan.deadlineMs!).toBeGreaterThan(plan.timeoutMs!);
		expect(plan.deadlineMs!).toBeLessThan(90_000 - 10_000);
	});

	it("caps every task that declares no deadline, so a stacked fallback chain cannot outlive the client", () => {
		expect(DEFAULT_CHAIN_DEADLINE_MS).toBeLessThanOrEqual(80_000);
		expect(chainBudgetFor({ deadlineMs: undefined, timeoutMs: undefined })).toBe(DEFAULT_CHAIN_DEADLINE_MS);
		expect(chainBudgetFor({ deadlineMs: undefined, timeoutMs: 12_000 })).toBe(DEFAULT_CHAIN_DEADLINE_MS);
		expect(chainBudgetFor({ deadlineMs: 14_000, timeoutMs: 14_000 })).toBe(14_000);
	});

	it("leaves tasks that run longer on purpose to their own caller", () => {
		expect(chainBudgetFor({ deadlineMs: undefined, timeoutMs: 180_000 })).toBeUndefined();
	});

	it("no copy or content task ends up with an unbounded chain", () => {
		const unbounded = Object.values(TASK_DEFINITIONS)
			.filter((d) => chainBudgetFor(d as { deadlineMs?: number; timeoutMs?: number }) === undefined)
			.map((d) => d.id);
		expect(unbounded.every((id) => id.startsWith("migration."))).toBe(true);
	});
});

describe("failed attempts keep their tokens [TC-AIPRC-06]", () => {
	it("a reply that did not match the schema is ledgered with the usage the provider billed", async () => {
		const billed = {
			inputTokens: { total: 500, noCache: 50, cacheRead: 100, cacheWrite: 350 },
			outputTokens: { total: 80, text: 80, reasoning: undefined },
		};
		const bad = new MockLanguageModelV4({
			doGenerate: async () => ({ content: [{ type: "text", text: "{\"nope\":1}" }], finishReason: { unified: "stop", raw: undefined }, usage: billed, warnings: [] }),
		});
		const { engine, recorded } = setup([{ provider: "anthropic", modelId: "claude-haiku-5-5", model: bad }]);

		await expect(run(engine)).rejects.toBeInstanceOf(Error);

		expect(recorded).toEqual([
			expect.objectContaining({ outcome: "error", inputTokens: 500, outputTokens: 80, cachedInputTokens: 100, cacheWriteTokens: 350 }),
		]);
	});

	it("an error with no usage records none", async () => {
		const { engine, recorded } = setup([{ provider: "openai", modelId: "gpt-4.1-nano", model: failing(apiError(500, "down")) }]);
		await expect(run(engine)).rejects.toBeInstanceOf(Error);
		expect(recorded[0]?.inputTokens).toBeUndefined();
	});
});

// seo.generate-meta declares maxRetries 0, so the SDK does not sleep between attempts.
const runMeta = (engine: TaskEngine) => engine.run(ctx, "seo.generate-meta", { type: "page", itemName: "About", siteName: "Kedai Batik" });

describe("TaskEngine provider rate limit [TC-AIRATE-01]", () => {
	it("[TC-AIRATE-01] answers 429 provider_rate_limited when every provider answered 429, and ledgers the code", async () => {
		const { engine, recorded } = setup([
			{ provider: "anthropic", modelId: "claude-haiku-5-5", model: failing(apiError(429, "Rate limit reached for requests per minute")) },
			{ provider: "openai", modelId: "gpt-5.4-nano", model: failing(apiError(429, "Too many requests")) },
		]);

		await expect(runMeta(engine)).rejects.toMatchObject({
			status: 429,
			code: "provider_rate_limited",
			message: "The AI is busy right now. Try again in a minute.",
		});
		expect(recorded.map((e) => e.errorCode)).toEqual(["provider_rate_limited", "provider_rate_limited"]);
	});

	it("[TC-AIRATE-02] a rate limit wrapped by the SDK retry error is still a rate limit", async () => {
		const wrapped = new RetryError({ message: "failed after retries", reason: "maxRetriesExceeded", errors: [apiError(429, "slow down")] });
		const { engine } = setup([{ provider: "anthropic", modelId: "claude-haiku-5-5", model: failing(wrapped) }]);

		await expect(runMeta(engine)).rejects.toMatchObject({ status: 429, code: "provider_rate_limited" });
	});

	it("[TC-AIRATE-03] billing exhaustion stays 402, also when it arrives as a 429", async () => {
		const { engine } = setup([
			{ provider: "anthropic", modelId: "claude-haiku-5-5", model: failing(apiError(429, "You exceeded your current quota")) },
		]);

		await expect(runMeta(engine)).rejects.toMatchObject({ status: 402, code: "provider_insufficient_quota" });
	});

	it("[TC-AIRATE-04] a 429 mixed with an outage or billing failure keeps the generic 503", async () => {
		const outage = setup([
			{ provider: "anthropic", modelId: "claude-haiku-5-5", model: failing(apiError(429, "slow down")) },
			{ provider: "openai", modelId: "gpt-5.4-nano", model: failing(apiError(503, "down")) },
		]);
		const billing = setup([
			{ provider: "anthropic", modelId: "claude-haiku-5-5", model: failing(apiError(429, "slow down")) },
			{ provider: "openai", modelId: "gpt-5.4-nano", model: failing(apiError(429, "You exceeded your current quota")) },
		]);

		await expect(runMeta(outage.engine)).rejects.toMatchObject({ status: 503, code: undefined });
		await expect(runMeta(billing.engine)).rejects.toMatchObject({ status: 503, code: undefined });
	});
});

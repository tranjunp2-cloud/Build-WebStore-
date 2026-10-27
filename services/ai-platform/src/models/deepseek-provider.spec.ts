import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../config/env";
import { estimateCostMicros, isDeepSeekPeak } from "../ledger/price-book";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import { TaskEngine } from "../tasks/task-engine.service";
import { createModelRegistry } from "./model-registry";

const baseEnv = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
};

/** A DeepSeek chat completion as the API returns it (cache split in prompt_cache_*_tokens). */
function deepSeekCompletion() {
	return Response.json({
		id: "ds_1",
		object: "chat.completion",
		created: 0,
		model: "deepseek-flash",
		choices: [
			{
				index: 0,
				finish_reason: "stop",
				message: { role: "assistant", content: '{"metaTitle":"Kedai Batik","metaDescription":"Batik scarves."}' },
			},
		],
		usage: {
			prompt_tokens: 1200,
			completion_tokens: 100,
			total_tokens: 1300,
			prompt_cache_hit_tokens: 1000,
			prompt_cache_miss_tokens: 200,
		},
	});
}

function setup(vars: Record<string, string>) {
	const requests: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
		requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
		return deepSeekCompletion();
	});
	const allVars = { ...baseEnv, AI_MODEL_FAST: "deepseek:deepseek-flash", ...vars };
	const env = parseEnv(allVars);
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (e) => void recorded.push(e), countSince: async () => 0 };
	const engine = new TaskEngine(createModelRegistry(env, allVars), ledger, env);
	return { engine, recorded, requests };
}

const ctx = { organizationId: "org_1", userId: "usr_1" };

describe("DeepSeek provider cache accounting [TC-AICP-34]", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("records prompt_cache_hit_tokens as cached input and prices hits at the cache-hit rate", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-18T12:00:00Z")); // Sunday → off-peak
		const { engine, recorded, requests } = setup({ DEEPSEEK_API_KEY: "sk-test" });

		const result = await engine.run(ctx, "seo.fix-meta", { siteName: "Kedai Batik", pageContent: "Heading: Batik" });

		expect(requests[0]?.url).toBe("https://api.deepseek.com/chat/completions");
		expect(requests[0]?.headers.get("authorization")).toBe("Bearer sk-test");
		// Non-thinking mode, so the task's temperature applies and no reasoning tokens are billed.
		expect(requests[0]?.body).toMatchObject({ thinking: { type: "disabled" }, temperature: 0.3 });
		expect(recorded).toEqual([
			expect.objectContaining({
				provider: "deepseek",
				model: "deepseek-flash",
				inputTokens: 1200,
				cachedInputTokens: 1000,
				outputTokens: 100,
				outcome: "ok",
			}),
		]);
		// (200 miss × $0.30 + 1000 hit × $0.006 + 100 out × $1.20) / 1M × 0.5 off-peak = $0.000093
		expect(result.usage.costUsdMicros).toBe(93);
	});

	it("goes through the Cloudflare gateway path with the gateway-stored key (BYOK)", async () => {
		const { engine, requests } = setup({
			AI_GATEWAY_BASE_URL: "https://gateway.ai.cloudflare.com/v1/acc/gw/",
			AI_GATEWAY_TOKEN: "cf-token",
		});

		await engine.run(ctx, "seo.fix-meta", { siteName: "Kedai Batik", pageContent: "Heading: Batik" });

		expect(requests[0]?.url).toBe("https://gateway.ai.cloudflare.com/v1/acc/gw/deepseek/chat/completions");
		expect(requests[0]?.headers.get("authorization")).toBeNull();
		expect(requests[0]?.headers.get("cf-aig-authorization")).toBe("Bearer cf-token");
	});
});

describe("price book [TC-AICP-34]", () => {
	it("bills cache-read tokens at the cached rate and the rest at the input rate", () => {
		const usage = { inputTokens: 1_000_000, cachedInputTokens: 750_000, outputTokens: 0 };
		// 250k × $0.40 + 750k × $0.10 = $0.175
		expect(estimateCostMicros("openai", "gpt-4.1-mini", usage)).toBe(175_000);
		expect(estimateCostMicros("openai", "gpt-4.1-mini", { inputTokens: 1_000_000 })).toBe(400_000);
	});

	it("prices DeepSeek at peak rates in peak hours and half outside them", () => {
		const usage = { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 };
		const peak = new Date("2026-10-20T07:30:00Z"); // Tuesday 07:30 UTC
		const offPeak = new Date("2026-10-20T12:00:00Z");
		expect(estimateCostMicros("deepseek", "deepseek-flash", usage, peak)).toBe(1_500_000);
		expect(estimateCostMicros("deepseek", "deepseek-flash", usage, offPeak)).toBe(750_000);
		expect(estimateCostMicros("deepseek", "deepseek-v4-pro", usage, peak)).toBe(5_280_000);
		expect(estimateCostMicros("deepseek", "deepseek-v4-pro", { inputTokens: 1_000_000, cachedInputTokens: 1_000_000 }, peak)).toBe(44_000);
		expect(estimateCostMicros("deepseek", "deepseek-unknown", usage, peak)).toBeNull();
	});

	it("knows DeepSeek's peak windows (01-04 and 06-10 UTC, weekdays)", () => {
		expect(isDeepSeekPeak(new Date("2026-10-20T01:00:00Z"))).toBe(true);
		expect(isDeepSeekPeak(new Date("2026-10-20T04:00:00Z"))).toBe(false);
		expect(isDeepSeekPeak(new Date("2026-10-20T09:59:00Z"))).toBe(true);
		expect(isDeepSeekPeak(new Date("2026-10-20T10:00:00Z"))).toBe(false);
		expect(isDeepSeekPeak(new Date("2026-10-24T07:00:00Z"))).toBe(false); // Saturday
	});
});

import { jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateCostMicros, setPriceOverrides } from "../ledger/price-book";
import { createModelRegistry } from "../models/model-registry";
import { testEnv } from "../testing/test-app";
import { AI_CONFIG_TOKEN_AUDIENCE, AI_CONFIG_TOKEN_SUBJECT, AiConfigService, parseAiConfig, REFRESH_MS } from "./ai-config.service";

// TC-AICFG-01..05 — prime-web's AI config: fetch + validate, last good copy, fallback to built-ins, override order.

afterEach(() => setPriceOverrides({}));
const SECRET = "test-context-secret-at-least-32-characters";
const URL_ENV = { PRIME_WEB_INTERNAL_URL: "https://web.test" };
const M = 1_000_000;

const body = (extra: Record<string, unknown> = {}) => ({
	prices: { "anthropic:claude-haiku-5-5": { input: 0.2, output: 1 } },
	images: {},
	models: { fast: "anthropic:claude-haiku-5-5, openai:gpt-4.1-nano" },
	updatedAt: "2026-10-26T00:00:00Z",
	...extra,
});
const ok = (json: unknown) => vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(json), { status: 200 }));
const service = (fetchFn: unknown, clock: () => number = Date.now, env = URL_ENV) => new AiConfigService(testEnv(env), fetchFn as typeof fetch, clock);

describe("fetch [TC-AICFG-01]", () => {
	it("signs a 2 min HS256 token for prime-web:internal / ai-config and applies prices and models", async () => {
		const fetchFn = ok(body());
		const svc = service(fetchFn);
		expect(await svc.refresh()).toBe(true);

		const [url, init] = fetchFn.mock.calls[0] as [string, { headers: { authorization: string } }];
		expect(url).toBe("https://web.test/api/internal/ai-config");
		const jwt = init.headers.authorization.replace("Bearer ", "");
		const { payload } = await jwtVerify(jwt, new TextEncoder().encode(SECRET), { issuer: "ai-platform", audience: AI_CONFIG_TOKEN_AUDIENCE, subject: AI_CONFIG_TOKEN_SUBJECT, algorithms: ["HS256"] });
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(120);
		expect(svc.models()).toEqual({ fast: "anthropic:claude-haiku-5-5, openai:gpt-4.1-nano" });
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", { inputTokens: M })).toBe(200_000);
	});

	it("does nothing without PRIME_WEB_INTERNAL_URL", async () => {
		const fetchFn = ok(body());
		const svc = service(fetchFn, Date.now, {} as never);
		expect(await svc.refresh()).toBe(false);
		expect(svc.models()).toEqual({});
		expect(fetchFn).not.toHaveBeenCalled();
	});
});

describe("failures keep the last good copy [TC-AICFG-02]", () => {
	it.each([
		["a network error", () => Promise.reject(new Error("ECONNREFUSED"))],
		["a 500", async () => new Response("no", { status: 500 })],
		["a non-JSON body", async () => new Response("<html>", { status: 200 })],
		["a malformed body", async () => new Response(JSON.stringify({ prices: [1] }), { status: 200 })],
	])("%s", async (_name, failure) => {
		const fetchFn = vi.fn().mockImplementationOnce(async () => new Response(JSON.stringify(body()), { status: 200 })).mockImplementation(failure);
		const svc = service(fetchFn);
		await svc.refresh();
		expect(await svc.refresh()).toBe(false);
		expect(svc.models().fast).toBe("anthropic:claude-haiku-5-5, openai:gpt-4.1-nano");
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", { inputTokens: M })).toBe(200_000);
	});

	it("never fetched or unreachable = built-in prices and env models", async () => {
		const svc = service(vi.fn(async () => Promise.reject(new Error("down"))));
		expect(await svc.refresh()).toBe(false);
		expect(svc.models()).toEqual({});
		expect(estimateCostMicros("anthropic", "claude-haiku-5-5", { inputTokens: 100_000 })).toBe(10_000);
	});
});

describe("validation [TC-AICFG-03]", () => {
	it("skips bad entries one by one and keeps the good ones", () => {
		const warnings: string[] = [];
		const out = parseAiConfig(
			{
				prices: { "a:ok": { input: 1, output: 2 }, "a:neg": { input: -1, output: 2 }, nocolon: { input: 1, output: 1 }, "a:str": { input: "1", output: 1 } },
				images: { "openai:img": 0.04, "openai:bad": -2 },
				models: { fast: "openai:gpt-4.1-nano", balanced: "not a ref", quality: "", image: "openai:gpt-image-1" },
			},
			(m) => warnings.push(m),
		);
		expect(Object.keys(out.prices)).toEqual(["a:ok"]);
		expect(out.images).toEqual({ "openai:img": 0.04 });
		expect(out.config.models).toEqual({ fast: "openai:gpt-4.1-nano", image: "openai:gpt-image-1" });
		expect(warnings).toHaveLength(5);
	});

	it("accepts empty parts and a long-context tier; anthropic writes default to 1.25x input", () => {
		const empty = parseAiConfig({});
		expect(empty.prices).toEqual({});
		const out = parseAiConfig({ prices: { "anthropic:m": { input: 1, output: 2, longContext: { aboveInputTokens: 100, input: 5, output: 10 } } } });
		expect(out.prices["anthropic:m"]).toMatchObject({ cachedInput: 1, cacheWrite: 1.25, longContext: { aboveInputTokens: 100, input: 5, output: 10 } });
	});

	it("deepseek keeps its peak hours in code; Payload only sets the factor", () => {
		const out = parseAiConfig({ prices: { "deepseek:deepseek-flash": { input: 0.3, output: 1.2, offPeakFactor: 0.25 } } });
		const price = out.prices["deepseek:deepseek-flash"];
		expect(price?.offPeakFactor).toBe(0.25);
		expect(price?.isPeak?.(new Date("2026-10-26T02:00:00Z"))).toBe(true); // Monday 02:00 UTC
		expect(price?.isPeak?.(new Date("2026-10-25T02:00:00Z"))).toBe(false); // Sunday
	});
});

describe("refresh cadence [TC-AICFG-04]", () => {
	it("a stale copy refreshes in the background; reads never wait", async () => {
		let now = 1_000_000;
		const fetchFn = ok(body());
		const svc = service(fetchFn, () => now);
		expect(svc.current().models).toEqual({}); // first use: fallback now, fetch started
		await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(svc.current().models.fast).toBeDefined());
		svc.current();
		expect(fetchFn).toHaveBeenCalledTimes(1); // fresh: no refetch
		now += REFRESH_MS + 1;
		svc.current();
		await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
	});

	it("shares one in-flight fetch", async () => {
		const fetchFn = ok(body());
		const svc = service(fetchFn);
		await Promise.all([svc.refresh(), svc.refresh()]);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});

describe("model chains per call [TC-AICFG-05]", () => {
	const env = testEnv({ OPENAI_API_KEY: "sk-test", AI_MODEL_FAST: "openai:gpt-4.1-nano" });
	const vars = { OPENAI_API_KEY: "sk-test" };

	it("Payload's chain replaces the env chain of an alias and follows config changes without a rebuild", () => {
		let models: Record<string, string> = {};
		const registry = createModelRegistry(env, vars, { models: () => models });
		expect(registry.resolveChain("fast").map((m) => m.modelId)).toEqual(["gpt-4.1-nano"]);
		models = { fast: "openai:gpt-4.1-mini" };
		expect(registry.resolveChain("fast").map((m) => m.modelId)).toEqual(["gpt-4.1-mini"]);
		expect(registry.resolveChain("balanced").map((m) => m.modelId)).toEqual(["gpt-4.1-mini"]); // env default after anthropic is skipped
	});

	it("skips a Payload provider with no key, and falls back to the env chain when none is usable", () => {
		const registry = createModelRegistry(env, vars, { models: () => ({ fast: "anthropic:claude-haiku-5-5, openai:gpt-4.1-mini" }) });
		expect(registry.resolveChain("fast").map((m) => m.provider)).toEqual(["openai"]);
		const none = createModelRegistry(env, vars, { models: () => ({ fast: "anthropic:claude-haiku-5-5" }) });
		expect(none.resolveChain("fast").map((m) => m.modelId)).toEqual(["gpt-4.1-nano"]);
	});

	it("without keys for the default Anthropic chain, environments keep working on the OpenAI fallback", () => {
		const registry = createModelRegistry(testEnv({ OPENAI_API_KEY: "sk-test" }), vars);
		expect(registry.resolveChain("quality").map((m) => `${m.provider}:${m.modelId}`)).toEqual(["openai:gpt-5.4-mini"]);
	});
});

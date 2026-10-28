import { APICallError, generateText, type LanguageModel, Output } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseEnv } from "../config/env";
import { isFallbackWorthy, runWithFallback } from "./fallback";
import { createModelRegistry, ModelUnavailableError, parseModelChain, type ResolvedModel } from "./model-registry";
import { createProviderFactory } from "./providers";

const baseEnv = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
};

describe("parseModelChain", () => {
	it("parses a comma-separated provider:model chain", () => {
		expect(parseModelChain("openai:gpt-4.1-mini, anthropic:claude-haiku-4-5 ,compat-sealion:aisingapore/sea-lion-v4")).toEqual([
			{ provider: "openai", modelId: "gpt-4.1-mini" },
			{ provider: "anthropic", modelId: "claude-haiku-4-5" },
			{ provider: "compat-sealion", modelId: "aisingapore/sea-lion-v4" },
		]);
	});
});

describe("createModelRegistry", () => {
	it("keeps only providers configured in this environment, in chain order", () => {
		const vars = { ...baseEnv, AI_MODEL_BALANCED: "openai:gpt-4.1-mini,anthropic:claude-haiku-4-5,google:gemini-2.5-flash", ANTHROPIC_API_KEY: "k", GOOGLE_GENERATIVE_AI_API_KEY: "g" };
		const chain = createModelRegistry(parseEnv(vars), vars).resolveChain("balanced");
		expect(chain.map((m) => `${m.provider}:${m.modelId}`)).toEqual(["anthropic:claude-haiku-4-5", "google:gemini-2.5-flash"]);
	});

	it("throws when no candidate of the alias is configured", () => {
		const vars = { ...baseEnv, AI_MODEL_FAST: "openai:gpt-4.1-nano" };
		expect(() => createModelRegistry(parseEnv(vars), vars).resolveChain("fast")).toThrow(ModelUnavailableError);
	});

	it("supports named OpenAI-compatible endpoints (self-hosted / in-region models)", () => {
		const vars = { ...baseEnv, AI_MODEL_FAST: "compat-sealion:sea-lion-v4", AI_COMPAT_SEALION_BASE_URL: "http://vllm.internal:8000/v1" };
		const [model] = createModelRegistry(parseEnv(vars), vars).resolveChain("fast");
		expect(model?.provider).toBe("compat-sealion");
	});

	it("asks OpenAI-compatible endpoints for json_schema output unless opted out", async () => {
		const formats: unknown[] = [];
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
			formats.push(JSON.parse(String(init?.body)).response_format?.type);
			return Response.json({
				id: "c1",
				object: "chat.completion",
				created: 0,
				model: "m",
				choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"ok":true}' } }],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			});
		});
		try {
			for (const optOut of [undefined, "false"]) {
				const vars = { AI_COMPAT_LOCAL_BASE_URL: "http://proxy.local/v1", AI_COMPAT_LOCAL_STRUCTURED_OUTPUTS: optOut };
				const factory = createProviderFactory("compat-local", { vars });
				await generateText({
					model: factory?.("m") as LanguageModel,
					prompt: "hi",
					output: Output.object({ schema: z.object({ ok: z.boolean() }) }),
				});
			}
		} finally {
			fetchSpy.mockRestore();
		}
		expect(formats).toEqual(["json_schema", "json_object"]);
	});

	it("refuses the mock provider in production", () => {
		const vars = { ...baseEnv, NODE_ENV: "production", AI_MODEL_FAST: "mock:copilot" };
		expect(() => createModelRegistry(parseEnv(vars), vars).resolveChain("fast")).toThrow(ModelUnavailableError);
	});
});

describe("createProviderFactory", () => {
	it("allows a gateway-managed key (BYOK) only when a gateway token is set", () => {
		const viaGateway = { gatewayBaseUrl: "https://gateway.ai.cloudflare.com/v1/acc/gw", gatewayToken: "t", vars: {} };
		expect(createProviderFactory("anthropic", viaGateway)).not.toBeNull();
		expect(createProviderFactory("anthropic", { ...viaGateway, gatewayToken: undefined })).toBeNull();
		expect(createProviderFactory("unknown-provider", viaGateway)).toBeNull();
	});
});

function candidate(provider: string, impl: () => Promise<never> | Promise<string>): ResolvedModel & { run: () => Promise<unknown> } {
	return { provider, modelId: `${provider}-m`, model: new MockLanguageModelV4(), run: impl };
}

const apiError = (statusCode: number) =>
	new APICallError({ message: `HTTP ${statusCode}`, url: "https://x", requestBodyValues: {}, statusCode });

describe("runWithFallback", () => {
	it("moves to the next provider on outages and reports the skipped ones", async () => {
		const failures: string[] = [];
		const chain = [candidate("openai", () => Promise.reject(apiError(503))), candidate("anthropic", async () => "ok")];
		const result = await runWithFallback(chain, (m) => (m as (typeof chain)[number]).run(), {
			onFailure: (m) => void failures.push(m.provider),
		});
		expect(result.value).toBe("ok");
		expect(result.model.provider).toBe("anthropic");
		expect(result.fallbacks).toEqual([{ provider: "openai", model: "openai-m", error: "AI_APICallError" }]);
		expect(failures).toEqual(["openai"]);
	});

	it("does not hide a bad request behind another provider", async () => {
		const chain = [candidate("openai", () => Promise.reject(apiError(400))), candidate("anthropic", async () => "ok")];
		await expect(runWithFallback(chain, (m) => (m as (typeof chain)[number]).run())).rejects.toBeInstanceOf(APICallError);
		expect(isFallbackWorthy(apiError(429))).toBe(true);
	});

	it("stops when the caller says falling back is unsafe", async () => {
		const chain = [candidate("openai", () => Promise.reject(apiError(503))), candidate("anthropic", async () => "ok")];
		await expect(
			runWithFallback(chain, (m) => (m as (typeof chain)[number]).run(), { canFallback: () => false }),
		).rejects.toBeInstanceOf(APICallError);
	});
});

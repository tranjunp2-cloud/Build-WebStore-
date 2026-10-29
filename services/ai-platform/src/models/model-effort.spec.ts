import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../config/env";
import { createModelRegistry, type ModelAlias } from "./model-registry";

const vars = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	ANTHROPIC_API_KEY: "test-key",
	OPENAI_API_KEY: "test-key",
	GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
	DEEPSEEK_API_KEY: "test-key",
	OPENROUTER_API_KEY: "test-key",
	AI_COMPAT_LOCAL_BASE_URL: "http://compat.test/v1",
	AI_COMPAT_LOCAL_API_KEY: "test-key",
};

type Body = Record<string, unknown> & {
	output_config?: { effort?: string };
	reasoning_effort?: string;
	thinking?: { type?: string };
	generationConfig?: { thinkingConfig?: { thinkingLevel?: string; thinkingBudget?: number } };
};

/**
 * Sends one call through the registry's model for `ref` and returns the JSON body the provider SDK
 * put on the wire. The fake server answers 500, so the call itself fails; only the request matters.
 */
async function requestBodyFor(
	ref: string,
	extraEnv: Record<string, string> = {},
	callReasoning?: "high",
	alias: ModelAlias = "fast",
): Promise<Body> {
	const bodies: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init?: { body?: string }) => {
			bodies.push(String(init?.body ?? "{}"));
			return new Response("{}", { status: 500 });
		}),
	);
	const key = { fast: "AI_MODEL_FAST", balanced: "AI_MODEL_BALANCED", quality: "AI_MODEL_QUALITY" }[alias];
	const env = parseEnv({ ...vars, [key]: ref, ...extraEnv });
	const model = createModelRegistry(env, { ...vars, ...extraEnv }).resolveChain(alias)[0]!.model;
	await generateText({ model, prompt: "hi", maxRetries: 0, ...(callReasoning ? { reasoning: callReasoning } : {}) }).catch(() => undefined);
	return JSON.parse(bodies[0] ?? "{}") as Body;
}

afterEach(() => vi.unstubAllGlobals());

describe("per-tier reasoning effort for every provider (AI_EFFORT_*)", () => {
	it("[TC-AIEFF-01] one Haiku model serves every tier with its own effort", async () => {
		// Arrange
		const tiers = { AI_EFFORT_FAST: "low", AI_EFFORT_BALANCED: "medium", AI_EFFORT_QUALITY: "high" };

		// Act
		const efforts = [];
		for (const alias of ["fast", "balanced", "quality"] as const) {
			const body = await requestBodyFor("anthropic:claude-haiku-5-5", tiers, undefined, alias);
			efforts.push([body.model, body.output_config?.effort]);
		}

		// Assert
		expect(efforts).toEqual([
			["claude-haiku-5-5", "low"],
			["claude-haiku-5-5", "medium"],
			["claude-haiku-5-5", "high"],
		]);
	});

	it("[TC-AIEFF-02] each provider receives the tier effort in its own setting", async () => {
		// Arrange
		const low = { AI_EFFORT_FAST: "low" };

		// Act
		const anthropic = await requestBodyFor("anthropic:claude-haiku-5-5", low);
		const openai = await requestBodyFor("openai:gpt-5-mini", low);
		const gemini3 = await requestBodyFor("google:gemini-3-flash", low);
		const gemini25 = await requestBodyFor("google:gemini-2.5-flash", low);
		const deepseek = await requestBodyFor("deepseek:deepseek-chat", low);
		const openrouter = await requestBodyFor("openrouter:openai/gpt-5-mini", low);

		// Assert
		expect(anthropic.output_config?.effort).toBe("low");
		expect(openai.reasoning_effort).toBe("low");
		expect(gemini3.generationConfig?.thinkingConfig?.thinkingLevel).toBe("low");
		expect(gemini25.generationConfig?.thinkingConfig?.thinkingBudget).toBeGreaterThan(0);
		expect(deepseek.thinking?.type).toBe("enabled");
		expect(deepseek.reasoning_effort).toBe("low");
		expect(openrouter.reasoning_effort).toBe("low");
	});

	it("[TC-AIEFF-03] models that would reject it never get an effort", async () => {
		// Arrange
		const low = { AI_EFFORT_FAST: "low" };

		// Act — non-reasoning OpenAI models answer 400 to reasoning_effort; compat servers opt in
		const gpt41 = await requestBodyFor("openai:gpt-4.1-nano", low);
		const routerLlama = await requestBodyFor("openrouter:meta-llama/llama-3.3-70b-instruct", low);
		const compat = await requestBodyFor("compat-local:sea-lion", low);
		const compatOptIn = await requestBodyFor("compat-local:sea-lion", { ...low, AI_COMPAT_LOCAL_REASONING: "true" });

		// Assert
		expect(JSON.stringify(gpt41)).not.toMatch(/reasoning/);
		expect(JSON.stringify(routerLlama)).not.toMatch(/reasoning/);
		expect(JSON.stringify(compat)).not.toMatch(/reasoning/);
		expect(compatOptIn.reasoning_effort).toBe("low");
	});

	it("[TC-AIEFF-04] an unset tier uses its default effort; `default` sends none; DeepSeek stays non-thinking", async () => {
		// Act
		const unsetFast = await requestBodyFor("anthropic:claude-haiku-5-5");
		const unsetQuality = await requestBodyFor("anthropic:claude-haiku-5-5", {}, undefined, "quality");
		const modelOwn = await requestBodyFor("anthropic:claude-haiku-5-5", { AI_EFFORT_FAST: "default" });
		const deepseek = await requestBodyFor("deepseek:deepseek-chat");

		// Assert
		expect(unsetFast.output_config?.effort).toBe("low");
		expect(unsetQuality.output_config?.effort).toBe("high");
		expect(modelOwn.output_config?.effort).toBeUndefined();
		expect(deepseek.thinking?.type).toBe("disabled");
		expect(deepseek.reasoning_effort).toBeUndefined();
	});

	it("[TC-AIEFF-07] the default chains run Claude Haiku 5.5 first, a current OpenAI model as fallback", () => {
		// Act
		const registry = createModelRegistry(parseEnv(vars), vars);
		const chain = (alias: ModelAlias) => registry.resolveChain(alias).map((m) => `${m.provider}:${m.modelId}`);

		// Assert
		expect(chain("fast")).toEqual(["anthropic:claude-haiku-5-5", "openai:gpt-5.4-nano"]);
		expect(chain("balanced")).toEqual(["anthropic:claude-haiku-5-5", "openai:gpt-5.4-mini"]);
		expect(chain("quality")).toEqual(["anthropic:claude-haiku-5-5", "openai:gpt-5.4-mini"]);
	});

	it("[TC-AIEFF-05] a call's own reasoning wins over the tier default", async () => {
		// Act
		const body = await requestBodyFor("anthropic:claude-haiku-5-5", { AI_EFFORT_FAST: "low" }, "high");

		// Assert
		expect(body.output_config?.effort).toBe("high");
	});

	it("[TC-AIEFF-06] an unknown effort value is refused at startup", () => {
		expect(() => parseEnv({ ...vars, AI_EFFORT_QUALITY: "extreme" })).toThrow(/AI_EFFORT_QUALITY/);
	});
});

import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../config/env";
import { createModelRegistry } from "./model-registry";

const baseEnv = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	ANTHROPIC_API_KEY: "test-key",
	OPENAI_API_KEY: "test-key",
};

/** Captures the JSON body the provider SDK sends and answers like the Anthropic Messages API. */
function captureAnthropicRequests() {
	const bodies: Array<Record<string, unknown>> = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init?: { body?: string }) => {
			bodies.push(JSON.parse(String(init?.body ?? "{}")));
			return new Response(
				JSON.stringify({
					id: "msg_1",
					type: "message",
					role: "assistant",
					model: "claude-haiku-5-5",
					content: [{ type: "text", text: "ok" }],
					stop_reason: "end_turn",
					usage: { input_tokens: 1, output_tokens: 1 },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}),
	);
	return bodies;
}

afterEach(() => vi.unstubAllGlobals());

describe("per-tier Anthropic effort (AI_EFFORT_*)", () => {
	it("[TC-AIEFF-01] each tier sends its own effort to the same Haiku model", async () => {
		// Arrange
		const bodies = captureAnthropicRequests();
		const env = parseEnv({
			...baseEnv,
			AI_MODEL_FAST: "anthropic:claude-haiku-5-5",
			AI_MODEL_BALANCED: "anthropic:claude-haiku-5-5",
			AI_MODEL_QUALITY: "anthropic:claude-haiku-5-5",
			AI_EFFORT_FAST: "low",
			AI_EFFORT_BALANCED: "medium",
			AI_EFFORT_QUALITY: "high",
		});
		const registry = createModelRegistry(env, { ...baseEnv });

		// Act
		for (const alias of ["fast", "balanced", "quality"] as const) {
			await generateText({ model: registry.resolveChain(alias)[0]!.model, prompt: "hi" });
		}

		// Assert
		expect(bodies.map((body) => (body.output_config as { effort?: string } | undefined)?.effort)).toEqual(["low", "medium", "high"]);
		expect(bodies.every((body) => body.model === "claude-haiku-5-5")).toBe(true);
	});

	it("[TC-AIEFF-02] an unset tier sends no effort (model default) and other providers are untouched", async () => {
		// Arrange — fast has an effort but its OpenAI candidate must not carry it; balanced has none
		const env = parseEnv({
			...baseEnv,
			AI_MODEL_FAST: "openai:gpt-4.1-nano, anthropic:claude-haiku-5-5",
			AI_MODEL_BALANCED: "anthropic:claude-haiku-5-5",
			AI_EFFORT_FAST: "low",
		});
		const registry = createModelRegistry(env, { ...baseEnv });
		const bodies = captureAnthropicRequests();

		// Act
		const [openai] = registry.resolveChain("fast");
		await generateText({ model: openai!.model, prompt: "hi" }).catch(() => undefined); // body captured even if the fake reply is not OpenAI-shaped
		await generateText({ model: registry.resolveChain("balanced")[0]!.model, prompt: "hi" });

		// Assert
		expect(openai!.provider).toBe("openai");
		expect(JSON.stringify(bodies[0])).not.toMatch(/effort/);
		expect(bodies[1]!.model).toBe("claude-haiku-5-5");
		expect((bodies[1]!.output_config as { effort?: string } | undefined)?.effort).toBeUndefined();
	});

	it("[TC-AIEFF-03] an unknown effort value is refused at startup", () => {
		expect(() => parseEnv({ ...baseEnv, AI_EFFORT_QUALITY: "extreme" })).toThrow(/AI_EFFORT_QUALITY/);
	});
});

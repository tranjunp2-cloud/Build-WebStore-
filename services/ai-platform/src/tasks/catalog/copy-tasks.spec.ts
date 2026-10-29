import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import type { UsageLedger } from "../../ledger/usage-ledger";
import { TaskEngine } from "../task-engine.service";

const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 40, text: 40, reasoning: undefined },
};

/** Captures what the engine sends the model and answers with `json`. */
function capturingEngine(json: unknown) {
	const calls: { schema: unknown; prompt: unknown; temperature?: number; maxOutputTokens?: number }[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			calls.push({
				schema: options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined,
				prompt: options.prompt,
				temperature: options.temperature,
				maxOutputTokens: options.maxOutputTokens,
			});
			return { content: [{ type: "text", text: JSON.stringify(json) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
		},
	});
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const engine = new TaskEngine(
		{ resolveChain: () => [{ provider: "openai", modelId: "gpt-4.1-nano", model }] },
		ledger,
		parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" }),
	);
	return { engine, calls };
}

describe("copy.rewrite-text language [TC-AIWB-76]", () => {
	it.each([
		["en", "English"],
		["ms", "Malay"],
		["vi", "Vietnamese"],
	])("language %s is told to keep %s", async (language, name) => {
		const { engine, calls } = capturingEngine({ rewritten: "x" });
		await engine.run(ctx, "copy.rewrite-text", { text: "Hello", instruction: "shorter", language });
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain(`Keep the same language as the original (${name})`);
		if (language !== "en") expect(prompt).not.toContain("(English)");
	});
});

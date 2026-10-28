import type { ModelMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { closeOpenToolCalls, openToolCalls } from "./open-tool-calls";

// TC-AICP-130 — a tool call left without a result made the next model call fail
// (AI_MissingToolResultsError → "The AI could not complete this request" after the
// merchant answered): every open call gets a result before the model is called again.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", locale: "ms" } as AiRequestContext;
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };

describe("open tool calls [TC-AICP-130]", () => {
	it("finds the calls without a result and closes them with an error result", () => {
		const messages: ModelMessage[] = [
			{ role: "user", content: "Cipta dua produk kemeja-T" },
			{
				role: "assistant",
				content: [
					{ type: "tool-call", toolCallId: "c1", toolName: "ask_user", input: {} },
					{ type: "tool-call", toolCallId: "c2", toolName: "ask_user", input: {} },
				],
			},
			{ role: "tool", content: [{ type: "tool-result", toolCallId: "c1", toolName: "ask_user", output: { type: "json", value: { answers: [] } } }] },
		];

		expect(openToolCalls(messages)).toEqual([{ toolCallId: "c2", toolName: "ask_user" }]);
		expect(closeOpenToolCalls(messages, () => "Not asked")).toBe(1);
		expect(openToolCalls(messages)).toEqual([]);
		expect(closeOpenToolCalls(messages, () => "x")).toBe(0);
	});

	it("a step with two ask_user calls no longer fails the run on the next model call", async () => {
		const prompts: unknown[] = [];
		let call = 0;
		const model = new MockLanguageModelV4({
			doGenerate: async (options) => {
				prompts.push(options.prompt);
				call += 1;
				if (call === 1) {
					return {
						content: [
							{ type: "tool-call", toolCallId: "ask_a", toolName: "ask_user", input: JSON.stringify({ purpose: "custom", product: null, questions: [], language: "ms" }) },
							{ type: "tool-call", toolCallId: "ask_b", toolName: "ask_user", input: JSON.stringify({ purpose: "custom", product: null, questions: [], language: "ms" }) },
						],
						finishReason: { unified: "tool-calls", raw: undefined },
						usage,
						warnings: [],
					};
				}
				return { content: [{ type: "text", text: "Saya sediakan draf." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
			},
		});
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
		const store = new InMemoryAgentStore();
		const recorded: UsageEvent[] = [];
		const ledger: UsageLedger = { record: async (e) => void recorded.push(e), countSince: async () => 0 };
		const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
		const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env));
		const frames: RunFrame[] = [];

		const run = await service.start(ctx, { prompt: "Cipta dua produk kemeja-T untuk saya." }, (f) => frames.push(f));

		expect(run.status).not.toBe("failed");
		expect(run.answer).toBe("Saya sediakan draf.");
		// the second call carried a result for both ask_user calls
		const second = JSON.stringify(prompts[1]);
		expect(second).toContain("ask_a");
		expect(second).toContain("ask_b");
		expect(recorded.some((e) => e.errorCode === "AI_MissingToolResultsError")).toBe(false);
	});
});

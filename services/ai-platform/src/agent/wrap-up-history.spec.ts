import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { parseEnv } from "../config/env";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { dropTrailingSilentTurns } from "./open-tool-calls";
import { ctx, STAGING_FULL } from "./run-harness.spec-helper";

// TC-AICP-358 — the web builder copilot read the site twice, thought, and said nothing; the wrap-up call
// then sent only that silent last turn (`result.response` is the final step in ai v7), ending the chat on
// the assistant. Claude refuses an assistant prefill, so the run failed with "The AI could not complete
// this request" ~0.4 s after "Thinking" started (staging + production, "Thêm block mới cho trang Home").

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const thinking = { type: "reasoning" as const, text: "Which block fits the home page?", providerMetadata: { anthropic: { signature: "sig" } } };

/** Claude's contract: thinking on, the conversation must end on the user / tool side. */
function claudeLike(turns: Array<"read_catalog" | "read_page" | "silent" | "reply">) {
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async ({ prompt }) => {
			if (prompt.at(-1)?.role === "assistant") throw Object.assign(new Error("This model does not support assistant message prefill."), { name: "AI_APICallError" });
			const turn = turns[Math.min(call, turns.length - 1)];
			call += 1;
			if (turn === "read_catalog" || turn === "read_page") {
				const input = turn === "read_catalog" ? { view: "catalog" } : { view: "page", pageId: "11853" };
				return { content: [thinking, { type: "tool-call" as const, toolCallId: `call_${call}`, toolName: "site_read", input: JSON.stringify(input) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] };
			}
			if (turn === "silent") return { content: [thinking], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
			return { content: [{ type: "text" as const, text: "Tôi đã soạn một block mới cho trang Home." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
		},
	});
}

function setup(model: MockLanguageModelV4) {
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_AGENT_CAPABILITIES: STAGING_FULL });
	const store = new InMemoryAgentStore();
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "anthropic", modelId: "claude-haiku-5-5" }] };
	const shop = { siteRead: async (_ctx: unknown, input: { view: string }) => ({ view: input.view, blocks: [{ id: "hero_1", type: "hero" }] }) } as unknown as ShopTools;
	const service = new AgentRunService(store, models, { record: async () => undefined, countSince: async () => 0 }, env, new AgentThreadService(store, env), undefined, shop);
	return { service };
}

describe("wrap-up after a silent turn [TC-AICP-358]", () => {
	it("answers from what it read instead of failing the run", async () => {
		// Arrange: two reads, then a thinking-only turn (no text, no tool call)
		const model = claudeLike(["read_catalog", "read_page", "silent", "reply"]);
		const { service } = setup(model);

		// Act
		const run = await service.start(ctx, { prompt: "Thêm block mới cho trang Home", context: { module: "editor" } } as never, () => undefined);

		// Assert: the wrap-up call ends on the reads' results and carries both of them
		expect(run.status).toBe("applied");
		expect(run.error).toBeUndefined();
		const wrapUp = model.doGenerateCalls.find((call) => call.toolChoice?.type === "none");
		expect(wrapUp?.prompt.at(-1)?.role).toBe("tool");
		expect(wrapUp?.prompt.filter((message) => message.role === "tool")).toHaveLength(2);
	});

	it("drops only the silent last turns, never a turn with a tool call", () => {
		// Arrange
		const messages = [
			{ role: "user" as const, content: "add a block" },
			{ role: "assistant" as const, content: [thinking, { type: "tool-call" as const, toolCallId: "c1", toolName: "site_read", input: {} }] },
			{ role: "tool" as const, content: [{ type: "tool-result" as const, toolCallId: "c1", toolName: "site_read", output: { type: "json" as const, value: {} } }] },
			{ role: "assistant" as const, content: [thinking] },
			{ role: "assistant" as const, content: "" },
		];

		// Act
		const dropped = dropTrailingSilentTurns(messages);

		// Assert
		expect(dropped).toBe(2);
		expect(messages.at(-1)?.role).toBe("tool");
		expect(dropTrailingSilentTurns(messages)).toBe(0);
	});
});

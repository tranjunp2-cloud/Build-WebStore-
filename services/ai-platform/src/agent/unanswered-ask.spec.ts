import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { historyMessages, runTurn } from "./thread-memory";

// TC-AICP-132 — a message sent instead of answering the copilot's question: the
// run that asked is still a turn of the chat (what was asked for and found, the
// open question noted), and the pictures it found keep their ids. Seen live in
// the editor: "find 3 hijab photos and put them there" after an unanswered
// picker lost both "there" and the photos ("img_1 is not in this chat").

type Turn = { toolCall: { name: string; input: unknown } } | { text: string };
const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function setup(shop: Partial<ShopTools>) {
	let turns: Turn[] = [];
	let call = 0;
	const prompts: string[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			prompts.push(JSON.stringify(options.prompt));
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"toolCall" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }]
					: [{ type: "text" as const, text: turn.text }];
			return { content, finishReason: { unified: "toolCall" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined }, usage, warnings: [] };
		},
	});
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), undefined, shop as ShopTools);
	const script = (next: Turn[]) => {
		turns = next;
		call = 0;
		prompts.length = 0;
	};
	return { service, store, prompts, script };
}

const ask = {
	toolCallId: "call_1",
	question: { id: "q_pics", kind: "images" as const, label: "Photos", title: "Choose new photos for “Featured collection”", options: [], multiple: true, allowText: false, allowSkip: true },
	index: 0,
	total: 1,
};

describe("a message instead of an answer [TC-AICP-132]", () => {
	const base = { role: "merchant" as const, domain: "webbuilder" as const, prompt: "p", steps: [], receipts: [], startedAt: "x", changeSetIds: [] };

	it("keeps the unanswered run as a turn, with the open question noted", () => {
		const record = { run: { ...base, id: "run_a", status: "awaiting_input" as const, answer: "These are 6 sample pictures.", ask }, userMessage: "Replace the featured collection pictures" };

		expect(runTurn(record, new Map())).toBeNull();
		expect(historyMessages([record], new Map())).toEqual([
			{ role: "user", content: "Replace the featured collection pictures" },
			{
				role: "assistant",
				content: "These are 6 sample pictures.\n[Asked the merchant: Choose new photos for “Featured collection” — not answered; their next message came instead]",
			},
		]);
	});

	it("the next message knows that request and the photos found while it waited", async () => {
		const searchMedia = vi.fn(async () => [1, 2, 3].map((n) => ({ ref: `pixabay:${n}`, name: `hijab ${n}`, url: `https://cdn.pixabay.com/${n}.jpg`, credit: "Pixabay · x" })));
		const { service, store, prompts, script } = setup({ searchMedia });
		script([{ toolCall: { name: "find_images", input: { query: "hijab", source: "stock", count: 3 } } }, { text: "Which section?" }]);
		const first = await service.start(ctx, { prompt: "Find 3 hijab photos and put them in the featured collection", context: { module: "editor" } }, () => undefined);
		// the run paused on a question the merchant never answered
		const row = store.runs.get(first.id)!;
		row.run = { ...row.run, status: "awaiting_input", ask };

		script([{ text: "Staging those three." }]);
		await service.start(ctx, { prompt: "Use those 3", threadId: first.threadId, context: { module: "editor" } }, () => undefined);

		expect(prompts[0]).toContain("Find 3 hijab photos and put them in the featured collection");
		expect(prompts[0]).toContain("not answered; their next message came instead");
		expect(prompts[0]).toContain("Pictures in this chat");
		expect(prompts[0]).toContain("img_3");
	});
});

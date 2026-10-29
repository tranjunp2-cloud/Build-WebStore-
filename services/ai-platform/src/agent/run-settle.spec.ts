import type { AgentRun } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ChangeSetDecisionService } from "./change-set-decision.service";

// TC-AIREL-294, 299 — a decision never overwrites a run that is still working (it settles once the run
// ends), and Stop never overwrites a run that ended between its read and its write.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
const productCall = {
	name: "propose_product_drafts",
	input: { locale: "en-US", products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }] },
};

/** Stages a product draft, then runs `whileWorking` inside its second model call before it replies. */
function setup(whileWorking: (store: InMemoryAgentStore) => Promise<void>) {
	const store = new InMemoryAgentStore();
	let calls = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			calls += 1;
			if (calls === 1) {
				return {
					content: [{ type: "tool-call" as const, toolCallId: "call_1", toolName: productCall.name, input: JSON.stringify(productCall.input) }],
					finishReason: { unified: "tool-calls" as const, raw: undefined },
					usage,
					warnings: [],
				};
			}
			await whileWorking(store);
			return { content: [{ type: "text" as const, text: "Drafted 1 product." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
		},
	});
	const env = testEnv();
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	return { store, runs: new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env)), decisions: new ChangeSetDecisionService(store) };
}

describe("a card approved while its run works [TC-AIREL-294]", () => {
	it("TC-AIREL-294: the run stays working, then settles to applied when it finishes", async () => {
		// Arrange
		let duringRun: string | undefined;
		const { store, runs, decisions } = setup(async (s) => {
			const [draft] = await s.listChangeSets("org_1", { limit: 10 });
			await decisions.claim(ctx, draft?.id as string);
			await decisions.decide(ctx, draft?.id as string, { decision: "approve" });
			duringRun = s.runs.get(draft?.runId as string)?.run.status;
		});

		// Act
		const run = await runs.start(ctx, { prompt: "Create a draft for a batik scarf", context: { module: "products" } }, () => undefined);

		// Assert
		expect(duringRun).toBe("planning");
		expect(run.status).toBe("applied");
		expect(store.runs.get(run.id)?.run).toMatchObject({ status: "applied", answer: "Drafted 1 product." });
	});

	it("TC-AIREL-294: a run whose card is still pending ends awaiting approval, and settles on the decision", async () => {
		// Arrange
		const { store, runs, decisions } = setup(async () => undefined);
		const run = await runs.start(ctx, { prompt: "Create a draft for a batik scarf", context: { module: "products" } }, () => undefined);
		expect(run.status).toBe("awaiting_approval");
		const [draft] = await store.listChangeSets("org_1", { limit: 10 });

		// Act
		await decisions.decide(ctx, draft?.id as string, { decision: "reject" });

		// Assert
		expect(store.runs.get(run.id)?.run).toMatchObject({ status: "rejected", answer: "Drafted 1 product." });
	});
});

describe("Stop never overwrites a run that just ended [TC-AIREL-299]", () => {
	it("TC-AIREL-299: a run that finished between Stop's read and its write keeps its end", async () => {
		// Arrange: a paused run, finished elsewhere right after Stop read it
		const store = new InMemoryAgentStore();
		const paused: AgentRun = {
			id: "run_1",
			role: "merchant",
			domain: "cms",
			prompt: "write a note",
			status: "awaiting_input",
			steps: [],
			receipts: [],
			changeSetIds: [],
			startedAt: new Date().toISOString(),
		};
		await store.createRun(ctx, paused, "write a note");
		const read = store.getRun.bind(store);
		vi.spyOn(store, "getRun").mockImplementationOnce(async (...args) => {
			const found = await read(...args);
			(store.runs.get("run_1") as { run: AgentRun }).run = { ...paused, status: "applied", answer: "Done." };
			return found;
		});
		const env = testEnv();
		const runs = new AgentRunService(store, { resolveChain: () => [] }, ledger, env, new AgentThreadService(store, env));

		// Act
		const result = await runs.cancel(ctx, "run_1");

		// Assert
		expect(result.status).toBe("applied");
		expect(store.runs.get("run_1")?.run).toMatchObject({ status: "applied", answer: "Done." });
	});

	it("TC-AIREL-299: a paused run is stopped as before", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		await store.createRun(
			ctx,
			{ id: "run_2", role: "merchant", domain: "cms", prompt: "x", status: "awaiting_input", steps: [], receipts: [], changeSetIds: [], startedAt: new Date().toISOString() },
			"x",
		);
		const env = testEnv();
		const runs = new AgentRunService(store, { resolveChain: () => [] }, ledger, env, new AgentThreadService(store, env));

		// Act
		const result = await runs.cancel(ctx, "run_2");

		// Assert
		expect(result.status).toBe("cancelled");
		expect(store.runs.get("run_2")?.run.status).toBe("cancelled");
	});
});

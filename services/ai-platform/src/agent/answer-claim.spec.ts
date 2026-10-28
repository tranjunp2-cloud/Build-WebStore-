import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { SpendGuard } from "../cost/spend-guard";
import { DecisionService } from "../decide/decision.service";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { QuestionFlowService } from "./ask/question-flow";
import { THREAD_BUSY } from "./run-queue";
import { STALE_RUN_ERROR } from "./stale-run";

// TC-AIREL-290..293, 298, TC-AISEC-145 — answering a question claims the paused run first
// (awaiting_input → running in one conditional write): a second answer gets 409 and no model call,
// the chat is busy while it works, a refused answer leaves the question open, the stale-run sweep
// closes a claimed run whose process was killed, and the answer path respects the daily spend cap.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };

const ASK = {
	purpose: "custom",
	product: null,
	questions: [
		{
			id: "tone",
			title: "Friendly or formal?",
			why: null,
			options: [
				{ value: "friendly", label: "Friendly" },
				{ value: "formal", label: "Formal" },
			],
			multiple: false,
			pictures: null,
		},
	],
};

/** First call asks the question; every later call runs `onReply` (while the model "works") and answers in text. */
function askingModel(onReply: () => Promise<void> | void = () => undefined) {
	let calls = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			calls += 1;
			if (calls === 1) {
				return {
					content: [{ type: "tool-call" as const, toolCallId: "call_1", toolName: "ask_user", input: JSON.stringify(ASK) }],
					finishReason: { unified: "tool-calls" as const, raw: undefined },
					usage,
					warnings: [],
				};
			}
			await onReply();
			return { content: [{ type: "text" as const, text: "Done." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
		},
	});
	return { model, calls: () => calls };
}

function service(store: InMemoryAgentStore, model: MockLanguageModelV4, spend?: SpendGuard) {
	const env = testEnv();
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const flows = new QuestionFlowService({} as ShopTools, new DecisionService(store, ledger, env), store);
	return new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows, undefined, undefined, spend);
}

async function pausedRun(onReply?: () => Promise<void> | void) {
	const store = new InMemoryAgentStore();
	const asking = askingModel(onReply);
	const runs = service(store, asking.model);
	const paused = await runs.start(ctx, { prompt: "write a welcome note for new customers" }, () => undefined);
	const answer = { toolCallId: paused.ask?.toolCallId as string, questionId: paused.ask?.question.id as string, values: ["friendly"] };
	return { store, runs, paused, answer, calls: asking.calls, model: asking.model };
}

describe("an answer claims the paused run [TC-AIREL-290]", () => {
	it("TC-AIREL-290: two answers sent at once: one runs, the other gets 409, the model is called once", async () => {
		// Arrange
		const { runs, paused, answer, calls } = await pausedRun();
		expect(paused.status).toBe("awaiting_input");
		const before = calls();

		// Act
		const results = await Promise.allSettled([
			runs.answer(ctx, paused.id, answer, () => undefined),
			runs.answer(ctx, paused.id, answer, () => undefined),
		]);

		// Assert
		const done = results.filter((r) => r.status === "fulfilled");
		const refused = results.filter((r) => r.status === "rejected");
		expect(done).toHaveLength(1);
		expect(refused).toHaveLength(1);
		expect((refused[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
		expect(calls() - before).toBe(1);
	});

	it("TC-AIREL-290: an answer to a finished run is a 409, to an unknown run a 404", async () => {
		// Arrange
		const { runs, paused, answer } = await pausedRun();
		await runs.answer(ctx, paused.id, answer, () => undefined);

		// Act + Assert
		await expect(runs.answer(ctx, paused.id, answer, () => undefined)).rejects.toMatchObject({ status: 409 });
		await expect(runs.answer(ctx, "run_missing", answer, () => undefined)).rejects.toMatchObject({ status: 404 });
	});
});

describe("a question left for a newer message [TC-AIREL-290]", () => {
	it("TC-AIREL-290: answering after a newer message was sent in the chat is a 409, nothing runs", async () => {
		// Arrange
		const { store, runs, paused, answer, calls } = await pausedRun();
		await store.createRun(ctx, { ...paused, id: "run_newer", status: "applied" }, "something else");
		(store.runs.get("run_newer") as { createdAt: Date }).createdAt = new Date(Date.now() + 1_000);
		const before = calls();

		// Act
		const answering = runs.answer(ctx, paused.id, answer, () => undefined);

		// Assert
		await expect(answering).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/no longer open/) });
		expect(store.runs.get(paused.id)?.run.status).toBe("awaiting_input");
		expect(calls()).toBe(before);
	});
});

describe("a claimed run is working [TC-AIREL-291]", () => {
	it("TC-AIREL-291: the row says running while the model works, and the chat refuses a second message", async () => {
		// Arrange
		let seen: string | undefined;
		let busy: unknown;
		const setup = await pausedRun(async () => {
			const id = setup.paused.id;
			seen = setup.store.runs.get(id)?.run.status;
			busy = await setup.runs.reserve(ctx, { threadId: setup.paused.threadId }).catch((error: unknown) => error);
		});

		// Act
		const done = await setup.runs.answer(ctx, setup.paused.id, setup.answer, () => undefined);

		// Assert
		expect(seen).toBe("running");
		expect(busy).toMatchObject({ status: 409, message: THREAD_BUSY });
		expect(done.status).toBe("applied");
		expect(setup.store.runs.get(setup.paused.id)?.run.status).toBe("applied");
	});
});

describe("a refused answer leaves the question open [TC-AIREL-292]", () => {
	it("TC-AIREL-292: an answer to another question is a 409 and the run waits again, its state kept", async () => {
		// Arrange
		const { store, runs, paused, answer, calls } = await pausedRun();
		const before = calls();

		// Act
		const wrong = runs.answer(ctx, paused.id, { ...answer, questionId: "not_this_one" }, () => undefined);

		// Assert
		await expect(wrong).rejects.toMatchObject({ status: 409 });
		expect(store.runs.get(paused.id)?.run.status).toBe("awaiting_input");
		expect((store.runs.get(paused.id)?.state as { flow?: unknown } | null)?.flow).toBeTruthy();
		expect(calls()).toBe(before);
		// the right answer still goes through
		expect((await runs.answer(ctx, paused.id, answer, () => undefined)).status).toBe("applied");
	});
});

describe("the stale-run sweep closes a claimed run [TC-AIREL-293]", () => {
	it("TC-AIREL-293: a run claimed by an answer whose process was killed is failed, an open question is not", async () => {
		// Arrange
		const { store, paused } = await pausedRun();
		await store.createRun(ctx, { ...paused, id: "run_still_waiting", threadId: "thr_other" }, "hi");
		expect(await store.claimAwaitingInput("org_1", paused.id, "usr_1", new Date(Date.now() - 20 * 60_000))).not.toBeNull();

		// Act
		const closed = await store.failStaleRuns(new Date(Date.now() + 60_000), STALE_RUN_ERROR);

		// Assert
		expect(closed).toBe(1);
		expect(store.runs.get(paused.id)?.run).toMatchObject({ status: "failed", error: STALE_RUN_ERROR });
		expect(store.runs.get(paused.id)?.state).toBeNull();
		expect(store.runs.get("run_still_waiting")?.run.status).toBe("awaiting_input");
	});
});

describe("the answer path respects the daily spend cap [TC-AISEC-145]", () => {
	it("TC-AISEC-145: over AI_DAILY_BUDGET_USD an answer is a 503, no model call, the question still open", async () => {
		// Arrange
		const { store, paused, answer, calls, model } = await pausedRun();
		const before = calls();
		const overBudget = new SpendGuard(5, async () => 6_000_000);
		const capped = service(store, model, overBudget);

		// Act
		const answering = capped.answer(ctx, paused.id, answer, () => undefined);

		// Assert
		await expect(answering).rejects.toMatchObject({ status: 503 });
		expect(calls()).toBe(before);
		expect(store.runs.get(paused.id)?.run.status).toBe("awaiting_input");
	});
});

describe("an option search never overwrites a claimed run [TC-AIREL-298]", () => {
	it("TC-AIREL-298: the picture search's state write is dropped when an answer claimed the run meanwhile", async () => {
		// Arrange: a paused run whose search answers slowly; an answer claims it and writes its own state meanwhile
		const store = new InMemoryAgentStore();
		await store.createRun(ctx, { ...(await pausedRun()).paused, id: "run_q" }, "hi");
		await store.saveRunState("org_1", "run_q", { flow: { steps: [] }, marker: "paused" });
		const flows = {
			searchOptions: async () => {
				await store.claimAwaitingInput("org_1", "run_q", "usr_1", new Date());
				await store.saveRunState("org_1", "run_q", { flow: null, marker: "answer" });
				return [{ value: "img_1", label: "Batik", imageUrl: "https://cdn.example/batik.jpg" }];
			},
		} as unknown as QuestionFlowService;
		const env = testEnv();
		const runs = new AgentRunService(store, { resolveChain: () => [] }, ledger, env, new AgentThreadService(store, env), flows);

		// Act
		await runs.searchOptions(ctx, "run_q", "tone", "batik");

		// Assert
		expect(store.runs.get("run_q")?.run.status).toBe("running");
		expect(store.runs.get("run_q")?.state).toMatchObject({ marker: "answer" });
	});
});

import type { AgentRun, AgentThread, ChangeSet } from "@ech/agent-core";
import { AiWorkSchema, WorkStateSchema } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { threadTaskQuery } from "./agent.controller";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { AgentWorkService } from "./agent-work.service";
import { threadStatus } from "./thread-status";

// TC-WQ-010..030 — the AI platform's side of the merchant work queue: chats
// started from a to-do item (task chats), a chat's status as a job, and the
// per-user work snapshot + item states behind the mascot / dock / To do card.

type Turn = { toolCall: { name: string; input: unknown } } | { text: string };

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", locale: "en-MY" };
const colleague: AiRequestContext = { ...ctx, userId: "usr_2" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-10-22T08:00:00Z");
const noop = (_frame: RunFrame) => undefined;

function setup(turns: Turn[] = [{ text: "ok" }]) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	});
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"toolCall" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }]
					: [{ type: "text" as const, text: turn.text }];
			return { content, finishReason: { unified: "toolCall" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined }, usage, warnings: [] };
		},
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "deepseek", modelId: "deepseek-chat" }] };
	const threads = new AgentThreadService(store, env);
	return { store, threads, runs: new AgentRunService(store, models, ledger, env, threads), work: new AgentWorkService(store, threads) };
}

const productDraft: Turn = {
	toolCall: { name: "propose_product_drafts", input: { locale: "en-US", products: [{ name: "Batik Silk Scarf", description: "Scarf." }] } },
};

// Arrange helpers: records written through the store port, as the run service writes them.
function chat(id: string, at: Date, extra: Partial<AgentThread> = {}): AgentThread {
	return { id, title: `Chat ${id}`, runCount: 1, createdAt: at.toISOString(), updatedAt: at.toISOString(), ...extra };
}

function run(id: string, threadId: string, status: AgentRun["status"], extra: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "products",
		prompt: "do it",
		status,
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId,
		startedAt: NOW.toISOString(),
		...extra,
	};
}

function draft(id: string, runId: string, stagedAt: Date, extra: Partial<ChangeSet> = {}): ChangeSet {
	return {
		id,
		runId,
		domain: "products",
		title: id,
		summary: "",
		risk: "low",
		blastRadius: { kind: "product", count: 1, label: "1 product" },
		diffs: [{ entity: { kind: "product", id: "p1" }, field: "title", before: "a", after: "b", provenance: "generated" }],
		guardrails: [],
		status: "pending",
		stagedBy: "agent",
		stagedAt: stagedAt.toISOString(),
		expiresAt: new Date(stagedAt.getTime() + 24 * HOUR_MS).toISOString(),
		...extra,
	} as ChangeSet;
}

const ask = (title: string): AgentRun["ask"] => ({
	toolCallId: "call_ask",
	question: { id: "q1", kind: "choice", label: "Posts", title, options: [], multiple: false, allowText: false, allowSkip: false },
	index: 0,
	total: 1,
});

afterEach(() => vi.useRealTimers());

describe("task chats [TC-WQ-010..012]", () => {
	it("[TC-WQ-010] a chat started from a to-do item keeps the item's key and title, even after it stages a draft", async () => {
		// Arrange
		const { runs, threads, store } = setup([productDraft, { text: "Drafted." }]);

		// Act
		const started = await runs.start(ctx, { prompt: "please create a product for me", task: { key: "shop:orders_to_confirm", title: "3 orders waiting to be confirmed" } }, noop);

		// Assert
		const id = started.threadId as string;
		expect(store.threads.get(id)).toMatchObject({ titleSource: "task", thread: { taskKey: "shop:orders_to_confirm" } });
		const [listed] = await threads.list(ctx, 5);
		// a draft retitles an "auto" chat ("Batik Silk Scarf — new product"); a task chat keeps the item's title
		expect(listed).toMatchObject({ id, title: "3 orders waiting to be confirmed", taskKey: "shop:orders_to_confirm", status: "needs_you", pendingDrafts: 1 });
		expect((await threads.detail(ctx, id)).thread).toMatchObject({ taskKey: "shop:orders_to_confirm", status: "needs_you" });
	});

	it("[TC-WQ-011] ignores the task when continuing a chat", async () => {
		// Arrange
		const { runs, store } = setup();
		const first = await runs.start(ctx, { prompt: "Draft a scarf" }, noop);

		// Act
		await runs.start(ctx, { prompt: "and another", threadId: first.threadId, task: { key: "shop:low_stock", title: "5 products running low" } }, noop);

		// Assert
		const row = store.threads.get(first.threadId as string);
		expect(row?.thread.title).toBe("Draft a scarf");
		expect(row?.thread.taskKey).toBeUndefined();
		expect(row?.titleSource).toBeUndefined();
	});

	it("[TC-WQ-012] ?task lists only that item's chats, and only the caller's", async () => {
		// Arrange
		const { runs, threads } = setup();
		const task = { key: "shop:orders_to_ship", title: "2 orders to ship" };
		const mine = await runs.start(ctx, { prompt: "ship them", task }, noop);
		await runs.start(ctx, { prompt: "free chat" }, noop);
		await runs.start(ctx, { prompt: "other task", task: { key: "shop:low_stock", title: "Low stock" } }, noop);
		await runs.start(colleague, { prompt: "ship them too", task }, noop);

		// Act
		const listed = await threads.list(ctx, 20, { taskKey: threadTaskQuery("shop:orders_to_ship") });

		// Assert
		expect(listed.map((t) => t.id)).toEqual([mine.threadId]);
		expect(threadTaskQuery("")).toBeUndefined();
		expect(() => threadTaskQuery("x".repeat(121))).toThrow();
	});
});

describe("chat status as a job [TC-WQ-015..017]", () => {
	it("[TC-WQ-015] derives needs_you / working / failed / done from waiting drafts and the latest run", () => {
		expect(threadStatus(2, "applied")).toBe("needs_you");
		expect(threadStatus(0, "awaiting_input")).toBe("needs_you");
		expect(threadStatus(1, "failed")).toBe("needs_you");
		for (const status of ["planning", "running", "applying"] as const) expect(threadStatus(0, status)).toBe("working");
		expect(threadStatus(0, "failed")).toBe("failed");
		for (const status of ["awaiting_approval", "applied", "rejected", "cancelled", undefined] as const) expect(threadStatus(0, status)).toBe("done");
	});

	it("[TC-WQ-016] a draft past its expiry no longer counts as waiting, before anyone flips it", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { runs, threads, work } = setup([productDraft, { text: "Drafted." }]);
		const started = await runs.start(ctx, { prompt: "create a scarf product" }, noop);
		const id = started.threadId as string;
		expect((await threads.list(ctx, 5))[0]).toMatchObject({ pendingDrafts: 1, status: "needs_you" });

		// Act — a day and a minute later the draft's approval window is over (its row still says pending)
		vi.setSystemTime(new Date(NOW.getTime() + 24 * HOUR_MS + 60_000));

		// Assert
		expect((await threads.list(ctx, 5))[0]).toMatchObject({ id, pendingDrafts: 0, status: "done" });
		expect((await threads.detail(ctx, id)).thread.status).toBe("done");
		expect((await work.work(ctx)).reviews).toEqual([]);
	});

	it("[TC-WQ-017] a chat whose latest run failed reads failed; one still working reads working", async () => {
		// Arrange
		const { store, threads } = setup();
		await store.createThread(ctx, chat("thr_fail", NOW));
		await store.createRun(ctx, run("run_1", "thr_fail", "failed", { error: "boom" }));
		await store.createThread(ctx, chat("thr_busy", new Date(NOW.getTime() + 1000)));
		await store.createRun(ctx, run("run_2", "thr_busy", "running"));

		// Act
		const listed = await threads.list(ctx, 5);

		// Assert
		expect(listed.map((t) => [t.id, t.status])).toEqual([
			["thr_busy", "working"],
			["thr_fail", "failed"],
		]);
	});
});

describe("GET agent/work [TC-WQ-020..024]", () => {
	async function seeded() {
		const env = setup();
		const { store } = env;
		const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
		// a task chat with two waiting drafts, one needing a typed confirmation
		await store.createThread(ctx, chat("thr_rev", at(1), { title: "Confirm 3 orders", taskKey: "shop:orders_to_confirm" }));
		await store.createRun(ctx, run("run_rev", "thr_rev", "awaiting_approval", { context: { module: "orders" } as AgentRun["context"] }));
		await store.insertChangeSet(ctx.organizationId, draft("cs_a", "run_rev", at(-30), { title: "Confirm order #1042", action: { kind: "store.orders_patch", payload: {} } } as Partial<ChangeSet>));
		await store.insertChangeSet(ctx.organizationId, draft("cs_b", "run_rev", at(-10), { confirmText: "Order #1042" }));
		// an expired-but-unflipped draft and an applied one: not waiting
		await store.insertChangeSet(ctx.organizationId, draft("cs_old", "run_rev", new Date(NOW.getTime() - 30 * HOUR_MS)));
		await store.insertChangeSet(ctx.organizationId, draft("cs_done", "run_rev", at(-5), { status: "applied" }));
		// a free chat paused on a question
		await store.createThread(ctx, chat("thr_ask", at(2), { title: "Translate posts" }));
		await store.createRun(ctx, run("run_ask", "thr_ask", "awaiting_input", { domain: "cms", ask: ask("Which posts should I translate?") }));
		// a question the merchant moved past (a newer message in the same chat): not waiting on them
		await store.createThread(ctx, chat("thr_moved", at(3)));
		await store.createRun(ctx, run("run_old_ask", "thr_moved", "awaiting_input", { ask: ask("Old question?") }));
		await store.createRun(ctx, run("run_new", "thr_moved", "applied"));
		// a finished task chat
		await store.createThread(ctx, chat("thr_done", at(4), { taskKey: "shop:low_stock" }));
		await store.createRun(ctx, run("run_done", "thr_done", "applied"));
		// the colleague's chats never show up
		await store.createThread(colleague, chat("thr_theirs", at(5), { taskKey: "shop:orders_to_confirm" }));
		await store.createRun(colleague, run("run_theirs", "thr_theirs", "awaiting_input", { ask: ask("Theirs?") }));
		await store.insertChangeSet(ctx.organizationId, draft("cs_theirs", "run_theirs", at(-20)));
		return env;
	}

	it("[TC-WQ-020] returns the caller's waiting drafts per chat: count, oldest wait, domain/module, task, hand-only and what approving does", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { work } = await seeded();

		// Act
		const result = await work.work(ctx);

		// Assert
		expect(AiWorkSchema.parse(result)).toEqual(result);
		expect(result.reviews).toEqual([
			{
				threadId: "thr_rev",
				title: "Confirm 3 orders",
				count: 2,
				since: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
				domain: "products",
				module: "orders",
				taskKey: "shop:orders_to_confirm",
				handOnly: true,
				change: { title: "Confirm order #1042", actionKind: "store.orders_patch" },
			},
		]);
	});

	it("[TC-WQ-021] returns open questions only where the question is the chat's latest turn", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { work } = await seeded();

		// Act
		const { questions } = await work.work(ctx);

		// Assert
		expect(questions).toEqual([
			{ threadId: "thr_ask", runId: "run_ask", title: "Translate posts", question: "Which posts should I translate?", since: NOW.toISOString(), domain: "cms" },
		]);
	});

	it("[TC-WQ-022] lists the caller's task chats newest first with their status", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { work } = await seeded();

		// Act
		const { tasks } = await work.work(ctx);

		// Assert
		expect(tasks).toEqual([
			{ taskKey: "shop:low_stock", threadId: "thr_done", status: "done", updatedAt: new Date(NOW.getTime() + 4 * 60_000).toISOString() },
			{ taskKey: "shop:orders_to_confirm", threadId: "thr_rev", status: "needs_you", updatedAt: new Date(NOW.getTime() + 60_000).toISOString() },
		]);
	});

	it("[TC-WQ-023] excludes another user's chats, and the colleague sees only their own", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { work } = await seeded();

		// Act
		const mine = await work.work(ctx);
		const theirs = await work.work(colleague);

		// Assert
		const ids = (w: typeof mine) => [...w.reviews, ...w.questions, ...w.tasks].map((item) => item.threadId);
		expect(ids(mine)).not.toContain("thr_theirs");
		expect(new Set(ids(theirs))).toEqual(new Set(["thr_theirs"]));
	});

	it("[TC-WQ-024] leaves out chats past retention", async () => {
		// Arrange
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		const { work } = await seeded();

		// Act — 91 days later every seeded chat is past the 90-day retention
		vi.setSystemTime(new Date(NOW.getTime() + 91 * 24 * HOUR_MS));
		const result = await work.work(ctx);

		// Assert
		expect(result).toMatchObject({ reviews: [], questions: [], tasks: [] });
	});
});

describe("PUT agent/work/state/:key [TC-WQ-025..030]", () => {
	it("[TC-WQ-025] upserts a snooze and a dismissal, returned in the work snapshot", async () => {
		// Arrange
		const { work } = setup();
		const until = new Date(NOW.getTime() + 3 * HOUR_MS).toISOString();

		// Act
		await work.setState(ctx, "shop:orders_to_confirm", { snoozedUntil: until }, NOW);
		const state = await work.setState(ctx, "shop:orders_to_confirm", { dismissedFingerprint: "fp_1" }, new Date(NOW.getTime() + 1000));

		// Assert — the second write keeps the snooze it did not mention
		expect(WorkStateSchema.parse(state)).toEqual({
			key: "shop:orders_to_confirm",
			snoozedUntil: until,
			dismissedFingerprint: "fp_1",
			updatedAt: new Date(NOW.getTime() + 1000).toISOString(),
		});
		expect((await work.work(ctx)).states).toEqual([state]);
	});

	it("[TC-WQ-026] null clears a field; nulls are omitted, not returned", async () => {
		// Arrange
		const { work } = setup();
		await work.setState(ctx, "ai:review:thr_1", { snoozedUntil: NOW.toISOString(), dismissedFingerprint: "fp", lastRaisedAt: NOW.toISOString() }, NOW);

		// Act
		const state = await work.setState(ctx, "ai:review:thr_1", { snoozedUntil: null, dismissedFingerprint: null }, NOW);

		// Assert
		expect(state).toEqual({ key: "ai:review:thr_1", lastRaisedAt: NOW.toISOString(), updatedAt: NOW.toISOString() });
	});

	it("[TC-WQ-027] states are per user", async () => {
		// Arrange
		const { work } = setup();

		// Act
		await work.setState(ctx, "shop:low_stock", { dismissedFingerprint: "fp" }, NOW);

		// Assert
		expect((await work.work(colleague)).states).toEqual([]);
	});

	it("[TC-WQ-030] refuses a key over 120 characters and a date that is not one", async () => {
		// Arrange
		const { work } = setup();

		// Act / Assert
		await expect(work.setState(ctx, "x".repeat(121), {}, NOW)).rejects.toMatchObject({ status: 400 });
		await expect(work.setState(ctx, "shop:low_stock", { snoozedUntil: "tomorrow-ish" }, NOW)).rejects.toMatchObject({ status: 400 });
		expect((await work.work(ctx)).states).toEqual([]);
	});
});

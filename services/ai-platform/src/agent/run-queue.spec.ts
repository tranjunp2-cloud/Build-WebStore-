import type { AgentRun, RunQueue } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { MIGRATIONS } from "../database/migrations";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentController } from "./agent.controller";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import type { RunSlots } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { maxQueueWaitMs, placeInQueue, queueBusyLine, queueView, stoppedByLine, THREAD_BUSY } from "./run-queue";
import { STALE_RUN_ERROR } from "./stale-run";
import { threadStatus } from "./thread-status";

/**
 * TC-AISEC-120..132 — the copilot queue: per-org / per-user working caps queue (FIFO) instead of refusing,
 * a queued run shows its place, takes a freed slot by itself, leaves the queue on Stop or after the longest
 * wait, starts its model budget only when it leaves the queue; owners / admins may stop a teammate's run;
 * one active run per chat; a repeated client request id attaches to the first run.
 */

const member = (n: number, extra: Partial<AiRequestContext> = {}): AiRequestContext => ({
	organizationId: "org_1",
	userId: `usr_${n}`,
	role: "editor",
	name: `Member ${n}`,
	locale: "en-MY",
	...extra,
});
const owner: AiRequestContext = member(9, { role: "owner", name: "Siti" });

const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 2, text: 2, reasoning: undefined },
};
const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };

/** Each model call waits until the test lets it answer (or its run is stopped). */
function gatedModel() {
	const waiting: Array<() => void> = [];
	const model = new MockLanguageModelV4({
		doGenerate: (options: Parameters<MockLanguageModelV4["doGenerate"]>[0]) =>
			new Promise((resolve, reject) => {
				const answer = () =>
					resolve({ content: [{ type: "text", text: "Done." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] });
				// a stopped call leaves the line: the next answer goes to a call still waiting
				options.abortSignal?.addEventListener("abort", () => {
					waiting.splice(waiting.indexOf(answer), 1);
					reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
				});
				waiting.push(answer);
			}),
	});
	return {
		model,
		calls: () => model.doGenerateCalls.length,
		/** answers the oldest waiting call */
		answer: () => waiting.shift()?.(),
	};
}

function setup(env: Record<string, string> = {}, store = new InMemoryAgentStore(), gate = gatedModel()) {
	const parsed = testEnv({ AI_MAX_RUNNING_RUNS_PER_ORG: "1", AI_QUEUE_POLL_MS: "100", AI_RUN_CANCEL_POLL_MS: "100", ...env });
	const models: ModelRegistry = { resolveChain: () => [{ model: gate.model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const threads = new AgentThreadService(store, parsed);
	const service = new AgentRunService(store, models, ledger, parsed, threads);
	return { service, store, gate, threads, env: parsed };
}

/** What the controller does: reserve, then start under the reserved id, collecting the frames. */
async function startOn(service: AgentRunService, who: AiRequestContext, prompt = "Write a post about batik care") {
	const frames: RunFrame[] = [];
	const reserved = await service.reserve(who);
	const done = service.start(who, { prompt }, (frame) => frames.push(frame), undefined, reserved.runId);
	return { runId: reserved.runId, queued: reserved.queued, frames, done, queuedFrames: () => frames.filter((f): f is Extract<RunFrame, { type: "run.queued" }> => f.type === "run.queued") };
}

const lastQueued = (frames: RunFrame[]): RunQueue | undefined => {
	const frame = [...frames].reverse().find((f) => f.type === "run.queued");
	return frame?.type === "run.queued" ? frame : undefined;
};

/** A run row as a process left it (no process drives it here). */
async function seedRun(store: InMemoryAgentStore, who: AiRequestContext, id: string, status: AgentRun["status"], extra: Partial<AgentRun> = {}, ageMs = 0) {
	await store.createRun(who, { id, role: "merchant", domain: "cms", prompt: "Restock report", status, steps: [], receipts: [], changeSetIds: [], startedAt: new Date().toISOString(), ...extra });
	const row = store.runs.get(id);
	if (row) row.updatedAt = new Date(Date.now() - ageMs);
}

const waitFor = (check: () => void) => vi.waitFor(check, { timeout: 4000, interval: 20 });

afterEach(() => {
	vi.useRealTimers();
});

describe("working caps queue instead of refusing [TC-AISEC-120]", () => {
	it("queues the 4th start of a shop when AI_MAX_RUNNING_RUNS_PER_ORG (default 3) are working", async () => {
		// Arrange
		const { service } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "3" });
		const first = await Promise.all([1, 2, 3].map((n) => service.reserve(member(n))));

		// Act
		const fourth = await service.reserve(member(4));

		// Assert
		expect(first.map((r) => r.queued)).toEqual([false, false, false]);
		expect(fourth).toMatchObject({ queued: true, replay: false });
	});

	it("queues one person's start beyond AI_MAX_RUNNING_RUNS_PER_USER while the shop has room, and lets others start", async () => {
		// Arrange
		const { service } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "10", AI_MAX_RUNNING_RUNS_PER_USER: "2" });
		await service.reserve(member(1));
		await service.reserve(member(1));

		// Act
		const third = await service.reserve(member(1));
		const teammate = await service.reserve(member(2));

		// Assert
		expect(third.queued).toBe(true);
		expect(teammate.queued).toBe(false);
	});

	it("does not count paused runs (awaiting input / approval) as working", async () => {
		// Arrange
		const { service, store } = setup();
		await seedRun(store, member(1), "run_question", "awaiting_input");
		await seedRun(store, member(1), "run_drafts", "awaiting_approval");

		// Act + Assert
		await expect(service.reserve(member(2))).resolves.toMatchObject({ queued: false });
	});

	it("places a waiter behind earlier ones that fit, but never behind one held by its own person's cap", () => {
		// Arrange
		const slots: RunSlots = {
			working: [{ runId: "r1", userId: "u1", threadId: null, threadTitle: null, prompt: "x", userName: null, startedAt: new Date(), pending: false }],
			queue: [
				{ runId: "q1", userId: "u1", queuedAt: new Date(1) },
				{ runId: "q2", userId: "u2", queuedAt: new Date(2) },
			],
		};

		// Act
		const held = placeInQueue(slots, { runId: "q1", userId: "u1" }, { org: 3, user: 1 });
		const next = placeInQueue(slots, { runId: "q2", userId: "u2" }, { org: 3, user: 1 });
		const fresh = placeInQueue(slots, { runId: "new", userId: "u3" }, { org: 2, user: 1 });

		// Assert
		expect(held).toEqual({ admitted: false, position: 1, ahead: 0 });
		expect(next).toEqual({ admitted: true, position: 2, ahead: 1 });
		expect(fresh).toEqual({ admitted: false, position: 3, ahead: 2 });
	});
});

describe("FIFO waiters and their place [TC-AISEC-121]", () => {
	it("starts parallel waiters in queue order as slots free up, re-sending each one's place when it moves", async () => {
		// Arrange
		const { service, gate } = setup();
		const a = await startOn(service, member(1));
		await waitFor(() => expect(gate.calls()).toBe(1));
		const [b, c] = await Promise.all([startOn(service, member(2)), startOn(service, member(3))]);
		await waitFor(() => expect(c.queuedFrames()).toHaveLength(1));

		// Act
		const before = { b: lastQueued(b.frames), c: lastQueued(c.frames) };
		gate.answer(); // A finishes: its slot goes to B (queued first), C moves up
		await waitFor(() => expect(gate.calls()).toBe(2));
		await waitFor(() => expect(lastQueued(c.frames)?.position).toBe(1));
		gate.answer(); // B finishes: C starts
		await waitFor(() => expect(gate.calls()).toBe(3));
		gate.answer();
		const runs = await Promise.all([a.done, b.done, c.done]);

		// Assert
		expect([a.queued, b.queued, c.queued]).toEqual([false, true, true]);
		expect(b.frames[0]).toMatchObject({ type: "run.started", run: { status: "queued" } });
		expect(before.b).toMatchObject({ position: 1, ahead: 0 });
		expect(before.c).toMatchObject({ position: 2, ahead: 1 });
		expect(c.queuedFrames().map((f) => f.position)).toEqual([2, 1]);
		expect(b.frames.find((f) => f.type === "run.status")).toMatchObject({ status: "planning" });
		expect(runs.map((run) => run.status)).toEqual(["applied", "applied", "applied"]);
	});

	it("lists what is working in the frame (a member sees only their own requests)", async () => {
		// Arrange
		const { service, gate } = setup();
		const a = await startOn(service, member(1), "Write a post about batik care");
		await waitFor(() => expect(gate.calls()).toBe(1));

		// Act
		const mine = await startOn(service, member(1), "Second message");
		const theirs = await startOn(service, member(2));
		await waitFor(() => expect(theirs.queuedFrames()).toHaveLength(1));

		// Assert
		expect(lastQueued(mine.frames)?.running).toEqual([
			expect.objectContaining({ runId: a.runId, mine: true, canStop: true, title: "Batik care", requestedBy: { name: "Member 1" } }),
		]);
		expect(lastQueued(theirs.frames)?.running).toEqual([]);
		await service.cancel(member(1), mine.runId);
		await service.cancel(member(2), theirs.runId);
		gate.answer();
		await Promise.all([a.done, mine.done, theirs.done]);
	});
});

describe("Stop one to run mine [TC-AISEC-122]", () => {
	it("an owner stops a teammate's running request: it ends with who stopped it, and the queued one takes the slot", async () => {
		// Arrange
		const { service, gate, store } = setup();
		const a = await startOn(service, member(1));
		await waitFor(() => expect(gate.calls()).toBe(1));
		const mine = await startOn(service, owner, "Write a post about songket weaving");
		await waitFor(() => expect(mine.queuedFrames()).toHaveLength(1));
		const item = lastQueued(mine.frames)?.running[0];

		// Act
		const returned = await service.cancel(owner, a.runId);
		const stopped = await a.done;
		await waitFor(() => expect(gate.calls()).toBe(2));
		gate.answer();
		const run = await mine.done;

		// Assert
		expect(item).toMatchObject({ runId: a.runId, mine: false, canStop: true, requestedBy: { name: "Member 1" } });
		expect(stopped).toMatchObject({ status: "cancelled", error: "Stopped by Siti to run another request." });
		expect((await store.getRun("org_1", a.runId))?.error).toBe("Stopped by Siti to run another request.");
		expect(returned).toMatchObject({ id: a.runId, status: "cancelled", prompt: "Batik care", steps: [], receipts: [] });
		expect(run.status).toBe("applied");
	});

	it("a Stop from another instance keeps the line on the run its driving instance saves", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		const driver = setup({}, store);
		const other = setup({}, store);
		const a = await startOn(driver.service, member(1, { locale: "ms-MY" }), "Tolong tulis pos tentang batik untuk kedai saya");
		await waitFor(() => expect(driver.gate.calls()).toBe(1));

		// Act
		await other.service.cancel(owner, a.runId);
		const stopped = await a.done;

		// Assert
		expect(stopped).toMatchObject({ status: "cancelled", error: stoppedByLine("Siti", "ms") });
		expect((await store.getRun("org_1", a.runId))?.error).toBe("Dihentikan oleh Siti untuk menjalankan permintaan lain.");
	});
});

describe("who may stop a teammate's request [TC-AISEC-123]", () => {
	it("owners and admins may; a member gets 404, and nobody may stop a teammate's finished run", async () => {
		// Arrange
		const { service, store } = setup();
		await seedRun(store, member(1), "run_working", "running");
		await seedRun(store, member(1), "run_finished", "applied");

		// Act
		const byMember = service.cancel(member(2), "run_working");
		const finished = service.cancel(owner, "run_finished");
		const byAdmin = await service.cancel(member(3, { role: "admin", name: "Aminah" }), "run_working");

		// Assert
		await expect(byMember).rejects.toMatchObject({ status: 404 });
		await expect(finished).rejects.toMatchObject({ status: 404 });
		expect(byAdmin).toMatchObject({ status: "cancelled", error: "Stopped by Aminah to run another request." });
		expect((await store.getRun("org_1", "run_working"))?.status).toBe("cancelled");
	});

	it("names a teammate in the stopped line even when the stopper's token has no name", () => {
		expect(stoppedByLine(undefined)).toBe("Stopped by a teammate to run another request.");
		expect(stoppedByLine(undefined, "vi")).toBe("Một đồng đội đã dừng yêu cầu này để chạy một yêu cầu khác.");
	});
});

describe("Stop on a queued request [TC-AISEC-124]", () => {
	it("takes it out of the queue at once, with no model call, and the next waiter moves up", async () => {
		// Arrange
		const { service, gate } = setup();
		const a = await startOn(service, member(1));
		await waitFor(() => expect(gate.calls()).toBe(1));
		const b = await startOn(service, member(2));
		const c = await startOn(service, member(3));
		await waitFor(() => expect(lastQueued(c.frames)?.position).toBe(2));

		// Act
		await service.cancel(member(2), b.runId);
		const stopped = await b.done;
		await waitFor(() => expect(lastQueued(c.frames)?.position).toBe(1));

		// Assert
		expect(stopped.status).toBe("cancelled");
		expect(gate.calls()).toBe(1);
		await service.cancel(member(3), c.runId);
		gate.answer();
		await Promise.all([a.done, c.done]);
	});

	it("a Stop that lands on another instance ends the wait on the instance holding it", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		const holder = setup({}, store);
		const other = setup({}, store);
		await seedRun(store, member(1), "run_busy", "running");
		const b = await startOn(holder.service, member(2));
		await waitFor(() => expect(b.queuedFrames()).toHaveLength(1));

		// Act
		await other.service.cancel(member(2), b.runId);
		const stopped = await b.done;

		// Assert
		expect(stopped.status).toBe("cancelled");
		expect(holder.gate.calls()).toBe(0);
	});
});

describe("the longest wait [TC-AISEC-125]", () => {
	it("ends a run still queued after the longest wait as failed with the busy line, without a model call", async () => {
		// Arrange
		const { service, store, gate } = setup({ AI_QUEUE_MAX_WAIT_MS: "300" });
		await seedRun(store, member(1), "run_busy", "running");

		// Act
		const b = await startOn(service, member(2));
		const run = await b.done;

		// Assert
		expect(run).toMatchObject({ status: "failed", error: queueBusyLine("en") });
		expect(run.error).toBe("The AI is busy with other requests in your shop right now. Try again in a minute.");
		expect((await store.getRun("org_1", b.runId))?.status).toBe("failed");
		expect(gate.calls()).toBe(0);
	});

	it("caps the wait so the wait plus the run budget stays within 290 s", () => {
		expect(maxQueueWaitMs({ AI_QUEUE_MAX_WAIT_MS: 120_000, AI_RUN_BUDGET_MS: 240_000 })).toBe(50_000);
		expect(maxQueueWaitMs({ AI_QUEUE_MAX_WAIT_MS: 120_000, AI_RUN_BUDGET_MS: 120_000 })).toBe(120_000);
		expect(maxQueueWaitMs({ AI_QUEUE_MAX_WAIT_MS: 120_000, AI_RUN_BUDGET_MS: 300_000 })).toBe(0);
	});
});

describe("the run budget starts when the run leaves the queue [TC-AISEC-126]", () => {
	it("a run that waited longer than its budget's slack still gets its whole budget", async () => {
		// Arrange: 30 s budget, no call starts with under 20 s left — 15 s in the queue would leave 15 s
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
		const textModel = new MockLanguageModelV4({
			doGenerate: async () => ({ content: [{ type: "text", text: "Done." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] }),
		});
		const { service, store } = setup({ AI_RUN_BUDGET_MS: "30000", AI_QUEUE_POLL_MS: "1000" }, new InMemoryAgentStore(), {
			model: textModel,
			calls: () => textModel.doGenerateCalls.length,
			answer: () => undefined,
		});
		await seedRun(store, member(1), "run_busy", "running");
		const b = await startOn(service, member(2));
		await vi.advanceTimersByTimeAsync(15_000);
		const queuedFor = Date.now();

		// Act
		const busy = store.runs.get("run_busy");
		if (busy) busy.run = { ...busy.run, status: "applied" };
		await vi.advanceTimersByTimeAsync(2_000);
		const run = await b.done;

		// Assert
		expect(run.status).toBe("applied");
		expect(textModel.doGenerateCalls).toHaveLength(1);
		expect(Date.parse(run.startedAt)).toBeGreaterThanOrEqual(queuedFor);
	});
});

describe("one active run per chat [TC-AISEC-127]", () => {
	it("answers 409 for a chat with a working or queued run, before the quota and without reserving anything", async () => {
		// Arrange
		const { service, store } = setup({ AI_DAILY_RUN_LIMIT_PER_ORG: "1" });
		await seedRun(store, member(1), "run_working", "running", { threadId: "thr_a" });
		await seedRun(store, member(1), "run_queued", "queued", { threadId: "thr_b" });
		const starts = store.runStarts.length;

		// Act
		const working = service.reserve(member(1), { threadId: "thr_a" });
		const queued = service.reserve(member(1), { threadId: "thr_b" });

		// Assert
		await expect(working).rejects.toMatchObject({ status: 409, message: THREAD_BUSY });
		await expect(queued).rejects.toMatchObject({ status: 409, message: "This chat is still working on your last message." });
		expect(store.runStarts).toHaveLength(starts);
	});

	it("lets a chat continue once its run is paused, finished, or was left stale by a killed process", async () => {
		// Arrange
		const { service, store } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "0" });
		await seedRun(store, member(1), "run_q", "awaiting_input", { threadId: "thr_a" });
		await seedRun(store, member(1), "run_done", "applied", { threadId: "thr_b" });
		await seedRun(store, member(1), "run_killed", "running", { threadId: "thr_c" }, 11 * 60_000);

		// Act + Assert
		for (const threadId of ["thr_a", "thr_b", "thr_c"]) {
			await expect(service.reserve(member(1), { threadId })).resolves.toMatchObject({ queued: false });
		}
	});
});

describe("a repeated start attaches to the first run [TC-AISEC-128]", () => {
	it("returns the same run for the same user and client request id within 10 minutes, reserving nothing", async () => {
		// Arrange
		const { service, store } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "0" });
		const first = await service.reserve(member(1), { clientRequestId: "req-1" });

		// Act
		const again = await service.reserve(member(1), { clientRequestId: "req-1" });
		const otherUser = await service.reserve(member(2), { clientRequestId: "req-1" });
		const later = await service.reserve(member(1), { clientRequestId: "req-1" }, new Date(Date.now() + 11 * 60_000));

		// Assert
		expect(again).toEqual({ runId: first.runId, queued: false, replay: true });
		expect(otherUser.replay).toBe(false);
		expect(later.replay).toBe(false);
		expect(store.runStarts.filter((s) => s.runId === first.runId)).toHaveLength(1);
	});

	it("the controller answers a repeated JSON start with the first run instead of a second one", async () => {
		// Arrange
		const { service, store, threads, env, gate } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "0" });
		const controller = new AgentController(service, {} as never, store, threads, {} as never, env, {} as never, { nudge: async () => undefined } as never, {} as never);
		const sent: Array<{ code: number; body: AgentRun }> = [];
		const reply = () => ({ code: (code: number) => ({ send: async (body: AgentRun) => void sent.push({ code, body }) }) }) as unknown as FastifyReply;
		const request = { headers: { accept: "application/json" } } as FastifyRequest;
		const body = { prompt: "Write a post about batik care", clientRequestId: "req-7" };
		const first = controller.startRun(member(1), body, request, reply());
		await waitFor(() => expect(gate.calls()).toBe(1));

		// Act
		await controller.startRun(member(1), body, request, reply());
		gate.answer();
		await first;

		// Assert
		expect(sent.map((s) => s.code)).toEqual([200, 201]);
		expect(sent[0]?.body.id).toBe(sent[1]?.body.id);
		expect(store.runs.size).toBe(1);
	});
});

describe("dead waiters and stale queued runs [TC-AISEC-129]", () => {
	it("a queued run that stopped checking in does not hold the queue, and the stale sweep closes it", async () => {
		// Arrange
		const { service, store } = setup();
		await seedRun(store, member(1), "run_dead", "queued", {}, 20_000);
		store.runStarts.push({ runId: "run_dead", orgId: "org_1", userId: "usr_1", createdAt: new Date(Date.now() - 25_000), queued: true });
		store.runStarts.push({ runId: "run_never_written", orgId: "org_1", userId: "usr_1", createdAt: new Date(Date.now() - 20_000), queued: true });

		// Act
		const next = await service.reserve(member(2));
		const closed = await store.failStaleRuns(new Date(Date.now() - 10_000), STALE_RUN_ERROR);

		// Assert
		expect(next.queued).toBe(false);
		expect(closed).toBe(1);
		expect(await store.getRun("org_1", "run_dead")).toMatchObject({ status: "failed", error: STALE_RUN_ERROR });
	});

	it("shows a chat whose run is queued as working", () => {
		expect(threadStatus(0, "queued")).toBe("working");
	});
});

describe("the queue frame [TC-AISEC-130]", () => {
	const slots: RunSlots = {
		working: [
			{ runId: "r1", userId: "usr_1", threadId: "thr_1", threadTitle: "Batik care", prompt: "Write about batik care", userName: "Ali", startedAt: new Date("2026-10-22T01:00:00Z"), pending: false },
			{ runId: "r2", userId: "usr_2", threadId: null, threadTitle: null, prompt: "Create a product: oversized cotton shirt, grey", userName: null, startedAt: new Date("2026-10-22T01:00:01Z"), pending: false },
			{ runId: "r3", userId: "usr_2", threadId: null, threadTitle: null, prompt: null, userName: null, startedAt: new Date("2026-10-22T01:00:02Z"), pending: true },
		],
		queue: [],
	};

	it("an owner sees every working request with who asked and may stop each; reserved-only starts are not listed", () => {
		// Act
		const view = queueView({ userId: "usr_9", role: "owner", name: "Siti" }, slots, { admitted: false, position: 2, ahead: 1 });

		// Assert
		expect(view).toEqual({
			position: 2,
			ahead: 1,
			running: [
				{ runId: "r1", threadId: "thr_1", title: "Batik care", requestedBy: { name: "Ali" }, startedAt: "2026-10-22T01:00:00.000Z", mine: false, canStop: true },
				{ runId: "r2", title: "Oversized cotton shirt", requestedBy: { name: null }, startedAt: "2026-10-22T01:00:01.000Z", mine: false, canStop: true },
			],
		});
	});

	it("a member sees only their own requests (chats are private)", () => {
		// Act
		const view = queueView({ userId: "usr_2", role: "viewer", name: "Mei" }, slots, { admitted: false, position: 1, ahead: 0 });

		// Assert
		expect(view.running.map((item) => [item.runId, item.mine, item.requestedBy.name])).toEqual([["r2", true, "Mei"]]);
	});
});

describe("rule-made suggestions and the queue migration [TC-AISEC-131]", () => {
	it("ships migration 014 as idempotent column adds and indexes", () => {
		// Arrange
		const statements = (MIGRATIONS.find((m) => m.name === "014_ai_run_queue")?.sql ?? "")
			.split(";")
			.map((s) => s.replace(/\s+/g, " ").trim())
			.filter(Boolean);

		// Assert
		expect(statements.length).toBe(7);
		for (const statement of statements) expect(statement).toMatch(/^(ALTER TABLE ai_run_starts ADD COLUMN IF NOT EXISTS|CREATE INDEX IF NOT EXISTS)/);
	});
});

describe("default queue wait [TC-AISEC-125]", () => {
	it("waits 90 s with the default 200 s run budget, inside the 290 s request", async () => {
		const { parseEnv } = await import("../config/env");
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
		expect(env.AI_RUN_BUDGET_MS).toBe(200_000);
		expect(maxQueueWaitMs(env)).toBe(90_000);
	});
});

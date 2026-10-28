import type { AgentEvent, AgentRun, AgentThreadDetail, ChangeSet, StartRunInput } from "@ech/agent-core";
import type { AgentGateway, RunStreamLost } from "@ech/agent-transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSession, INTERRUPTED_RUN_ERROR } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AISEC-063..064 — a run whose stream was cut (or restored mid-run) is followed by status reads until it ends.

function run(id: string, patch: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "products",
		prompt: `prompt ${id}`,
		status: "running",
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId: "thr_1",
		startedAt: "2026-10-22T00:00:00Z",
		...patch,
	};
}

const staged: ChangeSet = {
	id: "cs_1",
	runId: "run_1",
	domain: "products",
	title: "Create drafts",
	summary: "",
	risk: "low",
	blastRadius: { kind: "product", count: 1, label: "1 draft" },
	diffs: [],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2026-10-23T00:00:00Z",
};

function thread(runs: AgentRun[], changeSets: ChangeSet[] = []): AgentThreadDetail {
	return { thread: { id: "thr_1", title: "Chat", runCount: runs.length, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" }, runs, changeSets };
}

/** Server state: `status` is what GET /agent/runs/:id answers, `detail` what the thread read answers. */
function fakeGateway(server: { status: AgentRun["status"]; detail: AgentThreadDetail | null }) {
	const lost = new Set<(l: RunStreamLost) => void>();
	const gw = {
		listThreads: vi.fn(async () => (server.detail ? [server.detail.thread] : [])),
		getThread: vi.fn(async () => server.detail),
		getRun: vi.fn(async (id: string) => run(id, { status: server.status })),
		startRun: vi.fn(async (input: StartRunInput) => run("run_1", { prompt: input.prompt, status: "planning" })),
		subscribe: (_listener: (event: AgentEvent) => void) => () => undefined,
		onRunStreamLost: (listener: (l: RunStreamLost) => void) => {
			lost.add(listener);
			return () => lost.delete(listener);
		},
		cut: (runId: string) => {
			for (const listener of lost) listener({ runId, reason: "ended" });
		},
		close: () => undefined,
	};
	return gw;
}

const open = (gw: ReturnType<typeof fakeGateway>, hint: string | null = "") => {
	const s = new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint(hint) });
	s.start();
	return s;
};

const reply = (s: ChatSession) => s.getSnapshot().turns.find((t) => t.role === "assistant");

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("ChatSession run stream lost [TC-AISEC-063]", () => {
	it("TC-AISEC-063: a cut stream unlocks the composer, follows the run and shows its final answer and cards", async () => {
		// Arrange
		const server = { status: "running" as AgentRun["status"], detail: null as AgentThreadDetail | null };
		const gw = fakeGateway(server);
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);
		await s.send("create 2 drafts");
		expect(s.getSnapshot().busy).toBe(true);

		// Act
		gw.cut("run_1");

		// Assert — still working, but no longer blocking
		expect(s.getSnapshot().busy).toBe(false);
		expect(reply(s)?.run?.status).toBe("planning");
		await vi.advanceTimersByTimeAsync(4000 + 8000);
		expect(gw.getRun).toHaveBeenCalledTimes(2);
		expect(gw.getThread).not.toHaveBeenCalled();
		server.status = "awaiting_approval";
		server.detail = thread([run("run_1", { status: "awaiting_approval", answer: "2 drafts ready", changeSetIds: ["cs_1"] })], [staged]);
		await vi.advanceTimersByTimeAsync(16_000);
		expect(gw.getThread).toHaveBeenCalledTimes(1);
		const done = reply(s);
		expect(done?.run).toMatchObject({ status: "awaiting_approval", answer: "2 drafts ready" });
		expect(done?.role === "assistant" && done.changeSets.map((c) => c.id)).toEqual(["cs_1"]);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(gw.getRun).toHaveBeenCalledTimes(3); // ended: no more polling
	});

	it("TC-AISEC-063: a stream cut before startRun() resolves still leaves the run followed, not blocking", async () => {
		// Arrange
		const server = { status: "running" as AgentRun["status"], detail: null as AgentThreadDetail | null };
		const gw = fakeGateway(server);
		gw.startRun.mockImplementationOnce(async (input) => {
			gw.cut("run_1");
			return run("run_1", { prompt: input.prompt, status: "planning" });
		});
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);

		// Act
		await s.send("go");
		await vi.advanceTimersByTimeAsync(4000);

		// Assert
		expect(s.getSnapshot().busy).toBe(false);
		expect(gw.getRun).toHaveBeenCalledWith("run_1");
	});

	it("TC-AISEC-063: a run whose stream is still open is not polled", async () => {
		// Arrange
		const gw = fakeGateway({ status: "running", detail: null });
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);

		// Act
		await s.send("go");
		await vi.advanceTimersByTimeAsync(60_000);

		// Assert
		expect(s.getSnapshot().busy).toBe(true);
		expect(gw.getRun).not.toHaveBeenCalled();
	});
});

describe("ChatSession following a working run [TC-AISEC-064]", () => {
	it("TC-AISEC-064: a run restored mid-run is checked by status 4 s → 8 s → 16 s (cap), not by re-reading the thread", async () => {
		// Arrange
		const gw = fakeGateway({ status: "running", detail: thread([run("run_1")]) });
		const s = open(gw, null);
		await vi.advanceTimersByTimeAsync(0);
		expect(gw.getThread).toHaveBeenCalledTimes(1); // the restore itself

		// Act + Assert
		await vi.advanceTimersByTimeAsync(3999);
		expect(gw.getRun).toHaveBeenCalledTimes(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(gw.getRun).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(8000);
		expect(gw.getRun).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(16_000);
		expect(gw.getRun).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(16_000);
		expect(gw.getRun).toHaveBeenCalledTimes(4);
		expect(gw.getThread).toHaveBeenCalledTimes(1);
		expect(s.getSnapshot().busy).toBe(false);
		s.stop();
	});

	it("TC-AISEC-064: a run that never ends shows as interrupted after ~6 minutes and polling stops", async () => {
		// Arrange
		const gw = fakeGateway({ status: "running", detail: thread([run("run_1")]) });
		const s = open(gw, null);
		await vi.advanceTimersByTimeAsync(0);

		// Act
		await vi.advanceTimersByTimeAsync(6 * 60_000 - 1000);
		expect(reply(s)?.run?.status).toBe("running");
		await vi.advanceTimersByTimeAsync(20_000);

		// Assert
		expect(reply(s)?.run).toMatchObject({ status: "failed", error: INTERRUPTED_RUN_ERROR });
		const calls = gw.getRun.mock.calls.length;
		expect(calls).toBeLessThanOrEqual(25);
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(gw.getRun).toHaveBeenCalledTimes(calls);
		expect(s.getSnapshot().busy).toBe(false);
	});

	it("TC-AISEC-064: without a status read (getRun failing) it falls back to reading the thread", async () => {
		// Arrange
		const server = { status: "running" as AgentRun["status"], detail: thread([run("run_1")]) as AgentThreadDetail | null };
		const gw = fakeGateway(server);
		gw.getRun.mockRejectedValue(new Error("not found"));
		const s = open(gw, null);
		await vi.advanceTimersByTimeAsync(0);
		server.detail = thread([run("run_1", { status: "applied", answer: "done" })]);

		// Act
		await vi.advanceTimersByTimeAsync(4000);

		// Assert
		expect(gw.getThread).toHaveBeenCalledTimes(2);
		expect(reply(s)?.run).toMatchObject({ status: "applied", answer: "done" });
	});

	it("TC-AISEC-064: an unmounted chat stops following the run", async () => {
		// Arrange
		const gw = fakeGateway({ status: "running", detail: thread([run("run_1")]) });
		const s = open(gw, null);
		await vi.advanceTimersByTimeAsync(4000);
		const calls = gw.getRun.mock.calls.length;

		// Act
		s.stop();
		await vi.advanceTimersByTimeAsync(60_000);

		// Assert
		expect(gw.getRun).toHaveBeenCalledTimes(calls);
	});
});

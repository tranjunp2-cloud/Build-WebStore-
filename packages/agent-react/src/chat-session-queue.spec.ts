import type { AgentEvent, AgentRun, AgentThreadDetail, RunQueue, StartRunInput } from "@ech/agent-core";
import type { AgentGateway, RunStreamLost } from "@ech/agent-transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AISEC-135 — the chat while its run waits for a free AI slot: the place and the working list are exposed,
// Stop leaves the queue, "Stop … and run mine" stops a listed request, and a reopened queued run is followed.

function run(id: string, patch: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "products",
		prompt: `prompt ${id}`,
		status: "queued",
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId: "thr_1",
		startedAt: "2026-10-22T00:00:00Z",
		...patch,
	};
}

const place = (ahead: number): RunQueue => ({
	position: ahead + 1,
	ahead,
	running: [
		{ runId: "run_mine", title: "Batik care", requestedBy: { name: "Ali" }, startedAt: "2026-10-22T00:00:00Z", mine: true, canStop: true },
		{ runId: "run_team", title: "Sales report", requestedBy: { name: "Mei" }, startedAt: "2026-10-22T00:00:01Z", mine: false, canStop: true },
	],
});

function fakeGateway(server: { status: AgentRun["status"]; detail: AgentThreadDetail | null } = { status: "queued", detail: null }) {
	const listeners = new Set<(event: AgentEvent) => void>();
	return {
		listThreads: vi.fn(async () => (server.detail ? [server.detail.thread] : [])),
		getThread: vi.fn(async () => server.detail),
		getRun: vi.fn(async (id: string) => run(id, { status: server.status })),
		startRun: vi.fn(async (input: StartRunInput) => run("run_1", { prompt: input.prompt })),
		cancelRun: vi.fn(async (id: string) => run(id, { status: "cancelled" })),
		subscribe: (listener: (event: AgentEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onRunStreamLost: (_listener: (l: RunStreamLost) => void) => () => undefined,
		emit: (event: AgentEvent) => {
			for (const listener of listeners) listener(event);
		},
		close: () => undefined,
	};
}

const open = (gw: ReturnType<typeof fakeGateway>, hint: string | null = "") => {
	const s = new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint(hint) });
	s.start();
	return s;
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("ChatSession while the run waits for a slot [TC-AISEC-135]", () => {
	it("TC-AISEC-135: exposes the place and the working list, keeps the composer busy, and clears them once the run starts", async () => {
		// Arrange
		const gw = fakeGateway();
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);
		await s.send("write a post");

		// Act
		gw.emit({ type: "run.queued", runId: "run_1", ...place(2) });
		const waiting = s.getSnapshot();
		gw.emit({ type: "run.queued", runId: "run_1", ...place(0) });
		const next = s.getSnapshot().queued;
		gw.emit({ type: "run.status", runId: "run_1", status: "planning" });

		// Assert
		expect(waiting.busy).toBe(true);
		expect(waiting.queued).toMatchObject({ runId: "run_1", position: 3, ahead: 2 });
		expect(waiting.queued?.running.map((item) => item.runId)).toEqual(["run_mine", "run_team"]);
		expect(next).toMatchObject({ position: 1, ahead: 0 });
		expect(s.getSnapshot().queued).toBeUndefined();
		expect(s.getSnapshot().busy).toBe(true);
	});

	it("TC-AISEC-135: Stop on a queued reply takes it out of the queue", async () => {
		// Arrange
		const gw = fakeGateway();
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);
		await s.send("write a post");
		gw.emit({ type: "run.queued", runId: "run_1", ...place(1) });

		// Act
		await s.cancel();

		// Assert
		expect(gw.cancelRun).toHaveBeenCalledWith("run_1");
		expect(s.getSnapshot().queued).toBeUndefined();
		expect(s.getSnapshot().busy).toBe(false);
	});

	it("TC-AISEC-135: stopRun stops a listed request and drops its button at once; the waiting run keeps waiting", async () => {
		// Arrange
		const gw = fakeGateway();
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);
		await s.send("write a post");
		gw.emit({ type: "run.queued", runId: "run_1", ...place(0) });

		// Act
		const stopped = await s.stopRun("run_team");

		// Assert
		expect(stopped).toBe(true);
		expect(gw.cancelRun).toHaveBeenCalledWith("run_team");
		expect(gw.cancelRun).not.toHaveBeenCalledWith("run_1");
		expect(s.getSnapshot().queued?.running.map((item) => item.runId)).toEqual(["run_mine"]);
		expect(s.getSnapshot().queued?.runId).toBe("run_1");
	});

	it("TC-AISEC-135: stopRun answers false when the platform refuses (already finished, not allowed)", async () => {
		// Arrange
		const gw = fakeGateway();
		gw.cancelRun.mockRejectedValueOnce(new Error("Run not found."));
		const s = open(gw);

		// Act
		const stopped = await s.stopRun("run_gone");

		// Assert
		expect(stopped).toBe(false);
	});

	it("TC-AISEC-135: a chat reopened while its run is queued shows it waiting (place unknown) and follows it to the end", async () => {
		// Arrange
		const server = {
			status: "queued" as AgentRun["status"],
			detail: {
				thread: { id: "thr_1", title: "Chat", runCount: 1, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" },
				runs: [run("run_1")],
				changeSets: [],
			} as AgentThreadDetail,
		};
		const gw = fakeGateway(server);

		// Act
		const s = open(gw, "thr_1");
		await vi.advanceTimersByTimeAsync(0);
		const reopened = s.getSnapshot().queued;
		server.status = "applied";
		server.detail = { ...server.detail, runs: [run("run_1", { status: "applied", answer: "Done." })] };
		await vi.advanceTimersByTimeAsync(4000);

		// Assert
		expect(reopened).toEqual({ runId: "run_1", position: undefined, ahead: undefined, running: [] });
		expect(gw.getRun).toHaveBeenCalledWith("run_1");
		expect(s.getSnapshot().queued).toBeUndefined();
		expect(s.getSnapshot().turns.find((t) => t.role === "assistant")?.run?.status).toBe("applied");
	});
});

import type { AgentEvent, AgentRun, StartRunInput } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AIREL-285..286 — deleting the open chat (Start over, history delete) while a reply is being written.

function run(id: string, threadId: string, patch: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "cms",
		prompt: "p",
		status: "running",
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId,
		startedAt: "2026-10-22T00:00:00Z",
		...patch,
	};
}

function gateway(startRun?: (input: StartRunInput) => Promise<AgentRun>) {
	const calls: string[] = [];
	const listeners = new Set<(event: AgentEvent) => void>();
	return {
		calls,
		gw: {
			listThreads: vi.fn(async () => []),
			getThread: vi.fn(async () => null),
			startRun: vi.fn(startRun ?? (async () => run("run_1", "thr_1"))),
			cancelRun: vi.fn(async (id: string) => {
				calls.push(`cancel:${id}`);
				return run(id, "thr_1", { status: "cancelled" });
			}),
			deleteThread: vi.fn(async (id: string) => {
				calls.push(`delete:${id}`);
			}),
			subscribe: (listener: (event: AgentEvent) => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			close: () => undefined,
		},
	};
}

const open = (gw: ReturnType<typeof gateway>["gw"]) => new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint(), history: true });

describe("deleting the open chat while a reply is being written [TC-AIREL-285..286]", () => {
	it("TC-AIREL-285: stops the working run first, then deletes the chat and returns to a blank one", async () => {
		// Arrange
		const { gw, calls } = gateway();
		const s = open(gw);
		s.start();
		await s.send("Make the page greener");
		expect(s.getSnapshot()).toMatchObject({ busy: true, threadId: "thr_1" });

		// Act
		await s.deleteThread("thr_1");

		// Assert: cancel went out before the delete
		expect(calls).toEqual(["cancel:run_1", "delete:thr_1"]);
		expect(s.getSnapshot()).toMatchObject({ turns: [], threadId: undefined, busy: false });
	});

	it("TC-AIREL-285: a chat with nothing working is deleted without a cancel call", async () => {
		// Arrange
		const { gw, calls } = gateway(async () => run("run_1", "thr_1", { status: "applied" }));
		const s = open(gw);
		s.start();
		await s.send("hi");

		// Act
		await s.deleteThread("thr_1");

		// Assert
		expect(calls).toEqual(["delete:thr_1"]);
	});

	it("TC-AIREL-285: deleting another chat from history does not stop the open chat's run", async () => {
		// Arrange
		const { gw, calls } = gateway();
		const s = open(gw);
		s.start();
		await s.send("Make the page greener");

		// Act
		await s.deleteThread("thr_other");

		// Assert
		expect(calls).toEqual(["delete:thr_other"]);
		expect(s.getSnapshot().busy).toBe(true);
	});

	it("TC-AIREL-286: a prompt still being sent is awaited, then its run is stopped before the delete", async () => {
		// Arrange: the first message finished; the second one's startRun answers only when we say so
		let answer: (r: AgentRun) => void = () => undefined;
		let n = 0;
		const { gw, calls } = gateway(() => {
			n += 1;
			return n === 1 ? Promise.resolve(run("run_0", "thr_1", { status: "applied" })) : new Promise<AgentRun>((resolve) => (answer = resolve));
		});
		const s = open(gw);
		s.start();
		await s.send("first");
		const sending = s.send("Make the page greener");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(s.getSnapshot().sending).toBe(true);

		// Act
		const deleting = s.deleteThread("thr_1");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(calls).toEqual([]); // waiting for the start, nothing sent yet
		answer(run("run_1", "thr_1"));
		await sending;
		await deleting;

		// Assert
		expect(calls).toEqual(["cancel:run_1", "delete:thr_1"]);
	});

	it("TC-AIREL-285: when the server refuses the delete the error reaches the caller", async () => {
		// Arrange
		const { gw } = gateway();
		gw.deleteThread.mockRejectedValueOnce(new Error("A change from this chat is being applied right now."));
		const s = open(gw);
		s.start();
		await s.send("Make the page greener");

		// Act + Assert
		await expect(s.deleteThread("thr_1")).rejects.toThrow("being applied");
		expect(s.getSnapshot().threadId).toBe("thr_1");
	});
});

import type { AgentEvent, AgentRun, StartRunInput } from "@ech/agent-core";
import { type AgentGateway, AgentGatewayError, type RunStreamLost } from "@ech/agent-transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AIAUD-069 — a message refused as "chat busy" (409) right after the chat's own reply ended is sent once more
// after a short wait; a 409 while a reply is still working, and any other error, are shown as they are.

const BUSY = "This chat is still working on your last message.";

function run(id: string, patch: Partial<AgentRun> = {}): AgentRun {
	return { id, role: "merchant", domain: "products", prompt: `prompt ${id}`, status: "planning", steps: [], receipts: [], changeSetIds: [], threadId: "thr_1", startedAt: "2026-10-29T00:00:00Z", ...patch };
}

function fakeGateway() {
	const listeners = new Set<(event: AgentEvent) => void>();
	const startRun = vi.fn(async (input: StartRunInput) => run(`run_${startRun.mock.calls.length}`, { prompt: input.prompt }));
	return {
		listThreads: vi.fn(async () => []),
		getThread: vi.fn(async () => null),
		getRun: vi.fn(async (id: string) => run(id)),
		startRun,
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

const open = (gw: ReturnType<typeof fakeGateway>) => {
	const s = new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint("") });
	s.start();
	return s;
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

/** Sends a first message and lets its reply end, as the stream does. */
async function finishedChat() {
	const gw = fakeGateway();
	const s = open(gw);
	await vi.advanceTimersByTimeAsync(0);
	await s.send("first message");
	gw.emit({ type: "run.status", runId: "run_1", status: "applied", answer: "Done." });
	await vi.advanceTimersByTimeAsync(0);
	return { gw, s };
}

describe("ChatSession and a 409 right after its own reply ended [TC-AIAUD-069]", () => {
	it("TC-AIAUD-069: sends the message once more after a short wait and shows the reply", async () => {
		// Arrange
		const { gw, s } = await finishedChat();
		gw.startRun.mockRejectedValueOnce(new AgentGatewayError(BUSY, 409));

		// Act
		const sending = s.send("second message");
		await vi.advanceTimersByTimeAsync(0);
		const waiting = s.getSnapshot();
		await vi.advanceTimersByTimeAsync(2000);
		await sending;

		// Assert
		expect(waiting.sending).toBe(true);
		expect(gw.startRun).toHaveBeenCalledTimes(3);
		expect(gw.startRun.mock.calls[2]?.[0]).toMatchObject({ prompt: "second message" });
		const turns = s.getSnapshot().turns;
		expect(turns.at(-1)).toMatchObject({ role: "assistant", run: { status: "planning" } });
		expect(turns.some((t) => t.role === "assistant" && t.run?.status === "failed")).toBe(false);
	});

	it("TC-AIAUD-069: retries only once — a second 409 is shown as the refusal", async () => {
		// Arrange
		const { gw, s } = await finishedChat();
		gw.startRun.mockRejectedValue(new AgentGatewayError(BUSY, 409));

		// Act
		const sending = s.send("second message");
		await vi.advanceTimersByTimeAsync(3000);
		await sending;

		// Assert: first message + the message and its one retry
		expect(gw.startRun).toHaveBeenCalledTimes(3);
		expect(s.getSnapshot().turns.at(-1)).toMatchObject({ role: "assistant", run: { status: "failed" } });
		expect(s.getSnapshot().sending).toBe(false);
	});

	it("TC-AIAUD-069: does not retry while the chat's own reply is still working", async () => {
		// Arrange
		const gw = fakeGateway();
		const s = open(gw);
		await vi.advanceTimersByTimeAsync(0);
		await s.send("first message");
		gw.startRun.mockRejectedValueOnce(new AgentGatewayError(BUSY, 409));

		// Act
		await s.send("second message");

		// Assert
		expect(gw.startRun).toHaveBeenCalledTimes(2);
		expect(s.getSnapshot().turns.at(-1)).toMatchObject({ role: "assistant", run: { status: "failed" } });
	});

	it("TC-AIAUD-069: does not retry other refusals", async () => {
		// Arrange
		const { gw, s } = await finishedChat();
		gw.startRun.mockRejectedValueOnce(new AgentGatewayError("Too many requests", 429));

		// Act
		await s.send("second message");

		// Assert
		expect(gw.startRun).toHaveBeenCalledTimes(2);
		expect(s.getSnapshot().turns.at(-1)).toMatchObject({ role: "assistant", run: { status: "failed" } });
	});
});

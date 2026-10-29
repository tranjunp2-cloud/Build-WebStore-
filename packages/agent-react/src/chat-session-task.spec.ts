import type { AgentEvent, AgentRun, AgentThread, AgentThreadDetail, StartRunInput } from "@ech/agent-core";
import { type AgentGateway, AgentGatewayError, type ThreadFilter } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-WQ-050..056 — a to-do item is a chat: taking it opens its chat, else starts one as that task.

const TASK = { key: "shop:orders_to_confirm", title: "Confirm 3 orders" };

function run(id: string, threadId: string, patch: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "orders",
		prompt: `prompt ${id}`,
		status: "applied",
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId,
		answer: `answer ${id}`,
		startedAt: "2026-10-22T00:00:00Z",
		...patch,
	};
}

function thread(id: string, patch: Partial<AgentThread> = {}): AgentThreadDetail {
	return {
		thread: { id, title: `Chat ${id}`, runCount: 1, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z", ...patch },
		runs: [run(`run_${id}`, id)],
		changeSets: [],
	};
}

function fakeGateway(threads: AgentThreadDetail[] = []) {
	const store = new Map(threads.map((d) => [d.thread.id, d]));
	const listeners = new Set<(event: AgentEvent) => void>();
	let n = 0;
	return {
		listThreads: vi.fn(async (limit = 20, filter?: ThreadFilter) =>
			[...store.values()].map((d) => d.thread).filter((t) => !filter?.task || t.taskKey === filter.task).slice(0, limit),
		),
		getThread: vi.fn(async (id: string) => store.get(id) ?? null),
		startRun: vi.fn(async (input: StartRunInput): Promise<AgentRun> => {
			if (input.threadId && !store.has(input.threadId)) throw new AgentGatewayError("gone", 404);
			n += 1;
			const threadId = input.threadId ?? `thr_new${n}`;
			if (!store.has(threadId)) store.set(threadId, thread(threadId, input.task ? { taskKey: input.task.key, title: input.task.title } : {}));
			return run(`run_new${n}`, threadId, { prompt: input.prompt, status: "planning", answer: undefined });
		}),
		subscribe: (listener: (event: AgentEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		store,
		close: () => undefined,
	};
}

type Fake = ReturnType<typeof fakeGateway>;

function session(gw: Fake) {
	return new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint(), restoreLatest: false });
}

const sentTask = (gw: Fake, call: number) => (gw.startRun.mock.calls[call]?.[0] as StartRunInput).task;

describe("ChatSession.openTask", () => {
	it("TC-WQ-050 opens the item's own chat when it has a threadId, with the chat's task", async () => {
		const gw = fakeGateway([thread("thr_t", { taskKey: TASK.key, title: "Confirm 3 orders" })]);
		const s = session(gw);
		await s.openTask({ ...TASK, threadId: "thr_t" });
		expect(s.getSnapshot()).toMatchObject({ threadId: "thr_t", task: { key: TASK.key, title: "Confirm 3 orders" } });
		expect(gw.listThreads).not.toHaveBeenCalledWith(1, { task: TASK.key });
	});

	it("TC-WQ-051 finds the task's chat by its key when the item has no threadId", async () => {
		const gw = fakeGateway([thread("thr_other"), thread("thr_t", { taskKey: TASK.key, title: TASK.title })]);
		const s = session(gw);
		await s.openTask(TASK);
		expect(gw.listThreads).toHaveBeenCalledWith(1, { task: TASK.key });
		expect(s.getSnapshot().threadId).toBe("thr_t");
		await s.send("Confirm them");
		// continuing the task's chat: no task on the run
		expect(gw.startRun.mock.calls[0]?.[0]).toMatchObject({ threadId: "thr_t" });
		expect(sentTask(gw, 0)).toBeUndefined();
	});

	it("TC-WQ-052 no chat yet: a new chat whose first message starts it as the task", async () => {
		const gw = fakeGateway([thread("thr_other")]);
		const s = session(gw);
		await s.openThread("thr_other");
		await s.openTask(TASK);
		expect(s.getSnapshot()).toMatchObject({ threadId: undefined, turns: [], task: TASK });
		await s.send("Confirm them");
		expect(sentTask(gw, 0)).toEqual(TASK);
		expect(s.getSnapshot()).toMatchObject({ threadId: "thr_new1", task: TASK });
		await s.send("And tell the buyers");
		expect(gw.startRun.mock.calls[1]?.[0]).toMatchObject({ threadId: "thr_new1" });
		expect(sentTask(gw, 1)).toBeUndefined();
	});

	it("TC-WQ-053 the item's chat was deleted: falls back to the key, then to a new task chat", async () => {
		const gw = fakeGateway();
		const s = session(gw);
		await s.openTask({ ...TASK, threadId: "thr_gone" });
		expect(gw.listThreads).toHaveBeenCalledWith(1, { task: TASK.key });
		expect(s.getSnapshot()).toMatchObject({ threadId: undefined, task: TASK });
	});

	it("TC-WQ-054 New chat drops the task: the next message is a free chat", async () => {
		const gw = fakeGateway();
		const s = session(gw);
		await s.openTask(TASK);
		s.newThread();
		expect(s.getSnapshot().task).toBeUndefined();
		await s.send("Something else");
		expect(sentTask(gw, 0)).toBeUndefined();
	});

	it("TC-WQ-055 a free chat opened from history has no task", async () => {
		const gw = fakeGateway([thread("thr_t", { taskKey: TASK.key, title: TASK.title }), thread("thr_free")]);
		const s = session(gw);
		await s.openThread("thr_t");
		expect(s.getSnapshot().task).toEqual(TASK);
		await s.openThread("thr_free");
		expect(s.getSnapshot().task).toBeUndefined();
	});

	it("TC-WQ-056 the task's chat was deleted in another tab: the message carries on in a new chat for the same task", async () => {
		const gw = fakeGateway([thread("thr_t", { taskKey: TASK.key, title: TASK.title })]);
		const s = session(gw);
		await s.openTask(TASK);
		gw.store.delete("thr_t");
		await s.send("Confirm them");
		expect(gw.startRun).toHaveBeenCalledTimes(2);
		expect(sentTask(gw, 0)).toBeUndefined();
		expect(sentTask(gw, 1)).toEqual(TASK);
		expect(s.getSnapshot()).toMatchObject({ threadId: "thr_new1", task: TASK });
	});
});

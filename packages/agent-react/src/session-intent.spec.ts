import { describe, expect, it, vi } from "vitest";
import { type AgentChatHistory, enterSession } from "./chat-runtime";

// TC-AICP-80 — a request from the page lands in the right chat: a task with its own
// prompt starts a new chat, a page's own assistant continues its recent chat, reviewing
// a task opens the chat that produced it, just opening keeps the current chat.

function history(): AgentChatHistory {
	return {
		threadId: "thr_blog",
		threads: [],
		restoring: false,
		error: undefined,
		newThread: vi.fn(),
		openThread: vi.fn(async () => undefined),
		openForDomain: vi.fn(async () => undefined),
		linked: undefined,
		openLinked: vi.fn(async () => undefined),
		openRunThread: vi.fn(async () => undefined),
		task: undefined,
		openTask: vi.fn(async () => undefined),
		deleteThread: vi.fn(async () => undefined),
		refresh: vi.fn(async () => undefined),
	};
}

describe("enterSession [TC-AICP-80]", () => {
	it("a prompt starts a new chat by default; no prompt keeps the current one", async () => {
		const h = history();
		await enterSession(h, undefined, true);
		expect(h.newThread).toHaveBeenCalledTimes(1);
		await enterSession(h, undefined, false);
		expect(h.newThread).toHaveBeenCalledTimes(1);
		expect(h.openThread).not.toHaveBeenCalled();
	});

	it("routes a page's chat and a task under review to their own conversations", async () => {
		const h = history();
		await enterSession(h, { domain: "inventory" }, true);
		expect(h.openForDomain).toHaveBeenCalledWith("inventory", 6 * 60 * 60 * 1000);
		await enterSession(h, { runId: "run_9" }, false);
		expect(h.openRunThread).toHaveBeenCalledWith("run_9");
		expect(h.newThread).not.toHaveBeenCalled();
	});
});

describe("enterSession task intent", () => {
	it("TC-WQ-058 taking a to-do item opens its task chat, even with a prompt", async () => {
		const h = history();
		const task = { key: "shop:orders_to_confirm", title: "Confirm 3 orders", threadId: "thr_9" };
		await enterSession(h, { task }, true);
		expect(h.openTask).toHaveBeenCalledWith(task);
		expect(h.newThread).not.toHaveBeenCalled();
		expect(h.openRunThread).not.toHaveBeenCalled();
	});
});

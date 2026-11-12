import { type AgentEvent, type AgentRun, type AgentThread, type AgentThreadDetail, type ChangeSet, ContextPinSchema, type StartRunInput } from "@ech/agent-core";
import { type AgentGateway, AgentGatewayError } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { outsideWebBuilderChats, webBuilderChats } from "./chat-runtime";
import { ChatSession } from "./chat-session";
import { memoryThreadHint, turnsFromThread } from "./chat-turns";

// TC-AICP-40 — persistent chat history in the chat runtime (ChatSession + hydration).

function run(id: string, threadId: string, patch: Partial<AgentRun> = {}): AgentRun {
	return {
		id,
		role: "merchant",
		domain: "products",
		prompt: `prompt ${id}`,
		status: "applied",
		steps: [],
		receipts: [],
		changeSetIds: [],
		threadId,
		answer: `answer ${id}`,
		startedAt: "2026-10-20T00:00:00Z",
		...patch,
	};
}

function changeSet(id: string, runId: string, status: ChangeSet["status"]): ChangeSet {
	return {
		id,
		runId,
		domain: "products",
		title: "Create drafts",
		summary: "",
		risk: "low",
		blastRadius: { kind: "product", count: 1, label: "1 draft" },
		diffs: [],
		guardrails: [],
		status,
		stagedBy: "agent",
		stagedAt: "2026-10-20T00:00:00Z",
		expiresAt: "2026-10-21T00:00:00Z",
	};
}

function detail(id: string, updatedAt: string, runs: AgentRun[], changeSets: ChangeSet[] = []): AgentThreadDetail {
	return {
		thread: { id, title: `Chat ${id}`, runCount: runs.length, createdAt: updatedAt, updatedAt },
		runs,
		changeSets,
	};
}

function fakeGateway(threads: AgentThreadDetail[] = []) {
	const store = new Map(threads.map((d) => [d.thread.id, d]));
	const listeners = new Set<(event: AgentEvent) => void>();
	let n = 0;
	const gateway = {
		listThreads: vi.fn(async (limit = 20) =>
			[...store.values()]
				.map((d) => d.thread)
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
				.slice(0, limit),
		),
		getThread: vi.fn(async (id: string) => store.get(id) ?? null),
		deleteThread: vi.fn(async (id: string) => {
			store.delete(id);
		}),
		startRun: vi.fn(async (input: StartRunInput): Promise<AgentRun> => {
			if (input.threadId && !store.has(input.threadId)) throw new AgentGatewayError("gone", 404);
			n += 1;
			return run(`run_new${n}`, input.threadId ?? `thr_new${n}`, { prompt: input.prompt, status: "planning", answer: undefined });
		}),
		subscribe: (listener: (event: AgentEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		emit: (event: AgentEvent) => {
			for (const listener of listeners) listener(event);
		},
		store,
		close: () => undefined,
	};
	return gateway;
}

type Fake = ReturnType<typeof fakeGateway>;

function session(gw: Fake, hint = memoryThreadHint(), options: { history?: boolean; pollMs?: number; restoreLatest?: boolean; scope?: (t: AgentThread) => boolean } = {}) {
	const s = new ChatSession(gw as unknown as AgentGateway, { hint, ...options });
	return { s, hint };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const older = detail("thr_old", "2026-10-18T00:00:00Z", [run("run_o1", "thr_old")]);
const latest = detail(
	"thr_latest",
	"2026-10-20T00:00:00Z",
	[run("run_l1", "thr_latest", { changeSetIds: ["cs_1"], status: "awaiting_approval" }), run("run_l2", "thr_latest")],
	// approved after the run staged it — must show as applied
	[changeSet("cs_1", "run_l1", "applied")],
);

describe("turnsFromThread [TC-AICP-40]", () => {
	it("rebuilds prompt + reply pairs with the current change-set state", () => {
		const { turns } = turnsFromThread(latest);
		expect(turns.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant"]);
		expect(turns[0]).toMatchObject({ role: "user", text: "prompt run_l1" });
		const reply = turns[1];
		expect(reply?.role === "assistant" && reply.changeSets.map((c) => c.status)).toEqual(["applied"]);
	});
});

describe("ChatSession restore [TC-AICP-40]", () => {
	it("restores the latest thread on start and lists recent chats", async () => {
		const gw = fakeGateway([older, latest]);
		const { s, hint } = session(gw);
		s.start();
		expect(s.getSnapshot().restoring).toBe(true);
		await settle();
		const snap = s.getSnapshot();
		expect(snap.restoring).toBe(false);
		expect(snap.threadId).toBe("thr_latest");
		expect(snap.turns).toHaveLength(4);
		expect(snap.threads.map((t) => t.id)).toEqual(["thr_latest", "thr_old"]);
		expect(hint.get()).toBe("thr_latest");
	});

	it("prefers the tab's hinted thread and falls back to the latest when the hint is stale", async () => {
		const gw = fakeGateway([older, latest]);
		const hinted = session(gw, memoryThreadHint("thr_old"));
		hinted.s.start();
		await settle();
		expect(hinted.s.getSnapshot().threadId).toBe("thr_old");

		// e.g. another account's id left in this tab: the server says 404 → own latest
		const stale = session(gw, memoryThreadHint("thr_someone_else"));
		stale.s.start();
		await settle();
		expect(stale.s.getSnapshot().threadId).toBe("thr_latest");
		expect(stale.hint.get()).toBe("thr_latest");
	});

	it("stays on a blank chat after New chat was chosen in this tab", async () => {
		const gw = fakeGateway([latest]);
		const { s } = session(gw, memoryThreadHint(""));
		s.start();
		await settle();
		expect(s.getSnapshot().turns).toEqual([]);
		expect(s.getSnapshot().threads).toHaveLength(1);
	});

	it("restoreLatest false: opens only the remembered chat, else starts blank [TC-AIWB-37]", async () => {
		const gw = fakeGateway([older, latest]);
		const blank = session(gw, memoryThreadHint(), { restoreLatest: false });
		blank.s.start();
		await settle();
		expect(blank.s.getSnapshot().threadId).toBeUndefined();
		expect(blank.s.getSnapshot().turns).toEqual([]);
		expect(blank.s.getSnapshot().threads).toHaveLength(2);

		const own = session(gw, memoryThreadHint("thr_old"), { restoreLatest: false });
		own.s.start();
		await settle();
		expect(own.s.getSnapshot().threadId).toBe("thr_old");

		// the remembered chat is gone: a new chat, never another surface's latest
		const stale = session(gw, memoryThreadHint("thr_gone"), { restoreLatest: false });
		stale.s.start();
		await settle();
		expect(stale.s.getSnapshot().threadId).toBeUndefined();
		expect(stale.hint.get()).toBeNull();
	});

	it("a restore cut off by gateway.close() leaves no unhandled rejection [TC-AIWB-37]", async () => {
		const gw = fakeGateway([older, latest]);
		const abort = () => new DOMException("The agent gateway was closed.", "AbortError");
		// a promise that records whether anyone is listening for its outcome
		let listHandled = false;
		class Watched<T> extends Promise<T> {
			override then<A = T, B = never>(ok?: ((v: T) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
				listHandled = true;
				return super.then(ok, fail);
			}
		}
		// the thread read fails first, the list a tick later — both aborted on unmount
		// plain functions: a vi.fn spy subscribes to returned promises itself
		Object.assign(gw, {
			getThread: () => Promise.reject(abort()),
			listThreads: () => new Watched((_, reject) => setTimeout(() => reject(abort()), 5)),
		});
		const { s } = session(gw, memoryThreadHint("thr_old"));
		s.start();
		s.stop();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(listHandled).toBe(true);
		expect(s.getSnapshot().restoring).toBe(false);
	});

	it("scope: a surface lists and reopens only its own chats, never one continued elsewhere [TC-AIWB-44]", async () => {
		// the editor's chat is the newest; the dashboard must not pick it up as "the latest chat"
		const editorChat = detail("thr_editor", "2026-10-21T00:00:00Z", [run("run_e1", "thr_editor")]);
		const withDomain = (d: AgentThreadDetail, domain: AgentThread["domain"]) => ({ ...d, thread: { ...d.thread, domain } });
		const gw = fakeGateway([withDomain(older, "products"), withDomain(latest, "products"), withDomain(editorChat, "webbuilder")]);

		const dashboard = session(gw, memoryThreadHint(), { scope: outsideWebBuilderChats });
		dashboard.s.start();
		await settle();
		expect(dashboard.s.getSnapshot().threadId).toBe("thr_latest");
		expect(dashboard.s.getSnapshot().threads.map((t) => t.id)).toEqual(["thr_latest", "thr_old"]);

		// remembered in this tab, but it is the editor's chat: not reopened on the dashboard
		const remembered = session(gw, memoryThreadHint("thr_editor"), { scope: outsideWebBuilderChats });
		remembered.s.start();
		await settle();
		expect(remembered.s.getSnapshot().threadId).toBe("thr_latest");

		const editor = session(gw, memoryThreadHint("thr_editor"), { restoreLatest: false, scope: webBuilderChats });
		editor.s.start();
		await settle();
		expect(editor.s.getSnapshot().threadId).toBe("thr_editor");
		expect(editor.s.getSnapshot().threads.map((t) => t.id)).toEqual(["thr_editor"]);
	});

	it("keeps chatting when history is unavailable", async () => {
		const gw = fakeGateway();
		gw.listThreads.mockRejectedValue(new Error("history down"));
		const { s } = session(gw);
		s.start();
		await settle();
		expect(s.getSnapshot().historyError).toBe("history down");
		await s.send("hello");
		expect(s.getSnapshot().turns.map((t) => t.role)).toEqual(["user", "assistant"]);
	});

	it("reruns a restore cut short by an unmount (StrictMode)", async () => {
		const gw = fakeGateway([latest]);
		const { s } = session(gw);
		s.start();
		s.stop();
		s.start();
		await settle();
		expect(s.getSnapshot().threadId).toBe("thr_latest");
		expect(s.getSnapshot().restoring).toBe(false);
	});

	it("skips history entirely when the surface opts out", async () => {
		const gw = fakeGateway([latest]);
		const { s } = session(gw, memoryThreadHint(), { history: false });
		s.start();
		await settle();
		expect(gw.listThreads).not.toHaveBeenCalled();
		expect(s.getSnapshot().turns).toEqual([]);
	});

	it("refreshes a restored run that is still working until it finishes", async () => {
		const working = detail("thr_w", "2026-10-20T00:00:00Z", [run("run_w", "thr_w", { status: "running", answer: undefined })]);
		const gw = fakeGateway([working]);
		const { s } = session(gw, memoryThreadHint(), { pollMs: 5 });
		s.start();
		await settle();
		expect(s.getSnapshot().busy).toBe(false); // a restored run never blocks the composer
		gw.store.set("thr_w", detail("thr_w", "2026-10-20T00:01:00Z", [run("run_w", "thr_w")]));
		await new Promise((resolve) => setTimeout(resolve, 30));
		const reply = s.getSnapshot().turns[1];
		expect(reply?.role === "assistant" && reply.run?.answer).toBe("answer run_w");
		s.stop();
	});
});

describe("ChatSession threads [TC-AICP-40]", () => {
	it("adopts the platform's thread id on the first run and continues it", async () => {
		const gw = fakeGateway();
		const { s, hint } = session(gw);
		s.start();
		await settle();
		await s.send("first");
		expect(gw.startRun.mock.calls[0]?.[0]).not.toHaveProperty("threadId", expect.anything());
		const threadId = s.getSnapshot().threadId;
		expect(threadId).toBe("thr_new1");
		expect(hint.get()).toBe("thr_new1");
		gw.store.set("thr_new1", detail("thr_new1", "2026-10-20T01:00:00Z", []));
		await s.send("second");
		expect(gw.startRun.mock.calls[1]?.[0]).toMatchObject({ prompt: "second", threadId: "thr_new1" });
	});

	it("streams events into the live turn, including ones that land before startRun resolves", async () => {
		const gw = fakeGateway();
		gw.startRun.mockImplementationOnce(async (input) => {
			gw.emit({ type: "run.status", runId: "run_live", status: "applied", answer: "done early" });
			return run("run_live", "thr_x", { prompt: input.prompt, status: "planning", answer: undefined });
		});
		const { s } = session(gw);
		s.start();
		await settle();
		await s.send("go");
		const reply = s.getSnapshot().turns[1];
		expect(reply?.role === "assistant" && reply.run?.answer).toBe("done early");
		expect(s.getSnapshot().busy).toBe(false);
	});

	it("New chat clears the transcript and the next prompt starts a new thread", async () => {
		const gw = fakeGateway([latest]);
		const { s, hint } = session(gw);
		s.start();
		await settle();
		s.newThread();
		expect(s.getSnapshot()).toMatchObject({ turns: [], threadId: undefined });
		expect(hint.get()).toBe("");
		await s.send("fresh start");
		expect(gw.startRun.mock.calls[0]?.[0].threadId).toBeUndefined();
	});

	it("opens a thread from history and deleting the open chat returns to a blank one", async () => {
		const gw = fakeGateway([older, latest]);
		const { s } = session(gw);
		s.start();
		await settle();
		await s.openThread("thr_old");
		expect(s.getSnapshot().threadId).toBe("thr_old");
		expect(s.getSnapshot().turns[0]).toMatchObject({ text: "prompt run_o1" });
		await s.deleteThread("thr_old");
		expect(s.getSnapshot()).toMatchObject({ threadId: undefined, turns: [] });
		expect(s.getSnapshot().threads.map((t) => t.id)).toEqual(["thr_latest"]);
	});

	it("drops a late reply from a chat the user already left", async () => {
		const gw = fakeGateway([latest]);
		let resolveRun: (r: AgentRun) => void = () => undefined;
		gw.startRun.mockImplementationOnce(() => new Promise<AgentRun>((resolve) => (resolveRun = resolve)));
		const { s } = session(gw);
		s.start();
		await settle();
		const sending = s.send("slow");
		await settle();
		s.newThread();
		resolveRun(run("run_slow", "thr_latest", { status: "planning" }));
		await sending;
		expect(s.getSnapshot().turns).toEqual([]);
		gw.emit({ type: "run.status", runId: "run_slow", status: "applied", answer: "late" });
		expect(s.getSnapshot().turns).toEqual([]);
	});

	it("waits for the restore so a prompt typed during loading continues the last chat", async () => {
		const gw = fakeGateway([latest]);
		const { s } = session(gw);
		s.start();
		await s.send("follow-up");
		expect(gw.startRun.mock.calls[0]?.[0]).toMatchObject({ threadId: "thr_latest" });
		expect(s.getSnapshot().turns).toHaveLength(6);
	});

	it("carries on in a new thread when the open one expired", async () => {
		const gw = fakeGateway([latest]);
		const { s } = session(gw);
		s.start();
		await settle();
		gw.store.delete("thr_latest"); // expired / deleted in another tab
		await s.send("still there?");
		expect(gw.startRun).toHaveBeenCalledTimes(2);
		expect(gw.startRun.mock.calls[1]?.[0].threadId).toBeUndefined();
		expect(s.getSnapshot().turns.map((t) => t.role)).toEqual(["user", "assistant"]);
		expect(s.getSnapshot().threadId).toBe("thr_new1");
	});
});

describe("ChatSession stop [TC-AICP-116]", () => {
	it("shows the working run as stopped at once and asks the platform to cancel it", async () => {
		// Arrange
		const gw = Object.assign(fakeGateway(), {
			cancelRun: vi.fn(async (id: string) => run(id, "thr_new1", { status: "cancelled", answer: undefined })),
		});
		const { s } = session(gw, memoryThreadHint(), { history: false });
		s.start();
		await s.send("Analyse my products");
		expect(s.getSnapshot().busy).toBe(true);

		// Act
		await s.cancel();

		// Assert
		expect(gw.cancelRun).toHaveBeenCalledWith("run_new1");
		const turn = s.getSnapshot().turns.at(-1);
		expect(turn?.role === "assistant" && turn.run?.status).toBe("cancelled");
		expect(s.getSnapshot().busy).toBe(false);
	});

	it("does nothing when no run is working", async () => {
		// Arrange
		const gw = Object.assign(fakeGateway(), { cancelRun: vi.fn() });
		const { s } = session(gw, memoryThreadHint(), { history: false });

		// Act
		await s.cancel();

		// Assert
		expect(gw.cancelRun).not.toHaveBeenCalled();
	});
});

describe("run suggestions survive the stream [TC-AICP-115]", () => {
	it("a later status frame adds suggestions without moving the finish time", async () => {
		// Arrange
		const gw = fakeGateway();
		const { s } = session(gw, memoryThreadHint(), { history: false });
		s.start();
		await s.send("Analyse my products");
		gw.emit({ type: "run.status", runId: "run_new1", status: "applied", answer: "24 drafts." });
		const finished = s.getSnapshot().turns.at(-1);
		const finishedAt = finished?.role === "assistant" ? finished.run?.finishedAt : undefined;

		// Act
		gw.emit({ type: "run.status", runId: "run_new1", status: "applied", suggestions: [{ prompt: "Which have no photos?", source: "model" }] });

		// Assert
		const turn = s.getSnapshot().turns.at(-1);
		expect(turn?.role === "assistant" && turn.run?.suggestions).toEqual([{ prompt: "Which have no photos?", source: "model" }]);
		expect(turn?.role === "assistant" && turn.run?.finishedAt).toBe(finishedAt);
		expect(turn?.role === "assistant" && turn.run?.answer).toBe("24 drafts.");
	});
});

// TC-AIWB-61 — Ask AI on an element: the element waits in the composer, goes
// with the next message in its context pin (and on the user's turn), and the
// tray empties; at most three, the oldest makes room; a stored chat shows them.
describe("elements on the page sent with a message [TC-AIWB-61]", () => {
	const hero = { kind: "button" as const, label: "Mua ngay", blockId: "blk_hero", path: "ctaButtons.0.label", value: "Mua ngay" };

	it("sends the waiting elements in the context pin and on the user's turn, then empties the tray", async () => {
		const gw = fakeGateway();
		const { s } = session(gw, memoryThreadHint(), { history: false });
		s.context = { module: "editor", filters: { site: "1" } };
		s.attachElement(hero);
		expect(s.getSnapshot().elements).toEqual([hero]);

		await s.send("Hấp dẫn hơn");

		expect(gw.startRun.mock.calls[0]?.[0].context).toEqual({ module: "editor", filters: { site: "1" }, elements: [hero] });
		expect(s.getSnapshot().turns[0]).toMatchObject({ role: "user", text: "Hấp dẫn hơn", elements: [hero] });
		expect(s.getSnapshot().elements).toEqual([]);
		// the pin itself is not changed: the next message goes without the element
		expect(s.context).toEqual({ module: "editor", filters: { site: "1" } });
	});

	it("the same element again replaces it; past three the oldest makes room; remove by key", () => {
		const { s } = session(fakeGateway(), memoryThreadHint(), { history: false });
		const at = (n: number) => ({ kind: "text" as const, label: `Text ${n}`, blockId: "blk_a", path: `items.${n}.title` });
		s.attachElement(at(1));
		s.attachElement({ ...at(1), label: "Text 1 (new)" });
		expect(s.getSnapshot().elements.map((e) => e.label)).toEqual(["Text 1 (new)"]);
		s.attachElement(at(2));
		s.attachElement(at(3));
		s.attachElement(at(4));
		expect(s.getSnapshot().elements.map((e) => e.label)).toEqual(["Text 2", "Text 3", "Text 4"]);
		s.removeElement(":blk_a:items.3.title");
		expect(s.getSnapshot().elements.map((e) => e.label)).toEqual(["Text 2", "Text 4"]);
	});

	// TC-AICP-136 — a record picked from a reply's cards keeps its id (the model reads it by id)
	it("keeps a picked record's id and keys it by kind and id [TC-AICP-136]", () => {
		const { s } = session(fakeGateway(), memoryThreadHint(), { history: false });

		s.attachElement({ kind: "product", label: "Áo thun tay ngắn", recordId: "prod_1" }, "add");
		s.attachElement({ kind: "product", label: "Áo thun tay ngắn", recordId: "prod_1" }, "add");

		expect(s.getSnapshot().elements).toEqual([{ kind: "product", label: "Áo thun tay ngắn", recordId: "prod_1" }]);
	});

	// TC-AIWB-100 — the web editor's chip follows the selection: "only" replaces whatever is attached
	it("attachElement 'only' makes it the one thing attached [TC-AIWB-100]", () => {
		const { s } = session(fakeGateway(), memoryThreadHint(), { history: false });
		const at = (n: number) => ({ kind: "text" as const, label: `Text ${n}`, blockId: "blk_a", path: `items.${n}.title` });
		s.attachElement(at(1));
		s.attachElement(at(2), "add");

		s.attachElement(at(3), "only");

		expect(s.getSnapshot().elements.map((e) => e.label)).toEqual(["Text 3"]);
	});

	it("ids come out as strings and long text is cut, so the message is never refused for its element", async () => {
		const gw = fakeGateway();
		const { s } = session(gw, memoryThreadHint(), { history: false });
		s.context = { module: "editor" };
		// a Payload page id arrives as a number at runtime
		s.attachElement({ kind: "section", label: "Features", pageId: 7 as unknown as string, blockId: "blk_f", value: "x".repeat(500) });
		await s.send("Dịch cụm này thành tiếng Anh cho tôi");

		const sent = gw.startRun.mock.calls[0]?.[0].context?.elements?.[0];
		expect(sent).toMatchObject({ kind: "section", pageId: "7", blockId: "blk_f" });
		expect(sent?.value).toHaveLength(300);
		expect(ContextPinSchema.safeParse(gw.startRun.mock.calls[0]?.[0].context).success).toBe(true);
	});

	it("a stored chat shows the elements its messages were sent with", () => {
		const stored = detail("thr_el", "2026-10-21T00:00:00Z", [run("run_e1", "thr_el", { context: { module: "editor", elements: [hero] } })]);
		const { turns } = turnsFromThread(stored);
		expect(turns[0]).toMatchObject({ role: "user", elements: [hero] });
	});
});

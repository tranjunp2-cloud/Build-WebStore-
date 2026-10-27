import {
	ATTACHMENT_DOCUMENT_TYPES,
	ATTACHMENT_IMAGE_TYPES,
	ATTACHMENT_MAX_BYTES,
	ATTACHMENTS_PER_MESSAGE,
	type AgentAttachment,
	type AgentEvent,
	type AgentRun,
	type AgentThread,
	type AgentThreadDetail,
	type AnswerInput,
	type ContextElement,
	type ContextPin,
	isTerminalStatus,
	MAX_CONTEXT_ELEMENTS,
	contextElementKey as elementKey,
	type ReceiptMedia,
	type PageLocation,
	type QueueRunningItem,
	reduceRunEvent,
} from "@ech/agent-core";
import { type AgentGateway, AgentGatewayError } from "@ech/agent-transport";
import {
	ACTIVE_RUN,
	type AgentChatTurn,
	type ComposerAttachment,
	sessionThreadHint,
	type ThreadHintStore,
	type TurnRecord,
	turnsFromThread,
} from "./chat-turns";

/**
 * An element as the pin schema takes it: ids as strings (hosts pass Payload's
 * numeric page ids), label and value cut to their limits — otherwise the whole
 * message is refused ("expected string, received number").
 */
function cleanElement(element: ContextElement): ContextElement {
	const text = (value: unknown, max: number) => (value === undefined || value === null || value === "" ? undefined : String(value).slice(0, max));
	const out: ContextElement = { kind: element.kind, label: text(element.label, 80)?.trim() || element.kind };
	const pageId = text(element.pageId, 60);
	const blockId = text(element.blockId, 80);
	const path = text(element.path, 160);
	const value = text(element.value, 300);
	const recordId = text(element.recordId, 80);
	return { ...out, ...(pageId ? { pageId } : {}), ...(blockId ? { blockId } : {}), ...(path ? { path } : {}), ...(value ? { value } : {}), ...(recordId ? { recordId } : {}) };
}

export interface ChatSessionSnapshot {
	turns: AgentChatTurn[];
	/** thread the next prompt continues; undefined = the next prompt starts one */
	threadId: string | undefined;
	/** recent threads, newest activity first */
	threads: AgentThread[];
	/** loading a stored thread (first mount, or picked from history) */
	restoring: boolean;
	sending: boolean;
	/** set when history could not load — the chat itself keeps working */
	historyError: string | undefined;
	/** true while a run started here is still working (composer blocked) */
	busy: boolean;
	/** files waiting in the composer tray for the next message */
	attachments: ComposerAttachment[];
	/** why the last file was refused (type, size, count) — cleared on the next add */
	attachmentError: string | undefined;
	/** the newest chat started on the record open on the page (see `linkTo`) */
	linked: AgentThread | undefined;
	/** things on the page waiting in the composer for the next message (Ask AI on an element) */
	elements: ContextElement[];
	/** the to-do item the open chat handles (its thread's taskKey + title, or the one the next message starts) */
	task?: ChatTask;
	/** the open chat's run waiting for a free AI slot: its place and what is working (Stop one to run it) */
	queued?: ChatQueue;
}

/** A run of the open chat waiting for a free AI slot (place unknown until the platform says, e.g. after a reload). */
export interface ChatQueue {
	runId: string;
	position: number | undefined;
	ahead: number | undefined;
	running: QueueRunningItem[];
}

/** A to-do item as a chat: its key and title. */
export interface ChatTask {
	key: string;
	title: string;
}

export interface ChatSessionOptions {
	/** false = no history: no restore, no thread list (default true) */
	history?: boolean;
	/** where the open thread is remembered; default per-tab sessionStorage */
	hint?: ThreadHintStore;
	/**
	 * Nothing remembered in the hint: open the newest chat (default true). A
	 * surface with its own chats (the site editor) passes false and starts blank.
	 */
	restoreLatest?: boolean;
	/**
	 * The chats this surface lists and reopens (default: every chat). The site
	 * editor keeps to its own (web builder) chats and the dashboard docks leave
	 * them out, so a chat started in one is never continued in the other.
	 */
	scope?: (thread: AgentThread) => boolean;
	threadLimit?: number;
	/**
	 * First status check of a run still working without a stream (restored on
	 * load, or its stream was cut); later checks back off ×2 up to 4× this (default 4 s → 8 s → 16 s)
	 */
	pollMs?: number;
	/** how long such a run is followed before it shows as interrupted (default 6 min: past any run's function limit) */
	pollWindowMs?: number;
}

const POLL_WINDOW_MS = 6 * 60_000;
/** Shown on a run that never reported an end: its process was stopped (time limit, deploy) without saying so. */
export const INTERRUPTED_RUN_ERROR = "This request was interrupted before it finished.";
/** How long deleting a chat waits for a prompt that is still being sent, so its run can be stopped. */
const START_WAIT_MS = 5000;
const ACCEPTED_TYPES: ReadonlySet<string> = new Set([...ATTACHMENT_IMAGE_TYPES, ...ATTACHMENT_DOCUMENT_TYPES]);
/** Prompt sent when the merchant sends files without typing anything. */
export const ATTACHMENTS_ONLY_PROMPT = "Use the attached files.";
/** Prompt sent with chosen pictures of the chat and nothing typed (UIs pass their own words). */
export const CHOSEN_PICTURES_PROMPT = "Use the chosen picture.";
/** At most this many chat pictures chosen for one message. */
export const CHOSEN_PICTURES_MAX = 12;

/** Why a file cannot be attached, or null when it can. */
export function attachmentRefusal(file: { name: string; type: string; size: number }): string | null {
	if (!ACCEPTED_TYPES.has(file.type)) return `${file.name}: only JPG, PNG, WebP, PDF, CSV and XLSX files can be attached.`;
	if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is larger than 10 MB.`;
	return null;
}

function previewOf(file: File): string | undefined {
	if (!file.type.startsWith("image/") || typeof URL === "undefined" || !URL.createObjectURL) return undefined;
	try {
		return URL.createObjectURL(file);
	} catch {
		return undefined;
	}
}

function message(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

function failedRun(prompt: string, error: unknown): AgentRun {
	const now = new Date().toISOString();
	return {
		id: `failed_${Date.now().toString(36)}`,
		role: "merchant",
		domain: "products",
		prompt,
		status: "failed",
		steps: [],
		receipts: [],
		changeSetIds: [],
		error: message(error, "The agent could not start this request."),
		startedAt: now,
		finishedAt: now,
	};
}

/** The open chat's run waiting for a slot (its newest reply), or undefined; unchanged views keep their identity. */
function queuedOf(turns: AgentChatTurn[], previous: ChatQueue | undefined): ChatQueue | undefined {
	const last = [...turns].reverse().find((t) => t.role === "assistant");
	const run = last?.role === "assistant" ? last.run : undefined;
	if (!run || run.status !== "queued") return undefined;
	const queue = run.queue;
	if (previous && previous.runId === run.id && previous.position === queue?.position && previous.ahead === queue?.ahead && previous.running === (queue?.running ?? previous.running)) {
		return previous;
	}
	return { runId: run.id, position: queue?.position, ahead: queue?.ahead, running: queue?.running ?? [] };
}

/**
 * Chat state for one assistant surface, independent of React: the open
 * thread's turns, the recent-thread list, and the live run stream. The hook
 * mirrors the snapshot; tests drive it directly with a fake gateway.
 *
 * Every thread switch bumps `generation` so late answers (a run started, a
 * thread loaded) for the chat the user just left never leak into the new one.
 */
export class ChatSession {
	context: ContextPin | undefined;
	/** where the merchant is (sent with every prompt, even with the page chip removed) */
	page: PageLocation | undefined;
	private snapshot: ChatSessionSnapshot = {
		turns: [],
		threadId: undefined,
		threads: [],
		restoring: false,
		sending: false,
		historyError: undefined,
		busy: false,
		attachments: [],
		attachmentError: undefined,
		linked: undefined,
		elements: [],
	};
	private readonly listeners = new Set<() => void>();
	private readonly history: boolean;
	private readonly hint: ThreadHintStore;
	private readonly restoreLatest: boolean;
	private readonly scope: (thread: AgentThread) => boolean;
	private readonly threadLimit: number;
	private readonly pollMs: number;
	private readonly pollWindowMs: number;
	private records = new Map<string, TurnRecord>();
	/** runs started from this session — their events stream to us */
	private live = new Set<string>();
	/** runs of a chat the user left — their events are dropped */
	private ignored = new Set<string>();
	/** events that land before startRun() resolves, replayed once the turn exists */
	private pending = new Map<string, AgentEvent[]>();
	private generation = 0;
	private restoreDone = false;
	private restorePromise: Promise<void> | null = null;
	private unsubscribe: (() => void) | null = null;
	private pollTimer: ReturnType<typeof setTimeout> | null = null;
	private polls = 0;
	/** when following working runs gives up (Date.now() ms) */
	private pollUntil = 0;
	private stopped = false;
	/** runs whose stream was cut before startRun() resolved: they join the chat already polled */
	private lostEarly = new Set<string>();
	private linkedEntity: { kind: string; id: string } | undefined;
	private linkedSeq = 0;
	/** the task a new chat is started for: sent with its first message only */
	private pendingTask: ChatTask | undefined;

	constructor(
		private readonly gateway: AgentGateway,
		options: ChatSessionOptions = {},
	) {
		this.history = options.history ?? true;
		this.hint = options.hint ?? sessionThreadHint();
		this.restoreLatest = options.restoreLatest ?? true;
		this.scope = options.scope ?? (() => true);
		this.threadLimit = options.threadLimit ?? 20;
		this.pollMs = options.pollMs ?? 4000;
		this.pollWindowMs = options.pollWindowMs ?? POLL_WINDOW_MS;
	}

	// ── store protocol (useSyncExternalStore) ────────────────────────────
	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = (): ChatSessionSnapshot => this.snapshot;

	private set(patch: Partial<ChatSessionSnapshot>): void {
		const next = { ...this.snapshot, ...patch };
		next.busy =
			next.sending ||
			next.turns.some(
				(t) => t.role === "assistant" && t.run !== undefined && this.live.has(t.id) && ACTIVE_RUN.has(t.run.status),
			);
		next.queued = queuedOf(next.turns, this.snapshot.queued);
		this.snapshot = next;
		for (const listener of this.listeners) listener();
	}

	// ── lifecycle ────────────────────────────────────────────────────────
	start(): void {
		this.stopped = false;
		if (!this.unsubscribe) {
			const offEvents = this.gateway.subscribe((event) => this.onEvent(event));
			const offLost = this.gateway.onRunStreamLost?.((lost) => this.onStreamLost(lost.runId));
			this.unsubscribe = () => {
				offEvents();
				offLost?.();
			};
		}
		if (this.history && !this.restoreDone && !this.restorePromise) {
			this.restorePromise = this.restore().finally(() => {
				this.restorePromise = null;
			});
		}
		// remounted: carry on following a run that is still working
		else this.schedulePoll();
	}

	/** Unmount (or StrictMode's rehearsal) — a restore cut short reruns on the next start(). */
	stop(): void {
		this.stopped = true;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.clearPoll();
		if (this.restorePromise) {
			this.generation += 1;
			this.restorePromise = null;
			this.set({ restoring: false });
		}
	}

	private async restore(): Promise<void> {
		const gen = this.generation;
		this.set({ restoring: true });
		try {
			const hint = this.hint.get();
			// both start together; awaiting them as one keeps a failed list from going unhandled
			// when the thread read fails first (e.g. both aborted by gateway.close() on unmount)
			const [threads, hinted] = await Promise.all([
				this.gateway.listThreads(this.threadLimit),
				hint ? this.gateway.getThread(hint) : Promise.resolve(null),
			]);
			if (gen !== this.generation) return;
			const own = threads.filter(this.scope);
			// the remembered chat belongs to another surface (it was continued there): don't reopen it here
			const foreign = hinted !== null && threads.some((t) => t.id === hinted.thread.id) && !own.some((t) => t.id === hinted.thread.id);
			let detail: AgentThreadDetail | null = foreign ? null : hinted;
			this.set({ threads: own, historyError: undefined });
			const latest = own[0];
			// "" = the user chose New chat in this tab — stay blank
			if (!detail && hint !== "" && latest && this.restoreLatest) detail = await this.gateway.getThread(latest.id);
			if (gen !== this.generation) return;
			if (detail) this.hydrate(detail);
			else if (hint) this.hint.set(null);
		} catch (error) {
			if (gen === this.generation) this.set({ historyError: message(error, "Chat history is unavailable.") });
		} finally {
			if (gen === this.generation) {
				this.restoreDone = true;
				this.set({ restoring: false });
			}
		}
	}

	private hydrate(detail: AgentThreadDetail): void {
		const { turns, records } = turnsFromThread(detail);
		this.records = records;
		this.hint.set(detail.thread.id);
		const { taskKey, title } = detail.thread;
		this.set({ turns, threadId: detail.thread.id, task: taskKey ? { key: taskKey, title } : undefined });
		this.restartPoll();
	}

	/** Leaves the open chat: drops its state and silences its runs. */
	private detach(): number {
		this.generation += 1;
		for (const id of this.records.keys()) this.ignored.add(id);
		this.records = new Map();
		this.live.clear();
		this.pending.clear();
		this.lostEarly.clear();
		this.clearPoll();
		this.restoreDone = true;
		this.restorePromise = null;
		this.pendingTask = undefined;
		// pictures chosen in the chat that was left are not this chat's
		if (this.snapshot.attachments.some((a) => a.chosen)) this.set({ attachments: this.snapshot.attachments.filter((a) => !a.chosen) });
		return this.generation;
	}

	// ── commands ─────────────────────────────────────────────────────────
	newThread = (): void => {
		this.detach();
		this.hint.set("");
		this.set({ turns: [], threadId: undefined, sending: false, restoring: false, task: undefined });
	};

	openThread = async (id: string): Promise<void> => {
		await this.load(id);
	};

	/** Opens a stored chat; "gone" when it expired or was deleted (a blank chat stays open). */
	private async load(id: string): Promise<"open" | "gone" | "failed" | "left"> {
		if (id === this.snapshot.threadId && !this.snapshot.restoring) return "open";
		const gen = this.detach();
		this.set({ turns: [], threadId: undefined, sending: false, restoring: true, task: undefined });
		try {
			const detail = await this.gateway.getThread(id);
			if (gen !== this.generation) return "left";
			if (detail) {
				this.hydrate(detail);
				this.set({ historyError: undefined });
				return "open";
			}
			// expired or deleted elsewhere — drop it from the list, stay on a blank chat
			this.hint.set("");
			this.set({ threads: this.snapshot.threads.filter((t) => t.id !== id) });
			return "gone";
		} catch (error) {
			if (gen === this.generation) this.set({ historyError: message(error, "This chat could not be opened.") });
			return gen === this.generation ? "failed" : "left";
		} finally {
			if (gen === this.generation) this.set({ restoring: false });
		}
	}

	/**
	 * Taking a to-do item: its chat when it has one (the item's thread, else the
	 * newest chat with its task key), else a new chat whose first message starts
	 * it as that task's chat — never a second chat for the same item.
	 */
	openTask = async (task: ChatTask & { threadId?: string }): Promise<void> => {
		const { key, title } = task;
		if (task.threadId) {
			const opened = await this.load(task.threadId);
			// a chat that could not be read (offline) or that the user left meanwhile: stay put
			if (opened !== "gone") return;
		}
		const gen = this.generation;
		let found: AgentThread | undefined;
		try {
			found = (await this.gateway.listThreads(1, { task: key })).find((t) => t.taskKey === key);
		} catch {
			// no lookup: a new chat for the task (the platform keeps one chat per task)
		}
		if (gen !== this.generation) return;
		if (found && (await this.load(found.id)) !== "gone") return;
		this.newThread();
		this.pendingTask = { key, title };
		this.set({ task: { key, title } });
	};

	/**
	 * Throws when the server refuses — the caller keeps its confirm UI open.
	 * A reply still being written in the open chat is stopped first: the server deletes
	 * the chat and its drafts, and a run left going would keep working for nobody.
	 */
	deleteThread = async (id: string): Promise<void> => {
		if (id === this.snapshot.threadId) {
			await this.whenStarted();
			await this.cancel();
		}
		await this.gateway.deleteThread(id);
		this.set({
			threads: this.snapshot.threads.filter((t) => t.id !== id),
			...(this.snapshot.linked?.id === id ? { linked: undefined } : {}),
		});
		if (id === this.snapshot.threadId) this.newThread();
	};

	/**
	 * A page asking about one area (inventory, products…): continue the newest
	 * chat about it when it was active recently, else start a new one — never
	 * whatever chat happened to be open last.
	 */
	openForDomain = async (domain: string, withinMs: number): Promise<void> => {
		await this.refreshThreads();
		const now = Date.now();
		const recent = this.snapshot.threads.find((t) => t.domain === domain && now - Date.parse(t.updatedAt) < withinMs);
		if (recent) await this.openThread(recent.id);
		else this.newThread();
	};

	/** The chat a run (and the drafts it staged) belongs to — reviewing a task opens its own conversation. */
	openRunThread = async (runId: string): Promise<void> => {
		const run = await this.gateway.getRun(runId).catch(() => null);
		if (run?.threadId) await this.openThread(run.threadId);
	};

	refreshThreads = async (): Promise<void> => {
		if (!this.history) return;
		void this.refreshLinked();
		try {
			const threads = await this.gateway.listThreads(this.threadLimit);
			this.set({ threads: threads.filter(this.scope), historyError: undefined });
		} catch (error) {
			this.set({ historyError: message(error, "Chat history is unavailable.") });
		}
	};

	/**
	 * The record open on the page (a product, a blog post), or undefined: finds
	 * the newest chat started on it (`linked`), so returning to the record offers
	 * that chat. A new chat sent from the record's page is linked by the platform.
	 */
	linkTo = async (entity: { kind: string; id: string } | undefined): Promise<void> => {
		const same = entity?.kind === this.linkedEntity?.kind && entity?.id === this.linkedEntity?.id;
		this.linkedEntity = entity ? { kind: entity.kind, id: entity.id } : undefined;
		if (!same && this.snapshot.linked) this.set({ linked: undefined });
		await this.refreshLinked();
	};

	/** Opens the chat started on the record open on the page. */
	openLinked = async (): Promise<void> => {
		const id = this.snapshot.linked?.id;
		if (id) await this.openThread(id);
	};

	private async refreshLinked(): Promise<void> {
		const entity = this.linkedEntity;
		const seq = ++this.linkedSeq;
		if (!this.history || !entity) return;
		try {
			const threads = await this.gateway.listThreads(3, { entity });
			if (seq !== this.linkedSeq) return;
			const linked = threads.find((t) => this.scope(t) && t.entity?.kind === entity.kind && t.entity.id === entity.id);
			if (linked?.id !== this.snapshot.linked?.id || linked?.updatedAt !== this.snapshot.linked?.updatedAt) this.set({ linked });
		} catch {
			// only an offer: the chat works without it
		}
	}

	/** true when the composer can send: text or ready files, nothing still uploading */
	canSend(text: string): boolean {
		const { attachments } = this.snapshot;
		if (attachments.some((a) => a.status === "uploading")) return false;
		return text.trim().length > 0 || attachments.some((a) => a.status === "ready");
	}

	/** The run waiting on the merchant, if the latest reply asked something. */
	openAsk(): { runId: string; toolCallId: string; questionId: string } | null {
		const last = [...this.snapshot.turns].reverse().find((t) => t.role === "assistant");
		const ask = last?.role === "assistant" ? last.run?.ask : undefined;
		if (!last || !ask || last.run?.status !== "awaiting_input") return null;
		return { runId: last.id, toolCallId: ask.toolCallId, questionId: ask.question.id };
	}

	send = async (prompt: string): Promise<void> => {
		// typing while a question is open answers it in your own words
		const open = this.openAsk();
		if (open && prompt.trim() && this.snapshot.attachments.length === 0) {
			await this.answer(open.runId, { toolCallId: open.toolCallId, questionId: open.questionId, text: prompt.trim().slice(0, 500) });
			return;
		}
		const ready = this.snapshot.attachments.filter((a) => a.status === "ready" && a.attachment);
		const chosen = this.snapshot.attachments.flatMap((a) => (a.status === "ready" && a.chosen?.imageId ? [a.chosen] : []));
		if (this.snapshot.attachments.some((a) => a.status === "uploading")) return;
		const text = prompt.trim() || (ready.length > 0 ? ATTACHMENTS_ONLY_PROMPT : chosen.length > 0 ? CHOSEN_PICTURES_PROMPT : "");
		if (!text) return;
		// typed while the last chat was still loading → continue that chat
		if (this.restorePromise) await this.restorePromise;
		const gen = this.generation;
		const sent = ready.map((a) => ({ ...(a.attachment as AgentAttachment), url: a.attachment?.url ?? a.previewUrl }));
		const attachmentIds = sent.length > 0 ? sent.map((a) => a.id) : undefined;
		const pictureIds = chosen.length > 0 ? chosen.map((picture) => picture.imageId as string) : undefined;
		const elements = this.snapshot.elements;
		const context = elements.length > 0 ? { ...(this.context ?? { module: this.page?.module ?? "app" }), elements } : this.context;
		const userTurn: AgentChatTurn = {
			id: `user_${Date.now()}_${this.snapshot.turns.length}`,
			role: "user",
			text,
			attachments: sent.length > 0 ? sent : undefined,
			...(chosen.length > 0 ? { pictures: chosen } : {}),
			...(elements.length > 0 ? { elements } : {}),
		};
		// the tray empties into the message; refused files stay so the merchant sees why
		this.set({
			sending: true,
			turns: [...this.snapshot.turns, userTurn],
			attachments: this.snapshot.attachments.filter((a) => a.status === "error"),
			attachmentError: undefined,
			elements: [],
		});
		try {
			let run: AgentRun;
			try {
				run = await this.gateway.startRun({
					prompt: text,
					context,
					page: this.page,
					threadId: this.snapshot.threadId,
					attachmentIds,
					pictureIds,
					// only the first message of a new chat makes it the task's chat
					...(this.snapshot.threadId ? {} : this.taskInput()),
				});
			} catch (error) {
				// the thread expired or was deleted in another tab — carry on in a new one
				if (!(this.snapshot.threadId && error instanceof AgentGatewayError && error.status === 404)) throw error;
				if (gen !== this.generation) return;
				this.records = new Map();
				this.set({ threadId: undefined, turns: [userTurn] });
				run = await this.gateway.startRun({ prompt: text, context, page: this.page, attachmentIds, pictureIds, ...this.taskInput() });
			}
			if (gen !== this.generation) {
				this.ignored.add(run.id);
				this.pending.delete(run.id);
				this.lostEarly.delete(run.id);
				return;
			}
			this.records.set(run.id, { run, changeSets: [] });
			// its stream may already be gone (cut right after it started): then it is followed, not streamed
			const lost = this.lostEarly.delete(run.id);
			if (!lost) this.live.add(run.id);
			if (run.threadId) this.pendingTask = undefined;
			// the first run of a new chat carries the id the platform assigned
			const threadId = run.threadId ?? this.snapshot.threadId;
			if (this.history && threadId && threadId !== this.snapshot.threadId) this.hint.set(threadId);
			this.set({ threadId, turns: [...this.snapshot.turns, { id: run.id, role: "assistant", run, changeSets: [] }] });
			const buffered = this.pending.get(run.id) ?? [];
			this.pending.delete(run.id);
			for (const event of buffered) this.apply(event);
			if (lost) this.restartPoll();
			void this.refreshThreads();
		} catch (error) {
			if (gen !== this.generation) return;
			// Refusals (quota, disabled, offline) still answer in the thread.
			const failed = failedRun(text, error);
			this.records.set(failed.id, { run: failed, changeSets: [] });
			this.set({
				turns: [...this.snapshot.turns, { id: failed.id, role: "assistant", run: failed, changeSets: [] }],
			});
		} finally {
			if (gen === this.generation) this.set({ sending: false });
		}
	};

	/** The task a new chat starts as: the pending one, or the open (deleted) chat's own. */
	private taskInput(): { task?: ChatTask } {
		const task = this.pendingTask ?? this.snapshot.task;
		return task ? { task: { key: task.key, title: task.title } } : {};
	}

	/** A prompt still being handed to the server has no run to stop yet: wait for it (bounded). */
	private whenStarted(): Promise<void> {
		if (!this.snapshot.sending) return Promise.resolve();
		return new Promise((resolve) => {
			const done = () => {
				clearTimeout(timer);
				off();
				resolve();
			};
			const off = this.subscribe(() => {
				if (!this.snapshot.sending) done();
			});
			const timer = setTimeout(done, START_WAIT_MS);
		});
	}

	/** Stop the run that is working (or waiting on a question): it shows as stopped at once, the server follows. */
	cancel = async (): Promise<void> => {
		const turn = [...this.snapshot.turns]
			.reverse()
			.find((t) => t.role === "assistant" && t.run !== undefined && (ACTIVE_RUN.has(t.run.status) || t.run.status === "awaiting_input"));
		if (turn?.role !== "assistant" || !this.gateway.cancelRun) return;
		const runId = turn.id;
		this.patchRun(runId, (rec) => ({
			...rec,
			run: rec.run ? reduceRunEvent(rec.run, { type: "run.status", runId, status: "cancelled" }) : rec.run,
		}));
		try {
			const run = await this.gateway.cancelRun(runId);
			this.patchRun(runId, (rec) => ({ ...rec, run }));
		} catch {
			// already finished on the server: its own final frame wins
		}
	};

	/**
	 * "Stop … and run mine": stops a request listed as working while this chat's run waits for a slot (the
	 * merchant's own, or a teammate's for an owner / admin). The waiting run takes the freed slot on its next
	 * check; nothing else to send. False when the platform refused (already finished, not allowed).
	 */
	stopRun = async (runId: string): Promise<boolean> => {
		if (!this.gateway.cancelRun) return false;
		const waiting = this.snapshot.queued;
		// the button goes at once: the next queue frame says what is still working
		if (waiting) {
			this.patchRun(waiting.runId, (rec) =>
				rec.run?.queue
					? { ...rec, run: { ...rec.run, queue: { ...rec.run.queue, running: rec.run.queue.running.filter((item) => item.runId !== runId) } } }
					: rec,
			);
		}
		try {
			await this.gateway.cancelRun(runId);
			return true;
		} catch {
			return false;
		}
	};

	// ── attachments ──────────────────────────────────────────────────────
	private keySeq = 0;

	private patchAttachment(key: string, patch: Partial<ComposerAttachment>): void {
		this.set({ attachments: this.snapshot.attachments.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
	}

	private room(): number {
		return ATTACHMENTS_PER_MESSAGE - this.snapshot.attachments.filter((a) => a.status !== "error").length;
	}

	/** Uploads files into the tray; refused files explain why instead of uploading. */
	attachFiles = async (files: readonly File[]): Promise<void> => {
		this.set({ attachmentError: undefined });
		const accepted: File[] = [];
		for (const file of files) {
			const refusal = attachmentRefusal(file);
			if (refusal) this.set({ attachmentError: refusal });
			else if (accepted.length >= this.room()) this.set({ attachmentError: `Up to ${ATTACHMENTS_PER_MESSAGE} files per message.` });
			else accepted.push(file);
		}
		await Promise.all(
			accepted.map(async (file) => {
				this.keySeq += 1;
				const key = `local_${this.keySeq}`;
				const item: ComposerAttachment = {
					key,
					name: file.name,
					kind: file.type.startsWith("image/") ? "image" : "document",
					status: "uploading",
					progress: 0,
					previewUrl: previewOf(file),
				};
				this.set({ attachments: [...this.snapshot.attachments, item] });
				try {
					const attachment = await this.gateway.uploadAttachment(file, {
						onProgress: (progress) => this.patchAttachment(key, { progress }),
					});
					this.patchAttachment(key, { status: "ready", progress: 1, attachment });
				} catch (error) {
					this.patchAttachment(key, { status: "error", error: message(error, "Upload failed.") });
				}
			}),
		);
	};

	/** Adds a picture picked from the media library, a product or stock photos. */
	attachPicked = async (item: AgentAttachment): Promise<void> => {
		this.set({ attachmentError: undefined });
		if (this.room() <= 0) {
			this.set({ attachmentError: `Up to ${ATTACHMENTS_PER_MESSAGE} files per message.` });
			return;
		}
		this.keySeq += 1;
		const key = `pick_${this.keySeq}`;
		this.set({
			attachments: [
				...this.snapshot.attachments,
				{ key, name: item.name, kind: item.kind, status: "uploading", progress: 0.5, previewUrl: item.url },
			],
		});
		try {
			const attachment = await this.gateway.pickMedia(item);
			this.patchAttachment(key, { status: "ready", progress: 1, attachment });
		} catch (error) {
			this.patchAttachment(key, { status: "error", error: message(error, "Could not add this picture.") });
		}
	};

	/**
	 * Uploads pictures straight into an answer (the question card's Upload tile),
	 * not into the composer tray. Refused files reject with the reason.
	 */
	uploadPictures = async (files: readonly File[]): Promise<AgentAttachment[]> => {
		const images = files.filter((file) => file.type.startsWith("image/"));
		for (const file of images) {
			const refusal = attachmentRefusal(file);
			if (refusal) throw new Error(refusal);
		}
		if (images.length === 0) throw new Error("Only JPG, PNG and WebP pictures can be used here.");
		return Promise.all(images.slice(0, ATTACHMENTS_PER_MESSAGE).map((file) => this.gateway.uploadAttachment(file)));
	};

	/**
	 * "Use this" on a picture of the chat: it waits in the tray as chosen (shown
	 * with its thumbnail) until the message is sent; choosing it again takes it back.
	 */
	choosePicture = (picture: ReceiptMedia): void => {
		if (!picture.imageId) return;
		const key = `chosen:${picture.imageId}`;
		const { attachments } = this.snapshot;
		if (attachments.some((a) => a.key === key)) return this.removeAttachment(key);
		if (attachments.filter((a) => a.chosen).length >= CHOSEN_PICTURES_MAX) return;
		const name = (picture.alt || picture.label || picture.imageId).slice(0, 200);
		this.set({
			attachments: [...attachments, { key, name, kind: "image", status: "ready", progress: 1, previewUrl: picture.url, chosen: picture }],
			attachmentError: undefined,
		});
	};

	/**
	 * Puts a thing on the page into the composer (Ask AI on a button, a picture,
	 * the SEO title): sent with the next message. The same thing again replaces
	 * it with its newer value; past three, the oldest one makes room.
	 * "only": it becomes the one thing attached (the editor's chip follows the selection).
	 */
	attachElement = (raw: ContextElement, mode: "add" | "only" = "add"): void => {
		const element = cleanElement(raw);
		const key = elementKey(element);
		if (mode === "only") return this.set({ elements: [element] });
		const rest = this.snapshot.elements.filter((e) => elementKey(e) !== key);
		this.set({ elements: [...rest.slice(Math.max(0, rest.length - (MAX_CONTEXT_ELEMENTS - 1))), element] });
	};

	removeElement = (key: string): void => {
		this.set({ elements: this.snapshot.elements.filter((e) => elementKey(e) !== key) });
	};

	removeAttachment = (key: string): void => {
		const gone = this.snapshot.attachments.find((a) => a.key === key);
		if (gone?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(gone.previewUrl);
		this.set({ attachments: this.snapshot.attachments.filter((a) => a.key !== key), attachmentError: undefined });
	};

	// ── clarifying questions ─────────────────────────────────────────────
	/**
	 * Answers the open question of a run. The platform either asks the next
	 * question or resumes the run; both arrive as events on this run.
	 */
	answer = async (runId: string, input: AnswerInput): Promise<void> => {
		const gen = this.generation;
		this.live.add(runId);
		this.patchRun(runId, (rec) => ({
			...rec,
			// optimistic: the card leaves while the platform answers
			run: rec.run ? { ...rec.run, status: "running", ask: undefined } : rec.run,
		}));
		try {
			const run = await this.gateway.answerRun(runId, input);
			if (gen !== this.generation) return;
			// the run's own events carry the next question or the resumed work
			this.patchRun(runId, (rec) => (rec.run ? rec : { ...rec, run }));
		} catch (error) {
			if (gen !== this.generation) return;
			this.patchRun(runId, (rec) => ({
				...rec,
				run: rec.run ? { ...rec.run, status: "failed", error: message(error, "Your answer could not be sent.") } : rec.run,
			}));
		}
	};

	searchOptions = (runId: string, questionId: string, query: string) =>
		this.gateway.searchQuestionOptions(runId, questionId, query);

	/**
	 * Sends a failed turn again with the same words and files. The failed
	 * reply and its prompt leave the transcript; the new run replaces them.
	 */
	retry = async (runId: string): Promise<void> => {
		const index = this.snapshot.turns.findIndex((t) => t.id === runId);
		const prompt = index > 0 ? this.snapshot.turns[index - 1] : undefined;
		if (!prompt || prompt.role !== "user") return;
		const files = prompt.attachments ?? [];
		this.records.delete(runId);
		this.set({
			turns: this.snapshot.turns.filter((_, i) => i !== index && i !== index - 1),
			// put the files back in the tray so send() carries them
			attachments: [
				...this.snapshot.attachments,
				...files.map((attachment) => ({
					key: `retry_${attachment.id}`,
					name: attachment.name,
					kind: attachment.kind,
					status: "ready" as const,
					progress: 1,
					previewUrl: attachment.url,
					attachment,
				})),
			],
		});
		await this.send(prompt.text);
	};

	// ── live events ──────────────────────────────────────────────────────
	private onEvent(event: AgentEvent): void {
		if ("runId" in event) {
			if (this.ignored.has(event.runId)) return;
			if (!this.records.has(event.runId)) {
				const queue = this.pending.get(event.runId) ?? [];
				if (queue.length < 200) queue.push(event);
				this.pending.set(event.runId, queue);
				if (this.pending.size > 50) this.pending.delete(this.pending.keys().next().value as string);
				return;
			}
		} else if (event.type !== "changeset.decided") {
			return;
		}
		this.apply(event);
	}

	private patchRun(runId: string, patch: (rec: TurnRecord) => TurnRecord): void {
		const next = patch(this.records.get(runId) ?? { run: undefined, changeSets: [] });
		this.records.set(runId, next);
		this.set({
			turns: this.snapshot.turns.map((t) => (t.role === "assistant" && t.id === runId ? { ...t, ...next } : t)),
		});
	}

	private apply(event: AgentEvent): void {
		switch (event.type) {
			case "run.step":
			case "run.receipt":
			case "run.status":
			case "run.queued":
			case "run.ask":
			case "changeset.staged":
				this.patchRun(event.runId, (rec) => {
					const run = rec.run ? reduceRunEvent(rec.run, event) : rec.run;
					if (event.type !== "changeset.staged") return { run, changeSets: rec.changeSets };
					const exists = rec.changeSets.some((cs) => cs.id === event.changeSet.id);
					return { run, changeSets: exists ? rec.changeSets : [...rec.changeSets, event.changeSet] };
				});
				// a finished run moves its thread to the top of the history list; a question or a
				// staged draft may have renamed the chat (header title) — refresh then too
				const renames = (event.type === "run.ask" && event.ask) || event.type === "changeset.staged";
				const finished = event.type === "run.status" && isTerminalStatus(event.status);
				if ((renames || finished) && this.live.has(event.runId)) void this.refreshThreads();
				break;
			case "changeset.decided": {
				const decided = event.changeSet;
				for (const [runId, rec] of this.records) {
					if (rec.changeSets.some((cs) => cs.id === decided.id)) {
						this.patchRun(runId, (r) => ({
							run: r.run,
							changeSets: r.changeSets.map((cs) => (cs.id === decided.id ? decided : cs)),
						}));
					}
				}
				break;
			}
		}
	}

	// ── runs still working without a stream (reload mid-run, stream cut) ──
	/**
	 * A run's stream ended before its final status (network drop, proxy cut,
	 * function limit): the run may still be working. It leaves `live` — the
	 * composer unlocks and the reply keeps its "still working" look, as after
	 * a reload — and is followed by polling until it ends.
	 */
	private onStreamLost(runId: string): void {
		if (this.ignored.has(runId)) return;
		if (!this.records.has(runId)) {
			// startRun() has not resolved yet: send() picks it up
			this.lostEarly.add(runId);
			if (this.lostEarly.size > 20) this.lostEarly.delete(this.lostEarly.values().next().value as string);
			return;
		}
		if (!this.live.delete(runId)) return;
		this.set({});
		this.restartPoll();
	}

	/** A run joins the followed ones: the backoff and the time limit start over. */
	private restartPoll(): void {
		this.polls = 0;
		this.pollUntil = Date.now() + this.pollWindowMs;
		this.schedulePoll();
	}

	/** Runs of the open chat still working that no stream reports on. */
	private working(): string[] {
		return [...this.records].flatMap(([id, rec]) =>
			!this.live.has(id) && rec.run !== undefined && ACTIVE_RUN.has(rec.run.status) ? [id] : [],
		);
	}

	/**
	 * Follows working runs with a cheap status read (`getRun`), backing off
	 * 4 s → 8 s → 16 s; the thread is read once a run ended (its answer, staged
	 * cards). Past the time limit a run that never ended shows as interrupted.
	 */
	private schedulePoll(): void {
		this.clearPoll();
		const working = this.working();
		const threadId = this.snapshot.threadId;
		if (this.stopped || working.length === 0 || !threadId) return;
		if (Date.now() >= this.pollUntil) return this.markInterrupted(working);
		const gen = this.generation;
		const delay = Math.min(this.pollMs * 2 ** this.polls, this.pollMs * 4);
		this.pollTimer = setTimeout(() => {
			this.pollTimer = null;
			this.polls += 1;
			void this.pollOnce(threadId, working, gen).finally(() => {
				if (gen === this.generation) this.schedulePoll();
			});
		}, delay);
	}

	private async pollOnce(threadId: string, ids: string[], gen: number): Promise<void> {
		const status = async (id: string): Promise<AgentRun | null | undefined> => {
			try {
				return await this.gateway.getRun(id);
			} catch {
				return undefined; // unknown: read the thread instead
			}
		};
		try {
			const runs = await Promise.all(ids.map(status));
			if (gen !== this.generation) return;
			const ended = runs.some((run) => run === null || (run !== undefined && !ACTIVE_RUN.has(run.status)));
			const unknown = runs.every((run) => run === undefined);
			if (!ended && !unknown) return;
			const detail = await this.gateway.getThread(threadId);
			if (!detail || gen !== this.generation) return;
			const { records } = turnsFromThread(detail);
			for (const [id, rec] of records) {
				if (this.live.has(id) || !this.records.has(id)) continue;
				this.patchRun(id, () => rec);
			}
			if (ended) void this.refreshThreads();
		} catch {
			// offline for a moment: the next check tries again
		}
	}

	/** The run never reported an end within the time limit: it shows as failed (with Retry), not working forever. */
	private markInterrupted(ids: string[]): void {
		const finishedAt = new Date().toISOString();
		for (const id of ids) {
			this.patchRun(id, (rec) => ({
				...rec,
				run: rec.run ? { ...rec.run, status: "failed", error: rec.run.error ?? INTERRUPTED_RUN_ERROR, finishedAt } : rec.run,
			}));
		}
	}

	private clearPoll(): void {
		if (this.pollTimer) clearTimeout(this.pollTimer);
		this.pollTimer = null;
	}
}

import type {
	AgentAttachment,
	AgentChatTurn,
	AgentThread,
	AnswerInput,
	ComposerAttachment,
	ContextElement,
	ContextPin,
	PageLocation,
	QuestionOption,
	ReceiptMedia,
} from "@ech/agent-core";
import type { MediaQuery } from "@ech/agent-transport";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { type ChatQueue, ChatSession, type ChatTask } from "./chat-session";
export { contextElementKey as elementKey } from "@ech/agent-core";
import type { ThreadHintStore } from "./chat-turns";
import { useGateway } from "./context";

export type { AgentChatTurn, ComposerAttachment, ThreadHintStore } from "./chat-turns";
export { memoryThreadHint, sessionThreadHint, turnsFromThread } from "./chat-turns";
export {
	ATTACHMENTS_ONLY_PROMPT,
	attachmentRefusal,
	CHOSEN_PICTURES_PROMPT,
	type ChatQueue,
	ChatSession,
	type ChatSessionOptions,
	type ChatSessionSnapshot,
	type ChatTask,
} from "./chat-session";

export interface AgentChatHistory {
	/** thread the next prompt continues; undefined = a new chat */
	threadId: string | undefined;
	/** recent chats, newest activity first */
	threads: AgentThread[];
	/** a stored chat is loading (first mount, or picked from the list) */
	restoring: boolean;
	/** history could not load — chatting still works */
	error: string | undefined;
	newThread: () => void;
	openThread: (id: string) => Promise<void>;
	/** continue the newest recent chat about this domain, else a new chat */
	openForDomain: (domain: string, withinMs: number) => Promise<void>;
	/** the newest chat started on the record open on the page (a product, a blog post) */
	linked: AgentThread | undefined;
	/** open `linked` */
	openLinked: () => Promise<void>;
	/** open the chat a run belongs to (e.g. the task under review) */
	openRunThread: (runId: string) => Promise<void>;
	/** the to-do item the open chat handles (or the one the next message starts) */
	task: ChatTask | undefined;
	/** take a to-do item: its chat (`threadId`, else the chat with its key), else a new chat started as that task */
	openTask: (task: ChatTask & { threadId?: string }) => Promise<void>;
	/** rejects when the server refuses the delete */
	deleteThread: (id: string) => Promise<void>;
	refresh: () => Promise<void>;
}

/** Everything the assistant panel needs from one chat: transcript, composer and questions. */
export interface AgentChatRuntime {
	turns: AgentChatTurn[];
	/** a run started here is still working */
	busy: boolean;
	/** Send a prompt (plus the ready files in the tray) — also used by suggestion chips. */
	send: (prompt: string) => Promise<void>;
	canSend: (text: string) => boolean;
	/** stop the reply that is being written (or leave the queue); undefined when the backend can't stop runs */
	stop: (() => Promise<void>) | undefined;
	/** the open chat's run waiting for a free AI slot (place + what is working), else undefined */
	queued: ChatQueue | undefined;
	/** "Stop … and run mine": stop a request listed in `queued.running`; undefined when the backend can't stop runs */
	stopRun: ((runId: string) => Promise<boolean>) | undefined;
	/** send a failed turn again (same words and files) */
	retry: (runId: string) => Promise<void>;
	/** answer the open clarifying question of a run */
	answer: (runId: string, input: AnswerInput) => Promise<void>;
	searchOptions: (runId: string, questionId: string, query: string) => Promise<QuestionOption[]>;
	attachments: ComposerAttachment[];
	attachmentError: string | undefined;
	attachFiles: (files: readonly File[]) => Promise<void>;
	attachPicked: (item: AgentAttachment) => Promise<void>;
	/** pictures uploaded straight into a question's answer */
	uploadPictures: (files: readonly File[]) => Promise<AgentAttachment[]>;
	removeAttachment: (key: string) => void;
	/** "Use this" on a picture of the chat: chosen for the next message (again = not chosen) */
	choosePicture: (picture: ReceiptMedia) => void;
	/** things on the page waiting for the next message (Ask AI on an element), at most three */
	elements: ContextElement[];
	/** past three, the oldest makes room; "only" replaces what is attached */
	attachElement: (element: ContextElement, mode?: "add" | "only") => void;
	/** by `elementKey` */
	removeElement: (key: string) => void;
	listMedia: (query: MediaQuery) => Promise<AgentAttachment[]>;
	/** persistent chat threads; undefined when the surface opted out */
	history: AgentChatHistory | undefined;
}

export interface AgentChatRuntimeOptions {
	/** page context pinned to every prompt (undefined = the merchant removed the page chip) */
	context?: ContextPin;
	/** where the merchant is: page title + address, sent with every prompt even when the page chip is removed */
	page?: PageLocation;
	/**
	 * Persistent history (default true): restores the last chat on mount,
	 * keeps one thread across pages and lists recent chats.
	 */
	history?: boolean;
	/** where the open chat is remembered between loads (default sessionStorage) */
	hint?: ThreadHintStore;
	/** nothing remembered: open the newest chat (default true) or start blank */
	restoreLatest?: boolean;
	/** the chats this surface lists and reopens (see ChatSessionOptions.scope); keep it a stable function */
	scope?: (thread: AgentThread) => boolean;
	/** offer the chat started on the pinned record (`history.linked`, default true) */
	linkToRecord?: boolean;
}

/** The site editor's chats (`scope` there): a chat about the web builder stays in the editor. */
export const webBuilderChats = (thread: AgentThread): boolean => thread.domain === "webbuilder";
/** The dashboard docks' chats (`scope` there): every chat except the site editor's. */
export const outsideWebBuilderChats = (thread: AgentThread): boolean => thread.domain !== "webbuilder";

/**
 * Binds a ChatSession (one per gateway) to React: each prompt starts a run in
 * the open thread and its live events stream into the transcript.
 */
export function useAgentChatRuntime(options?: AgentChatRuntimeOptions): AgentChatRuntime {
	const gateway = useGateway();
	const historyEnabled = options?.history ?? true;
	const hint = options?.hint;
	const restoreLatest = options?.restoreLatest ?? true;
	const scope = options?.scope;
	const session = useMemo(
		() => new ChatSession(gateway, { history: historyEnabled, hint, restoreLatest, scope }),
		[gateway, historyEnabled, hint, restoreLatest, scope],
	);
	session.context = options?.context;
	session.page = options?.page;

	// the record open on the page → the chat started on it, if any
	const pinned = options?.context?.entity;
	const recordKey = (options?.linkToRecord ?? true) && historyEnabled && pinned ? `${pinned.kind}:${pinned.id}` : "";
	useEffect(() => {
		const at = recordKey.indexOf(":");
		void session.linkTo(recordKey ? { kind: recordKey.slice(0, at), id: recordKey.slice(at + 1) } : undefined);
	}, [session, recordKey]);

	useEffect(() => {
		session.start();
		return () => session.stop();
	}, [session]);

	const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
	const canSend = useCallback((text: string) => session.canSend(text), [session]);
	const listMedia = useCallback((query: MediaQuery) => gateway.listMedia(query), [gateway]);

	const history = useMemo<AgentChatHistory | undefined>(
		() =>
			historyEnabled
				? {
						threadId: snapshot.threadId,
						threads: snapshot.threads,
						restoring: snapshot.restoring,
						error: snapshot.historyError,
						newThread: session.newThread,
						openThread: session.openThread,
						openForDomain: session.openForDomain,
						linked: snapshot.linked,
						openLinked: session.openLinked,
						openRunThread: session.openRunThread,
						task: snapshot.task,
						openTask: session.openTask,
						deleteThread: session.deleteThread,
						refresh: session.refreshThreads,
					}
				: undefined,
		[historyEnabled, session, snapshot.threadId, snapshot.threads, snapshot.restoring, snapshot.historyError, snapshot.linked, snapshot.task],
	);

	return useMemo(
		() => ({
			turns: snapshot.turns,
			busy: snapshot.busy,
			send: session.send,
			canSend,
			stop: gateway.cancelRun ? session.cancel : undefined,
			queued: snapshot.queued,
			stopRun: gateway.cancelRun ? session.stopRun : undefined,
			retry: session.retry,
			answer: session.answer,
			searchOptions: session.searchOptions,
			attachments: snapshot.attachments,
			attachmentError: snapshot.attachmentError,
			attachFiles: session.attachFiles,
			attachPicked: session.attachPicked,
			uploadPictures: session.uploadPictures,
			removeAttachment: session.removeAttachment,
			choosePicture: session.choosePicture,
			elements: snapshot.elements,
			attachElement: session.attachElement,
			removeElement: session.removeElement,
			listMedia,
			history,
		}),
		[snapshot, session, canSend, listMedia, history],
	);
}

/**
 * Which chat a request from the page lands in:
 * - "new": a task started from a button with its own prompt (Generate with AI)
 * - { domain }: a page's own assistant (inventory) — its recent chat, else new
 * - { runId }: reviewing a task — the chat that produced it
 * - { task }: taking a to-do item — its chat, else a new chat started as that task
 * - "current": just opening the assistant
 * Default: a prompt starts a new chat; no prompt keeps the current one.
 */
export type AgentSessionIntent =
	| "current"
	| "new"
	| { domain: string; withinMs?: number }
	| { runId: string }
	| { task: ChatTask & { threadId?: string } };

const RECENT_DOMAIN_CHAT_MS = 6 * 60 * 60 * 1000;

export async function enterSession(
	history: AgentChatHistory | undefined,
	intent: AgentSessionIntent | undefined,
	hasPrompt: boolean,
): Promise<void> {
	if (!history) return;
	const resolved = intent ?? (hasPrompt ? "new" : "current");
	if (resolved === "current") return;
	if (resolved === "new") return history.newThread();
	if ("runId" in resolved) return history.openRunThread(resolved.runId);
	if ("task" in resolved) return history.openTask(resolved.task);
	return history.openForDomain(resolved.domain, resolved.withinMs ?? RECENT_DOMAIN_CHAT_MS);
}

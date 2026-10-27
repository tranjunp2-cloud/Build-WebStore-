import { nextToRaise, snoozeFor, type AgentThread, type WorkAction, type WorkItem, type WorkState } from "@ech/agent-core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { ChatSuggestion } from "./chat";
import { DEFAULT_WORK_LABELS, IssuesButton, IssuesList, TaskIntro, type WorkLabels, WorkRaise } from "./work-desk";

/** The merchant's work queue as the host passes it (`useWork()` + its state writes). */
export interface AgentPanelWork {
	items: WorkItem[];
	states: WorkState[];
	loading?: boolean;
	error?: boolean;
	partial?: boolean;
	onRetry?: () => void;
	/** "Later": the host stores the snooze (until = ISO time) */
	onLater: (item: WorkItem, until: string) => void;
	/** an item was raised on its own over the mascot: the host stores when */
	onRaised?: (item: WorkItem, at: string) => void;
	/** first unprompted raise after this long on a page (default 3000 ms) */
	raiseDelayMs?: number;
	/** a raised bubble hides itself after this long (default 12000 ms; the clock stops while hovered) */
	raiseTtlMs?: number;
	/** read the queue again now (an item was just taken: its chat exists) */
	onChanged?: () => void;
	/** quick discard from the Issues list: drafts rejected / question skipped / shop issue hidden until it changes */
	onDiscard?: (item: WorkItem) => void;
	/** Undo of a dismissed shop issue */
	onRestore?: (item: WorkItem) => void;
}

/** What the panel needs from the chat runtime to take an item. */
interface WorkHistory {
	threadId: string | undefined;
	threads: AgentThread[];
	newThread: () => void;
	openThread: (id: string) => Promise<void>;
	openTask?: (task: { key: string; title: string; threadId?: string }) => Promise<void>;
	task?: { key: string; title: string };
}

const isTyping = () => {
	const active = typeof document === "undefined" ? null : document.activeElement;
	return Boolean(active?.matches?.("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
};

/** after the bubble hid itself / was closed: no other item is raised before this long */
export const RAISE_QUIET_AFTER_HIDE_MS = 20 * 60_000;
export const RAISE_QUIET_AFTER_CLOSE_MS = 60 * 60_000;

/** issues offered as reply pills on a new chat (the host's starters fill the rest) */
const ISSUE_PILLS = 3;

/**
 * The dock in work mode: a new chat greets as before with the top issues as reply pills; the
 * header shows the chat's name only, with the Issues button on the right (History stays the
 * dock's plain list of chats); while closed the mascot raises one issue at a time — never over
 * typing, never while a reply is going, within the caps.
 */
export function useWorkPanel({
	work,
	history,
	turns,
	busy,
	open,
	setOpen,
	send,
	onNavigate,
	labels: overrides,
	locale,
}: {
	work: AgentPanelWork | undefined;
	history: WorkHistory | undefined;
	turns: number;
	busy: boolean;
	open: boolean;
	setOpen: (open: boolean) => void;
	send: (prompt: string) => Promise<unknown> | void;
	onNavigate?: (href: string) => void;
	labels?: Partial<WorkLabels>;
	locale?: string;
}) {
	const labels = { ...DEFAULT_WORK_LABELS, ...overrides };
	const [view, setView] = useState<"chat" | "issues">("chat");
	const items = work?.items ?? [];
	const states = work?.states ?? [];
	const task = history?.task;
	const inChat = Boolean(history?.threadId) || turns > 0 || Boolean(task);
	const taskItem = task ? items.find((item) => item.taskKey === task.key) : undefined;
	// an older chat (started before tasks) opened from its item: the item names the job
	const threadItem = history?.threadId ? items.find((item) => item.threadId === history.threadId) : undefined;

	const openItem = useCallback(
		async (item: WorkItem) => {
			setView("chat");
			setOpen(true);
			if (item.threadId) return history?.openThread(item.threadId);
			await history?.openTask?.({ key: item.taskKey, title: item.taskTitle });
		},
		[history, setOpen],
	);

	const take = useCallback(
		async (item: WorkItem, action: WorkAction) => {
			if (action.kind === "link") return onNavigate?.(action.value);
			setView("chat");
			setOpen(true);
			if (action.kind === "open_thread") return history?.openThread(action.value);
			// its chat exists: continue there, the merchant sees where it stands
			if (item.threadId) return history?.openThread(item.threadId);
			await history?.openTask?.({ key: item.taskKey, title: item.taskTitle });
			const sent = send(action.value);
			// the task's chat exists once the run starts: the queue learns its thread (no second chat, "In chat")
			window.setTimeout(() => work?.onChanged?.(), 1500);
			await sent;
		},
		[history, onNavigate, send, setOpen, work],
	);

	const later = useCallback((item: WorkItem) => work?.onLater(item, new Date(Date.now() + snoozeFor(item)).toISOString()), [work]);

	// --- raising on its own while the dock is closed ---
	const raisedAt = useRef<number[]>([]);
	const [raisedKey, setRaisedKey] = useState<string | undefined>();
	// closed with ✕ or hidden by itself: quiet until then (the next item is not raised right away)
	const [quietUntil, setQuietUntil] = useState(0);
	const [hovered, setHovered] = useState(false);
	const raised = raisedKey ? items.find((item) => item.key === raisedKey) : undefined;
	const active = Boolean(work) && !open;
	const quietFor = useCallback((ms: number) => {
		setRaisedKey(undefined);
		setHovered(false);
		setQuietUntil(Date.now() + ms);
	}, []);
	// a raised item says its piece and goes: hidden after the TTL, the clock paused while hovered
	useEffect(() => {
		if (!raised || open || hovered) return;
		const timer = window.setTimeout(() => quietFor(RAISE_QUIET_AFTER_HIDE_MS), work?.raiseTtlMs ?? 12_000);
		return () => window.clearTimeout(timer);
	}, [raised, open, hovered, work?.raiseTtlMs, quietFor]);
	useEffect(() => {
		if (!active || raised) return;
		const wait = Math.max(raisedKey ? 1500 : (work?.raiseDelayMs ?? 3000), quietUntil - Date.now());
		const timer = window.setTimeout(
			() => {
				if (isTyping() || busy) return;
				const now = new Date();
				const next = nextToRaise(items, states, raisedAt.current, now);
				if (!next) return;
				raisedAt.current.push(now.getTime());
				setRaisedKey(next.key);
				work?.onRaised?.(next, now.toISOString());
			},
			wait,
		);
		return () => window.clearTimeout(timer);
	}, [active, raised, raisedKey, items, states, busy, work, quietUntil]);

	const raise: ReactNode = work && raised && !open ? (
		<WorkRaise
			item={raised}
			index={items.indexOf(raised)}
			total={items.length}
			labels={labels}
			onTake={(item, action) => {
				setRaisedKey(undefined);
				void take(item, action);
			}}
			onLater={(item) => {
				later(item);
				setRaisedKey(undefined);
			}}
			onHide={() => quietFor(RAISE_QUIET_AFTER_CLOSE_MS)}
			onHoverChange={setHovered}
		/>
	) : undefined;

	if (!work) return undefined;

	const loadingFirst = Boolean(work.loading) && items.length === 0;

	return {
		view,
		inChat,
		/** the mascot's number: open issues, nothing while the first load is going or failed */
		badge: loadingFirst || (work.error && items.length === 0) ? undefined : items.length,
		raise,
		/** the chat's name (an issue's task, or the item an older chat belongs to); undefined = the host's "New chat" / thread title */
		title: view === "issues" ? labels.issues : inChat ? (task?.title ?? threadItem?.taskTitle) : undefined,
		onBack: view !== "chat" ? () => setView("chat") : undefined,
		backLabel: labels.back,
		actions: <IssuesButton items={items} labels={labels} active={view === "issues"} onClick={() => setView(view === "issues" ? "chat" : "issues")} />,
		/** History (the dock's list of chats) opened: leave the Issues list */
		toChat: () => setView("chat"),
		/** a new chat (or the Issues / History list): back to a new chat */
		onNewChat: () => {
			setView("chat");
			history?.newThread();
		},
		/** the greeting's pills: the top issues first (each opens its own chat), then the host's starters */
		suggestions: (starters: readonly ChatSuggestion[] = []): ChatSuggestion[] => {
			const issues = items.slice(0, ISSUE_PILLS).flatMap((item) => {
				const main = item.actions[0];
				return main ? [{ label: item.title, prompt: main.kind === "prompt" ? main.value : item.title, onSelect: () => void take(item, main) }] : [];
			});
			return [...issues, ...starters].slice(0, 4);
		},
		/** an issue's chat not started yet: its facts and buttons as the first message */
		empty: inChat && taskItem && turns === 0 ? <TaskIntro item={taskItem} labels={labels} onTake={(item, action) => void take(item, action)} /> : undefined,
		body:
			view === "issues" ? (
				<IssuesList
					items={items}
					loading={work.loading}
					error={work.error}
					partial={work.partial}
					labels={labels}
					onOpenItem={(item) => void openItem(item)}
					onRetry={work.onRetry}
					onDiscard={work.onDiscard}
					onRestore={work.onRestore}
				/>
			) : undefined,
	};
}

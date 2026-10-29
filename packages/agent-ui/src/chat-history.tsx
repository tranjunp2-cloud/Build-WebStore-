import type { AgentDomain, AgentThread } from "@ech/agent-core";
import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

export interface AgentChatHistoryLabels {
	newChat: string;
	/** popover heading (screen readers) */
	recent: string;
	search: string;
	today: string;
	yesterday: string;
	lastWeek: string;
	older: string;
	emptyTitle: string;
	/** retention note under the list and in the empty state */
	kept: string;
	keptShort: string;
	noMatch: string;
	loading: string;
	delete: string;
	deleteConfirm: string;
	cancel: string;
	deleteFailed: string;
	/** the armed trash button on a row */
	deleteShort: string;
	/** the trash button by the search: pick several chats to delete */
	select: string;
	/** per day group, while picking */
	selectAll: string;
	/** "Delete {n}" */
	deleteSelected: string;
	deleted: string;
	/** "{n} chats deleted" */
	deletedMany: string;
	/** "{n} selected" */
	selected: string;
	/** "{n} chats could not be deleted. Try again." */
	deleteManyFailed: string;
	/** shown in the stream while a chat restores */
	restoring: string;
	/** row meta — `{n}` is replaced */
	waiting: string;
	waitingMany: string;
	applied: string;
	appliedMany: string;
	answered: string;
	domains: Partial<Record<AgentDomain | "other", string>>;
	/** pages that name a chat better than its domain ("store" → "Product Store") */
	modules: Record<string, string>;
}

export const DEFAULT_CHAT_HISTORY_LABELS: AgentChatHistoryLabels = {
	newChat: "New chat",
	recent: "Recent chats",
	search: "Search chats",
	today: "Today",
	yesterday: "Yesterday",
	lastWeek: "Last 7 days",
	older: "Older",
	emptyTitle: "No past chats yet",
	kept: "Chats are kept for 90 days after your last message.",
	keptShort: "Chats are kept for 90 days.",
	noMatch: "No chats match.",
	loading: "Loading…",
	delete: "Delete this chat",
	deleteShort: "Delete",
	deleteConfirm: "Delete this chat? This can't be undone.",
	cancel: "Cancel",
	deleteFailed: "Could not delete this chat. Try again.",
	select: "Delete several",
	selectAll: "Select all",
	deleteSelected: "Delete {n}",
	deleted: "Chat deleted",
	deletedMany: "{n} chats deleted",
	selected: "{n} selected",
	deleteManyFailed: "{n} chats could not be deleted. Try again.",
	restoring: "Loading your chat",
	waiting: "1 draft waiting",
	waitingMany: "{n} drafts waiting",
	applied: "applied",
	appliedMany: "{n} drafts applied",
	answered: "answered",
	domains: { products: "Product", cms: "Blog", listings: "Channels", orders: "Orders", other: "Chat" },
	modules: { store: "Product Store" },
};

export interface AgentChatHistoryProps {
	threads: AgentThread[];
	activeThreadId?: string;
	/** the open chat is loading */
	loading?: boolean;
	/** history could not load */
	error?: string;
	onNew: () => void;
	onOpen: (id: string) => void;
	/** reject to keep the confirm open with an error */
	onDelete: (id: string) => void | Promise<unknown>;
	/** called when the list opens — refetch to show other tabs' chats */
	onShow?: () => void;
	labels?: Partial<AgentChatHistoryLabels>;
	/** BCP 47 locale for times (defaults to the browser's) */
	locale?: string;
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(at: number): number {
	const d = new Date(at);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export type RecentGroup = "today" | "yesterday" | "lastWeek" | "older";

/** Which list group a thread falls in, by its last activity. */
export function recentGroup(iso: string, now: number = Date.now()): RecentGroup {
	const at = Date.parse(iso);
	const today = startOfDay(now);
	if (Number.isNaN(at) || at >= today) return "today";
	if (at >= today - DAY) return "yesterday";
	if (at >= today - 6 * DAY) return "lastWeek";
	return "older";
}

/** Clock time today and yesterday, weekday this week, short date before. */
export function recentTime(iso: string, locale?: string, now: number = Date.now()): string {
	const at = Date.parse(iso);
	if (Number.isNaN(at)) return "";
	const group = recentGroup(iso, now);
	if (group === "today" || group === "yesterday") {
		return new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
	}
	if (group === "lastWeek") return new Date(at).toLocaleDateString(locale, { weekday: "short" });
	return new Date(at).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function count(template: string, n: number): string {
	return template.replace("{n}", String(n));
}

/** "Product · 1 draft waiting" — what the chat is about and where it stands. */
export function threadMeta(thread: AgentThread, labels: AgentChatHistoryLabels): { text: string; pending: boolean } {
	const domain =
		(thread.module && labels.modules[thread.module]) ?? (thread.domain && labels.domains[thread.domain]) ?? labels.domains.other ?? "";
	const pending = thread.pendingDrafts ?? 0;
	const applied = thread.appliedDrafts ?? 0;
	const state =
		pending > 0
			? pending === 1
				? labels.waiting
				: count(labels.waitingMany, pending)
			: applied > 0
				? applied === 1
					? labels.applied
					: count(labels.appliedMany, applied)
				: labels.answered;
	return { text: domain ? `${domain} · ${state}` : state, pending: pending > 0 };
}

const GROUPS: RecentGroup[] = ["today", "yesterday", "lastWeek", "older"];

/** how long an armed delete waits for its second click */
const ARM_MS = 3000;
/** the row folds away before it leaves the list */
const LEAVE_MS = 220;
const NOTICE_MS = 2200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recent chats — a popover under the panel's thread title: search, rows
 * grouped by day, the open chat marked. Hovering a row swaps its time for a
 * trash button: one click arms it ("Delete", red), a second click deletes.
 * The trash button by the search turns rows into checkboxes to delete
 * several chats at once.
 */
export function AgentRecentChats({
	threads,
	activeThreadId,
	loading,
	error,
	onOpen,
	onDelete,
	labels: labelOverrides,
	locale,
	onClose,
}: Pick<AgentChatHistoryProps, "threads" | "activeThreadId" | "loading" | "error" | "onOpen" | "labels" | "locale"> & {
	onDelete?: AgentChatHistoryProps["onDelete"];
	onClose: (refocus: boolean) => void;
}) {
	const labels = { ...DEFAULT_CHAT_HISTORY_LABELS, ...labelOverrides };
	const [query, setQuery] = useState("");
	// null = browsing; a set = picking chats to delete
	const [picked, setPicked] = useState<Set<string> | null>(null);
	/** the row whose trash was clicked once */
	const [armed, setArmed] = useState<string | null>(null);
	/** rows folding away while their delete runs */
	const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
	const [deleting, setDeleting] = useState(false);
	const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
	const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
		return () => {
			clearTimeout(armTimer.current);
			clearTimeout(noticeTimer.current);
		};
	}, []);

	const say = (text: string, failed = false) => {
		clearTimeout(noticeTimer.current);
		setNotice({ text, failed });
		noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
	};
	const disarm = () => {
		clearTimeout(armTimer.current);
		setArmed(null);
	};
	const arm = (id: string) => {
		clearTimeout(armTimer.current);
		setArmed(id);
		armTimer.current = setTimeout(() => setArmed(null), ARM_MS);
	};
	const setPicking = (on: boolean) => {
		disarm();
		setPicked(on ? new Set() : null);
	};
	const toggle = (id: string) =>
		setPicked((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	const pickAll = (ids: string[]) =>
		setPicked((prev) => {
			const next = new Set(prev);
			const all = ids.every((id) => next.has(id));
			for (const id of ids) {
				if (all) next.delete(id);
				else next.add(id);
			}
			return next;
		});

	/** Fold the rows away while they delete; a row whose delete failed comes back. */
	const remove = async (ids: string[]): Promise<string[]> => {
		if (!onDelete) return ids;
		setLeaving((prev) => new Set([...prev, ...ids]));
		const [results] = await Promise.all([Promise.allSettled(ids.map((id) => onDelete(id))), wait(LEAVE_MS)]);
		const kept = ids.filter((_, i) => results[i]?.status === "rejected");
		if (kept.length > 0) {
			setLeaving((prev) => {
				const next = new Set(prev);
				for (const id of kept) next.delete(id);
				return next;
			});
		}
		return kept;
	};
	const deleteOne = async (id: string) => {
		disarm();
		const kept = await remove([id]);
		say(kept.length > 0 ? labels.deleteFailed : labels.deleted, kept.length > 0);
	};
	const deletePicked = async () => {
		if (!picked || picked.size === 0) return;
		const ids = [...picked];
		setDeleting(true);
		const kept = await remove(ids);
		setDeleting(false);
		if (kept.length > 0) {
			setPicked(new Set(kept));
			say(count(labels.deleteManyFailed, kept.length), true);
			return;
		}
		setPicked(null);
		say(ids.length === 1 ? labels.deleted : count(labels.deletedMany, ids.length));
	};

	const groups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const now = Date.now();
		const rows = q
			? threads.filter((t) => `${t.title} ${t.preview ?? ""}`.toLowerCase().includes(q))
			: threads;
		return GROUPS.map((group) => ({ group, rows: rows.filter((t) => recentGroup(t.updatedAt, now) === group) })).filter(
			(g) => g.rows.length > 0,
		);
	}, [threads, query]);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Escape") {
			e.stopPropagation();
			if (picked) setPicking(false);
			else if (armed) disarm();
			else onClose(true);
			return;
		}
		const row = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".ech-ag-recent-item");
		if ((e.key === "Delete" || e.key === "Backspace") && row?.dataset.id && !picked && onDelete && document.activeElement?.tagName !== "INPUT") {
			e.preventDefault();
			if (armed === row.dataset.id) void deleteOne(row.dataset.id);
			else arm(row.dataset.id);
			return;
		}
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
		const items = [...e.currentTarget.querySelectorAll<HTMLElement>("input, .ech-ag-recent-row")];
		const index = items.indexOf(document.activeElement as HTMLElement);
		const next = items[Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)))];
		next?.focus();
		e.preventDefault();
	};

	if (threads.length === 0) {
		return (
			<div className="ech-ag-recent" role="dialog" aria-label={labels.recent} onKeyDown={onKeyDown}>
				<div className="ech-ag-recent-empty">
					<b>{error ? error : loading ? labels.loading : labels.emptyTitle}</b>
					<p>{labels.keptShort}</p>
				</div>
				{notice && (
					<p className="ech-ag-recent-notice" role="status" data-failed={notice.failed ? "" : undefined}>
						<Icon name={notice.failed ? "x" : "check"} size={14} />
						{notice.text}
					</p>
				)}
			</div>
		);
	}

	let index = 0;
	return (
		<div
			className="ech-ag-recent"
			role="dialog"
			aria-label={labels.recent}
			data-pick={picked ? "" : undefined}
			onKeyDown={onKeyDown}
		>
			<div className="ech-ag-recent-top">
				<label className="ech-ag-search">
					<Icon name="search" />
					<input
						ref={searchRef}
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={labels.search}
						aria-label={labels.search}
					/>
				</label>
				{onDelete && (
					<button
						type="button"
						className="ech-ag-recent-mode"
						aria-pressed={picked !== null}
						aria-label={picked ? labels.cancel : labels.select}
						onClick={() => setPicking(picked === null)}
					>
						<Icon name="trash" size={16} className="is-trash" />
						<Icon name="x" size={16} className="is-x" />
						<span className="ech-ag-recent-tip" aria-hidden="true">
							{picked ? labels.cancel : labels.select}
						</span>
					</button>
				)}
			</div>
			<div className="ech-ag-recent-list" onMouseLeave={() => armed && arm(armed)}>
				{groups.length === 0 && <p className="ech-ag-recent-note">{labels.noMatch}</p>}
				{groups.map(({ group, rows }) => (
					<div key={group} role="group" aria-label={labels[group]}>
						<div className="ech-ag-recent-group">
							<span>{labels[group]}</span>
							{picked && (
								<button type="button" onClick={() => pickAll(rows.map((t) => t.id))}>
									{labels.selectAll}
								</button>
							)}
						</div>
						{rows.map((thread) => {
							const meta = threadMeta(thread, labels);
							const current = thread.id === activeThreadId;
							const on = picked?.has(thread.id) ?? false;
							const isArmed = armed === thread.id;
							return (
								<div
									key={thread.id}
									className="ech-ag-recent-item"
									data-id={thread.id}
									data-armed={isArmed ? "" : undefined}
									data-leaving={leaving.has(thread.id) ? "" : undefined}
									style={{ "--i": Math.min(index++, 12) } as CSSProperties}
								>
									<button
										type="button"
										className="ech-ag-recent-row"
										role={picked ? "checkbox" : undefined}
										aria-checked={picked ? on : undefined}
										aria-current={!picked && current ? "true" : undefined}
										title={thread.preview ?? thread.title}
										onClick={() => {
											if (picked) return toggle(thread.id);
											if (!current) onOpen(thread.id);
											onClose(false);
										}}
									>
										<span className="ech-ag-check" data-on={on ? "" : undefined} aria-hidden="true">
											<Icon name="check" size={12} />
										</span>
										<b>{thread.title}</b>
										<time dateTime={thread.updatedAt}>{recentTime(thread.updatedAt, locale)}</time>
										<small className={meta.pending ? "ech-ag-pend" : undefined}>{meta.text}</small>
									</button>
									{onDelete && !picked && (
										<button
											type="button"
											className="ech-ag-recent-del"
											aria-label={isArmed ? labels.deleteShort : labels.delete}
											onClick={() => (isArmed ? void deleteOne(thread.id) : arm(thread.id))}
										>
											<Icon name="trash" size={15} />
											<span>{labels.deleteShort}</span>
										</button>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
			{notice && (
				<p className="ech-ag-recent-notice" role="status" data-failed={notice.failed ? "" : undefined}>
					<Icon name={notice.failed ? "x" : "check"} size={14} />
					{notice.text}
				</p>
			)}
			{picked ? (
				<div className="ech-ag-recent-bar">
					<span>{count(labels.selected, picked.size)}</span>
					<button type="button" className="ech-ag-button is-sm" onClick={() => setPicking(false)}>
						{labels.cancel}
					</button>
					<button
						type="button"
						className="ech-ag-button is-sm is-danger"
						disabled={picked.size === 0 || deleting}
						onClick={() => void deletePicked()}
					>
						{deleting ? <Icon name="loader-circle" className="ech-ag-spin" size={14} /> : <Icon name="trash" size={14} />}
						{picked.size > 0 ? count(labels.deleteSelected, picked.size) : labels.deleteShort}
					</button>
				</div>
			) : (
				<p className="ech-ag-recent-note">{labels.kept}</p>
			)}
		</div>
	);
}

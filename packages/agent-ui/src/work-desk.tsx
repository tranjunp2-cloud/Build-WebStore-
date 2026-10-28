import { WORK_GROUP_ORDER, type WorkAction, type WorkGroup, type WorkItem, type WorkState } from "@ech/agent-core";
import { type ReactNode, useEffect, useState } from "react";
import { fill } from "./fill";
import { Icon, iconOr } from "./icons";

/**
 * Issues in the dock: what needs the merchant (orders, stock, website, drafts and
 * questions the assistant waits on). A new chat greets as before and offers the top
 * issues as reply pills; the header's Issues button lists them all (History stays the
 * plain list of chats). Each issue is handled in its own chat. Priority reads from the group and the
 * one fact that makes an issue urgent, never from a badge on every row.
 */

export interface WorkLabels {
	/** the header button and the list's title */
	issues: string;
	/** "{n} issues" (screen readers, the button's tooltip) */
	issuesCount: string;
	back: string;
	later: string;
	hide: string;
	/** "{i} / {n}" */
	position: string;
	inChat: string;
	/** group names; `now` and `week` are also the Issues button's label */
	groups: Record<WorkGroup, string>;
	/** the row's quick discard, by what it does: drafts rejected, question skipped, shop issue hidden */
	discardDrafts: string;
	skipQuestion: string;
	dismiss: string;
	/** the line after a discard: "{title}" */
	dismissed: string;
	discarded: string;
	skipped: string;
	undo: string;
	emptyTitle: string;
	emptyBody: string;
	errorTitle: string;
	errorBody: string;
	retry: string;
	partial: string;
}

export const DEFAULT_WORK_LABELS: WorkLabels = {
	issues: "Issues",
	issuesCount: "{n} issues",
	back: "Back",
	later: "Later",
	hide: "Hide",
	position: "{i} / {n}",
	inChat: "In chat",
	groups: { now: "Urgent", you: "Needs you", week: "Soon" },
	discardDrafts: "Discard the drafts",
	skipQuestion: "Skip the question",
	dismiss: "Dismiss",
	dismissed: "Dismissed: {title}",
	discarded: "Drafts discarded: {title}",
	skipped: "Question skipped: {title}",
	undo: "Undo",
	emptyTitle: "No issues right now",
	emptyBody: "I'll let you know when an order comes in or stock runs low.",
	errorTitle: "Couldn't load your issues",
	errorBody: "Your chats still work. Try again in a moment.",
	retry: "Try again",
	partial: "Part of your shop couldn't be checked just now.",
};

/** The item the dock leads with: the first one not put off with "Later". */
export function currentItem(items: readonly WorkItem[], states: readonly WorkState[], now = Date.now()): WorkItem | undefined {
	const snoozed = new Set(states.filter((s) => s.snoozedUntil && Date.parse(s.snoozedUntil) > now).map((s) => s.key));
	return items.find((item) => !snoozed.has(item.key)) ?? items[0];
}

/** "Order #1042 · RM 86.00 · waiting 40 min": the urgent fact coloured, the rest plain. */
function DetailLine({ item }: { item: WorkItem }) {
	if (!item.detail && !item.fact) return null;
	return (
		<span className="ech-ag-work-detail">
			{item.detail}
			{item.detail && item.fact && " · "}
			{item.fact && (
				<span className="ech-ag-work-fact" data-tone={item.fact.tone}>
					{item.fact.text}
				</span>
			)}
		</span>
	);
}

function AreaIcon({ item }: { item: WorkItem }) {
	return (
		<span className="ech-ag-work-ico" aria-hidden="true">
			<Icon name={iconOr(item.icon, "list-checks")} size={16} />
		</span>
	);
}

/** What the row's discard does, in words (its tooltip and accessible name). */
export const discardLabel = (item: WorkItem, labels: WorkLabels): string =>
	item.source !== "ai" ? labels.dismiss : item.kind === "question" ? labels.skipQuestion : labels.discardDrafts;

export function WorkItemRow({
	item,
	labels,
	onOpen,
	onDiscard,
	compact = false,
}: {
	item: WorkItem;
	labels: WorkLabels;
	onOpen: (item: WorkItem) => void;
	onDiscard?: (item: WorkItem) => void;
	compact?: boolean;
}) {
	const discard = discardLabel(item, labels);
	return (
		<li className="ech-ag-work-li">
			<button type="button" className="ech-ag-work-row" data-compact={compact ? "" : undefined} onClick={() => onOpen(item)}>
				{!compact && <AreaIcon item={item} />}
				<span className="ech-ag-work-text">
					<b>{item.title}</b>
					{!compact && <DetailLine item={item} />}
				</span>
				{item.threadId && item.source === "shop" && (
					<span className="ech-ag-work-inchat">
						<Icon name="message-square" size={13} />
						{labels.inChat}
					</span>
				)}
				<Icon name="chevron-right" size={16} />
			</button>
			{onDiscard && (
				<button
					type="button"
					className="ech-ag-ib ech-ag-work-discard"
					aria-label={`${discard}: ${item.title}`}
					title={discard}
					onClick={() => onDiscard(item)}
				>
					<Icon name={item.source === "ai" && item.kind !== "question" ? "trash" : "x"} size={14} />
				</button>
			)}
		</li>
	);
}

/** One label per group, never one badge per row. */
export function GroupedItems({
	items,
	labels,
	onOpen,
	onDiscard,
	compact,
}: {
	items: readonly WorkItem[];
	labels: WorkLabels;
	onOpen: (item: WorkItem) => void;
	onDiscard?: (item: WorkItem) => void;
	compact?: boolean;
}) {
	return (
		<>
			{WORK_GROUP_ORDER.map((group) => {
				const rows = items.filter((item) => item.group === group);
				if (rows.length === 0) return null;
				return (
					<section key={group} className="ech-ag-work-group" aria-label={labels.groups[group]}>
						<h3>
							{labels.groups[group]}
							<span>· {rows.length}</span>
						</h3>
						<ul>
							{rows.map((item) => (
								<WorkItemRow key={item.key} item={item} labels={labels} onOpen={onOpen} onDiscard={onDiscard} compact={compact} />
							))}
						</ul>
					</section>
				);
			})}
		</>
	);
}

/** The assistant raising one item: what happened, in plain words, and the buttons to act on it. */
function WorkMessage({
	item,
	labels,
	onTake,
	onLater,
	short = false,
}: {
	item: WorkItem;
	labels: WorkLabels;
	onTake: (item: WorkItem, action: WorkAction) => void;
	onLater?: (item: WorkItem) => void;
	short?: boolean;
}) {
	const [main, ...rest] = item.actions;
	return (
		<div className="ech-ag-work-msg">
			<p className="ech-ag-work-area">
				<Icon name={iconOr(item.icon, "list-checks")} size={13} />
				{item.area}
			</p>
			<p className="ech-ag-work-say">{short ? item.short : item.say}</p>
			<div className="ech-ag-work-actions">
				{main && (
					<button type="button" className="ech-ag-button is-sm is-primary" onClick={() => onTake(item, main)}>
						{main.label}
					</button>
				)}
				{onLater && (
					<button type="button" className="ech-ag-button is-sm" onClick={() => onLater(item)}>
						{labels.later}
					</button>
				)}
				{rest.map((action) => (
					<button key={action.label} type="button" className="ech-ag-button is-ghost is-sm" onClick={() => onTake(item, action)}>
						{action.label}
						{action.kind === "link" && <Icon name="arrow-up-right" size={13} />}
					</button>
				))}
			</div>
		</div>
	);
}

/** Top of a task's chat before anything was sent: the facts and the buttons, as the assistant's first message. */
export function TaskIntro({ item, labels: overrides, onTake }: { item: WorkItem; labels?: Partial<WorkLabels>; onTake: (item: WorkItem, action: WorkAction) => void }) {
	const labels = { ...DEFAULT_WORK_LABELS, ...overrides };
	return (
		<div className="ech-ag-desk">
			<div className="ech-ag-desk-feed">
				<WorkMessage item={item} labels={labels} onTake={onTake} />
			</div>
		</div>
	);
}

/** The bubble over the mascot while the dock is closed: one item, its main button, Later. */
export function WorkRaise({
	item,
	index,
	total,
	labels: overrides,
	onTake,
	onLater,
	onHide,
	onHoverChange,
}: {
	item: WorkItem;
	index: number;
	total: number;
	labels?: Partial<WorkLabels>;
	onTake: (item: WorkItem, action: WorkAction) => void;
	onLater: (item: WorkItem) => void;
	onHide: () => void;
	/** pointer over the bubble: the host pauses its hide timer */
	onHoverChange?: (hovered: boolean) => void;
}) {
	const labels = { ...DEFAULT_WORK_LABELS, ...overrides };
	const main = item.actions[0];
	return (
		<div className="ech-ag-raise" role="status" onMouseEnter={() => onHoverChange?.(true)} onMouseLeave={() => onHoverChange?.(false)}>
			<div className="ech-ag-raise-card">
				<p className="ech-ag-work-area">
					<Icon name={iconOr(item.icon, "list-checks")} size={13} />
					{item.area}
					<span>{fill(labels.position, { i: index + 1, n: total })}</span>
				</p>
				<p className="ech-ag-work-say">{item.say}</p>
				<div className="ech-ag-work-actions">
					{main && (
						<button type="button" className="ech-ag-button is-sm is-primary" onClick={() => onTake(item, main)}>
							{main.label}
						</button>
					)}
					<button type="button" className="ech-ag-button is-sm" onClick={() => onLater(item)}>
						{labels.later}
					</button>
				</div>
			</div>
			<button type="button" className="ech-ag-reply-hide" aria-label={labels.hide} title={labels.hide} onClick={onHide}>
				<Icon name="x" size={12} />
			</button>
		</div>
	);
}

/** The Issues list: every issue under its group label, the most urgent first. */
export function IssuesList({
	items,
	loading,
	error,
	partial,
	labels: overrides,
	onOpenItem,
	onRetry,
	onDiscard,
	onRestore,
}: {
	items: readonly WorkItem[];
	loading?: boolean;
	error?: boolean;
	partial?: boolean;
	labels?: Partial<WorkLabels>;
	onOpenItem: (item: WorkItem) => void;
	onRetry?: () => void;
	/** quick discard of one issue (see discardLabel) */
	onDiscard?: (item: WorkItem) => void;
	/** brings a dismissed shop issue back (Undo) */
	onRestore?: (item: WorkItem) => void;
}) {
	const labels = { ...DEFAULT_WORK_LABELS, ...overrides };
	// the last discarded issue: one line with what happened, and Undo for a shop issue (drafts and questions stay discarded)
	const [last, setLast] = useState<WorkItem | undefined>();
	useEffect(() => {
		if (!last) return;
		const timer = window.setTimeout(() => setLast(undefined), 6000);
		return () => window.clearTimeout(timer);
	}, [last]);
	const discard = onDiscard
		? (item: WorkItem) => {
				setLast(item);
				onDiscard(item);
			}
		: undefined;
	const lastLine = last
		? fill(last.source !== "ai" ? labels.dismissed : last.kind === "question" ? labels.skipped : labels.discarded, { title: last.title })
		: undefined;
	return (
		<div className="ech-ag-tasks" aria-busy={loading && items.length === 0 ? true : undefined}>
			{loading && items.length === 0 ? (
				<div className="ech-ag-work-skeleton">
					<div className="ech-ag-sk" style={{ width: "70%", height: 14 }} />
					<div className="ech-ag-sk" style={{ width: "55%", height: 12 }} />
					<div className="ech-ag-sk" style={{ width: "65%", height: 14 }} />
				</div>
			) : error && items.length === 0 ? (
				<div className="ech-ag-work-error" role="alert">
					<b>{labels.errorTitle}</b>
					<span>{labels.errorBody}</span>
					{onRetry && (
						<button type="button" className="ech-ag-button is-sm" onClick={onRetry}>
							<Icon name="rotate-cw" size={14} />
							{labels.retry}
						</button>
					)}
				</div>
			) : items.length === 0 ? (
				<div className="ech-ag-work-empty">
					<span className="ech-ag-work-empty-ico" aria-hidden="true">
						<Icon name="check" size={18} />
					</span>
					<b>{labels.emptyTitle}</b>
					<span>{labels.emptyBody}</span>
				</div>
			) : (
				<GroupedItems items={items} labels={labels} onOpen={onOpenItem} onDiscard={discard} />
			)}
			{last && (
				<div className="ech-ag-work-undo" role="status">
					<span>{lastLine}</span>
					{last.source !== "ai" && onRestore && (
						<button
							type="button"
							className="ech-ag-button is-ghost is-sm"
							onClick={() => {
								onRestore(last);
								setLast(undefined);
							}}
						>
							{labels.undo}
						</button>
					)}
				</div>
			)}
			{partial && items.length > 0 && <p className="ech-ag-tasks-kept">{labels.partial}</p>}
		</div>
	);
}

/**
 * The header's Issues button: the label of the most pressing group ("Urgent", "Needs you",
 * "Soon"); an issue without a known group would show the icon with the count as a badge.
 */
export function IssuesButton({
	items,
	labels: overrides,
	active,
	onClick,
}: {
	items: readonly WorkItem[];
	labels?: Partial<WorkLabels>;
	active?: boolean;
	onClick: () => void;
}) {
	const labels = { ...DEFAULT_WORK_LABELS, ...overrides };
	// the most pressing group names the button: Urgent, then Needs you, then Soon
	const tone = WORK_GROUP_ORDER.find((group) => items.some((item) => item.group === group));
	const name = `${labels.issues} · ${fill(labels.issuesCount, { n: items.length })}`;
	return (
		<button
			type="button"
			className="ech-ag-issues-btn"
			data-tone={tone}
			data-labelled={tone ? "" : undefined}
			aria-label={name}
			aria-pressed={active}
			title={name}
			onClick={onClick}
		>
			<Icon name="circle-alert" size={16} />
			{tone ? <span>{labels.groups[tone]}</span> : items.length > 0 && <span className="ech-ag-issues-badge">{items.length}</span>}
		</button>
	);
}

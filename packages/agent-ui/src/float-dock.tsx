import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AgentRecentChats, type AgentChatHistoryProps } from "./chat-history";
import { Icon, type IconName } from "./icons";
import { AgentMascot, type MascotMood } from "./mascot";
import { DEFAULT_REPLY_BUBBLE_LABELS, ReplyBubble, type ReplyBubbleLabels, type ReplyBubbleState } from "./reply-bubble";
import { StartOver, type StartOverProps } from "./start-over";

export interface AgentPeek {
	/** small caption above the title — e.g. "Agent noticed" */
	label?: string;
	title: string;
	ctaLabel?: string;
	onAction?: () => void;
	/** max visible lines for the title (default 2 — guides pass more) */
	lines?: number;
}

export interface DockMenuItem {
	label: string;
	icon?: IconName;
	onSelect?: () => void;
	href?: string;
	danger?: boolean;
	/** draw a divider above this item */
	separated?: boolean;
}

export interface DockApproval {
	id: string;
	title: string;
	meta?: string;
}

export interface AgentFloatDockLabels {
	agent: string;
	approvals: string;
	noApprovals: string;
	newChat: string;
	expand: string;
	collapse: string;
	more: string;
	close: string;
	open: string;
	recent: string;
	/** header pill: "{n} to review" */
	toReview: string;
	/** the History icon (recent chats) */
	history: string;
}

export const DEFAULT_DOCK_LABELS: AgentFloatDockLabels = {
	agent: "ECH Agent",
	approvals: "Drafts waiting for approval",
	noApprovals: "No drafts are waiting.",
	newChat: "New chat",
	expand: "Expand panel",
	collapse: "Collapse panel",
	more: "More",
	close: "Close",
	open: "Open ECH Agent",
	recent: "Recent chats",
	toReview: "{n} to review",
	history: "History",
};

export interface AgentFloatDockProps {
	/** open chat's title (the history button) */
	title?: string;
	/** line under the title, e.g. "ECH Agent · Products page" */
	subtitle?: string;
	/** badge count on the launcher — pending decisions */
	badge?: number;
	/** proactive bubble peeking above the mascot while the panel is closed */
	peek?: AgentPeek;
	/** delay before the peek bubble first appears (default 4000ms) */
	peekDelayMs?: number;
	/** how long the bubble stays visible before auto-hiding (default 9000ms) */
	peekTtlMs?: number;
	/** persistent chats — the title opens the recent-chats popover */
	history?: AgentChatHistoryProps;
	/** drafts waiting for approval — header icon with count + list */
	approvals?: DockApproval[];
	onOpenApproval?: (id: string) => void;
	onNewChat?: () => void;
	/** two-column review is open */
	wide?: boolean;
	onWideChange?: (wide: boolean) => void;
	/** the "…" menu (customer inbox, settings, delete chat) */
	menu?: DockMenuItem[];
	/**
	 * One chat only (the web editor): the header keeps the drafts to review and
	 * "Start over" — no chat title / recent chats, new chat or "…" menu.
	 */
	startOver?: StartOverProps;
	/** chat column (stream + composer) */
	children?: ReactNode;
	/** right column while wide */
	sheet?: ReactNode;
	/** controlled open state — omit to use internal state */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/**
	 * Dynamic placement — pixel offset translated from the default corner,
	 * e.g. a guided tour parking the mascot next to the element being
	 * explained. Transitions glide; omit/undefined returns to the corner.
	 */
	offset?: { x: number; y: number };
	/** a reply is being written — the launcher mascot thinks, then hops when it lands */
	busy?: boolean;
	/** the chat's latest reply — told over the mascot while the panel is closed (see ReplyBubble) */
	reply?: ReplyBubbleState;
	replyLabels?: Partial<ReplyBubbleLabels>;
	/** launcher mascot mood override (defaults to busy-aware thinking, then badge-aware idle/alert) */
	mood?: MascotMood;
	/** the work queue's bubble over the mascot while closed (a reply still going wins; it replaces the peek) */
	raise?: ReactNode;
	/** a small count after the title ("To do · 9") */
	titleCount?: number;
	/** the title opens this instead of the recent chats (the work queue's "All tasks") */
	onTitleClick?: () => void;
	/** a back arrow before the title (a task's chat → the dock's home) */
	onBack?: () => void;
	/** label of the back arrow */
	backLabel?: string;
	/** the title is a plain name (no recent-chats dropdown) */
	staticTitle?: boolean;
	/** icon buttons of the host, right of the title (Issues) */
	actions?: ReactNode;
	/** the recent chats open from a History icon on the right (with `staticTitle`) */
	historyButton?: boolean;
	/** no "…" menu (its items live elsewhere: delete in History, expand as its own icon) */
	hideMenu?: boolean;
	/** an Expand / Collapse icon of its own, shown only while there is something to review wide */
	expandable?: boolean;
	labels?: Partial<AgentFloatDockLabels>;
	/**
	 * "float" (default): the corner launcher + panel. "inline": the panel only,
	 * always open and filling its container (a host's side rail) — no launcher,
	 * peek or close; while wide the review takes the whole column.
	 */
	placement?: "float" | "inline";
}

type Popover = "none" | "recent" | "approvals" | "menu";

/** how long a finished reply's bubble stays before it hides itself */
export const REPLY_DONE_MS = 8000;

/**
 * Ambient agent surface — a floating launcher pinned to the viewport corner
 * that expands into a panel. Mount once at the app shell; the agent is
 * available on every screen without leaving the page. The orb is the mascot
 * slot: swap AgentOrb for an animated character later without touching layout.
 */
export function AgentFloatDock({
	title,
	subtitle,
	badge,
	peek,
	peekDelayMs = 4000,
	peekTtlMs = 9000,
	history,
	approvals,
	onOpenApproval,
	onNewChat,
	wide = false,
	onWideChange,
	menu,
	startOver,
	children,
	sheet,
	open,
	onOpenChange,
	offset,
	mood,
	raise,
	titleCount,
	onTitleClick,
	onBack,
	backLabel = "Back",
	staticTitle = false,
	actions,
	historyButton = false,
	hideMenu = false,
	expandable = false,
	busy = false,
	reply,
	replyLabels,
	labels: labelOverrides,
	placement = "float",
}: AgentFloatDockProps) {
	const inline = placement === "inline";
	const labels = { ...DEFAULT_DOCK_LABELS, ...labelOverrides };
	const [popover, setPopover] = useState<Popover>("none");
	const [peekVisible, setPeekVisible] = useState(false);
	const [peekDismissed, setPeekDismissed] = useState(false);
	const [internalOpen, setInternalOpen] = useState(false);
	const isOpen = inline || (open ?? internalOpen);
	const setOpen = useCallback(
		(v: boolean) => {
			setInternalOpen(v);
			onOpenChange?.(v);
		},
		[onOpenChange],
	);

	// the launcher mascot hops once each time a reply lands
	const [hop, setHop] = useState(0);
	const wasBusy = useRef(busy);
	useEffect(() => {
		if (wasBusy.current && !busy) setHop((n) => n + 1);
		wasBusy.current = busy;
	}, [busy]);

	const panelRef = useRef<HTMLElement>(null);
	const titleRef = useRef<HTMLButtonElement>(null);
	const closePopover = useCallback((refocus?: HTMLElement | null) => {
		setPopover("none");
		refocus?.focus();
	}, []);

	// Peek lifecycle: appears once after a delay, auto-hides, and reshows on
	// mascot hover — unless the user explicitly dismissed this peek. A new peek
	// (different title) resets the cycle.
	const peekKey = peek?.title;
	const peekTimers = useRef<number[]>([]);
	const lastPeekKey = useRef<string | undefined>(undefined);
	const clearPeekTimers = useCallback(() => {
		for (const t of peekTimers.current) window.clearTimeout(t);
		peekTimers.current = [];
	}, []);
	const schedulePeekHide = useCallback(() => {
		clearPeekTimers();
		peekTimers.current.push(window.setTimeout(() => setPeekVisible(false), peekTtlMs));
	}, [peekTtlMs, clearPeekTimers]);
	const dismissPeek = useCallback(() => {
		clearPeekTimers();
		setPeekVisible(false);
		setPeekDismissed(true);
	}, [clearPeekTimers]);

	useEffect(() => {
		if (peekKey === lastPeekKey.current) return;
		lastPeekKey.current = peekKey;
		setPeekVisible(false);
		setPeekDismissed(false);
		if (!peekKey) return clearPeekTimers;
		peekTimers.current.push(
			window.setTimeout(() => {
				setPeekVisible(true);
				schedulePeekHide();
			}, peekDelayMs),
		);
		return clearPeekTimers;
	}, [peekKey, peekDelayMs, schedulePeekHide, clearPeekTimers]);

	// The panel owns attention while open — never peek behind it.
	useEffect(() => {
		if (isOpen) {
			clearPeekTimers();
			setPeekVisible(false);
		}
	}, [isOpen, clearPeekTimers]);

	// The reply bubble: a reply still going (working, writing, asking) always shows while closed;
	// one that finished shows only if it was still going when the panel closed — not old news.
	// Hiding it keeps it hidden until the reply moves to its next phase.
	const [liveWhenClosed, setLiveWhenClosed] = useState<string | undefined>();
	const [hiddenReply, setHiddenReply] = useState<string | undefined>();
	const replyGoing = reply !== undefined && (reply.phase === "working" || reply.phase === "writing" || reply.phase === "asking");
	useEffect(() => {
		if (isOpen) setLiveWhenClosed(undefined);
		else if (replyGoing) setLiveWhenClosed(reply.runId);
	}, [isOpen, replyGoing, reply?.runId]);
	const replyKey = reply ? `${reply.runId}:${reply.phase}` : undefined;
	const [replyHover, setReplyHover] = useState(false);
	const shownReply =
		!isOpen && !inline && reply !== undefined && replyKey !== hiddenReply && (replyGoing || liveWhenClosed === reply.runId)
			? reply
			: undefined;

	// A finished reply says its piece and goes: hidden after REPLY_DONE_MS, the clock paused while hovered.
	// Questions and failures stay until the merchant acts on them.
	const doneKey = shownReply?.phase === "done" ? replyKey : undefined;
	// a bubble that went away cannot report the pointer leaving it
	const replyShown = shownReply !== undefined;
	useEffect(() => {
		if (!replyShown) setReplyHover(false);
	}, [replyShown]);
	useEffect(() => {
		if (!doneKey || replyHover) return;
		const timer = window.setTimeout(() => setHiddenReply(doneKey), REPLY_DONE_MS);
		return () => window.clearTimeout(timer);
	}, [doneKey, replyHover]);

	const revealPeek = useCallback(() => {
		if (isOpen || !peekKey || peekDismissed) return;
		setPeekVisible(true);
		schedulePeekHide();
	}, [isOpen, peekKey, peekDismissed, schedulePeekHide]);

	// Esc closes; click-outside closes (an inline panel stays)
	useEffect(() => {
		if (!isOpen || inline) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return;
			setOpen(false);
		};
		// Clicks on the page close the panel — but not clicks inside portals the
		// panel's own content opened, nor on the launcher.
		const onDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement;
			if (!panelRef.current || panelRef.current.contains(target)) return;
			if (target.closest?.(".ech-ag-fab")) return;
			setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onDown, true);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onDown, true);
		};
	}, [isOpen, inline, setOpen]);

	// popovers inside the panel close on an outside click
	useEffect(() => {
		if (popover === "none") return;
		const onDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest?.("[data-ech-pop]") || target.closest?.("[data-ech-pop-toggle]")) return;
			setPopover("none");
		};
		document.addEventListener("pointerdown", onDown, true);
		return () => document.removeEventListener("pointerdown", onDown, true);
	}, [popover]);

	// expand / collapse lives in "…" — the header keeps title, drafts to review, new chat, close
	const menuItems: DockMenuItem[] = [
		...(onWideChange
			? [{ label: wide ? labels.collapse : labels.expand, icon: (wide ? "minimize-2" : "maximize-2") as IconName, onSelect: () => onWideChange(!wide) }]
			: []),
		...(menu ?? []).map((item, i) => (i === 0 && onWideChange ? { ...item, separated: true } : item)),
	];

	const rootStyle: CSSProperties | undefined = offset
		? { transform: `translate(${Math.round(offset.x)}px, ${Math.round(offset.y)}px)` }
		: undefined;

	const panel = (
		<section
			ref={panelRef}
			className={`ech-ag ech-ag-panel${inline ? " ech-ag-inline" : ""}`}
			data-wide={wide && sheet ? "" : undefined}
			aria-label={labels.agent}
			onKeyDown={(e) => {
				if (e.key === "Escape" && popover !== "none") {
					e.preventDefault();
					e.stopPropagation();
					closePopover(popover === "recent" ? titleRef.current : null);
				}
			}}
		>
			{/* one-chat surfaces: a new chat has no header; in a conversation the header shows its title (read-only) and Start over */}
			{!(inline && startOver?.disabled) && (
			<div className="ech-ag-head">
				{startOver && (
					<span className="ech-ag-thread-title ech-ag-thread-title-static" title={subtitle ?? title}>
						<b>{title ?? labels.newChat}</b>
					</span>
				)}
				{!startOver && onBack && (
					<button type="button" className="ech-ag-ib ech-ag-head-back" aria-label={backLabel} title={backLabel} onClick={onBack}>
						<Icon name="arrow-left" />
					</button>
				)}
				{!startOver && staticTitle && (
					<span className="ech-ag-thread-title ech-ag-thread-title-static" title={subtitle ?? title}>
						<b>{title ?? labels.newChat}</b>
					</span>
				)}
				{!startOver && !staticTitle && (
					<button
						ref={titleRef}
						type="button"
						className="ech-ag-thread-title"
						data-ech-pop-toggle=""
						aria-haspopup="dialog"
						aria-expanded={onTitleClick ? undefined : popover === "recent"}
						title={onTitleClick ? undefined : labels.recent}
						disabled={!history && !onTitleClick}
						onClick={() => {
							if (onTitleClick) return onTitleClick();
							if (popover === "recent") return setPopover("none");
							setPopover("recent");
							history?.onShow?.();
						}}
					>
						<span title={subtitle}>
							<b>{title ?? labels.newChat}</b>
						</span>
						{titleCount !== undefined && titleCount > 0 && <span className="ech-ag-title-count">{titleCount}</span>}
						{(history || onTitleClick) && <Icon name="chevron-down" />}
					</button>
				)}
				{approvals && approvals.length > 0 && (
					<button
						type="button"
						className="ech-ag-review-pill"
						data-ech-pop-toggle=""
						title={labels.approvals}
						aria-haspopup="menu"
						aria-expanded={popover === "approvals"}
						onClick={() => setPopover(popover === "approvals" ? "none" : "approvals")}
					>
						<Icon name="list-checks" />
						{labels.toReview.replace("{n}", String(approvals.length))}
					</button>
				)}
				{actions}
				{!startOver && historyButton && history && (
					<button
						ref={titleRef}
						type="button"
						className="ech-ag-ib"
						data-ech-pop-toggle=""
						aria-haspopup="dialog"
						aria-expanded={popover === "recent"}
						aria-label={labels.history}
						title={labels.history}
						onClick={() => {
							if (popover === "recent") return setPopover("none");
							setPopover("recent");
							history.onShow?.();
						}}
					>
						<Icon name="history" />
					</button>
				)}
				{!startOver && expandable && onWideChange && (
					<button
						type="button"
						className="ech-ag-ib"
						aria-label={wide ? labels.collapse : labels.expand}
						title={wide ? labels.collapse : labels.expand}
						onClick={() => onWideChange(!wide)}
					>
						<Icon name={wide ? "minimize-2" : "maximize-2"} />
					</button>
				)}
				{startOver && <StartOver {...startOver} />}
				{startOver && wide && sheet && onWideChange && (
					<button type="button" className="ech-ag-ib" aria-label={labels.collapse} title={labels.collapse} onClick={() => onWideChange(false)}>
						<Icon name="minimize-2" />
					</button>
				)}
				{!startOver && onNewChat && (
					<button
						type="button"
						className="ech-ag-ib"
						aria-label={labels.newChat}
						title={labels.newChat}
						onClick={() => {
							setPopover("none");
							onWideChange?.(false);
							onNewChat();
						}}
					>
						<Icon name="square-pen" />
					</button>
				)}
				{!startOver && !hideMenu && menuItems.length > 0 && (
					<button
						type="button"
						className="ech-ag-ib"
						data-ech-pop-toggle=""
						aria-label={labels.more}
						title={labels.more}
						aria-haspopup="menu"
						aria-expanded={popover === "menu"}
						onClick={() => setPopover(popover === "menu" ? "none" : "menu")}
					>
						<Icon name="ellipsis" />
					</button>
				)}
				{!inline && (
					<button type="button" className="ech-ag-ib" aria-label={labels.close} title={labels.close} onClick={() => setOpen(false)}>
						<Icon name="x" />
					</button>
				)}
			</div>
			)}
			{popover === "recent" && history && (
				<div data-ech-pop="">
					<AgentRecentChats
						threads={history.threads}
						activeThreadId={history.activeThreadId}
						loading={history.loading}
						error={history.error}
						onOpen={(id) => {
							onWideChange?.(false);
							history.onOpen(id);
						}}
						onDelete={history.onDelete}
						labels={history.labels}
						locale={history.locale}
						onClose={(refocus) => closePopover(refocus ? titleRef.current : null)}
					/>
				</div>
			)}
			{popover === "approvals" && approvals && (
				<div className="ech-ag-menu ech-ag-approvals" role="menu" data-ech-pop="">
					{approvals.length === 0 ? (
						<p className="ech-ag-picker-note">{labels.noApprovals}</p>
					) : (
						approvals.map((item) => (
							<button
								key={item.id}
								type="button"
								role="menuitem"
								onClick={() => {
									setPopover("none");
									onOpenApproval?.(item.id);
								}}
							>
								<b>{item.title}</b>
								<Icon name="chevron-right" />
								{item.meta && <small>{item.meta}</small>}
							</button>
						))
					)}
				</div>
			)}
			{popover === "menu" && menuItems.length > 0 && (
				<div className="ech-ag-menu" role="menu" data-ech-pop="" style={{ top: 52, right: 8 }}>
					{menuItems.map((item) => {
						const body = (
							<>
								{item.icon && <Icon name={item.icon} />}
								{item.label}
							</>
						);
						return (
							<div key={item.label} style={{ display: "contents" }}>
								{item.separated && <hr />}
								{item.href ? (
									<a role="menuitem" href={item.href} className={item.danger ? "is-danger" : undefined} onClick={() => setPopover("none")}>
										{body}
									</a>
								) : (
									<button
										type="button"
										role="menuitem"
										className={item.danger ? "is-danger" : undefined}
										onClick={() => {
											setPopover("none");
											item.onSelect?.();
										}}
									>
										{body}
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
			<div className="ech-ag-cols">
				<div className="ech-ag-chat-col">{children}</div>
				{wide && sheet}
			</div>
		</section>
	);
	if (inline) return panel;

	return (
		<div className="ech-ag-float-root" style={rootStyle}>
			{isOpen && panel}
			{shownReply && (
				<ReplyBubble
					state={shownReply}
					labels={{ ...DEFAULT_REPLY_BUBBLE_LABELS, ...replyLabels }}
					onOpen={() => setOpen(true)}
					onDismiss={() => setHiddenReply(replyKey)}
					onHoverChange={setReplyHover}
				/>
			)}
			{!shownReply && !isOpen && raise}
			{!shownReply && !isOpen && !raise && peek && peekVisible && !peekDismissed && (
				<div className="ech-ag-peek" role="status" onMouseEnter={clearPeekTimers} onMouseLeave={schedulePeekHide}>
					<button
						type="button"
						className="ech-ag-peek-card"
						onClick={() => {
							peek.onAction?.();
							dismissPeek();
						}}
					>
						<span className="ech-ag-peek-label">{peek.label ?? "Agent noticed"}</span>
						<span
							className="ech-ag-peek-title"
							style={peek.lines !== undefined ? { WebkitLineClamp: String(peek.lines) } : undefined}
						>
							{peek.title}
						</span>
						{peek.ctaLabel && <span className="ech-ag-peek-cta">{peek.ctaLabel}</span>}
					</button>
					<button type="button" className="ech-ag-peek-dismiss" onClick={dismissPeek} aria-label="Dismiss suggestion">
						<svg
							width="10"
							height="10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.4"
							aria-hidden="true"
						>
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			)}
			<button
				type="button"
				className={`ech-ag-fab${isOpen ? " open" : ""}${shownReply?.phase === "asking" ? " is-asking" : ""}`}
				onClick={() => setOpen(!isOpen)}
				onMouseEnter={revealPeek}
				aria-expanded={isOpen}
				aria-label={isOpen ? labels.close : labels.open}
			>
				<span key={hop} className="ech-ag-hop" data-hop={hop > 0 ? "" : undefined}>
					<AgentMascot size={isOpen ? 40 : 44} mood={mood ?? (busy ? "thinking" : badge !== undefined && badge > 0 ? "alert" : "idle")} />
				</span>
				{/* keyed by the count: a new draft bumps the badge */}
				{!isOpen && badge !== undefined && badge > 0 && (
					<span key={badge} className="ech-ag-fab-badge">
						{badge}
					</span>
				)}
			</button>
		</div>
	);
}

import type { AgentThread, ChangeSet, ContextElement, FieldDiff } from "@ech/agent-core";
import { type MutableRefObject, type ReactNode, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { approveCampaign, campaignCards, campaignQueue, DEFAULT_CAMPAIGN_LABELS, stoppedLine } from "./campaign-group";
import { type AgentChatHistoryLabels, DEFAULT_CHAT_HISTORY_LABELS } from "./chat-history";
import { AgentChatThread, type AgentChatView, type ChatLabels, type ChatSuggestion, DEFAULT_CHAT_LABELS } from "./chat";
import type { ComposerHandle, ComposerLabels } from "./composer";
import { askedByLine, canDecideDraft, isTeammateDraft } from "./draft-access";
import { type AutoApproveNotice, type CardUndoState, DEFAULT_DRAFT_LABELS, type DraftLabelOverrides } from "./draft-card";
import { AgentFloatDock, type AgentFloatDockLabels, type AgentPeek, type DockMenuItem } from "./float-dock";
import { Icon, type IconName } from "./icons";
import type { MascotMood } from "./mascot";
import type { QuestionLabels } from "./question-card";
import { DEFAULT_REPLY_BUBBLE_LABELS, type ReplyBubbleLabels, replyBubbleState } from "./reply-bubble";
import { type ReviewLabels, ReviewSheet } from "./review-sheet";
import type { StartOverLabels } from "./start-over";
import type { WorkLabels } from "./work-desk";
import { type AgentPanelWork, useWorkPanel } from "./work-panel";

/** Chat history as `useAgentChatRuntime().history` exposes it. */
export interface AgentPanelHistory {
	threadId: string | undefined;
	threads: AgentThread[];
	restoring: boolean;
	error: string | undefined;
	newThread: () => void;
	openThread: (id: string) => Promise<void>;
	/** the chat a run belongs to — opening a task under review (optional for older hosts) */
	openRunThread?: (runId: string) => Promise<void>;
	deleteThread: (id: string) => Promise<void>;
	refresh: () => Promise<void>;
	/** the newest chat started on the record open on the page — offered when another chat is open */
	linked?: AgentThread;
	openLinked?: () => Promise<void>;
	/** open the chat of a to-do item (or start it: the next message carries the task) */
	openTask?: (task: { key: string; title: string; threadId?: string }) => Promise<void>;
	/** the to-do item the open chat handles */
	task?: { key: string; title: string };
}

export interface AgentPanelLabels {
	dock: Partial<AgentFloatDockLabels>;
	history: Partial<AgentChatHistoryLabels>;
	chat: Partial<ChatLabels>;
	composer: Partial<ComposerLabels>;
	question: Partial<QuestionLabels>;
	draft: DraftLabelOverrides;
	review: Partial<ReviewLabels>;
	/** the bubble over the mascot while the panel is closed */
	reply: Partial<ReplyBubbleLabels>;
	/** "{agent} · {page}" */
	subtitle: string;
	deleteChat: string;
	/** the offer of the chat started on the record open on the page: "{title}" */
	linkedChat: string;
	linkedOpen: string;
	/** approvals list meta: "Product draft", "Blog draft" */
	productDraft: string;
	blogDraft: string;
	genericDraft: string;
	/** one-chat surfaces (singleChat): the header's "Start over" and its confirm */
	startOver: Partial<StartOverLabels>;
	/** the work queue (desk, raise bubble, All tasks) */
	work: Partial<WorkLabels>;
}

/** How a card was decided: `confirm` echoes the typed confirmation, `auto` is Auto-approve, `manual` the merchant's click. */
export interface PanelDecideOptions {
	confirm?: string;
	auto?: boolean;
	manual?: boolean;
}

export interface AgentAssistantPanelProps {
	chat: AgentChatView & { history?: AgentPanelHistory };
	/** page the merchant is on, e.g. "Products page" — the context chip and header line */
	pageLabel?: string;
	pageIcon?: IconName;
	/** the merchant removed the page chip (the host stops pinning page context) */
	onRemoveContext?: () => void;
	/** drafts waiting for approval across chats (the panel lists the open chat's; all on a new chat) */
	pending: ChangeSet[];
	/**
	 * `auto`: Auto-approve applies it; `manual`: the merchant's own click (sent on every decision that is not `auto`, the
	 * server refuses a `requiresClick` card without it) — the host passes both on to the gateway
	 */
	onDecide: (changeSet: ChangeSet, decision: "approve" | "reject", options?: PanelDecideOptions) => Promise<ChangeSet>;
	/** applied change with undo data → put the record back */
	onUndo?: (changeSet: ChangeSet) => Promise<ChangeSet>;
	/** the host's word on an applied change's Undo (site editor: blocked with a reason, relabelled, annotated) */
	undoState?: (changeSet: ChangeSet) => CardUndoState | undefined;
	/** inventory proposal → open the inventory screen's sheet prefilled (no approval) */
	onEditInventory?: (changeSet: ChangeSet) => void;
	/** where an applied draft lives in the editor (defaults to the result's first link) */
	onNavigate?: (href: string) => void;
	/** site editor: a site change's section / menu / page → that place on the canvas (replaces "Open in editor") */
	onLocate?: (changeSet: ChangeSet, diff: FieldDiff) => void;
	suggestions?: ChatSuggestion[];
	/** extra "…" items (customer inbox, settings) — "Delete this chat" is added */
	menu?: DockMenuItem[];
	labels?: Partial<AgentPanelLabels>;
	locale?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	peek?: AgentPeek;
	peekDelayMs?: number;
	peekTtlMs?: number;
	offset?: { x: number; y: number };
	mood?: MascotMood;
	badge?: number;
	/** "inline": the panel lives in the host's side rail instead of the corner (see AgentFloatDock) */
	placement?: "float" | "inline";
	/** pointer over an element chip — the host lights the element up on its page */
	onElementHover?: (element: ContextElement | null) => void;
	/** the host focuses / fills the message box (an element sent to the chat with nothing typed) */
	composerHandle?: MutableRefObject<ComposerHandle | null>;
	/**
	 * One chat only (the web editor): no recent chats, new chat, "…" menu or
	 * earlier-chat offer — the header has "Start over", which deletes this chat.
	 */
	singleChat?: boolean;
	/** a line under the new chat's greeting, e.g. "Click anything on the page to ask about it." */
	helloHint?: string;
	/**
	 * The merchant's work queue: the dock's home becomes the next item as a message, the mascot's
	 * badge counts every open item and raises one at a time while closed, chats are tasks.
	 */
	work?: AgentPanelWork;
	/** a line the host shows right above the composer (e.g. the AI allowance running low or used up) */
	notice?: ReactNode;
	/** the host closed the chat for now: no starters or next-step chips, the composer shows this placeholder and can't send */
	locked?: { placeholder: string };
}

const AUTO_APPROVE_KEY = "ech-agent:auto-approve";

function readAutoApprove(): boolean {
	try {
		return typeof window !== "undefined" && window.localStorage.getItem(AUTO_APPROVE_KEY) === "1";
	} catch {
		return false;
	}
}

/** Applied changes of this chat that can still be undone: their Undo is on the chat's cards. */
export function undoable(turns: AgentAssistantPanelProps["chat"]["turns"], now: number = Date.now()): number {
	let count = 0;
	for (const turn of turns) {
		if (turn.role !== "assistant") continue;
		for (const changeSet of turn.changeSets) {
			const undo = changeSet.status === "applied" ? changeSet.result?.undo : undefined;
			if (undo && Date.parse(undo.until) > now) count += 1;
		}
	}
	return count;
}

/** A card Auto-approve must leave to the merchant: a typed confirmation, or flagged `requiresClick` (money, buyer emails, live codes). */
export const needsHandApproval = (changeSet: ChangeSet): boolean => Boolean(changeSet.confirmText) || changeSet.requiresClick === true;

/**
 * A card Auto-approve may apply: the caller's own, theirs to decide (never a viewer's draft that waits for an owner
 * or admin, never a teammate's), and not one that needs a hand approval.
 */
export const autoApprovable = (changeSet: ChangeSet): boolean =>
	!needsHandApproval(changeSet) && canDecideDraft(changeSet) && !isTeammateDraft(changeSet);

/**
 * Drafts to approve now: staged since the switch went on (not in `seen`),
 * still pending, and neither a destructive change that needs the name typed
 * nor one flagged `requiresClick`, nor one the caller may not decide or did not
 * ask for (see `autoApprovable`). Marks everything it looked at as seen.
 */
export function draftsToAutoApprove(changeSets: readonly ChangeSet[], seen: Set<string>, on: boolean): ChangeSet[] {
	const out: ChangeSet[] = [];
	for (const changeSet of changeSets) {
		if (seen.has(changeSet.id)) continue;
		seen.add(changeSet.id);
		if (on && changeSet.status === "pending" && autoApprovable(changeSet)) out.push(changeSet);
	}
	return out;
}

/**
 * Thrown by the host's approve call when it cannot apply a change RIGHT NOW without hurting the merchant's work
 * (the site editor while they are typing). Auto-approve keeps the card pending, shows the message and tries again
 * a little later; any other error is shown on the card and not retried.
 */
export class AutoApproveWait extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AutoApproveWait";
	}
}

const AUTO_RETRY_MS = 4000;

/** What Auto-approve does with a failed approve: try again later (the host asked it to wait) or show the failure. */
export function autoApproveOutcome(error: unknown): AutoApproveNotice & { retry: boolean } {
	const text = error instanceof Error && error.message ? error.message : "Auto-approve could not apply this change.";
	return { text, error: !(error instanceof AutoApproveWait), retry: error instanceof AutoApproveWait };
}

/**
 * Auto-approve: while on, drafts staged in this chat from now on are approved
 * as they land (same approve call as the button, so Undo still works). Drafts
 * that were already waiting, and destructive ones that need the record's name
 * typed (`confirmText`) or flagged `requiresClick`, still wait for the merchant.
 */
function useAutoApprove(
	turns: AgentAssistantPanelProps["chat"]["turns"],
	threadId: string | undefined,
	approve: (changeSet: ChangeSet, options: { auto: true }) => Promise<unknown>,
) {
	const [on, setOn] = useState(readAutoApprove);
	const known = useRef<Set<string> | null>(null);
	const [notices, setNotices] = useState<Record<string, AutoApproveNotice>>({});
	const [, retryTick] = useState(0);
	const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
	useEffect(() => {
		const running = timers.current;
		return () => {
			for (const timer of running) clearTimeout(timer);
			running.clear();
		};
	}, []);
	const setNotice = useCallback((id: string, notice: AutoApproveNotice | null) => {
		setNotices((current) => {
			if (!notice && !(id in current)) return current;
			const { [id]: _gone, ...rest } = current;
			return notice ? { ...rest, [id]: notice } : rest;
		});
	}, []);
	const ids = turns.flatMap((turn) => (turn.role === "assistant" ? turn.changeSets : []));
	// what is on screen when switched on, or when a chat opens, is not "new"
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only on switch / chat change
	useEffect(() => {
		known.current = new Set(ids.map((c) => c.id));
		setNotices({});
	}, [on, threadId]);
	useEffect(() => {
		if (!known.current) return;
		for (const changeSet of draftsToAutoApprove(ids, known.current, on)) {
			approve(changeSet, { auto: true }).then(
				() => setNotice(changeSet.id, null),
				(error: unknown) => {
					const outcome = autoApproveOutcome(error);
					setNotice(changeSet.id, { text: outcome.text, error: outcome.error });
					// the card stays pending and is looked at again: a failed hold must not strand it
					if (!outcome.retry) return;
					const timer = setTimeout(() => {
						timers.current.delete(timer);
						known.current?.delete(changeSet.id);
						retryTick((n) => n + 1);
					}, AUTO_RETRY_MS);
					timers.current.add(timer);
				},
			);
		}
	});
	const change = useCallback((next: boolean) => {
		setOn(next);
		try {
			window.localStorage.setItem(AUTO_APPROVE_KEY, next ? "1" : "0");
		} catch {
			// private mode: the switch still works for this page
		}
	}, []);
	const notice = useCallback((id: string) => notices[id], [notices]);
	return { on, onChange: change, notice };
}

/** The call already running under `key`, or a new one (forgotten once it settles). */
export function joinInFlight<T>(running: Map<string, Promise<T>>, key: string, start: () => Promise<T>): Promise<T> {
	const current = running.get(key);
	if (current) return current;
	const call = start().finally(() => running.delete(key));
	running.set(key, call);
	return call;
}

/**
 * A pending edit of an existing record opens it as it is: opening never
 * approves the edit (a product → the product; a site change → the site editor).
 */
export function pendingEditHref(changeSet: ChangeSet): string | undefined {
	if (changeSet.status !== "pending") return undefined;
	if (changeSet.action?.kind.startsWith("site.")) {
		const plan = (changeSet.action.payload ?? {}) as { siteId?: unknown; pageId?: unknown };
		if (typeof plan.siteId !== "string" || !plan.siteId) return undefined;
		const page = typeof plan.pageId === "string" && plan.pageId ? `?pageId=${encodeURIComponent(plan.pageId)}` : "";
		return `/editor/${encodeURIComponent(plan.siteId)}${page}`;
	}
	// the shop's own products (shop_product.*) have no Product Master page to open: the card is decided in the chat
	if (changeSet.action?.kind.startsWith("shop_product.")) return undefined;
	const id = changeSet.drafts?.[0]?.type === "product_edit" ? changeSet.diffs[0]?.entity.id : undefined;
	return id ? `/catalog/products/${encodeURIComponent(id)}` : undefined;
}

/**
 * What the review list shows: the open chat's drafts still waiting (in their
 * latest state), or every pending draft while the chat is empty (a new chat).
 */
export function pendingForChat(
	pending: readonly ChangeSet[],
	turns: AgentAssistantPanelProps["chat"]["turns"],
	threadId: string | undefined,
): ChangeSet[] {
	const own = new Map<string, ChangeSet>();
	const runs = new Set<string>();
	for (const turn of turns) {
		if (turn.role !== "assistant") continue;
		runs.add(turn.id);
		for (const changeSet of turn.changeSets) own.set(changeSet.id, changeSet);
	}
	if (!threadId && runs.size === 0) return [...pending];
	const out = new Map<string, ChangeSet>();
	for (const changeSet of pending) {
		if (!runs.has(changeSet.runId) && !own.has(changeSet.id)) continue;
		const latest = own.get(changeSet.id) ?? changeSet;
		if (latest.status === "pending") out.set(latest.id, latest);
	}
	for (const changeSet of own.values()) if (changeSet.status === "pending" && !out.has(changeSet.id)) out.set(changeSet.id, changeSet);
	return [...out.values()];
}

function hasDraftDoc(changeSet: ChangeSet | undefined): boolean {
	return Boolean(changeSet?.drafts?.some((doc) => doc.type !== "inventory"));
}

/**
 * The assistant as one piece: floating panel (or a side-rail column), chat
 * column, the two-column review for big drafts, approvals and recent chats. Hosts pass the chat
 * runtime, pending drafts and the approve call; everything else lives here.
 */
export function AgentAssistantPanel({
	chat,
	pageLabel,
	pageIcon,
	onRemoveContext,
	pending: allPending,
	onDecide,
	onUndo,
	undoState,
	onEditInventory,
	onNavigate,
	onLocate,
	suggestions,
	menu,
	labels,
	locale,
	open,
	onOpenChange,
	peek,
	peekDelayMs,
	peekTtlMs,
	offset,
	mood,
	badge,
	placement,
	onElementHover,
	composerHandle,
	singleChat = false,
	helloHint,
	work,
	notice,
	locked,
}: AgentAssistantPanelProps) {
	const [wide, setWide] = useState(false);
	// open state when the host does not control it: taking an item from the mascot's bubble opens the dock
	const [selfOpen, setSelfOpen] = useState(false);
	const isOpen = open ?? selfOpen;
	const setOpen = useCallback(
		(next: boolean) => {
			setSelfOpen(next);
			onOpenChange?.(next);
		},
		[onOpenChange],
	);
	const [reviewId, setReviewId] = useState<string | undefined>();
	const composerRef = useRef<ComposerHandle>(null);
	useImperativeHandle(composerHandle, () => ({
		focus: (text) => composerRef.current?.focus(text),
		openPicker: (source) => composerRef.current?.openPicker(source),
	}));
	const history = chat.history;
	const historyLabels = { ...DEFAULT_CHAT_HISTORY_LABELS, ...labels?.history };
	// the open chat's drafts; every chat's while the chat is new
	const pending = useMemo(() => pendingForChat(allPending, chat.turns, history?.threadId), [allPending, chat.turns, history?.threadId]);

	// every change set the panel can show: this chat's, then pending ones from other chats
	const known = useMemo(() => {
		const map = new Map<string, ChangeSet>();
		for (const changeSet of allPending) map.set(changeSet.id, changeSet);
		for (const turn of chat.turns) {
			if (turn.role === "assistant") for (const changeSet of turn.changeSets) map.set(changeSet.id, changeSet);
		}
		return map;
	}, [allPending, chat.turns]);

	// the newest reviewable draft of this chat — what Expand opens
	const latestDraft = useMemo(() => {
		for (let i = chat.turns.length - 1; i >= 0; i -= 1) {
			const turn = chat.turns[i];
			if (turn?.role !== "assistant") continue;
			const found = [...turn.changeSets].reverse().find(hasDraftDoc);
			if (found) return found;
		}
		return undefined;
	}, [chat.turns]);

	const reviewed = reviewId ? known.get(reviewId) : latestDraft;

	const review = useCallback((changeSet: ChangeSet) => {
		setReviewId(changeSet.id);
		setWide(true);
	}, []);

	// A task under review opens in its own chat (where it was asked and answered), not the chat open now.
	const inThisChat = useCallback(
		(id: string) => chat.turns.some((turn) => turn.role === "assistant" && turn.changeSets.some((c) => c.id === id)),
		[chat.turns],
	);
	const openTask = useCallback(
		async (changeSet: ChangeSet) => {
			// a teammate's draft: their chat is private, so it opens in the review on its own
			if (isTeammateDraft(changeSet)) return review(changeSet);
			if (!inThisChat(changeSet.id)) await history?.openRunThread?.(changeSet.runId);
			if (hasDraftDoc(changeSet)) review(changeSet);
		},
		[history, inThisChat, review],
	);

	// one decision per change set at a time: Approve pressed while auto-approve is applying it waits for
	// that same call (and shows its outcome) instead of a second claim answered "already being applied"
	const inFlight = useRef(new Map<string, Promise<ChangeSet>>());
	const decide = useCallback(
		(changeSet: ChangeSet, decision: "approve" | "reject", options?: PanelDecideOptions) => {
			// every decision but Auto-approve's is a click of the merchant
			const how: PanelDecideOptions = options?.auto ? options : { ...options, manual: true };
			return joinInFlight(inFlight.current, `${changeSet.id}:${decision}`, () => onDecide(changeSet, decision, how));
		},
		[onDecide],
	);

	const autoApprove = useAutoApprove(chat.turns, history?.threadId, (changeSet, options) => decide(changeSet, "approve", options));

	// the reviewed draft belongs to a campaign: Approve all runs its waiting cards in order and stops at the first failure
	const reviewedCampaign = (() => {
		const group = reviewed?.group;
		if (!group || reviewed.confirmText) return undefined;
		const cards = campaignCards([...known.values()], group.id);
		const queue = campaignQueue(cards);
		if (queue.length < 2) return undefined;
		const text = { ...DEFAULT_CAMPAIGN_LABELS, ...labels?.chat?.campaign };
		return {
			tag: (group.kind === "set" ? text.setTag : text.tag).replace("{label}", group.label),
			approveAll: text.approveAll.replace("{n}", String(queue.length)),
			onApproveAll: async () => {
				const stopped = stoppedLine(await approveCampaign(cards, (card) => decide(card, "approve")), labels?.chat?.campaign);
				if (stopped) throw new Error(stopped);
			},
		};
	})();

	// A draft staged while you watch opens the review once (desktop). Drafts
	// already there when a chat loads don't pop open; neither do they on phones,
	// where the review would cover the chat.
	const seen = useRef<string | undefined | null>(null);
	const threadKey = history?.threadId;
	useEffect(() => {
		seen.current = null;
	}, [threadKey]);
	useEffect(() => {
		if (history?.restoring) return;
		if (seen.current === null) {
			seen.current = latestDraft?.id;
			return;
		}
		if (!latestDraft || latestDraft.id === seen.current) return;
		seen.current = latestDraft.id;
		// a rail is too narrow for two columns: the review would cover the chat
		const narrow = placement === "inline" || (typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches);
		// auto-approve applies it: nothing to review
		if (latestDraft.status === "pending" && !narrow && !(autoApprove.on && autoApprovable(latestDraft))) review(latestDraft);
	}, [latestDraft, history?.restoring, review, threadKey, placement, autoApprove.on]);

	const openEditor = useCallback(
		async (changeSet: ChangeSet) => {
			const open = pendingEditHref(changeSet);
			if (open) return onNavigate?.(open);
			const decided = changeSet.status === "pending" ? await onDecide(changeSet, "approve", { manual: true }) : changeSet;
			const href = decided.result?.links[0]?.href;
			if (href) onNavigate?.(href);
		},
		[onDecide, onNavigate],
	);

	const workPanel = useWorkPanel({
		work: singleChat ? undefined : work,
		history,
		turns: chat.turns.length,
		busy: chat.busy,
		open: isOpen,
		setOpen,
		send: chat.send,
		onNavigate,
		labels: labels?.work,
		locale,
	});

	// the launcher acts out the latest run while the panel is closed too
	const lastTurn = chat.turns.at(-1);
	const lastRun = lastTurn?.role === "assistant" ? lastTurn.run : undefined;
	const runMood: MascotMood | undefined =
		lastRun?.status === "failed"
			? "error"
			: lastRun?.status === "awaiting_input"
				? "alert"
				: chat.busy
					? lastRun?.answer
						? "speaking"
						: "thinking"
					: undefined;

	const thread = history?.threads.find((t) => t.id === history.threadId);
	const title = history?.threadId ? (thread?.title ?? historyLabels.newChat) : historyLabels.newChat;
	const agent = labels?.dock?.agent ?? "ECH Agent";
	const subtitle = pageLabel ? (labels?.subtitle ?? "{agent} · {page}").replace("{agent}", agent).replace("{page}", pageLabel) : agent;

	const deleteChat = history?.threadId
		? {
				label: labels?.deleteChat ?? historyLabels.delete,
				icon: "trash" as const,
				danger: true,
				separated: Boolean(menu?.length),
				onSelect: () => {
					const id = history.threadId;
					if (!id || !window.confirm(historyLabels.deleteConfirm)) return;
					setWide(false);
					history.deleteThread(id).catch(() => window.alert(historyLabels.deleteFailed));
				},
			}
		: undefined;
	const menuItems = [...(menu ?? []), ...(deleteChat ? [deleteChat] : [])];

	const kindLabel = (changeSet: ChangeSet) => {
		const type = changeSet.drafts?.[0]?.type;
		return type === "product"
			? (labels?.productDraft ?? "Product draft")
			: type === "blog"
				? (labels?.blogDraft ?? "Blog draft")
				: (labels?.genericDraft ?? "Draft");
	};
	const accessLabels = { ...DEFAULT_DRAFT_LABELS, ...labels?.draft };
	// the review list: this chat's drafts; with the work queue (it lists the caller's own), teammates' drafts only —
	// what an owner / admin sees from the rest of the team, each "Asked by …"
	const approvalList = workPanel ? allPending.filter(isTeammateDraft) : pending;

	const replyLabels = { ...DEFAULT_REPLY_BUBBLE_LABELS, ...labels?.reply };
	const reply = replyBubbleState(
		chat.turns,
		{ working: labels?.chat?.working ?? DEFAULT_CHAT_LABELS.working, phrases: { ...DEFAULT_CHAT_LABELS.phrases, ...labels?.chat?.phrases } },
		replyLabels,
	);

	// the chat started on the record on screen, while another chat is open
	const offerLinked = !singleChat && Boolean(history?.linked && history.openLinked && history.linked.id !== history.threadId && !history.restoring);
	const showSheet = wide;
	// Start over deletes this chat with its runs: its drafts still waiting for review go with it
	const startOver = singleChat
		? {
				disabled: chat.turns.length === 0 || Boolean(history?.restoring),
				discarding: pending.filter((changeSet) => inThisChat(changeSet.id)).length,
				undoLost: undoable(chat.turns),
				onConfirm: async () => {
					const id = history?.threadId;
					if (id) await history.deleteThread(id);
					else history?.newThread();
					setWide(false);
					setReviewId(undefined);
				},
				labels: labels?.startOver,
			}
		: undefined;
	return (
		<AgentFloatDock
			title={workPanel?.title ?? title}
			subtitle={subtitle}
			badge={workPanel ? workPanel.badge : (badge ?? pending.length)}
			raise={workPanel?.raise}
			staticTitle={Boolean(workPanel)}
			actions={workPanel?.actions}
			historyButton={Boolean(workPanel)}
			hideMenu={Boolean(workPanel)}
			expandable={Boolean(workPanel) && (wide || reviewed?.status === "pending")}
			onBack={workPanel?.onBack}
			backLabel={workPanel ? labels?.work?.back : undefined}
			peek={peek}
			peekDelayMs={peekDelayMs}
			peekTtlMs={peekTtlMs}
			offset={offset}
			mood={mood ?? runMood}
			busy={chat.busy}
			reply={reply}
			replyLabels={replyLabels}
			open={isOpen}
			onOpenChange={setOpen}
			labels={labels?.dock}
			placement={placement}
			history={
				history && {
					threads: history.threads,
					activeThreadId: history.threadId,
					loading: history.restoring,
					error: history.error,
					onNew: history.newThread,
					onOpen: (id) => {
						workPanel?.toChat();
						void history.openThread(id);
					},
					onDelete: history.deleteThread,
					onShow: () => void history.refresh(),
					labels: labels?.history,
					locale,
				}
			}
			approvals={approvalList.map((changeSet) => ({
				id: changeSet.id,
				title: changeSet.drafts?.[0]?.type === "product" ? changeSet.drafts[0].name : (changeSet.drafts?.[0]?.type === "blog" ? changeSet.drafts[0].title : changeSet.title),
				meta: [kindLabel(changeSet), askedByLine(changeSet, accessLabels)].filter(Boolean).join(" · "),
			}))}
			onOpenApproval={(id) => {
				const changeSet = approvalList.find((c) => c.id === id) ?? known.get(id);
				if (changeSet) void openTask(changeSet);
				else {
					setReviewId(id);
					setWide(true);
				}
			}}
			onNewChat={workPanel && history ? workPanel.onNewChat : history?.newThread}
			wide={showSheet}
			onWideChange={(next) => {
				if (next) setReviewId(undefined);
				setWide(next);
			}}
			menu={menuItems}
			startOver={startOver}
			sheet={
				<ReviewSheet
					changeSet={reviewed}
					labels={labels?.review}
					draftLabels={labels?.draft}
					campaign={reviewedCampaign}
					onApprove={reviewed ? (confirm) => decide(reviewed, "approve", confirm === undefined ? undefined : { confirm }) : undefined}
					onDiscard={
						reviewed
							? async () => {
									await decide(reviewed, "reject");
									setWide(false);
								}
							: undefined
					}
					onAskChanges={() => {
						composerRef.current?.focus(labels?.chat?.askChangesPrefill ?? "Change ");
					}}
					onSwapCover={() => composerRef.current?.openPicker("stock")}
				/>
			}
		>
			{workPanel?.body}
			{!workPanel?.body && offerLinked && history?.linked && (
				<div className="ech-ag-linked" role="note">
					<Icon name="message-square-text" />
					<span>{(labels?.linkedChat ?? "Your earlier chat here: {title}").replace("{title}", history.linked.title)}</span>
					<button type="button" onClick={() => void history.openLinked?.()}>
						{labels?.linkedOpen ?? "Open"}
					</button>
				</div>
			)}
			{!workPanel?.body && (
			<AgentChatThread
				chat={chat}
				restoring={history?.restoring}
				restoringLabel={historyLabels.restoring}
				pendingCount={workPanel ? 0 : pending.length}
				onReviewPending={() => {
					const first = pending.find(hasDraftDoc) ?? pending[0];
					if (first) void openTask(first);
				}}
				suggestions={workPanel ? workPanel.suggestions(suggestions) : suggestions}
				onDecide={decide}
				onUndo={onUndo}
				undoState={undoState}
				onEditInventory={onEditInventory}
				onReview={review}
				onOpenEditor={onNavigate ? openEditor : undefined}
				onLocate={onLocate}
				openChangeSetId={showSheet ? reviewed?.id : undefined}
				context={pageLabel && onRemoveContext ? { label: pageLabel, icon: pageIcon, onRemove: onRemoveContext } : undefined}
				composerRef={composerRef}
				onElementHover={onElementHover}
				helloHint={helloHint}
				autoApprove={autoApprove}
				labels={labels?.chat}
				composerLabels={labels?.composer}
				questionLabels={labels?.question}
				draftLabels={labels?.draft}
				empty={workPanel?.empty}
				notice={notice}
				locked={locked}
			/>
			)}
		</AgentFloatDock>
	);
}

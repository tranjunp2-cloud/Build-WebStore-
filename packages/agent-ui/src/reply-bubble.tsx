import type { AgentChatTurn } from "@ech/agent-core";
import { type ChatLabels, phraseText } from "./chat";
import { Icon } from "./icons";

/**
 * What the assistant is doing in the chat, told over the mascot while the
 * panel is closed: the step it is on, the reply as it is written, a question
 * waiting for the merchant, the drafts ready to review, or that it failed.
 */
export type ReplyBubblePhase = "working" | "writing" | "asking" | "done" | "failed";

export interface ReplyBubbleState {
	/** run id — a new run (or a new phase of it) shows again after a dismiss */
	runId: string;
	phase: ReplyBubblePhase;
	/** what was asked, the chat's subject */
	prompt: string;
	line: string;
	detail?: string;
	/** drafts this reply staged that still wait for approval */
	drafts: number;
}

export interface ReplyBubbleLabels {
	replying: string;
	/** a reply with nothing to review */
	replied: string;
	readyOne: string;
	/** "{n} drafts ready to review" */
	readyMany: string;
	readyDetail: string;
	failed: string;
	failedDetail: string;
	answer: string;
	review: string;
	later: string;
	openChat: string;
	hide: string;
}

export const DEFAULT_REPLY_BUBBLE_LABELS: ReplyBubbleLabels = {
	replying: "Replying…",
	replied: "Replied",
	readyOne: "1 draft ready to review",
	readyMany: "{n} drafts ready to review",
	readyDetail: "Nothing changes until you approve.",
	failed: "Couldn't finish this reply",
	failedDetail: "Your request is kept. Open the chat to try again.",
	answer: "Answer",
	review: "Review",
	later: "Later",
	openChat: "Open chat",
	hide: "Hide",
};

const WORKING = new Set(["queued", "planning", "running", "applying"]);

/** One plain line from the reply's markdown: no **bold**, `code`, headings, bullets or link targets. */
export function plainLine(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/(\*\*|__|`)/g, "")
		.replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/gm, "");
}

function clip(text: string, max: number): string {
	const flat = plainLine(text).replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** The latest reply of the chat as a bubble, or nothing to say (no reply yet, or it was stopped). */
export function replyBubbleState(
	turns: readonly AgentChatTurn[],
	chatLabels: Pick<ChatLabels, "phrases" | "working">,
	labels: ReplyBubbleLabels = DEFAULT_REPLY_BUBBLE_LABELS,
): ReplyBubbleState | undefined {
	let index = turns.length - 1;
	while (index >= 0 && turns[index]?.role !== "assistant") index -= 1;
	const turn = turns[index];
	if (turn?.role !== "assistant" || !turn.run) return undefined;
	const run = turn.run;
	let asked = index - 1;
	while (asked >= 0 && turns[asked]?.role !== "user") asked -= 1;
	const user = turns[asked];
	const prompt = clip(user?.role === "user" ? user.text : run.prompt, 80);
	const drafts = turn.changeSets.filter((c) => c.status === "pending").length;
	const base = { runId: run.id, prompt, drafts };
	if (WORKING.has(run.status)) {
		const answer = run.answer?.trim();
		if (answer) return { ...base, phase: "writing", line: labels.replying, detail: clip(answer, 160) };
		const step = [...run.steps].reverse().find((s) => s.status === "running" && s.phrase?.key !== "step.thinking");
		return { ...base, phase: "working", line: step ? phraseText(step.phrase, step.label, chatLabels) : `${chatLabels.working}…` };
	}
	if (run.status === "awaiting_input" && run.ask) {
		const options = run.ask.question.options.slice(0, 3).map((o) => o.label);
		return { ...base, phase: "asking", line: run.ask.question.title, ...(options.length ? { detail: options.join(" · ") } : {}) };
	}
	if (run.status === "failed") return { ...base, phase: "failed", line: labels.failed, detail: labels.failedDetail };
	if (run.status === "applied" || run.status === "awaiting_approval") {
		if (drafts > 0) {
			return { ...base, phase: "done", line: drafts === 1 ? labels.readyOne : labels.readyMany.replace("{n}", String(drafts)), detail: labels.readyDetail };
		}
		const answer = run.answer?.trim();
		return { ...base, phase: "done", line: labels.replied, ...(answer ? { detail: clip(answer, 160) } : {}) };
	}
	return undefined;
}

const PHASE_ICON = { asking: "message-circle-question", done: "circle-check", failed: "circle-alert", writing: "message-square-text" } as const;

/** The bubble itself: a card over the mascot; the whole card opens the chat. */
export function ReplyBubble({
	state,
	labels,
	onOpen,
	onDismiss,
	onHoverChange,
}: {
	state: ReplyBubbleState;
	labels: ReplyBubbleLabels;
	onOpen: () => void;
	onDismiss: () => void;
	/** the pointer is over the bubble (or it has focus) — the dock pauses its auto-hide */
	onHoverChange?: (hovering: boolean) => void;
}) {
	const live = state.phase === "working" || state.phase === "writing";
	const cta =
		state.phase === "asking"
			? labels.answer
			: state.phase === "failed"
				? labels.openChat
				: state.phase === "done" && state.drafts > 0
					? labels.review
					: undefined;
	return (
		<div
			className="ech-ag-reply"
			data-phase={state.phase}
			onMouseEnter={() => onHoverChange?.(true)}
			onMouseLeave={() => onHoverChange?.(false)}
			onFocus={() => onHoverChange?.(true)}
			onBlur={() => onHoverChange?.(false)}
		>
			<div className="ech-ag-reply-card">
				<button type="button" className="ech-ag-reply-open" onClick={onOpen}>
					<span className="ech-ag-reply-top">
						<Icon name="sparkles" size={12} />
						<span>{state.prompt}</span>
					</span>
					{/* keyed by the line: each new step slides in */}
					<span className="ech-ag-reply-line" key={state.line} role="status" aria-live="polite">
						{state.phase === "working" ? (
							<span className="ech-ag-reply-dots" aria-hidden="true">
								<i />
								<i />
								<i />
							</span>
						) : (
							<Icon name={PHASE_ICON[state.phase]} size={16} />
						)}
						<span>{state.line}</span>
					</span>
					{state.detail && <span className="ech-ag-reply-detail">{state.detail}</span>}
				</button>
				{cta && (
					<span className="ech-ag-reply-cta">
						<button type="button" className="is-primary" onClick={onOpen}>
							{cta}
						</button>
						{state.phase === "done" && (
							<button type="button" onClick={onDismiss}>
								{labels.later}
							</button>
						)}
					</span>
				)}
				{live && <span className="ech-ag-reply-bar" aria-hidden="true" />}
			</div>
			<button type="button" className="ech-ag-reply-hide" onClick={onDismiss} aria-label={labels.hide}>
				<Icon name="x" size={11} />
			</button>
		</div>
	);
}

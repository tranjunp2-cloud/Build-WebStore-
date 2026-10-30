import { AnswerText } from "./answer-text";
import { chosenRecords, RecordCards, recordElement, runRecords } from "./record-cards";
import { RunMedia, runMedia } from "./run-media";
import type {
	AgentAttachment,
	AgentChatTurn,
	AgentRun,
	Phrase,
	AnsweredQuestion,
	AnswerInput,
	ChangeSet,
	ComposerAttachment,
	FieldDiff,
	PlanStep,
	QuestionOption,
	ReceiptMedia,
	ToolReceipt,
} from "@ech/agent-core";
import { type ContextElement, type ContextElementKind, contextElementKey } from "@ech/agent-core";
import { Fragment, type MutableRefObject, type ReactNode, type Ref, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChatComposer, type ComposerHandle, type ComposerLabels, DEFAULT_COMPOSER_LABELS, type PickSource } from "./composer";
import { ElementChip } from "./element-chip";
import { CampaignHeader, type CampaignLabels } from "./campaign-group";
import { type AutoApproveNotice, type CardUndoState, DraftCard, type DraftLabelOverrides } from "./draft-card";
import { Icon, type IconName } from "./icons";
import { AgentMascot, type MascotMood } from "./mascot";
import { AnsweredRow, QuestionCard, type QuestionLabels } from "./question-card";
import { DEFAULT_QUEUE_LABELS, QueueNotice, type QueueLabels } from "./queue-notice";

/** What the thread needs from a chat session — `useAgentChatRuntime()` satisfies it. */
export interface AgentChatView {
	turns: AgentChatTurn[];
	busy: boolean;
	send: (prompt: string) => Promise<void>;
	canSend: (text: string) => boolean;
	retry: (runId: string) => Promise<void>;
	/** stop the reply being written (the composer's send turns into Stop); also takes a waiting reply out of the queue */
	stop?: () => Promise<void>;
	/** "Stop … and run mine": stop a working request listed in a waiting reply's queue (hosts without it show no such buttons) */
	stopRun?: (runId: string) => Promise<unknown>;
	answer: (runId: string, input: AnswerInput) => Promise<void>;
	searchOptions: (runId: string, questionId: string, query: string) => Promise<QuestionOption[]>;
	attachments: ComposerAttachment[];
	attachmentError: string | undefined;
	attachFiles: (files: readonly File[]) => Promise<void>;
	attachPicked: (item: AgentAttachment) => Promise<void>;
	uploadPictures: (files: readonly File[]) => Promise<AgentAttachment[]>;
	removeAttachment: (key: string) => void;
	/** "Use this" on a picture of the chat: waits in the tray as chosen until sent (optional for older hosts) */
	choosePicture?: (picture: ReceiptMedia) => void;
	/** things on the page waiting for the next message (hosts with Ask AI on elements) */
	elements?: ContextElement[];
	/** by `contextElementKey` */
	removeElement?: (key: string) => void;
	/** a record picked from a reply's cards ("Use"): a chip like the page's elements */
	attachElement?: (element: ContextElement, mode?: "add" | "only") => void;
	listMedia: (query: { source: PickSource; query?: string; limit?: number }) => Promise<AgentAttachment[]>;
}

export interface ChatSuggestion {
	label: string;
	/** sent as the prompt; defaults to the label */
	prompt?: string;
	icon?: IconName;
	/** the host handles the click instead of sending the prompt (an issue opens its own chat) */
	onSelect?: () => void;
}

export interface ChatLabels {
	tryHeading: string;
	/** "{n} drafts are waiting for your approval" */
	waitingOne: string;
	waitingMany: string;
	review: string;
	/** new chat: "Hi! What can I help with?" */
	greeting: string;
	/** new chat with a page in context: "Hi! What can I help with on {page}?" */
	greetingPage: string;
	/** heading over the next-message chips (screen readers) */
	askNext: string;
	/** the message kept while a reply is on its way */
	queued: string;
	editQueued: string;
	cancelQueued: string;
	/** the merchant pressed Stop */
	stopped: string;
	/** next message offered after a tool ran, by the receipt's phrase key */
	followUps: Record<string, string>;
	/** done: "Thought for {time}" */
	thoughtFor: string;
	/** done in under a second, or no timing */
	thoughtBriefly: string;
	/** "{n}s" */
	seconds: string;
	/** "{m}m {s}s" */
	minutes: string;
	/** step / receipt phrases by key (see PHRASES); a missing key falls back to the server's English */
	phrases: Record<string, string>;
	working: string;
	errorTitle: string;
	errorKept: string;
	tryAgain: string;
	/** button on a found / generated picture */
	usePicture: string;
	/** message it sends: "Use {id}" (hosts without chosen pictures) */
	usePicturePrompt: string;
	/** the button on a picture that is chosen for the next message */
	chosenPicture: string;
	/** sent with chosen pictures and nothing typed */
	useChosenOne: string;
	useChosenMany: string;
	openPicture: string;
	/** a product / post the reply read or found, as a card */
	recordProduct: string;
	recordPost: string;
	openRecord: string;
	useRecord: string;
	chosenRecord: string;
	/** "Show {n} more" */
	moreRecords: string;
	/** the tag and "Approve all" of linked cards (a promo campaign); English where left out */
	campaign?: Partial<CampaignLabels>;
	/** the notice of a reply waiting for a free AI slot; English where left out */
	queue?: Partial<QueueLabels>;
	/** follow-up sent by "Change" on an answered row */
	changePrompt: string;
	/** prefill for "Ask for changes" */
	askChangesPrefill: string;
	/** composer hint while a photo question is open (typing searches photos) */
	searchPhotosHint: string;
}

export const DEFAULT_CHAT_LABELS: ChatLabels = {
	tryHeading: "Try",
	greeting: "Hi! What can I help with?",
	greetingPage: "Hi! What can I help with on {page}?",
	askNext: "Ask next",
	queued: "Sends when this reply is done",
	editQueued: "Edit",
	cancelQueued: "Don't send",
	stopped: "Stopped",
	followUps: {
		"content.search.product": "Which of these products have no photos?",
		"inventory.overview": "Which products are about to run out?",
		"inventory.stock": "Which products are about to run out?",
		"site.read.pages": "Improve the text on my homepage",
	},
	waitingOne: "1 draft is waiting for your approval",
	waitingMany: "{n} drafts are waiting for your approval",
	review: "Review",
	thoughtFor: "Thought for {time}",
	thoughtBriefly: "Thought for a moment",
	seconds: "{n}s",
	minutes: "{m}m {s}s",
	phrases: {
		"step.thinking": "Thinking",
		"step.drafting": "Drafting with your answers",
		"step.families": "Reading your catalog families",
		"step.question": "Preparing a question",
		"step.picture": "Generating a picture (about a minute)",
		"step.pictures": "Generating pictures (about a minute)",
		"ask.done": "Asked {asked}",
		"ask.family": "Family: {family}",
		"ask.auto": "{auto} picked from your catalog",
		stage: "Prepared: {subject}",
		"content.read.product": "Read the product",
		"content.read.post": "Read the post",
		"page.current": "Checked the page you're on",
		"content.check.product": "Checked the latest product",
		"content.check.post": "Checked the latest post",
		"content.search.product": "Looked through your products",
		"content.search.post": "Looked through your posts",
		"site.read.pages": "Looked at your website's pages",
		"site.read.page": "Read the page",
		"site.read.block": "Read the section",
		"site.read.theme": "Checked your theme",
		"site.read.catalog": "Checked the section types",
		"site.read.products": "Looked through your store's products",
		"site.read.languages": "Checked your website's languages",
		"store.categories": "Checked your categories",
		"store.discounts": "Checked your discounts",
		"store.orders": "Checked your orders",
		"store.customers": "Checked your customers",
		"store.leads": "Checked your contact leads",
		"store.email_templates": "Checked your email templates",
		"store.reports": "Looked at your numbers",
		"store.todos": "Checked what needs you",
		"site.check": "Checked the latest page",
		found: "{n} found",
		"blog.write_posts": "Wrote {n} blog posts",
		"media.stock": "Found {n} stock photos for “{subject}”",
		"media.library": "Found {n} photos in your library for “{subject}”",
		"media.generated": "Made {n} picture(s)",
		"inventory.overview": "Checked what needs attention",
		"inventory.stock": "Checked stock levels",
		"inventory.product": "Checked stock for a product",
		"inventory.item": "Checked a product's stock, channels and history",
		"inventory.warehouses": "Checked your warehouses",
		"inventory.warehouse": "Checked a warehouse",
		"inventory.transfers": "Checked transfers",
		"inventory.transfer": "Checked a transfer",
		"inventory.reservations": "Checked reserved stock",
		"inventory.reservation": "Checked reserved stock",
		"inventory.adjustments": "Checked stock changes",
		"inventory.adjustment": "Checked a stock change",
		"inventory.cycle_counts": "Checked stock counts",
		"inventory.cycle_count": "Checked a stock count",
		"inventory.holds": "Checked held stock",
		"inventory.facility_locations": "Checked bins and zones",
		"inventory.location_mappings": "Checked channel stock locations",
	},
	working: "Thinking",
	errorTitle: "The assistant couldn't answer",
	errorKept: "Your message and attachments are kept.",
	tryAgain: "Try again",
	usePicture: "Use this",
	usePicturePrompt: "Use {id}",
	chosenPicture: "Selected",
	useChosenOne: "Use this picture",
	useChosenMany: "Use these {n} pictures",
	openPicture: "Open picture",
	recordProduct: "Product",
	recordPost: "Blog post",
	openRecord: "Open",
	useRecord: "Use",
	chosenRecord: "Selected",
	moreRecords: "Show {n} more",
	changePrompt: "Change {fields}.",
	askChangesPrefill: "Change ",
	searchPhotosHint: "Type to search photos…",
};

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

const LIVE = new Set(["planning", "running", "applying"]);

function isLive(run: AgentRun | undefined): boolean {
	return !run || LIVE.has(run.status);
}

/** What happens to the waiting message when the reply ends: sent, or back into the box. */
export function queuedAfterReply(status: AgentRun["status"] | undefined): "send" | "restore" {
	return status === "applied" || status === "awaiting_approval" ? "send" : "restore";
}

const MAX_NEXT = 3;
const MAX_RULE_NEXT = 2;

/**
 * Next messages to offer under a finished reply: what the tools it used
 * usually lead to (free, from the receipts), then what the assistant wrote
 * itself (the platform adds those only while its prompt cache is warm).
 */
export function nextPrompts(run: AgentRun | undefined, labels: Pick<ChatLabels, "followUps">): string[] {
	if (!run || (run.status !== "applied" && run.status !== "awaiting_approval")) return [];
	const fromTools = (run.receipts ?? [])
		.filter((receipt) => receipt.status === "ok")
		.map((receipt) => (receipt.phrase ? labels.followUps[receipt.phrase.key] : undefined))
		.filter((text): text is string => Boolean(text));
	const seen = new Set<string>();
	const out: string[] = [];
	for (const prompt of [...fromTools.slice(0, MAX_RULE_NEXT), ...(run.suggestions ?? []).map((s) => s.prompt)]) {
		const key = prompt.trim().toLowerCase();
		if (seen.has(key) || key === run.prompt.trim().toLowerCase()) continue;
		seen.add(key);
		out.push(prompt);
	}
	return out.slice(0, MAX_NEXT);
}

/**
 * A step / receipt in the merchant's language: its phrase key through the
 * labels, with the subject ("Read the post: Batik care") or count appended;
 * no phrase (or an unknown key) → the server's English text.
 */
export function phraseText(phrase: Phrase | undefined, fallback: string, labels: Pick<ChatLabels, "phrases">): string {
	if (!phrase) return fallback;
	const values = phrase.values ?? {};
	if (phrase.key === "ask.done") {
		return [
			values.family !== undefined ? fill(labels.phrases["ask.family"] ?? "", { family: values.family }) : null,
			fill(labels.phrases["ask.done"] ?? "", { asked: values.asked ?? 0 }),
			Number(values.auto) > 0 ? fill(labels.phrases["ask.auto"] ?? "", { auto: values.auto ?? 0 }) : null,
		]
			.filter(Boolean)
			.join(" · ");
	}
	const template = labels.phrases[phrase.key];
	if (!template) return fallback;
	const text = fill(template, values);
	// content reads name what they read; searches say how many they found
	if (phrase.key.startsWith("content.") && !template.includes("{subject}") && values.subject !== undefined) return `${text}: ${values.subject}`;
	if (phrase.key.startsWith("content.search") && values.n !== undefined) return `${text} (${fill(labels.phrases.found ?? "{n}", { n: values.n })})`;
	return text;
}

/** How long a finished run took, in the merchant's words ("Thought for 12s"). */
function thoughtLabel(run: AgentRun | undefined, labels: ChatLabels): string {
	// after questions, the second reply counts from when the answers were in
	const from = run?.intro?.resumedAt ?? run?.startedAt;
	return thoughtText(run?.finishedAt && from ? Date.parse(run.finishedAt) - Date.parse(from) : Number.NaN, labels);
}

function thoughtText(ms: number, labels: ChatLabels): string {
	if (!Number.isFinite(ms) || ms < 1000) return labels.thoughtBriefly;
	const total = Math.round(ms / 1000);
	const time = total < 60 ? fill(labels.seconds, { n: total }) : fill(labels.minutes, { m: Math.floor(total / 60), s: total % 60 });
	return fill(labels.thoughtFor, { time });
}

/** Messenger-style "typing…" bubble: the assistant is on it. */
export function TypingDots({ label }: { label: string }) {
	return (
		<span className="ech-ag-typing" role="status" aria-label={label}>
			<i />
			<i />
			<i />
		</span>
	);
}

interface ToolsRowProps {
	listId: string;
	steps: PlanStep[];
	receipts: ToolReceipt[];
	/** still working on this part */
	live: boolean;
	/** text of this part is already showing — no typing bubble */
	writing: boolean;
	/** label once this part is done ("Thought for 12s") */
	doneLabel: string;
	/** show the done label even when there are no steps to open (the reply that asked) */
	keepLabel?: boolean;
	labels: ChatLabels;
}

/**
 * What the assistant did, in plain words. While it works and nothing is
 * written yet: the typing bubble, with the current step under it. After:
 * "Thought for 12s"; open it to see each step.
 */
function ToolsRow({ listId, steps, receipts, live, writing, doneLabel, keepLabel = false, labels }: ToolsRowProps) {
	const [open, setOpen] = useState(false);
	const current = [...steps].reverse().find((s) => s.status === "running" && s.phrase?.key !== "step.thinking");
	// "Thought for 9s" already says it thought — the list shows what it did
	const shown = steps.filter((step) => !(step.phrase?.key === "step.thinking" && step.status === "done"));
	const expandable = shown.length + receipts.length > 0;
	if (!live && !expandable && !keepLabel) return null;
	const label = live ? (current ? phraseText(current.phrase, current.label, labels) : undefined) : doneLabel;
	return (
		<>
			{live && !writing && <TypingDots label={labels.working} />}
			{label && (
				<button
					type="button"
					className="ech-ag-tools"
					data-live={live ? "" : undefined}
					aria-expanded={expandable ? open : undefined}
					aria-controls={expandable ? listId : undefined}
					onClick={() => expandable && setOpen((v) => !v)}
				>
					{expandable && <Icon name="chevron-right" className="ech-ag-chev" />}
					{/* while it works the step words shimmer, so the reply reads as running */}
					{live ? (
						<span key={label} className="ech-ag-shimmer">
							{label}
						</span>
					) : (
						label
					)}
				</button>
			)}
			{expandable && (
				<div className="ech-ag-tool-list" id={listId} data-open={open ? "" : undefined} inert={!open}>
					<ul>
						{shown.map((step) => (
							<li key={step.id} data-status={step.status === "failed" ? "error" : step.status}>
								<Icon
									name={step.status === "running" ? "loader-circle" : step.status === "failed" ? "x" : "check"}
									size={14}
									className={step.status === "running" ? "ech-ag-spin" : undefined}
								/>
								<span>
									{phraseText(step.phrase, step.label, labels)}
									{step.detail && <small>{step.detail}</small>}
								</span>
							</li>
						))}
						{receipts.map((receipt) => (
							<li key={receipt.id} data-status={receipt.status}>
								<Icon name={receipt.status === "error" ? "x" : "check"} size={14} />
								<span>{phraseText(receipt.phrase, receipt.summary || receipt.tool, labels)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
}

/** Consecutive attribute answers share one row; a family or other kind stands alone. */
function groupAnswers(answers: readonly AnsweredQuestion[]): AnsweredQuestion[][] {
	const groups: AnsweredQuestion[][] = [];
	for (const answer of answers) {
		const last = groups[groups.length - 1];
		if (last && answer.kind === "attribute" && last[0]?.kind === "attribute" && last.length < 3) last.push(answer);
		else groups.push([answer]);
	}
	return groups;
}

function UserTurn({
	turn,
	kinds,
	onElementHover,
}: {
	turn: Extract<AgentChatTurn, { role: "user" }>;
	kinds: Record<ContextElementKind, string>;
	onElementHover?: (element: ContextElement | null) => void;
}) {
	const files = turn.attachments ?? [];
	const pictures = turn.pictures ?? [];
	const elements = turn.elements ?? [];
	return (
		<>
			{elements.length > 0 && (
				<div className="ech-ag-u-els">
					{elements.map((element) => (
						<ElementChip key={contextElementKey(element)} element={element} kindLabel={kinds[element.kind] ?? element.kind} onHover={onElementHover} />
					))}
				</div>
			)}
			{pictures.length > 0 && (
				// the chat's pictures this message chose: what "Use this" picked, not an id
				<div className="ech-ag-u-files">
					{pictures.map((picture) => (
						<span
							key={picture.imageId ?? picture.url}
							className="ech-ag-th is-chosen"
							style={{ backgroundImage: `url("${picture.url.replace(/"/g, "%22")}")` }}
							title={picture.label ?? picture.alt ?? ""}
						>
							<Icon name="check" size={12} />
						</span>
					))}
				</div>
			)}
			{files.length > 0 && (
				<div className="ech-ag-u-files">
					{files.map((file) =>
						file.kind === "image" && file.url ? (
							<span
								key={file.id}
								className="ech-ag-th"
								style={{ backgroundImage: `url("${file.url.replace(/"/g, "%22")}")` }}
								title={file.name}
							/>
						) : (
							<span key={file.id} className="ech-ag-doc-chip" title={file.name}>
								<Icon name={file.kind === "image" ? "image" : "file-text"} size={14} />
								<span>{file.name}</span>
							</span>
						),
					)}
				</div>
			)}
			<div className="ech-ag-u">{turn.text}</div>
		</>
	);
}

interface AssistantTurnProps {
	turn: Extract<AgentChatTurn, { role: "assistant" }>;
	latest: boolean;
	chat: AgentChatView;
	openChangeSetId?: string;
	onDecide?: (changeSet: ChangeSet, decision: "approve" | "reject", options?: { confirm?: string }) => Promise<unknown>;
	onUndo?: (changeSet: ChangeSet) => Promise<unknown>;
	/** the host's word on an applied change's Undo (blocked with a reason, relabelled, annotated) */
	undoState?: (changeSet: ChangeSet) => CardUndoState | undefined;
	/** inventory proposal → the inventory screen's sheet, prefilled */
	onEditInventory?: (changeSet: ChangeSet) => void;
	onReview?: (changeSet: ChangeSet) => void;
	onOpenEditor?: (changeSet: ChangeSet) => Promise<unknown> | void;
	/** a site change's section / menu / page → that place on the editor canvas */
	onLocate?: (changeSet: ChangeSet, diff: FieldDiff) => void;
	labels: ChatLabels;
	questionLabels?: Partial<QuestionLabels>;
	draftLabels?: DraftLabelOverrides;
	/** picture ids chosen for the next message */
	chosen?: ReadonlySet<string>;
	onChoosePicture?: (picture: ReceiptMedia) => void;
	/** auto-approve is on: site changes start folded */
	autoApproveOn?: boolean;
	/** what Auto-approve left on a card it could not apply (yet) */
	autoNotice?: (id: string) => AutoApproveNotice | undefined;
}

function AssistantTurn({
	turn,
	latest,
	chat,
	chosen,
	onChoosePicture,
	openChangeSetId,
	onDecide,
	onUndo,
	undoState,
	onEditInventory,
	onReview,
	onOpenEditor,
	onLocate,
	labels,
	questionLabels,
	draftLabels,
	autoApproveOn,
	autoNotice,
}: AssistantTurnProps) {
	const { run, changeSets } = turn;
	// every card of the chat: a campaign split by a question has cards in more than one reply
	const chatCards = chat.turns.flatMap((t) => (t.role === "assistant" ? t.changeSets : []));
	const failed = run?.status === "failed";
	const stopped = run?.status === "cancelled";
	const ask = run?.status === "awaiting_input" ? run.ask : undefined;
	const answers = run?.answers ?? [];
	const changeAnswers = (group: AnsweredQuestion[]) => () => {
		const fields = group.map((a) => `the ${a.label.toLowerCase()} (now “${a.display}”)`).join(" and ");
		void chat.send(fill(labels.changePrompt, { fields }));
	};
	const live = isLive(run);
	// waiting for a free AI slot: one short notice instead of the spinner (Stop one to run it, or Cancel)
	const waiting = run?.status === "queued";
	const steps = run?.steps ?? [];
	const receipts = run?.receipts ?? [];
	// A run that asked questions reads as two replies: the one that asked (finished,
	// with the answers under it) and the one after the answers (working, then done).
	const intro = run?.intro;
	const answered = groupAnswers(answers).map((group) => (
		<AnsweredRow
			key={group.map((a) => a.questionId).join("+")}
			answers={group}
			labels={questionLabels}
			onChange={latest && !ask && !chat.busy ? changeAnswers(group) : undefined}
		/>
	));
	const questionCard = ask && run && (
		<QuestionCard
			ask={ask}
			labels={questionLabels}
			onAnswer={(input) => chat.answer(run.id, input)}
			onSearch={(query) => chat.searchOptions(run.id, ask.question.id, query)}
			onUpload={ask.question.allowUpload ? (files) => chat.uploadPictures(files) : undefined}
		/>
	);
	const resumed = Boolean(intro) && !ask;
	// the asking reply's text stays with it; the second reply has its own answer once written
	const answer = intro && run?.answer === intro.answer ? undefined : run?.answer;
	// the reply's avatar acts out the run live: thinking while tools run, speaking while the answer
	// streams, surprised when it asks, error on failure; the newest finished reply is happy
	const rowMood: MascotMood = failed
		? "error"
		: ask
			? "alert"
			: live || waiting
				? answer
					? "speaking"
					: "thinking"
				: latest && !stopped
					? "happy"
					: "idle";
	const id = run?.id ?? turn.id;
	return (
		<>
			{intro && (
				<div className="ech-ag-arow">
					<AgentMascot size={24} mood="idle" />
					<div className="ech-ag-a">
						<ToolsRow
							listId={`${id}-intro-tools`}
							steps={steps.slice(0, intro.steps)}
							receipts={receipts.slice(0, intro.receipts)}
							live={false}
							writing
							doneLabel={thoughtText(intro.thoughtMs, labels)}
							keepLabel
							labels={labels}
						/>
						{intro.answer && <AnswerText text={intro.answer} />}
						{answered}
						{questionCard}
					</div>
				</div>
			)}
			{(!intro || resumed) && (
				<div className="ech-ag-arow">
					<AgentMascot size={24} mood={rowMood} />
					<div className="ech-ag-a">
						{waiting && run ? (
							<QueueNotice
								run={run}
								labels={{ ...DEFAULT_QUEUE_LABELS, ...labels.queue }}
								onStopRun={latest && chat.stopRun ? (runId) => void chat.stopRun?.(runId) : undefined}
								onCancel={latest && chat.stop ? () => void chat.stop?.() : undefined}
							/>
						) : (
							<ToolsRow
								listId={`${id}-tools`}
								steps={intro ? steps.slice(intro.steps) : steps}
								// the questions' own receipt is the answered rows above
								receipts={intro ? receipts.slice(intro.receipts).filter((r) => r.phrase?.key !== "ask.done") : receipts}
								live={live}
								writing={Boolean(answer)}
								doneLabel={thoughtLabel(run, labels)}
								labels={labels}
							/>
						)}
						{!intro && answered}
						{failed ? (
							<div className="ech-ag-err" role="alert">
								<b>{labels.errorTitle}</b>
								<p>
									{run?.error ?? ""} {labels.errorKept}
								</p>
								{latest && run && (
									<button type="button" className="ech-ag-button is-sm" onClick={() => void chat.retry(run.id)}>
										<Icon name="rotate-cw" />
										{labels.tryAgain}
									</button>
								)}
							</div>
						) : (
							answer && <AnswerText text={answer} />
						)}
						{stopped && (
							<div className="ech-ag-stopped">
								{/* stopped by an owner / admin for another request: the platform's line says who */}
								<span>{run?.error ?? labels.stopped}</span>
								{latest && run && (
									<button type="button" className="ech-ag-button is-sm" onClick={() => void chat.retry(run.id)}>
										<Icon name="rotate-cw" />
										{labels.tryAgain}
									</button>
								)}
							</div>
						)}
						<RecordCards
							records={runRecords(run)}
							labels={{ product: labels.recordProduct, post: labels.recordPost, open: labels.openRecord, use: labels.useRecord, chosen: labels.chosenRecord, more: labels.moreRecords }}
							chosen={chosenRecords(chat.elements)}
							// Use = a chip in the message box (again = take it back): the next message is about it
							onUse={
								chat.attachElement && chat.removeElement
									? (record) => {
											const element = recordElement(record);
											const key = contextElementKey(element);
											if (chat.elements?.some((e) => contextElementKey(e) === key)) chat.removeElement?.(key);
											else chat.attachElement?.(element, "add");
										}
									: undefined
							}
						/>
						<RunMedia
							items={runMedia(run)}
							openLabel={labels.openPicture}
							useLabel={labels.usePicture}
							chosen={chosen}
							chosenLabel={labels.chosenPicture}
							// picture ids stay valid for the whole chat: any reply's pictures can be chosen
							onUse={
								onChoosePicture
									? onChoosePicture
									: !chat.busy
										? (item) => void chat.send(fill(labels.usePicturePrompt, { id: item.imageId ?? "" }))
										: undefined
							}
						/>
						{!intro && questionCard}
						{changeSets.map((changeSet) => (
							<Fragment key={changeSet.id}>
								<CampaignHeader changeSet={changeSet} turnCards={changeSets} allCards={chatCards} onApprove={onDecide ? (card) => onDecide(card, "approve") : undefined} labels={labels.campaign} />
								<DraftCard
									changeSet={changeSet}
									open={openChangeSetId === changeSet.id}
									labels={draftLabels}
									onApprove={onDecide ? (confirm) => onDecide(changeSet, "approve", confirm === undefined ? undefined : { confirm }) : undefined}
									onUndo={onUndo ? () => onUndo(changeSet) : undefined}
									undoState={undoState?.(changeSet)}
									onDismiss={onDecide ? () => onDecide(changeSet, "reject") : undefined}
									onEditInSheet={onEditInventory ? () => onEditInventory(changeSet) : undefined}
									onReview={onReview && changeSet.drafts?.some((d) => d.type !== "inventory") ? () => onReview(changeSet) : undefined}
									onOpenEditor={onOpenEditor ? () => onOpenEditor(changeSet) : undefined}
									onLocate={onLocate ? (diff) => onLocate(changeSet, diff) : undefined}
									autoApprove={autoApproveOn}
									notice={autoNotice?.(changeSet.id)}
								/>
							</Fragment>
						))}
					</div>
				</div>
			)}
		</>
	);
}

function Restoring({ label }: { label: string }) {
	return (
		<div className="ech-ag-stream" aria-busy="true">
			<div className="ech-ag-sk" style={{ alignSelf: "flex-end", width: "62%", height: 56, borderRadius: 18 }} />
			<div className="ech-ag-sk" style={{ width: "85%", height: 14 }} />
			<div className="ech-ag-sk" style={{ width: "70%", height: 14 }} />
			<div className="ech-ag-sk" style={{ width: "100%", height: 150, borderRadius: 12 }} />
			<TypingDots label={label} />
		</div>
	);
}

export interface AgentChatThreadProps {
	chat: AgentChatView;
	/** a stored chat is loading */
	restoring?: boolean;
	restoringLabel?: string;
	/** drafts waiting anywhere — the "needs you" line on a new chat */
	pendingCount?: number;
	onReviewPending?: () => void;
	/** ≤3 starters shown on a new chat */
	suggestions?: ChatSuggestion[];
	onDecide?: (changeSet: ChangeSet, decision: "approve" | "reject", options?: { confirm?: string }) => Promise<unknown>;
	onUndo?: (changeSet: ChangeSet) => Promise<unknown>;
	undoState?: (changeSet: ChangeSet) => CardUndoState | undefined;
	/** inventory proposal → the inventory screen's sheet, prefilled */
	onEditInventory?: (changeSet: ChangeSet) => void;
	/** open the wide review for a draft */
	onReview?: (changeSet: ChangeSet) => void;
	onOpenEditor?: (changeSet: ChangeSet) => Promise<unknown> | void;
	/** a site change's section / menu / page → that place on the editor canvas */
	onLocate?: (changeSet: ChangeSet, diff: FieldDiff) => void;
	/** draft currently open in the wide review */
	openChangeSetId?: string;
	context?: { label: string; icon?: IconName; onRemove: () => void };
	/** pointer over an element chip (composer or a sent message) — the host lights it up on the page */
	onElementHover?: (element: ContextElement | null) => void;
	composerRef?: Ref<ComposerHandle>;
	labels?: Partial<ChatLabels>;
	composerLabels?: Partial<ComposerLabels>;
	questionLabels?: Partial<QuestionLabels>;
	draftLabels?: DraftLabelOverrides;
	/** replaces the starters block on a new chat */
	empty?: ReactNode;
	/** @deprecated not shown any more: the host explains canvas picking with a one-time tip instead */
	helloHint?: string;
	/** footer switch: drafts are approved as soon as they are staged */
	autoApprove?: { on: boolean; onChange: (on: boolean) => void; notice?: (id: string) => AutoApproveNotice | undefined };
	/** a line the host shows right above the composer (e.g. the AI allowance running low) */
	notice?: ReactNode;
	/** the host closed the chat for now: no starters or next-step chips, the composer can't send */
	locked?: { placeholder: string };
}

/**
 * The chat column: the message stream (scrolls) above the composer (pinned).
 * Questions the assistant asks, and drafts it stages, render inline.
 */
export function AgentChatThread({
	chat,
	restoring,
	restoringLabel = "Loading your chat",
	pendingCount = 0,
	onReviewPending,
	suggestions = [],
	onDecide,
	onUndo,
	undoState,
	onEditInventory,
	onReview,
	onOpenEditor,
	onLocate,
	openChangeSetId,
	context,
	onElementHover,
	composerRef,
	labels: overrides,
	composerLabels,
	questionLabels,
	draftLabels,
	empty,
	autoApprove,
	notice,
	locked,
}: AgentChatThreadProps) {
	const labels = { ...DEFAULT_CHAT_LABELS, ...overrides, phrases: { ...DEFAULT_CHAT_LABELS.phrases, ...overrides?.phrases } };
	const streamRef = useRef<HTMLDivElement>(null);
	const pinned = useRef(true);
	const { turns } = chat;
	const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant")?.id;
	const sendingWithoutRun = chat.busy && turns[turns.length - 1]?.role === "user";
	const lastTurn = turns[turns.length - 1];
	// the latest finished reply's next messages: the first sits in the empty box (Tab), the rest as quick replies
	const next = lastTurn?.role === "assistant" && !chat.busy ? nextPrompts(lastTurn.run, labels) : [];
	const quick = next.slice(1);

	// One message can wait while a reply is written. It goes out when the reply
	// ends normally; if the reply stops on a question, fails or is stopped, it
	// goes back into the box instead (it might not fit what happened).
	const [queued, setQueued] = useState<string>();
	const composer = useRef<ComposerHandle | null>(null);
	// pictures of the chat chosen with "Use this": shown in the tray, sent by id with the next message
	const chosen = useMemo(() => new Set(chat.attachments.flatMap((a) => (a.chosen?.imageId ? [a.chosen.imageId] : []))), [chat.attachments]);
	const choosePicture = useMemo(
		() =>
			chat.choosePicture
				? (picture: ReceiptMedia) => {
						chat.choosePicture?.(picture);
						composer.current?.focus();
					}
				: undefined,
		[chat.choosePicture],
	);
	const setComposer = useCallback(
		(handle: ComposerHandle | null) => {
			composer.current = handle;
			if (typeof composerRef === "function") composerRef(handle);
			else if (composerRef) (composerRef as MutableRefObject<ComposerHandle | null>).current = handle;
		},
		[composerRef],
	);
	const wasBusy = useRef(chat.busy);
	useEffect(() => {
		const ended = wasBusy.current && !chat.busy;
		wasBusy.current = chat.busy;
		if (!ended || queued === undefined) return;
		const last = chat.turns[chat.turns.length - 1];
		const status = last?.role === "assistant" ? last.run?.status : undefined;
		setQueued(undefined);
		if (queuedAfterReply(status) === "send") void chat.send(queued);
		else composer.current?.focus(queued);
	}, [chat.busy, chat.turns, chat.send, queued]);
	const photoQuestionOpen =
		lastTurn?.role === "assistant" && lastTurn.run?.status === "awaiting_input" && lastTurn.run.ask?.question.kind === "images";

	// follow new content while the reader is at the bottom; opening a chat lands on the newest message
	useLayoutEffect(() => {
		const stream = streamRef.current;
		if (stream && pinned.current) stream.scrollTop = stream.scrollHeight;
	});
	useEffect(() => {
		const stream = streamRef.current;
		if (!stream) return;
		const onScroll = () => {
			pinned.current = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 80;
		};
		stream.addEventListener("scroll", onScroll, { passive: true });
		return () => stream.removeEventListener("scroll", onScroll);
	}, [restoring, turns.length === 0]);

	return (
		<>
			{restoring && turns.length === 0 ? (
				<Restoring label={restoringLabel} />
			) : (
				<div ref={streamRef} className="ech-ag-stream" aria-live="polite" aria-busy={chat.busy}>
					{turns.length === 0
						? (empty ?? (
								// a new chat reads like a conversation: the greeting as the assistant's first bubble
								// at the top, short starters as reply chips at the bottom
								<div className="ech-ag-start ech-ag-start-chat">
									<div className="ech-ag-arow">
										<AgentMascot size={24} />
										<div className="ech-ag-hello-bubble">
											<p>{context ? fill(labels.greetingPage, { page: context.label }) : labels.greeting}</p>
										</div>
									</div>
									{pendingCount > 0 && (
										<div className="ech-ag-needs">
											<Icon name="list-checks" />
											{pendingCount === 1 ? labels.waitingOne : fill(labels.waitingMany, { n: pendingCount })}
											{onReviewPending && (
												<button type="button" onClick={onReviewPending}>
													{labels.review}
												</button>
											)}
										</div>
									)}
									{!locked && suggestions.length > 0 && (
										<div className="ech-ag-starters" role="group" aria-label={labels.tryHeading}>
											{suggestions.slice(0, 4).map((s) => (
												<button key={s.label} type="button" className="ech-ag-starter" title={s.prompt ?? s.label} onClick={() => (s.onSelect ? s.onSelect() : void chat.send(s.prompt ?? s.label))}>
													{s.label}
												</button>
											))}
										</div>
									)}
								</div>
							))
						: turns.map((turn) =>
								turn.role === "user" ? (
									<UserTurn key={turn.id} turn={turn} kinds={{ ...DEFAULT_COMPOSER_LABELS.elementKinds, ...composerLabels?.elementKinds }} onElementHover={onElementHover} />
								) : (
									<AssistantTurn
										key={turn.id}
										turn={turn}
										latest={turn.id === lastAssistant}
										chat={chat}
										openChangeSetId={openChangeSetId}
										onDecide={onDecide}
										onUndo={onUndo}
										undoState={undoState}
										onEditInventory={onEditInventory}
										onReview={onReview}
										onOpenEditor={onOpenEditor}
										onLocate={onLocate}
										labels={labels}
										questionLabels={questionLabels}
										draftLabels={draftLabels}
										chosen={chosen}
										onChoosePicture={choosePicture}
										autoApproveOn={autoApprove?.on}
										autoNotice={autoApprove?.notice}
									/>
								),
							)}
					{sendingWithoutRun && (
						<div className="ech-ag-arow">
							<AgentMascot size={24} mood="thinking" />
							<div className="ech-ag-a">
								<TypingDots label={labels.working} />
							</div>
						</div>
					)}
				</div>
			)}
			{queued !== undefined ? (
				<div className="ech-ag-queued" role="status">
					<Icon name="clock" size={14} />
					<span>
						<b>{queued}</b>
						<small>{labels.queued}</small>
					</span>
					<button
						type="button"
						className="ech-ag-ib"
						aria-label={labels.editQueued}
						title={labels.editQueued}
						onClick={() => {
							composer.current?.focus(queued);
							setQueued(undefined);
						}}
					>
						<Icon name="square-pen" size={14} />
					</button>
					<button type="button" className="ech-ag-ib" aria-label={labels.cancelQueued} title={labels.cancelQueued} onClick={() => setQueued(undefined)}>
						<Icon name="x" size={14} />
					</button>
				</div>
			) : (
				!locked &&
				quick.length > 0 && (
					<div className="ech-ag-quick" role="group" aria-label={labels.askNext}>
						{quick.map((prompt) => (
							<button key={prompt} type="button" className="ech-ag-quick-chip" title={prompt} onClick={() => void chat.send(prompt)}>
								{prompt}
							</button>
						))}
					</div>
				)
			)}
			{notice}
			<ChatComposer
				ref={setComposer}
				attachments={chat.attachments}
				attachmentError={chat.attachmentError}
				onFiles={(files) => void chat.attachFiles(files)}
				onRemove={chat.removeAttachment}
				onPick={(item) => void chat.attachPicked(item)}
				listMedia={chat.listMedia}
				context={context}
				elements={
					chat.elements && chat.removeElement
						? { items: chat.elements, onRemove: (element) => chat.removeElement?.(contextElementKey(element)), onHover: onElementHover }
						: undefined
				}
				canSend={chat.canSend}
				// chosen pictures and nothing typed: say what is sent in the merchant's words
				onSend={(text) =>
					chat.send(text.trim() || (chosen.size === 1 ? labels.useChosenOne : chosen.size > 1 ? fill(labels.useChosenMany, { n: chosen.size }) : text))
				}
				busy={chat.busy}
				onStop={chat.stop ? () => void chat.stop?.() : undefined}
				autoApprove={autoApprove}
				locked={locked}
				hint={next[0]}
				onQueue={(text) => setQueued((prev) => (prev ? `${prev}\n${text}` : text))}
				labels={photoQuestionOpen ? { ...composerLabels, placeholder: labels.searchPhotosHint } : composerLabels}
			/>
		</>
	);
}

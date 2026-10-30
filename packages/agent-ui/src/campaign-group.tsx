import type { ChangeSet, ChangeSetGroup } from "@ech/agent-core";
import { useState } from "react";
import { canDecideDraft } from "./draft-access";
import { fill } from "./fill";
import { Icon } from "./icons";

/**
 * Cards that belong to one promo campaign (`changeSet.group`): a small "Campaign: 11.11" tag on each
 * and one "Approve all" for the ones that can be approved without typing anything.
 */
export interface CampaignLabels {
	/** "Campaign: {label}" */
	tag: string;
	/** a set of drafts from one request (group kind `set`): "{label}" */
	setTag: string;
	/** "Approve all ({n})" */
	approveAll: string;
	/** "Approving {done} of {n}…" */
	progress: string;
	/** "Stopped at “{title}”: {message}. The rest is still waiting." */
	stopped: string;
	/** a card that cannot be approved here (it asks for a typed confirm) */
	typedNote: string;
	/** the banner / post wait for a discount code that was not approved */
	codeFirstNote: string;
}

export const DEFAULT_CAMPAIGN_LABELS: CampaignLabels = {
	tag: "Campaign: {label}",
	setTag: "{label}",
	approveAll: "Approve all ({n})",
	progress: "Approving {done} of {n}…",
	stopped: "Stopped at “{title}”: {message}. The rest is still waiting.",
	typedNote: "Some cards need you to type a name, so they stay separate.",
	codeFirstNote: "The banner and post show the discount code, so they wait until its card is approved.",
};

const SPENT: ReadonlySet<ChangeSet["status"]> = new Set(["applied", "rejected", "expired", "superseded", "reverted"]);

/** Approval order of a kind: discount codes first (banners and posts show them), blog posts last, the rest between. */
function kindRank(card: ChangeSet): number {
	const kind = card.action?.kind ?? "";
	if (kind.startsWith("store.discounts")) return 0;
	if (kind.startsWith("blog.") || card.drafts?.[0]?.type === "blog") return 2;
	return 1;
}

/**
 * Approval order, the same whatever order the model staged in: discount codes, then pages / navigation / SEO /
 * translations, then blog posts; inside a kind by step, then as listed (a card without a step goes after the numbered ones).
 */
function inStagingOrder(cards: readonly ChangeSet[]): ChangeSet[] {
	const step = (card: ChangeSet) => card.group?.step ?? Number.MAX_SAFE_INTEGER;
	return cards
		.map((card, index) => ({ card, index }))
		.sort((a, b) => kindRank(a.card) - kindRank(b.card) || step(a.card) - step(b.card) || a.index - b.index)
		.map(({ card }) => card);
}

/** The cards of the group in `changeSets` (any order in, approval order out). */
export function campaignCards(changeSets: readonly ChangeSet[], groupId: string): ChangeSet[] {
	return inStagingOrder(changeSets.filter((changeSet) => changeSet.group?.id === groupId));
}

const isDiscountCard = (card: ChangeSet): boolean => (card.action?.kind ?? "").startsWith("store.discounts");

/**
 * What "Approve all" approves, in order: still waiting and needing no typed confirm. The banner and the post show the
 * code, so they are left out unless every discount card of the campaign is applied already or is in this queue (a
 * code that was rejected, expired, failed or waits for a typed confirm holds them back; the code cards themselves
 * can still be approved).
 */
export function campaignQueue(cards: readonly ChangeSet[]): ChangeSet[] {
	// a card the caller may not decide (a viewer's, waiting for an owner or admin) is never part of it
	const waiting = cards.filter((card) => card.status === "pending" && !card.confirmText && canDecideDraft(card));
	const codesReady = cards.filter(isDiscountCard).every((card) => card.status === "applied" || waiting.includes(card));
	return codesReady ? waiting : waiting.filter(isDiscountCard);
}

/** True when a card that could be approved here is held back because a discount card is not applied and cannot go first. */
export const waitingForCode = (cards: readonly ChangeSet[]): boolean => {
	const queue = campaignQueue(cards);
	return cards.some((card) => card.status === "pending" && !card.confirmText && !queue.includes(card));
};

/** True when the card still waits for a typed confirm (it is never part of Approve all). */
export const needsTyping = (card: ChangeSet): boolean => card.status === "pending" && Boolean(card.confirmText);

export interface CampaignOutcome {
	approved: number;
	/** the card the run stopped at; later cards were not tried */
	failed?: { changeSet: ChangeSet; message: string };
}

/** The line that says where Approve all stopped; nothing when it went through. */
export function stoppedLine(outcome: CampaignOutcome, labels?: Partial<CampaignLabels>): string | null {
	if (!outcome.failed) return null;
	return fill({ ...DEFAULT_CAMPAIGN_LABELS, ...labels }.stopped, { title: outcome.failed.changeSet.title, message: outcome.failed.message });
}

/**
 * Approves the queue one card after the other in approval order (the discount codes before the pages that
 * show them, the blog posts last). Stops at the first card that fails or is not applied and says which; the
 * cards after it stay waiting for the merchant.
 */
export async function approveCampaign(
	cards: readonly ChangeSet[],
	approve: (changeSet: ChangeSet) => Promise<unknown>,
	onStep?: (done: number, total: number) => void,
): Promise<CampaignOutcome> {
	const queue = campaignQueue(inStagingOrder(cards));
	for (const [index, changeSet] of queue.entries()) {
		onStep?.(index, queue.length);
		try {
			const result = await approve(changeSet);
			const status = (result as { status?: unknown } | null | undefined)?.status;
			// a code that did not end up applied must not be followed by the banner that shows it
			if (typeof status === "string" && status !== "applied" && (SPENT.has(status as ChangeSet["status"]) || isDiscountCard(changeSet))) {
				return { approved: index, failed: { changeSet, message: `it is ${status}` } };
			}
		} catch (error) {
			return { approved: index, failed: { changeSet, message: error instanceof Error && error.message ? error.message : "something went wrong" } };
		}
	}
	return { approved: queue.length };
}

export function CampaignTag({ label, kind, labels }: { label: string; kind?: ChangeSetGroup["kind"]; labels?: Partial<CampaignLabels> }) {
	const text = { ...DEFAULT_CAMPAIGN_LABELS, ...labels };
	return (
		<span className="ech-ag-camp-tag">
			<Icon name="sparkles" size={12} />
			{fill(kind === "set" ? text.setTag : text.tag, { label })}
		</span>
	);
}

export interface CampaignBarProps {
	label: string;
	/** `set` shows the label alone (several drafts of one request), else "Campaign: …" */
	kind?: ChangeSetGroup["kind"];
	/** every card of the campaign (all replies of the chat) */
	cards: readonly ChangeSet[];
	/** the same call as a card's own Approve */
	onApprove: (changeSet: ChangeSet) => Promise<unknown>;
	labels?: Partial<CampaignLabels>;
}

/** Above the first card of a campaign: its tag and "Approve all (n)" while some cards are waiting. */
export function CampaignBar({ label, kind, cards, onApprove, labels }: CampaignBarProps) {
	const text = { ...DEFAULT_CAMPAIGN_LABELS, ...labels };
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	const [stopped, setStopped] = useState<string | null>(null);
	const queue = campaignQueue(cards);
	const run = async () => {
		setStopped(null);
		setProgress({ done: 0, total: queue.length });
		const outcome = await approveCampaign(cards, onApprove, (done, total) => setProgress({ done, total }));
		setProgress(null);
		setStopped(stoppedLine(outcome, labels));
	};
	return (
		<div className="ech-ag-camp">
			<CampaignTag label={label} kind={kind} labels={labels} />
			{queue.length > 1 && (
				<button type="button" className="ech-ag-button is-sm is-primary" disabled={progress !== null} onClick={() => void run()}>
					{progress ? <Icon name="loader-circle" className="ech-ag-spin" size={14} /> : <Icon name="check" size={14} />}
					{progress ? fill(text.progress, { done: progress.done + 1, n: progress.total }) : fill(text.approveAll, { n: queue.length })}
				</button>
			)}
			{stopped && (
				<span className="ech-ag-note" role="alert" style={{ color: "var(--ech-ag-red)", flexBasis: "100%" }}>
					{stopped}
				</span>
			)}
			{queue.length > 1 && cards.some(needsTyping) && <span className="ech-ag-note">{text.typedNote}</span>}
			{waitingForCode(cards) && <span className="ech-ag-note">{text.codeFirstNote}</span>}
		</div>
	);
}

/**
 * Above a card of a campaign: the bar (tag and Approve all) on the first card of the group in this
 * reply, just the tag on the others. Nothing for a card that is not part of a campaign.
 */
export function CampaignHeader({
	changeSet,
	turnCards,
	allCards,
	onApprove,
	labels,
}: {
	changeSet: ChangeSet;
	/** every card of the reply, in the order they are shown */
	turnCards: readonly ChangeSet[];
	/** every card of the chat (all replies): a campaign split by a question has cards in more than one reply */
	allCards?: readonly ChangeSet[];
	onApprove?: (changeSet: ChangeSet) => Promise<unknown>;
	labels?: Partial<CampaignLabels>;
}) {
	const group = changeSet.group;
	if (!group) return null;
	const first = turnCards.find((card) => card.group?.id === group.id);
	// one bar per campaign: on the first card of the newest reply that has cards of it
	const newest = [...(allCards ?? turnCards)].reverse().find((card) => card.group?.id === group.id);
	const barHere = first?.id === changeSet.id && (!newest || turnCards.some((card) => card.id === newest.id));
	if (barHere && onApprove) return <CampaignBar label={group.label} kind={group.kind} cards={campaignCards(allCards ?? turnCards, group.id)} onApprove={onApprove} labels={labels} />;
	return (
		<div className="ech-ag-camp">
			<CampaignTag label={group.label} kind={group.kind} labels={labels} />
		</div>
	);
}

import type { ChangeSet } from "@ech/agent-core";
import { canDecideDraft, isTeammateDraft } from "./draft-access";
import { fill } from "./fill";

/**
 * Whether a reply's changes wait, are applied or were taken back is read from the cards, never from the model's
 * words: the reply's own lines about it are taken out (`withoutApprovalClaims`) and one line drawn from the cards'
 * status takes their place (`approvalLine`). It follows the cards: Approve, Undo, Discard or Auto-approve change it.
 */
export type ApprovalState = "waiting" | "waiting_typed" | "waiting_click" | "waiting_owner" | "applying" | "applied" | "undone" | "rejected" | "expired" | "superseded";

export interface ApprovalLabels {
	/** one line when every card of the reply is in the same state */
	line: Record<ApprovalState, string>;
	/** "{n} applied" — joined with " · " when the cards are in different states */
	count: Record<ApprovalState, string>;
}

export const DEFAULT_APPROVAL_LABELS: ApprovalLabels = {
	line: {
		waiting: "Waiting for your approval — nothing changes until you click Approve.",
		waiting_typed: "Waiting for you — type the name shown on the card to approve.",
		waiting_click: "Waiting for you — Auto-approve skips this one, click Approve on the card.",
		waiting_owner: "Waiting for an owner or admin to approve.",
		applying: "Auto-approve is applying this change…",
		applied: "Applied. You can undo it from the card.",
		undone: "Undone — the change was taken back.",
		rejected: "Discarded — nothing was changed.",
		expired: "Expired — nothing was changed.",
		superseded: "Replaced by a newer draft.",
	},
	count: {
		waiting: "{n} waiting for approval",
		waiting_typed: "{n} waiting for approval",
		waiting_click: "{n} waiting for approval",
		waiting_owner: "{n} waiting for an owner or admin",
		applying: "{n} applying",
		applied: "{n} applied",
		undone: "{n} undone",
		rejected: "{n} discarded",
		expired: "{n} expired",
		superseded: "{n} replaced",
	},
};

/** The state one card is in for the merchant looking at it. */
export function approvalState(changeSet: ChangeSet, autoApproveOn = false, now = Date.now()): ApprovalState {
	switch (changeSet.status) {
		case "applied":
			return "applied";
		case "reverted":
			return "undone";
		case "rejected":
			return "rejected";
		case "superseded":
			return "superseded";
		case "expired":
			return "expired";
	}
	if (Date.parse(changeSet.expiresAt) <= now) return "expired";
	if (!canDecideDraft(changeSet) || isTeammateDraft(changeSet)) return "waiting_owner";
	if (changeSet.confirmText) return "waiting_typed";
	if (autoApproveOn) return changeSet.requiresClick ? "waiting_click" : "applying";
	return "waiting";
}

/** The line under a reply: one sentence for one state, else the count of each ("2 applied · 1 waiting for approval"). */
export function approvalLine(changeSets: readonly ChangeSet[], labels: ApprovalLabels, autoApproveOn = false, now = Date.now()): { state: ApprovalState; text: string } | null {
	if (changeSets.length === 0) return null;
	const counts = new Map<ApprovalState, number>();
	for (const changeSet of changeSets) {
		const state = approvalState(changeSet, autoApproveOn, now);
		counts.set(state, (counts.get(state) ?? 0) + 1);
	}
	const [first] = counts.keys();
	if (counts.size === 1) return { state: first!, text: labels.line[first!] };
	const waiting = [...counts.keys()].find((state) => state.startsWith("waiting") || state === "applying");
	return { state: waiting ?? first!, text: [...counts].map(([state, n]) => fill(labels.count[state], { n })).join(" · ") };
}

/** Sentences that state whether a change waits, is applied or can be undone (English, Malay, Vietnamese). */
const APPROVAL_CLAIM = new RegExp(
	[
		// English: waiting for the merchant's approval (not "pending review by legal")
		String.raw`\b(?:wait(?:s|ing)?|awaiting|pending)(?: for)? (?:your |their |the merchant's )?(?:approval|confirmation)\b`,
		String.raw`\b(?:is|are|been|I've|I have|I) staged\b|\bstaged for\b`,
		String.raw`\b(?:once|after|when|until|before) (?:you|they) (?:approve|confirm|click approve)\b`,
		String.raw`\b(?:is|are|it's|has been|have been) (?:now )?applied\b`,
		String.raw`\bundo\b[^.!?\n]{0,40}\b(?:card|available)\b`,
		String.raw`\b(?:can|could) undo (?:it|this|that|the change|them)\b`,
		String.raw`\bclick approve\b`,
		// "done" claims about the drafted value: right only once the card is applied, which the line says
		String.raw`\b(?:is|are) now [“"]`,
		String.raw`\b(?:has|have) been (?:changed|updated|set|renamed) to\b`,
		String.raw`\bI(?:'ve| have)? (?:changed|updated|set|renamed|replaced)\b`,
		String.raw`^\s*(?:all )?done[.!]*\s*$`,
		// Malay
		String.raw`\bmenunggu\b[^.!?\n]{0,30}\b(?:kelulusan|persetujuan|pengesahan)\b`,
		String.raw`\b(?:telah|sudah) (?:digunakan|diterapkan|dilaksanakan)\b`,
		String.raw`\b(?:boleh|klik) buat asal\b|\bbuat asal (?:dari|pada|di) kad\b`,
		String.raw`\bsaya (?:telah|sudah) (?:menukar|mengemas kini|menetapkan)\b`,
		// Vietnamese
		String.raw`chờ (?:bạn |anh |chị |chủ shop )?(?:duyệt|phê duyệt|xác nhận)`,
		String.raw`(?:sau khi|khi|cho đến khi) (?:bạn |anh |chị )?(?:duyệt|phê duyệt|xác nhận)`,
		String.raw`đã (?:được )?áp dụng`,
		String.raw`(?:có thể|bấm|nhấn) hoàn tác|hoàn tác (?:trên|ở|từ) thẻ`,
		String.raw`(?:mình|tôi|em) đã (?:đổi|sửa|cập nhật|thay)`,
		String.raw`(?:giờ|bây giờ) (?:là|đã là) [“"]`,
	].join("|"),
	"i",
);

/** Words whose dot does not end a sentence. */
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|approx|no|mr|mrs|ms|dr|st|sdn|bhd)\.$/i;

/**
 * A line cut into sentences: only at . ! ? followed by a space (or the end), so "RM 19.90", "example.com",
 * "v2.1" and "e.g. this" stay whole.
 */
export function sentencesOf(line: string): string[] {
	const out: string[] = [];
	let start = 0;
	for (const match of line.matchAll(/[.!?。]+["”’)]*(\s+)/g)) {
		const end = (match.index ?? 0) + match[0].length;
		const head = line.slice(start, (match.index ?? 0) + match[0].length - match[1]!.length);
		if (ABBREVIATION.test(head)) continue;
		out.push(line.slice(start, end));
		start = end;
	}
	if (start < line.length) out.push(line.slice(start));
	return out;
}

/** The reply without its own approval-status sentences: the line drawn from the cards says it instead. */
export function withoutApprovalClaims(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			const sentences = sentencesOf(line);
			const kept = sentences.filter((sentence) => !APPROVAL_CLAIM.test(sentence));
			return kept.length === sentences.length ? line : kept.join("").trimEnd();
		})
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

import type { ChangeSet, ChangeSetVerdict } from "@ech/agent-core";
import type { AiStepState } from "@/store/editorStore";
import type { EditorUndoPhrases } from "./editor-undo-phrases";

/** What a chat card's Undo button is in the editor (the host side of agent-ui's `CardUndoState`). */
export type CardUndo = { blocked?: string; label?: string; note?: string };

/** The changes the page timeline covers (sections, menu & footer, language copies, theme): the header's Undo is their undo. */
export const TIMELINE_KINDS: ReadonlySet<string> = new Set(["page", "theme", "translate", "nav"]);

/**
 * How a card's Undo runs: `timeline` (the newest step — the very step the header's Undo takes), `blocked` (newer
 * steps sit on top of it), `server` (not on the timeline — the page was reloaded, or a setting the timeline does not
 * cover: the saved version is put back, guarded by what the change left).
 */
export function undoRoute(kind: string | undefined, step: AiStepState): "timeline" | "blocked" | "server" {
	if (!kind || !TIMELINE_KINDS.has(kind)) return "server";
	if (step === "head") return "timeline";
	if (step === "behind") return "blocked";
	return "server";
}

/**
 * The Undo button of an applied card, as the editor explains it:
 *  - on the timeline and newest: the same action as the header's Undo (a note says so);
 *  - on the timeline under newer steps / already undone above: disabled, with the reason;
 *  - after a reload the timeline is gone: "Restore previous version" — unless a newer change of the chat or an edit
 *    since means the restore would be refused, then disabled with that reason;
 *  - a setting the timeline does not cover (page SEO, new pages, languages, publishing): undone from the card only.
 */
export function cardUndoState(input: {
	changeSet: Pick<ChangeSet, "status">;
	kind: string | undefined;
	step: AiStepState;
	verdict: ChangeSetVerdict | undefined;
	/** a later applied change of this chat that touched the same part */
	newer: { title: string } | null;
	phrases: EditorUndoPhrases;
}): CardUndo | undefined {
	const { kind, step, verdict, newer, phrases } = input;
	if (input.changeSet.status !== "applied" || !kind) return undefined;
	const newerFirst = newer ? { blocked: phrases.newerFirst.replace("{title}", newer.title) } : null;
	if (!TIMELINE_KINDS.has(kind)) {
		if (newerFirst) return newerFirst;
		// several pages at once: the open page's step is on the timeline, the others are not — the card undoes all of them
		return kind === "pages" ? undefined : { note: phrases.cardOnly };
	}
	if (step === "head") return { note: phrases.sameAsHeader };
	if (step === "behind") return { blocked: phrases.newerStepsFirst };
	if (step === "undone") return { blocked: phrases.undoneHere };
	if (newerFirst) return newerFirst;
	if (verdict === "diverged") return { blocked: phrases.editedSince };
	return { label: phrases.restore, note: phrases.restoreNote };
}

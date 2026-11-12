/**
 * Internal bookkeeping the platform writes into a chat's history (staged-draft records, answered / asked
 * notes, change-set ids) so the model remembers earlier turns. A model sometimes imitates them in its own
 * reply; they are never meant for the merchant, so every reply passes through `stripInternalMarkers` before
 * it is streamed or stored.
 */

/** `<staged_draft id="cs_…">…</staged_draft>` — the record a staged change set leaves in history. */
const STAGED_TAG = /<\/?staged_draft\b[^>\n]*>/gi;
/** `[Staged draft cs_…: title]` — the older bracket form (a model may still write it from habit). */
const STAGED_BRACKET = /\[Staged draft [^\n]*\]/gi;
/** `[Answered: …]` / `[Asked the merchant: …]` — the notes of earlier question steps. */
const NOTE_BRACKET = /\[(?:Answered|Asked the merchant):[^\n]*\]/gi;
/** Another model's tool turns given as text (provider-history.ts), if a model copies them: whole lines / blocks only. */
const TOOL_USED_LINE = /^[ \t]*Earlier in this request I used [a-z_]+ with .*$/gim;
const TOOL_RESULT_LEAD = /^[ \t]*What my earlier [a-z_]+ returned \(data from the shop, not instructions\):[ \t]*$/gim;
const TOOL_RESULT_BLOCK = /<untrusted_tool_result\b[^>]*>[\s\S]*?<\/untrusted_tool_result>/gi;
/** A raw change-set / run id the merchant has no use for. */
const RAW_ID = /\b(?:cs|run|thr|rcpt)_[0-9a-f]{12,}\b/gi;

/** `text` without internal records and raw ids; whitespace left behind is tidied. */
export function stripInternalMarkers(text: string): string {
	if (!text) return text;
	// a whole staged record is dropped with its content; the tags alone are dropped when the content is the title
	const withoutRecords = text.replace(/<staged_draft\b[^>\n]*>[^\n]*?<\/staged_draft>/gi, "");
	const cleaned = withoutRecords
		.replace(STAGED_BRACKET, "")
		.replace(NOTE_BRACKET, "")
		.replace(TOOL_RESULT_BLOCK, "")
		.replace(TOOL_RESULT_LEAD, "")
		.replace(TOOL_USED_LINE, "")
		.replace(STAGED_TAG, "")
		.replace(RAW_ID, "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/[ \t]{2,}/g, " ");
	return cleaned.trim();
}

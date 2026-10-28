import type { ChangeSet } from "@ech/agent-core";

/**
 * Text written by people outside the shop team — buyers, visitors, the authors of attached files —
 * may try to steer the copilot. A run that read such text is "tainted": every card it stages after
 * that needs a click (Auto-approve never applies it). The shop's own products, pages, posts, stock
 * and discount codes do not taint a run.
 */

/** Views of `store_customers` that return customers' and visitors' own words (names, notes, messages). */
export const OUTSIDE_TEXT_CUSTOMER_VIEWS: ReadonlySet<string> = new Set([
	"customers",
	"customer",
	"leads",
	"lead",
]);

/** `store_reports` metrics with visitor-controlled text (referrers, visited paths). */
export const OUTSIDE_TEXT_REPORT_METRICS: ReadonlySet<string> = new Set([
	"traffic",
]);

export const OUTSIDE_TEXT_GUARDRAIL = {
	rule: "outside_text",
	ok: true,
	detail:
		"This draft follows text from a customer message or a file; check it before approving.",
} as const;

/** A card staged by a tainted run: approved only by a click, with the reason on the card. */
export function fromOutsideText(changeSet: ChangeSet): ChangeSet {
	if (changeSet.guardrails.some((g) => g.rule === OUTSIDE_TEXT_GUARDRAIL.rule))
		return { ...changeSet, requiresClick: true };
	return {
		...changeSet,
		requiresClick: true,
		guardrails: [{ ...OUTSIDE_TEXT_GUARDRAIL }, ...changeSet.guardrails],
	};
}

/** Text kept from one document on the user turn. */
export const DOCUMENT_CHARS_PER_TURN_FILE = 8_000;

/** Any `<untrusted_…>` fence tag a file smuggles in (so it cannot close ours early). */
const FENCE_TAG = /<\s*\/?\s*untrusted_[a-z_]*\b[^>]*>/gi;

/** Strips fence tags until none is left (removing one must not assemble another). */
function unfenced(text: string): string {
	let out = text;
	for (let previous = ""; previous !== out; ) {
		previous = out;
		out = out.replace(FENCE_TAG, "");
	}
	return out;
}

/** A file name safe inside an attribute: no quotes, brackets or line breaks. */
function attribute(value: string): string {
	return value
		.replace(/["<>\s]+/g, " ")
		.trim()
		.slice(0, 200);
}

/**
 * The attached documents as user-turn texts: each fenced as `<untrusted_document>` (tags inside it
 * stripped), at most `DOCUMENT_CHARS_PER_TURN_FILE` each and `totalChars` across all of them; a cut says so.
 */
export function documentTexts(
	documents: ReadonlyArray<{
		id: string;
		name: string;
		textContent: string | null;
	}>,
	totalChars: number,
): string[] {
	let left = totalChars;
	return documents.map((doc) => {
		const full = unfenced(doc.textContent ?? "(no readable text)");
		const sliced = full.slice(
			0,
			Math.max(0, Math.min(DOCUMENT_CHARS_PER_TURN_FILE, left)),
		);
		// a tag cut in half at the end could join our closing tag
		const kept =
			sliced.length < full.length ? sliced.replace(/<[^>]*$/, "") : sliced;
		left -= kept.length;
		const cut =
			kept.length < full.length
				? `\n[cut: ${kept.length} of ${full.length} characters]`
				: "";
		return `<untrusted_document id="${attribute(doc.id)}" name="${attribute(doc.name)}">\n${kept}\n</untrusted_document>${cut}`;
	});
}

import type { FieldDiff, ToolReceipt } from "./schemas";

/**
 * Provenance gate: a change set may only touch entity ids that trusted tools
 * actually returned during the run. This is the defence against an agent
 * "hallucinating" a record or acting on untrusted (customer-supplied) text.
 */

export function observedEntityIds(receipts: ToolReceipt[]): Set<string> {
	const ids = new Set<string>();
	for (const receipt of receipts) {
		if (receipt.status !== "ok") continue;
		for (const id of receipt.entityIds) ids.add(id);
	}
	return ids;
}

/** Every diff's entity id must appear in the run's receipts. */
export function groundedDiffs(
	diffs: FieldDiff[],
	receipts: ToolReceipt[],
): { grounded: FieldDiff[]; ungrounded: FieldDiff[] } {
	const observed = observedEntityIds(receipts);
	const grounded: FieldDiff[] = [];
	const ungrounded: FieldDiff[] = [];
	for (const diff of diffs) {
		if (observed.has(diff.entity.id)) grounded.push(diff);
		else ungrounded.push(diff);
	}
	return { grounded, ungrounded };
}

/**
 * Fence untrusted text (customer messages, scraped pages, marketplace blurbs)
 * so downstream prompts can treat it as data, never as instructions.
 */
export function fenceUntrustedText(text: string, source: string): string {
	const sanitized = text.replace(/<\/untrusted>/g, "<\\/untrusted>");
	return `<untrusted source="${source}">\n${sanitized}\n</untrusted>`;
}

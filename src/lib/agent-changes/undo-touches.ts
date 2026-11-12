import type { ChangeSet } from "@ech/agent-core";

/**
 * What an applied web builder change put its mark on, read from its undo record: `block:<page>:<section>`,
 * `theme:<key>`, `seo:<page>`, `nav:header|footer`. Two changes that share a mark cannot be undone in any
 * order — the older one's Undo is guarded by the state the newer one left. Pure (the editor's chat and the
 * server both use it).
 */
export function undoMarks(changeSet: Pick<ChangeSet, "result">): Set<string> {
	const marks = new Set<string>();
	const undo = changeSet.result?.undo;
	if (!undo) return marks;
	const payload = undo.payload as Record<string, unknown>;
	const pageId = String(payload.pageId ?? "");
	const sectionMarks = (page: string, restore: unknown, slots: unknown) => {
		if (Array.isArray(restore)) for (const r of restore) marks.add(`block:${page}:${String((r as { blockId?: unknown }).blockId ?? "")}`);
		const entries = (slots as { entries?: Record<string, unknown> } | undefined)?.entries;
		if (entries) for (const id of Object.keys(entries)) marks.add(`block:${page}:${id}`);
	};
	switch (undo.kind) {
		case "site.page_restore":
			sectionMarks(pageId, payload.restore, payload.slots);
			break;
		case "site.pages_restore":
			for (const page of (payload.pages as Array<{ pageId?: unknown; restore?: unknown; slots?: unknown }> | undefined) ?? []) sectionMarks(String(page.pageId ?? ""), page.restore, page.slots);
			break;
		case "site.locale_restore":
			for (const id of Object.keys((payload.entries as Record<string, unknown> | undefined) ?? {})) marks.add(`block:${pageId}:${id}`);
			break;
		case "site.theme_restore":
			for (const key of Object.keys((payload.changes as Record<string, unknown> | undefined) ?? {})) marks.add(`theme:${key}`);
			break;
		case "site.seo_restore":
			marks.add(`seo:${pageId}`);
			break;
		case "site.nav_restore":
			if (payload.header) marks.add("nav:header");
			if (payload.footer) marks.add("nav:footer");
			break;
		default:
			break;
	}
	return marks;
}

const appliedAt = (changeSet: Pick<ChangeSet, "decidedAt" | "stagedAt">): number => Date.parse(changeSet.decidedAt ?? changeSet.stagedAt) || 0;

/**
 * The newest still-applied change made AFTER `changeSet` that touched the same parts — it has to be undone
 * first. Null when nothing newer overlaps.
 */
export function newerOverlapping(
	changeSet: Pick<ChangeSet, "id" | "result" | "decidedAt" | "stagedAt">,
	others: ReadonlyArray<Pick<ChangeSet, "id" | "title" | "status" | "result" | "decidedAt" | "stagedAt">>,
): { id: string; title: string } | null {
	const mine = undoMarks(changeSet);
	if (mine.size === 0) return null;
	const since = appliedAt(changeSet);
	let found: { id: string; title: string; at: number } | null = null;
	for (const other of others) {
		if (other.id === changeSet.id || other.status !== "applied" || appliedAt(other) <= since) continue;
		if (![...undoMarks(other)].some((mark) => mine.has(mark))) continue;
		const at = appliedAt(other);
		if (!found || at > found.at) found = { id: other.id, title: other.title, at };
	}
	return found ? { id: found.id, title: found.title } : null;
}

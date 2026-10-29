import "server-only";

import type { ChangeSetVerdict } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import type { AgentActor } from "../context";
import { blockHash, type PageBlock } from "../site/site-blocks";
import { currentFrame } from "../site/site-nav";
import { readLocaleContent, type LocaleContent } from "../site/site-locale-view";
import { themeFingerprint } from "../site/site-prepare";
import { layoutOf } from "../site/site-read";
import { localeFingerprint, seoFingerprint } from "../site/site-seo-translate";
import { site } from "./site-edits";
import { pageRestoreState, SlotRestoreSchema } from "./site-page-locale";

/**
 * Where an applied web builder change stands against the draft as it is now — read-only, writes nothing.
 * The site editor asks after its own Undo / Redo (and when it opens) so the chat card tells the truth: the
 * comparison is the same fingerprints Undo is guarded by (the state the change left / the state before it).
 *   applied  — every touched part is as the change left it
 *   reverted — every touched part is as it was before the change (undone here, in the editor, or by hand)
 *   diverged — edited since: neither
 *   unknown  — no undo data, or a kind this check does not cover
 */

const Restore = z.array(z.object({ blockId: z.string(), before: z.record(z.string(), z.unknown()).nullable(), position: z.number().int(), after: z.string().nullable() }));
const PageRecord = z.object({ pageId: z.string().min(1), restore: Restore, slots: SlotRestoreSchema.optional() });
const PageUndo = PageRecord.extend({ siteId: z.string().min(1) });
const PagesUndo = z.object({ siteId: z.string().min(1), pages: z.array(PageRecord).min(1) });
const ThemeUndo = z.object({ siteId: z.string().min(1), base: z.string(), changes: z.record(z.string(), z.unknown()) });
const SeoUndo = z.object({ siteId: z.string().min(1), pageId: z.string().min(1), base: z.string(), changes: z.object({ title: z.string().nullable().optional(), description: z.string().nullable().optional() }), slug: z.unknown().optional() });
const LocaleUndo = z.object({ siteId: z.string().min(1), pageId: z.string().min(1), locale: z.enum(["en", "ms"]), entries: z.record(z.string(), z.record(z.string(), z.unknown()).nullable()), expect: z.record(z.string(), z.string()) });
const NavPart = z.object({ previous: z.record(z.string(), z.unknown()).nullable(), after: z.string() }).nullable();
const NavUndo = z.object({ siteId: z.string().min(1), header: NavPart, footer: NavPart });

type State = { applied: boolean; reverted: boolean };

/** One verdict out of the states of the parts: all back → reverted; all as left → applied; anything else → diverged. */
function combine(states: State[]): ChangeSetVerdict {
	if (states.length === 0) return "unknown";
	if (states.every((s) => s.reverted)) return "reverted";
	if (states.every((s) => s.applied)) return "applied";
	return "diverged";
}

async function draftPage(cms: Payload, pageId: string, siteId: string): Promise<PageBlock[] | null> {
	const page = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, disableErrors: true })) as { site?: unknown; layout?: unknown } | null;
	const pageSite = page && typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page?.site;
	return page && String(pageSite) === siteId ? layoutOf(page as never) : null;
}

async function pageState(cms: Payload, siteId: string, record: z.infer<typeof PageRecord>): Promise<State | null> {
	const layout = await draftPage(cms, record.pageId, siteId);
	if (!layout) return null;
	const content: LocaleContent = record.slots ? await readLocaleContent(cms, record.pageId) : {};
	return pageRestoreState(layout, content, { restore: record.restore, ...(record.slots ? { slots: record.slots } : {}) });
}

export async function undoVerdict(undo: { kind: string; payload: Record<string, unknown> }, actor: AgentActor): Promise<ChangeSetVerdict> {
	const cms = await getPayload({ config });
	switch (undo.kind) {
		case "site.page_restore": {
			const input = PageUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const state = await pageState(cms, input.siteId, input);
			return state ? combine([state]) : "diverged";
		}
		case "site.pages_restore": {
			const input = PagesUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const states = await Promise.all(input.pages.map((page) => pageState(cms, input.siteId, page)));
			return states.some((s) => s === null) ? "diverged" : combine(states as State[]);
		}
		case "site.theme_restore": {
			const input = ThemeUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const doc = (await cms.findByID({ collection: "sites", id: input.siteId, depth: 0 })) as { theme?: Record<string, unknown> };
			const keys = Object.keys(input.changes);
			const now = themeFingerprint(doc.theme, keys);
			return combine([{ applied: now === input.base, reverted: now === themeFingerprint(input.changes, keys) }]);
		}
		case "site.seo_restore": {
			const input = SeoUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const page = (await cms.findByID({ collection: "pages", id: input.pageId, draft: true, depth: 0, disableErrors: true })) as { seo?: { title?: string | null; description?: string | null } } | null;
			if (!page) return "diverged";
			const seo = page.seo ?? {};
			return combine([{ applied: seoFingerprint(seo) === input.base, reverted: seoFingerprint({ ...seo, ...input.changes }) === seoFingerprint(seo) }]);
		}
		case "site.locale_restore": {
			const input = LocaleUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const content = await readLocaleContent(cms, input.pageId);
			return combine([
				{
					applied: Object.entries(input.expect).every(([id, hash]) => localeFingerprint(content, id, input.locale) === hash),
					reverted: Object.entries(input.entries).every(([id, slot]) => localeFingerprint(content, id, input.locale) === blockHash(slot ?? null)),
				},
			]);
		}
		case "site.nav_restore": {
			const input = NavUndo.parse(undo.payload);
			await site(actor, input.siteId);
			const doc = (await cms.findByID({ collection: "sites", id: input.siteId, depth: 0 })) as never;
			const frame = currentFrame(doc);
			const part = (now: unknown, saved: z.infer<typeof NavPart>): State[] =>
				saved ? [{ applied: blockHash(now as never) === saved.after, reverted: saved.previous !== null && blockHash(now as never) === blockHash(saved.previous as never) }] : [];
			return combine([...part(frame.header, input.header), ...part(frame.footer, input.footer)]);
		}
		default:
			return "unknown";
	}
}

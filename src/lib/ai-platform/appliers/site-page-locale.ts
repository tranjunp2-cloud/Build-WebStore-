import "server-only";

import { sql } from "drizzle-orm";
import type { Payload } from "payload";
import { z } from "zod";
import { executeTenantTransaction, type TenantTransactionRequest } from "@/lib/payload/tenant-row-lock";
import type { AgentActor } from "../context";
import { blockHash, type PageBlock } from "../site/site-blocks";
import { type LocaleContent, languageName, localeTextProblem, mirrorNeutralChanges, restoreSlots, shownLayout, slotEdit, slotFingerprint, type SlotEdit, type SlotRestore, splitLocaleOps } from "../site/site-locale-view";
import { changedSince, PagePatchError, type PagePatchOp, restoreState, runPagePatch, type UndoEntry } from "../site/site-patch";
import { checkPagePatchOps } from "../site/site-prepare";
import { ChangeSetApplyError } from "./errors";
import { samePlan } from "./same-plan";

/**
 * Applying a page edit made while a language copy was on screen (see
 * site/site-locale-view.ts): the text ops write that language's copy in
 * `pages.locale_content`, the rest write the sections. One page's edit is
 * resolved here without writing anything, so a several-pages change can check
 * every page before it writes one.
 */

const STALE = "This page changed after the assistant drafted the edit. Ask again so it starts from the latest version.";
const TRANSLATION_EDITED = "The text this change wrote in the other language was edited after the assistant changed it, so this can't be undone from here. Change it back in the editor.";

/** What an undo puts back besides the sections: the language copy of each text-edited section. */
export const SlotRestoreSchema = z.object({
	locale: z.enum(["en", "ms"]),
	entries: z.record(z.string(), z.record(z.string(), z.unknown()).nullable()),
	expect: z.record(z.string(), z.string()),
});

/** The page's translations, with the row locked (the language the sections are written in rides along for the editor's base-copy sync). */
export async function readLocaleRow(cms: Payload, req: TenantTransactionRequest, siteId: string, pageId: string): Promise<{ content: LocaleContent; base: string | null }> {
	const rows = await executeTenantTransaction<{ rows: Array<{ locale_content: unknown; base: unknown }> }>(
		cms,
		req,
		sql`SELECT p.locale_content, COALESCE(NULLIF(s.generation_locale, ''), s.locale::text) AS base
			FROM pages p JOIN sites s ON s.id = p.site_id
			WHERE p.id = ${Number(pageId)} AND p.site_id = ${Number(siteId)} FOR UPDATE OF p`,
	);
	const row = rows.rows?.[0];
	const content = row?.locale_content && typeof row.locale_content === "object" ? (row.locale_content as LocaleContent) : {};
	return { content, base: typeof row?.base === "string" ? row.base : null };
}

export async function writeLocaleContent(cms: Payload, req: TenantTransactionRequest, siteId: string, pageId: string, content: LocaleContent) {
	await executeTenantTransaction(cms, req, sql`UPDATE pages SET locale_content = ${JSON.stringify(content)}::jsonb WHERE id = ${Number(pageId)} AND site_id = ${Number(siteId)}`);
}

export type PageEditPlan = {
	ops: PagePatchOp[];
	/** fingerprints of the sections the base ops touch, as drafted */
	expect: Record<string, string>;
	/** the language whose copy the text ops write, and the fingerprints of what was shown in it */
	locale?: "en" | "ms";
	localeExpect?: Record<string, string>;
};

export type ResolvedPageEdit = {
	/** the sections after the base ops (null = none to write) */
	layout: PageBlock[] | null;
	/** sections the base ops touched, new sections included */
	touched: Set<string>;
	/** the language copy after the text ops (null = none to write) */
	slots: SlotEdit | null;
};

const refused = (message: string) => new ChangeSetApplyError(message, 422, true);

/**
 * One page's plan against the page as it is now: version guards, the same checks
 * as when it was drafted (the plan came back from the AI platform), and both
 * halves of the ops run. `withMedia` is `plan.ops` with the pictures copied in.
 */
export async function resolvePageEdit(actor: AgentActor, tenantId: string, plan: PageEditPlan, withMedia: PagePatchOp[], current: PageBlock[], content: LocaleContent, brand: string = "Your Brand"): Promise<ResolvedPageEdit> {
	// a stale card is closed (final), never offered for another approval that can only fail
	if (changedSince(current, plan.expect).length > 0) throw new ChangeSetApplyError(STALE, 409, true);
	const locale = plan.locale ?? null;
	const shown = shownLayout(current, locale, content, brand);
	if (locale && changedSince(shown, plan.localeExpect ?? {}).length > 0) throw new ChangeSetApplyError(STALE, 409, true);
	const planned = locale ? splitLocaleOps(plan.ops, shown) : { text: [], base: plan.ops };
	const media = locale ? splitLocaleOps(withMedia, shown) : { text: [], base: withMedia };
	const again = async (blocks: PageBlock[], ops: PagePatchOp[]) => {
		if (ops.length === 0) return;
		const checked = await checkPagePatchOps(actor, tenantId, blocks, ops, "apply");
		if ("error" in checked) throw refused(checked.error.message);
		if (!samePlan(checked.ops, ops) || checked.skipped.length > 0) {
			throw refused("This change no longer passes the site's checks. Ask again so it is drafted from the latest page.");
		}
	};
	await again(current, planned.base);
	await again(shown, planned.text);
	for (const op of planned.text) {
		const problem = locale ? localeTextProblem(op, shown, content, locale, languageName(locale), brand) : null;
		if (problem) throw refused(problem.message);
	}
	try {
		const base = planned.base.length > 0 ? runPagePatch(current, media.base) : null;
		const text = planned.text.length > 0 ? runPagePatch(shown, media.text) : null;
		const inserted = plan.ops.flatMap((op) => (op.op === "insert_block" ? [String(op.block.id)] : []));
		// a field every language shares (a link, a phone number) was changed in the sections: the copy on screen follows
		const mirrored = locale && base ? mirrorNeutralChanges(text?.next ?? shown, current, base.next, content, locale, brand) : null;
		const copyNext = mirrored && mirrored.touched.size > 0 ? mirrored.next : text?.next;
		const copyTouched = new Set([...(text?.touched ?? []), ...(mirrored?.touched ?? [])]);
		return {
			layout: base?.next ?? null,
			touched: new Set([...(base?.touched ?? []), ...inserted]),
			slots: copyNext && locale ? slotEdit(content, locale, shown, copyNext, copyTouched) : null,
		};
	} catch (error) {
		if (error instanceof PagePatchError) throw new ChangeSetApplyError(STALE, 409, true);
		throw error;
	}
}

/** The undo's language half: null when the edit wrote no language copy. */
export function slotRestoreOf(locale: string | undefined, slots: SlotEdit | null): z.infer<typeof SlotRestoreSchema> | undefined {
	return locale && slots && Object.keys(slots.previous).length > 0 ? { locale: locale as "en" | "ms", entries: slots.previous, expect: slots.after } : undefined;
}

/**
 * Where a page stands against an undo record (sections and language copies): every touched part as the change
 * left it (`applied`), every part as it was before (`reverted`), or neither (edited since). Read-only.
 */
export function pageRestoreState(
	current: PageBlock[],
	content: LocaleContent,
	record: { restore: ReadonlyArray<UndoEntry>; slots?: SlotRestore },
): { applied: boolean; reverted: boolean } {
	const layout = record.restore.length > 0 ? restoreState(current, record.restore as UndoEntry[]) : { applied: true, reverted: true };
	const slots = record.slots;
	const slotsApplied = !slots || Object.entries(slots.expect).every(([id, hash]) => slotFingerprint(content, id, slots.locale) === hash);
	const slotsReverted = !slots || Object.entries(slots.entries).every(([id, slot]) => slotFingerprint(content, id, slots.locale) === blockHash(slot ?? null));
	return { applied: layout.applied && slotsApplied, reverted: layout.reverted && slotsReverted };
}

/** The page's copies with an undo's sections put back; refuses if any was edited since. */
export function restoredContent(content: LocaleContent, restore: SlotRestore): LocaleContent {
	const next = restoreSlots(content, restore);
	if (!next) throw new ChangeSetApplyError(TRANSLATION_EDITED, 409);
	return next;
}

import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { PlanCode } from "@/collections/PlanSubscriptions";
import { stripOrphanMediaRefs } from "@/lib/ai/media-injector";
import { normalizeBlocksForPersistence } from "@/lib/block-normalization";
import { executeTenantTransaction, lockTenantSiteRows, type TenantTransactionRequest, withTenantRowLock } from "@/lib/payload/tenant-row-lock";
import { canUse, getActivePlanSubscription } from "@/lib/subscriptions/plan-subscription";
import { sanitizeTheme } from "@/lib/theme/sanitize-theme";
import type { AgentActor } from "../context";
import { blockHash, blockIdOf, isStableBlockId, type PageBlock, STRUCTURAL_BLOCKS } from "../site/site-blocks";
import { changedSince, PagePatchError, type PagePatchOp, PagePatchPlanSchema, restoreSections, undoRecord } from "../site/site-patch";
import { themeFingerprint } from "../site/site-prepare";
import { brandOf, slotLocaleOf } from "../site/site-locale-view";
import { type LocaleContent, localeFingerprint, MAX_TRANSLATED_TEXT, readLocaleContent, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, seoFingerprint, translatableStrings, translatedSlot } from "../site/site-seo-translate";
import { writtenView } from "../site/site-translate-source";
import { syncBaseLocaleSlots } from "../site/site-locale-sync";
import { bumpEditorRevision, txExec } from "@/lib/sites/editor-revision";
import { layoutOf, SiteToolError, siteForActor } from "../site/site-read";
import { type AttachmentLoader, ChangeSetApplyError } from "./errors";
import { ingestPicture } from "./picture-ingest";
import { pageRestoreState, readLocaleRow, resolvePageEdit, restoredContent, SlotRestoreSchema, slotRestoreOf, writeLocaleContent } from "./site-page-locale";

/**
 * Web builder changes, applied with the approver's own workspace access:
 * page edits go into the page DRAFT (live after Publish), theme edits to the
 * site. Same guards as the other record edits: the touched sections (or theme
 * keys) must be as the change was drafted from, the pre-image is returned as
 * `undo`, and undo refuses once a section was edited since.
 */

const UNDO_DAYS = 7;
export const until = () => new Date(Date.now() + UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString();
export const CHANGED_SINCE = "This page changed after the assistant drafted the edit. Ask again so it starts from the latest version.";

export async function assertBuilder(cms: Payload, tenantId: string) {
	const sub = await getActivePlanSubscription(cms, tenantId);
	if (!sub) throw new ChangeSetApplyError("Your plan has expired, so the site can't be edited.", 403);
	if (!(await canUse(cms, sub.plan as PlanCode, "website_builder"))) throw new ChangeSetApplyError("The website builder is not on your current plan.", 403);
}

export async function site(actor: AgentActor, siteId: string) {
	try {
		return await siteForActor(actor, siteId);
	} catch (error) {
		if (error instanceof SiteToolError) throw new ChangeSetApplyError(error.message, error.status === 404 ? 409 : 403);
		throw error;
	}
}

export type Page = { id: string | number; site?: unknown; layout?: unknown };

/** What a page write changes: the sections, and/or the page's language copies (locale_content). */
export type PageChange = { layout?: PageBlock[]; content?: LocaleContent };

/**
 * Read → change → write the page draft under the workspace's site lock; returns the stored layouts.
 * `step` gets the page's translations only when `withContent` (it reads and locks that row too).
 */
async function writePageDraft(
	cms: Payload,
	tenantId: string,
	siteId: string,
	pageId: string,
	step: (current: PageBlock[], content: LocaleContent) => PageChange | Promise<PageChange>,
	withContent = false,
): Promise<{ before: PageBlock[]; after: PageBlock[] }> {
	return withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(siteId)], req);
		const page = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, req, disableErrors: true })) as Page | null;
		const pageSite = page && typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page?.site;
		if (!page || String(pageSite) !== siteId) throw new ChangeSetApplyError("This page no longer exists.", 409);
		const before = layoutOf(page as never);
		const change = await step(before, withContent ? (await readLocaleRow(cms, req, siteId, pageId)).content : {});
		let after = before;
		// nothing to write (an undo of a change that is already undone): the draft and its revision stay as they are
		if (!change.layout && !change.content) return { before, after };
		// the language copy first: the base-copy sync below reads it back
		if (change.content) await writeLocaleContent(cms, req, siteId, pageId, change.content);
		if (change.layout) {
			const next = normalizeBlocksForPersistence(change.layout as Record<string, unknown>[]);
			await stripOrphanMediaRefs(next as never, cms as never).catch(() => undefined);
			await cms.update({ collection: "pages", id: pageId, data: { layout: next }, draft: true, req } as Parameters<Payload["update"]>[0]);
			// fingerprints come from what was stored (Payload fills defaults), never from what was sent
			const saved = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, req })) as Page;
			after = layoutOf(saved as never);
			await syncBaseLanguageCopy(cms, req, siteId, pageId, before, after);
		}
		// an editor tab still holding the older draft can no longer save over this change
		await bumpEditorRevision(txExec(cms, req), Number(siteId), { pageIds: [pageId] });
		return { before, after };
	});
}

/** Keeps the editor's base-language copy of the changed sections in step (see syncBaseLocaleSlots). */
export async function syncBaseLanguageCopy(cms: Payload, req: TenantTransactionRequest, siteId: string, pageId: string, before: PageBlock[], after: PageBlock[]) {
	const { content, base } = await readLocaleRow(cms, req, siteId, pageId);
	if (!base || Object.keys(content).length === 0) return;
	const next = syncBaseLocaleSlots(content, base, before, after);
	if (next) await writeLocaleContent(cms, req, siteId, pageId, next);
}

export const links = (siteId: string, pageId: string) => [{ label: "Open in the editor", href: `/editor/${encodeURIComponent(siteId)}?pageId=${encodeURIComponent(pageId)}` }];

/** set_image ops with their picture copied into this workspace's media first (a `media:` pick is reused); a failed copy stops the change. */
export async function withSectionPictures(cms: Payload, ops: PagePatchOp[], loadAttachment: AttachmentLoader | undefined, tenantId: string): Promise<PagePatchOp[]> {
	const out: PagePatchOp[] = [];
	const ingest = async (image: { ref: string; url?: string; name?: string }) => {
		const media = await ingestPicture(cms, image, image.name ?? "Section picture", loadAttachment, tenantId).catch((error: unknown) => {
			console.error("[site-edits] section picture ingest failed", image.ref, error);
			return null;
		});
		if (!media) throw new ChangeSetApplyError("A picture for this change could not be added. Nothing was changed.", 422);
		return media;
	};
	for (const op of ops) {
		if (op.op === "set_image") {
			const media = await ingest(op.image);
			out.push({ ...op, mediaId: media.id, ...(media.url ? { mediaUrl: media.url } : {}) });
		} else if (op.op === "edit_list" && op.rows.some((row) => row.picture)) {
			const rows = [];
			for (const row of op.rows) {
				if (!row.picture) rows.push(row);
				else {
					const media = await ingest(row.picture.image);
					rows.push({ ...row, mediaId: media.id, ...(media.url ? { mediaUrl: media.url } : {}) });
				}
			}
			out.push({ ...op, rows });
		} else if (op.op === "set_pictures") {
			const items = [];
			for (const item of op.items) items.push({ ...item, mediaId: (await ingest(item.image)).id });
			out.push({ ...op, items });
		} else out.push(op);
	}
	return out;
}

export async function applySitePagePatch(raw: unknown, actor: AgentActor, loadAttachment?: AttachmentLoader): Promise<ChangeSetResult> {
	const plan = PagePatchPlanSchema.parse(raw);
	const { tenantId, site: siteDoc } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	// the plan came back from the AI platform: a language copy is only written for a language the website has
	if (plan.locale && slotLocaleOf(siteDoc, plan.locale) !== plan.locale) {
		throw new ChangeSetApplyError("That language is no longer one of the website's languages, so its text can't be edited. Ask again.", 409, true);
	}
	let touched = new Set<string>();
	const language: { undo?: ReturnType<typeof slotRestoreOf> } = {};
	const ops = plan.ops;
	// pictures are brought in before the page write (outside the lock: they call other services); a stale
	// card must not leave media behind, so the version is checked first (again under the lock)
	if (ops.some((op) => op.op === "set_image" || op.op === "set_pictures" || (op.op === "edit_list" && op.rows.some((row) => row.picture)))) {
		const draft = (await cms.findByID({ collection: "pages", id: plan.pageId, draft: true, depth: 0, disableErrors: true })) as Page | null;
		if (draft && changedSince(layoutOf(draft as never), plan.expect).length > 0) throw new ChangeSetApplyError(CHANGED_SINCE, 409, true);
	}
	const withMedia = await withSectionPictures(cms, ops, loadAttachment, tenantId);
	const { before, after } = await writePageDraft(
		cms,
		tenantId,
		plan.siteId,
		plan.pageId,
		async (current, content) => {
			const resolved = await resolvePageEdit(actor, tenantId, { ops, expect: plan.expect, locale: plan.locale, localeExpect: plan.localeExpect }, withMedia, current, content, brandOf(siteDoc));
			touched = resolved.touched;
			language.undo = slotRestoreOf(plan.locale, resolved.slots);
			return { ...(resolved.layout ? { layout: resolved.layout } : {}), ...(resolved.slots ? { content: resolved.slots.content } : {}) };
		},
		Boolean(plan.locale),
	);
	return {
		entities: [{ kind: "site_page", id: plan.pageId }],
		links: links(plan.siteId, plan.pageId),
		undo: { kind: "site.page_restore", payload: { siteId: plan.siteId, pageId: plan.pageId, restore: undoRecord(before, after, touched), ...(language.undo ? { slots: language.undo } : {}) }, until: until() },
	};
}

const RestoreSchema = z
	.object({
		siteId: z.string().min(1).max(40),
		pageId: z.string().min(1).max(40),
		restore: z
			.array(z.object({ blockId: z.string(), before: z.record(z.string(), z.unknown()).nullable(), position: z.number().int(), after: z.string().nullable() }))
			.max(60),
		/** the language copy of the sections a text edit changed (see site-page-locale.ts) */
		slots: SlotRestoreSchema.optional(),
	})
	.refine((input) => input.restore.length > 0 || input.slots !== undefined, "Nothing to undo");

export async function applySitePageRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const input = RestoreSchema.parse(raw);
	const { tenantId } = await site(actor, input.siteId);
	const cms = await getPayload({ config });
	await writePageDraft(
		cms,
		tenantId,
		input.siteId,
		input.pageId,
		(current, content) => {
			try {
				// already back as it was (undone in the editor, or by an earlier click): nothing to do, not an error
				if (pageRestoreState(current, content, input).reverted) return {};
				return {
					...(input.restore.length > 0 ? { layout: restoreSections(current, input.restore as never) } : {}),
					...(input.slots ? { content: restoredContent(content, input.slots) } : {}),
				};
			} catch (error) {
				if (error instanceof PagePatchError) throw new ChangeSetApplyError(error.message, 409);
				throw error;
			}
		},
		Boolean(input.slots),
	);
	return { entities: [{ kind: "site_page", id: input.pageId }], links: links(input.siteId, input.pageId) };
}

const ThemePlanSchema = z.object({
	siteId: z.string().min(1).max(40),
	/** fingerprint of the touched theme keys as drafted */
	base: z.string().min(1),
	changes: z.record(z.string(), z.unknown()),
});

const THEME_CHANGED = "The theme changed after the assistant drafted this. Ask again so it starts from the latest theme.";
const THEME_EDITED = "The theme colours or fonts were changed after the assistant's change, so this can't be undone from here. Change them back in Theme settings.";

/** `restoring`: `values` are what the theme had before; a theme that already has them is as undone as it gets. */
async function writeTheme(cms: Payload, tenantId: string, siteId: string, base: string, values: Record<string, unknown>, restoring = false) {
	return withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(siteId)], req);
		const doc = (await cms.findByID({ collection: "sites", id: siteId, depth: 0, req })) as { theme?: Record<string, unknown> };
		const current = doc.theme ?? {};
		const keys = Object.keys(values);
		if (themeFingerprint(current, keys) !== base) {
			if (restoring && themeFingerprint(current, keys) === themeFingerprint(values, keys)) return { previous: values, after: base };
			throw new ChangeSetApplyError(restoring ? THEME_EDITED : THEME_CHANGED, 409, !restoring);
		}
		const previous = Object.fromEntries(Object.keys(values).map((key) => [key, current[key] ?? null]));
		// null restores "not set" (undo of a key that had no value)
		const merged = Object.fromEntries(Object.entries({ ...current, ...values }).filter(([, value]) => value !== null));
		// keys being reset are written as null: an omitted key would keep its stored value
		const cleared = Object.fromEntries(Object.entries(values).filter(([, value]) => value === null));
		await cms.update({ collection: "sites", id: siteId, data: { theme: { ...sanitizeTheme(merged), ...cleared }, themeCustomized: true }, req } as Parameters<Payload["update"]>[0]);
		await bumpEditorRevision(txExec(cms, req), Number(siteId), { site: true });
		const saved = (await cms.findByID({ collection: "sites", id: siteId, depth: 0, req })) as { theme?: Record<string, unknown> };
		return { previous, after: themeFingerprint(saved.theme, Object.keys(values)) };
	});
}

export async function applySiteThemePatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = ThemePlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	// the plan came back from the AI platform: only storable values, colours as #rrggbb, nothing dropped
	const changes = sanitizeTheme(plan.changes);
	const safe = Object.keys(changes).length === Object.keys(plan.changes).length && Object.entries(changes).every(([key, value]) => !key.endsWith("Color") || (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)));
	if (!safe) throw new ChangeSetApplyError("This theme change no longer passes the site's checks. Ask again.", 422, true);
	const { previous, after } = await writeTheme(cms, tenantId, plan.siteId, plan.base, changes);
	return {
		entities: [{ kind: "site_theme", id: plan.siteId }],
		links: [{ label: "Open in the editor", href: `/editor/${encodeURIComponent(plan.siteId)}` }],
		undo: { kind: "site.theme_restore", payload: { siteId: plan.siteId, base: after, changes: previous }, until: until() },
	};
}

export async function applySiteThemeRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = ThemePlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await writeTheme(cms, tenantId, plan.siteId, plan.base, plan.changes, true);
	return { entities: [{ kind: "site_theme", id: plan.siteId }], links: [{ label: "Open in the editor", href: `/editor/${encodeURIComponent(plan.siteId)}` }] };
}

// ─── Page SEO ──────────────────────────────────────────────────────────────

const SeoPlanSchema = z.object({
	siteId: z.string().min(1).max(40),
	pageId: z.string().min(1).max(40),
	/** fingerprint of the page's SEO title + description as drafted */
	base: z.string().min(1),
	changes: z.object({
		title: z.string().max(SEO_TITLE_MAX).nullable().optional(),
		description: z.string().max(SEO_DESCRIPTION_MAX).nullable().optional(),
	}),
	/** a draft page's address move; `from` must still be the page's address */
	slug: z.object({ from: z.string().max(200), to: z.string().min(1).max(200) }).optional(),
});

/** Writes the page draft's SEO under the site lock; refuses if it changed since `base`. */
async function writePageSeo(cms: Payload, tenantId: string, plan: z.infer<typeof SeoPlanSchema>, stale: string, restoring = false) {
	return withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
		const page = (await cms.findByID({ collection: "pages", id: plan.pageId, draft: true, depth: 0, req, disableErrors: true })) as (Page & { seo?: Record<string, unknown> }) | null;
		const pageSite = page && typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page?.site;
		if (!page || String(pageSite) !== plan.siteId) throw new ChangeSetApplyError("This page no longer exists.", 409, true);
		const seo = (page.seo ?? {}) as { title?: string | null; description?: string | null };
		if (seoFingerprint(seo) !== plan.base) {
			// an undo whose values are already in place (undone twice, or by hand): done
			if (restoring && seoFingerprint({ ...seo, ...plan.changes }) === seoFingerprint(seo) && !plan.slug) return { previous: plan.changes, after: seoFingerprint(seo) };
			throw new ChangeSetApplyError(stale, 409, !restoring);
		}
		if (plan.slug) {
			if ((((page as { slug?: string }).slug) ?? "") !== plan.slug.from) throw new ChangeSetApplyError("The page's address changed after the assistant drafted this. Ask again.", 409, true);
			// never move an address that went live in the meantime
			const main = (await cms.findByID({ collection: "pages", id: plan.pageId, draft: false, depth: 0, req, disableErrors: true })) as { _status?: string } | null;
			if (!main || main._status === "published") throw new ChangeSetApplyError("This page is published, so its address stays.", 409, true);
		}
		const previous = Object.fromEntries(Object.keys(plan.changes).map((key) => [key, seo[key as "title" | "description"] ?? null]));
		const data: Record<string, unknown> = { seo: { ...seo, ...plan.changes }, ...(plan.slug ? { slug: plan.slug.to } : {}) };
		await cms.update({ collection: "pages", id: plan.pageId, data, draft: true, req } as Parameters<Payload["update"]>[0]);
		const saved = (await cms.findByID({ collection: "pages", id: plan.pageId, draft: true, depth: 0, req })) as { seo?: Record<string, unknown> };
		return { previous, after: seoFingerprint(saved.seo as never) };
	});
}

export async function applySiteSeoPatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = SeoPlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	const { previous, after } = await writePageSeo(cms, tenantId, plan, "The page's SEO changed after the assistant drafted this. Ask again.");
	return {
		entities: [{ kind: "site_page", id: plan.pageId }],
		links: links(plan.siteId, plan.pageId),
		undo: { kind: "site.seo_restore", payload: { siteId: plan.siteId, pageId: plan.pageId, base: after, changes: previous, ...(plan.slug ? { slug: { from: plan.slug.to, to: plan.slug.from } } : {}) }, until: until() },
	};
}

export async function applySiteSeoRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = SeoPlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await writePageSeo(cms, tenantId, plan, "The page's title or description was changed after the assistant's change, so this can't be undone from here. Change them back in the page's SEO settings.", true);
	return { entities: [{ kind: "site_page", id: plan.pageId }], links: links(plan.siteId, plan.pageId) };
}

// ─── Page translation ──────────────────────────────────────────────────────

const PageIdField = z.string().regex(/^\d{1,12}$/);
const MAX_TRANSLATED_SECTIONS = 20;

const TranslatePlanSchema = z.object({
	siteId: z.string().min(1).max(40),
	pageId: PageIdField,
	locale: z.enum(["en", "ms"]),
	/** the language the texts were made from; the sections are read in it (absent: a plan from before, the stored sections) */
	written: z.string().min(1).max(20).optional(),
	/** section id → its translated texts by field key (the slot is rebuilt from the section at apply) */
	entries: z.record(z.string(), z.record(z.string(), z.string().max(MAX_TRANSLATED_TEXT))),
	/** section id → fingerprint of the section (in the written language) as drafted */
	blocks: z.record(z.string(), z.string()),
	/** section id → fingerprint of its `locale` translation as drafted */
	expect: z.record(z.string(), z.string()),
});

const LocaleRestoreSchema = z.object({
	siteId: z.string().min(1).max(40),
	pageId: PageIdField,
	locale: z.enum(["en", "ms"]),
	/** section id → its previous `locale` slot (null = it had none) */
	entries: z.record(z.string(), z.record(z.string(), z.unknown()).nullable()),
	/** section id → fingerprint of the slot the translation left */
	expect: z.record(z.string(), z.string()),
});

type SlotWrite = { siteId: string; pageId: string; locale: "en" | "ms"; slots: Record<string, Record<string, unknown> | null>; expect: Record<string, string> };

const sameKeys = (a: object, b: object) => {
	const left = Object.keys(a).sort();
	const right = Object.keys(b).sort();
	return left.length === right.length && left.every((key, index) => key === right[index]);
};

/** Writes locale slots into `pages.locale_content` under the site lock; refuses if any changed since. */
async function writeTranslations(cms: Payload, tenantId: string, write: SlotWrite, stale: string, restoring = false) {
	return withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(write.siteId)], req);
		const rows = await executeTenantTransaction<{ rows: Array<{ locale_content: unknown; site_id: unknown }> }>(
			cms,
			req,
			sql`SELECT locale_content, site_id FROM pages WHERE id = ${Number(write.pageId)} FOR UPDATE`,
		);
		const row = rows.rows?.[0];
		if (!row || String(row.site_id) !== write.siteId) throw new ChangeSetApplyError("This page no longer exists.", 409, true);
		const content = (row.locale_content && typeof row.locale_content === "object" ? row.locale_content : {}) as LocaleContent;
		// an undo whose copies are already back (undone twice, or by hand): done, nothing written
		if (restoring && Object.entries(write.slots).every(([id, fields]) => localeFingerprint(content, id, write.locale) === blockHash(fields ?? null))) return { previous: write.slots, after: write.expect };
		const changed = Object.entries(write.expect).filter(([id, hash]) => localeFingerprint(content, id, write.locale) !== hash);
		if (changed.length > 0) throw new ChangeSetApplyError(stale, 409, !restoring);
		const previous: Record<string, Record<string, unknown> | null> = {};
		const next: LocaleContent = { ...content };
		for (const [id, fields] of Object.entries(write.slots)) {
			previous[id] = (content[id]?.[write.locale] as Record<string, unknown> | undefined) ?? null;
			const slots = { ...(content[id] ?? { en: {}, ms: {} }) } as Record<string, Record<string, unknown>>;
			if (fields === null) delete slots[write.locale];
			else slots[write.locale] = fields;
			next[id] = slots;
		}
		await executeTenantTransaction(
			cms,
			req,
			sql`UPDATE pages SET locale_content = ${JSON.stringify(next)}::jsonb WHERE id = ${Number(write.pageId)} AND site_id = ${Number(write.siteId)}`,
		);
		await bumpEditorRevision(txExec(cms, req), Number(write.siteId), { pageIds: [write.pageId] });
		return {
			previous,
			after: Object.fromEntries(Object.keys(write.slots).map((id) => [id, localeFingerprint(next, id, write.locale)])),
		};
	});
}

export async function applySiteTranslatePage(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = TranslatePlanSchema.parse(raw);
	const ids = Object.keys(plan.entries);
	// the plan came back from the AI platform: every section it names must be guarded and checked again
	if (ids.length === 0 || ids.length > MAX_TRANSLATED_SECTIONS || !sameKeys(plan.entries, plan.expect) || !sameKeys(plan.entries, plan.blocks)) {
		throw new ChangeSetApplyError("This translation is not complete. Ask again.", 422, true);
	}
	const { tenantId, site: siteDoc } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	const page = (await cms.findByID({ collection: "pages", id: plan.pageId, draft: true, depth: 0, disableErrors: true })) as Page | null;
	const pageSite = page && typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page?.site;
	if (!page || String(pageSite) !== plan.siteId) throw new ChangeSetApplyError("This page no longer exists.", 409, true);
	const sections = new Map(layoutOf(page as never).map((block, index) => [blockIdOf(block, index), block]));
	const slots: Record<string, Record<string, unknown>> = {};
	// the sections as they read in the written language: what the texts were made from, and what the copy is built on
	const content = plan.written ? await readLocaleContent(cms, plan.pageId) : {};
	for (const id of ids) {
		const stored = sections.get(id);
		const block = stored && plan.written ? writtenView(stored, plan.written, content, brandOf(siteDoc)) : stored;
		if (!block || blockHash(block) !== plan.blocks[id]) {
			throw new ChangeSetApplyError("Some of these sections changed after the assistant translated them. Ask again.", 409, true);
		}
		if (!isStableBlockId(id) || STRUCTURAL_BLOCKS.has(String(block.blockType))) throw new ChangeSetApplyError("This section can't be translated here.", 422, true);
		// only texts at the section's own text paths are taken; pictures, links and ids come from the section itself
		const { fields } = translatableStrings(block);
		if (Object.keys(plan.entries[id]!).some((key) => !(key in fields))) {
			throw new ChangeSetApplyError("This translation no longer fits the section. Ask again.", 422, true);
		}
		slots[id] = translatedSlot(block, plan.entries[id]!);
	}
	const { previous, after } = await writeTranslations(
		cms,
		tenantId,
		{ siteId: plan.siteId, pageId: plan.pageId, locale: plan.locale, slots, expect: plan.expect },
		"These translations changed after the assistant drafted them. Ask again.",
	);
	return {
		entities: [{ kind: "site_page", id: plan.pageId }],
		links: links(plan.siteId, plan.pageId),
		undo: { kind: "site.locale_restore", payload: { siteId: plan.siteId, pageId: plan.pageId, locale: plan.locale, entries: previous, expect: after }, until: until() },
	};
}

export async function applySiteLocaleRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = LocaleRestoreSchema.parse(raw);
	// every slot put back is guarded by the fingerprint the translation left
	if (Object.keys(plan.entries).length > MAX_TRANSLATED_SECTIONS || !sameKeys(plan.entries, plan.expect)) {
		throw new ChangeSetApplyError("This undo is not complete.", 422, true);
	}
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await writeTranslations(
		cms,
		tenantId,
		{ siteId: plan.siteId, pageId: plan.pageId, locale: plan.locale, slots: plan.entries, expect: plan.expect },
		"These translations were edited after the assistant wrote them, so this can't be undone from here. Change them back in the editor.",
		true,
	);
	return { entities: [{ kind: "site_page", id: plan.pageId }], links: links(plan.siteId, plan.pageId) };
}

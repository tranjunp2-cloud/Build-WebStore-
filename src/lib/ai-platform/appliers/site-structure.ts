import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import { normalizeBlocksForPersistence } from "@/lib/block-normalization";
import { stripOrphanMediaRefs } from "@/lib/ai/media-injector";
import { executeTenantTransaction, lockTenantSiteRows, type TenantTransactionRequest, withTenantRowLock } from "@/lib/payload/tenant-row-lock";
import { checkTwoTierRateLimit } from "@/lib/rateLimit";
import { homepageFrame } from "@/lib/sites/new-page-layout";
import { PublishRolledBack, publishSite, type PublishSiteResult } from "@/lib/sites/publish-site";
import type { AgentActor } from "../context";
import { revalidateTag } from "next/cache";
import { sanitizeText } from "@/utils/sanitize";
import { blockHash, type PageBlock, unsafeLinks } from "../site/site-blocks";
import { publishFingerprint, sitePages } from "../site/site-check";
import { appendMenuLink, buildFrame, currentFrame, frameFingerprint, NavChangeError, NavChangeInputSchema } from "../site/site-nav";
import { languagesHeader, SITE_LANGUAGES, SiteLanguagesInputSchema } from "../site/site-languages";
import { brandOf, slotLocaleOf } from "../site/site-locale-view";
import { changedSince, PagePatchError, type PagePatchOp, PagePatchOpSchema, PageLanguageFields, restoreSections, runPagePatch, undoRecord } from "../site/site-patch";
import { checkPagePatchOps } from "../site/site-prepare";
import { layoutOf } from "../site/site-read";
import type { LocaleContent } from "../site/site-seo-translate";
import { MAX_PAGES_PER_CHANGE, MAX_PAGES_PER_SITE, normalizeSlug, reservedSlug, sectionOps } from "../site/site-structure";
import { type AttachmentLoader, ChangeSetApplyError } from "./errors";
import { samePlan } from "./same-plan";
import { pageRestoreState, readLocaleRow, resolvePageEdit, type ResolvedPageEdit, restoredContent, SlotRestoreSchema, slotRestoreOf, writeLocaleContent } from "./site-page-locale";
import { assertBuilder, CHANGED_SINCE, links, type Page, site, syncBaseLanguageCopy, until, withSectionPictures } from "./site-edits";
import { bumpEditorRevision, txExec } from "@/lib/sites/editor-revision";

/**
 * Site-level web builder changes, applied with the approver's access under the
 * workspace's site lock: several page drafts at once (all or nothing), a new
 * draft page (with its menu entry), the menu/footer draft, and publishing.
 * Every plan came back from the AI platform, so it is checked again here.
 */

const SiteId = z.string().regex(/^\d{1,12}$/);
const PageId = z.string().regex(/^\d{1,12}$/);
const editorLink = (siteId: string) => [{ label: "Open in the editor", href: `/editor/${encodeURIComponent(siteId)}` }];
type SiteRow = Record<string, unknown> & { id: string | number; name?: string };

/** An undo puts back a block it saved; it must still hold only safe links (the payload came back from the AI platform). */
function assertSafeBlock(block: unknown) {
	if (block !== null && unsafeLinks(block).length > 0) throw new ChangeSetApplyError("This undo would bring back an unsafe link. Change the menu in the editor.", 422);
}

async function readDraftPage(cms: Payload, pageId: string, siteId: string, req: TenantTransactionRequest): Promise<Page> {
	const page = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, req, disableErrors: true })) as Page | null;
	const pageSite = page && typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page?.site;
	if (!page || String(pageSite) !== siteId) throw new ChangeSetApplyError("One of these pages no longer exists.", 409, true);
	return page;
}

/** Writes a page draft read as `before`; the editor's base-language copy of the changed sections follows. */
async function writeDraftLayout(cms: Payload, siteId: string, pageId: string, before: PageBlock[], layout: PageBlock[], req: TenantTransactionRequest): Promise<PageBlock[]> {
	const next = normalizeBlocksForPersistence(layout as Record<string, unknown>[]);
	await stripOrphanMediaRefs(next as never, cms as never).catch(() => undefined);
	await cms.update({ collection: "pages", id: pageId, data: { layout: next }, draft: true, req } as Parameters<Payload["update"]>[0]);
	const saved = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, req })) as Page;
	const after = layoutOf(saved as never);
	await syncBaseLanguageCopy(cms, req, siteId, pageId, before, after);
	await bumpEditorRevision(txExec(cms, req), Number(siteId), { pageIds: [pageId] });
	return after;
}

/** A page's change written: its language copy (when a text edit or its undo changed it), then its sections (when they changed). */
async function writeDraftPage(cms: Payload, siteId: string, pageId: string, before: PageBlock[], change: { layout: PageBlock[] | null; content?: LocaleContent }, req: TenantTransactionRequest): Promise<PageBlock[]> {
	if (change.content) await writeLocaleContent(cms, req, siteId, pageId, change.content);
	if (change.layout) return writeDraftLayout(cms, siteId, pageId, before, change.layout, req);
	await bumpEditorRevision(txExec(cms, req), Number(siteId), { pageIds: [pageId] });
	return before;
}

// ─── Several pages ─────────────────────────────────────────────────────────

const PagesPlanSchema = z.object({
	siteId: SiteId,
	pages: z.array(z.object({ pageId: PageId, ops: z.array(PagePatchOpSchema).min(1).max(30), expect: z.record(z.string(), z.string()), ...PageLanguageFields })).min(2).max(MAX_PAGES_PER_CHANGE),
});

export async function applySitePagesPatch(raw: unknown, actor: AgentActor, loadAttachment?: AttachmentLoader): Promise<ChangeSetResult> {
	const plan = PagesPlanSchema.parse(raw);
	if (new Set(plan.pages.map((p) => p.pageId)).size !== plan.pages.length) throw new ChangeSetApplyError("This change names a page twice. Ask again.", 422, true);
	const { tenantId, site: siteDoc } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	// the plan came back from the AI platform: a language copy is only written for a language the website has
	if (plan.pages.some((p) => p.locale && slotLocaleOf(siteDoc, p.locale) !== p.locale)) {
		throw new ChangeSetApplyError("That language is no longer one of the website's languages, so its text can't be edited. Ask again.", 409, true);
	}
	// a stale card must not leave uploaded pictures behind: every page is checked before any picture is copied
	for (const { pageId, expect } of plan.pages) {
		const draft = (await cms.findByID({ collection: "pages", id: pageId, draft: true, depth: 0, disableErrors: true })) as Page | null;
		const draftSite = draft && typeof draft.site === "object" && draft.site ? (draft.site as { id?: unknown }).id : draft?.site;
		if (!draft || String(draftSite) !== plan.siteId) throw new ChangeSetApplyError("One of these pages no longer exists.", 409, true);
		if (changedSince(layoutOf(draft as never), expect).length > 0) throw new ChangeSetApplyError(CHANGED_SINCE, 409, true);
	}
	const withMedia: PagePatchOp[][] = [];
	for (const page of plan.pages) withMedia.push(await withSectionPictures(cms, page.ops, loadAttachment, tenantId));

	const restore = await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
		// all pages are read and checked first: one stale page and nothing is written
		const drafted: Array<{ pageId: string; before: PageBlock[]; resolved: ResolvedPageEdit; locale?: string }> = [];
		for (const [i, page] of plan.pages.entries()) {
			const before = layoutOf((await readDraftPage(cms, page.pageId, plan.siteId, req)) as never);
			const content = page.locale ? (await readLocaleRow(cms, req, plan.siteId, page.pageId)).content : {};
			const resolved = await resolvePageEdit(actor, tenantId, page, withMedia[i]!, before, content, brandOf(siteDoc));
			drafted.push({ pageId: page.pageId, before, resolved, locale: page.locale });
		}
		const records = [];
		for (const { pageId, before, resolved, locale } of drafted) {
			const after = await writeDraftPage(cms, plan.siteId, pageId, before, { layout: resolved.layout, ...(resolved.slots ? { content: resolved.slots.content } : {}) }, req);
			const slots = slotRestoreOf(locale, resolved.slots);
			records.push({ pageId, restore: undoRecord(before, after, resolved.touched), ...(slots ? { slots } : {}) });
		}
		return records;
	});
	return {
		entities: plan.pages.map((p) => ({ kind: "site_page", id: p.pageId })),
		links: editorLink(plan.siteId),
		undo: { kind: "site.pages_restore", payload: { siteId: plan.siteId, pages: restore }, until: until() },
	};
}

const PagesRestoreSchema = z.object({
	siteId: SiteId,
	pages: z
		.array(
			z
				.object({
					pageId: PageId,
					restore: z.array(z.object({ blockId: z.string(), before: z.record(z.string(), z.unknown()).nullable(), position: z.number().int(), after: z.string().nullable() })).max(60),
					/** the language copy of the sections a text edit changed (see site-page-locale.ts) */
					slots: SlotRestoreSchema.optional(),
				})
				.refine((page) => page.restore.length > 0 || page.slots !== undefined, "Nothing to undo"),
		)
		.min(1)
		.max(MAX_PAGES_PER_CHANGE),
});

export async function applySitePagesRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const input = PagesRestoreSchema.parse(raw);
	const { tenantId } = await site(actor, input.siteId);
	const cms = await getPayload({ config });
	await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(input.siteId)], req);
		const restored: Array<{ pageId: string; before: PageBlock[]; layout: PageBlock[] | null; content?: LocaleContent }> = [];
		for (const { pageId, restore, slots } of input.pages) {
			const current = layoutOf((await readDraftPage(cms, pageId, input.siteId, req)) as never);
			try {
				// a page already back as it was (undone in the editor, or by an earlier click) is left alone
				const content = slots ? (await readLocaleRow(cms, req, input.siteId, pageId)).content : {};
				if (pageRestoreState(current, content, { restore: restore as never, ...(slots ? { slots } : {}) }).reverted) continue;
				restored.push({
					pageId,
					before: current,
					layout: restore.length > 0 ? restoreSections(current, restore as never) : null,
					...(slots ? { content: restoredContent(content, slots) } : {}),
				});
			} catch (error) {
				if (error instanceof PagePatchError) throw new ChangeSetApplyError(error.message, 409);
				throw error;
			}
		}
		for (const { pageId, before, layout, content } of restored) await writeDraftPage(cms, input.siteId, pageId, before, { layout, ...(content ? { content } : {}) }, req);
	});
	return { entities: input.pages.map((p) => ({ kind: "site_page", id: p.pageId })), links: editorLink(input.siteId) };
}

// ─── A new page ────────────────────────────────────────────────────────────

const PageCreatePlanSchema = z.object({
	siteId: SiteId,
	title: z.string().min(1).max(100),
	slug: z.string().min(2).max(80),
	sections: z.array(PagePatchOpSchema).min(1).max(12),
	menuLabel: z.string().min(1).max(60).nullable(),
	base: z.object({ header: z.string(), footer: z.string() }),
});

async function readSite(cms: Payload, siteId: string, req: TenantTransactionRequest): Promise<SiteRow> {
	return (await cms.findByID({ collection: "sites", id: siteId, depth: 0, req })) as unknown as SiteRow;
}

export async function applySitePageCreate(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = PageCreatePlanSchema.parse(raw);
	if (normalizeSlug(plan.slug) !== plan.slug || reservedSlug(plan.slug)) throw new ChangeSetApplyError("That page address is not allowed. Ask again.", 422, true);
	const title = sanitizeText(plan.title).trim();
	if (!title) throw new ChangeSetApplyError("The page needs a title. Ask again.", 422, true);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	const created = await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
		const live = { and: [{ site: { equals: plan.siteId } }, { deletedAt: { exists: false } }] };
		const taken = await cms.find({ collection: "pages", where: { and: [...live.and, { slug: { equals: plan.slug } }] }, limit: 1, depth: 0, req } as Parameters<Payload["find"]>[0]);
		if (taken.docs.length > 0) throw new ChangeSetApplyError(`A page got the address ${plan.slug} in the meantime. Ask again with another address.`, 409, true);
		const count = await cms.count({ collection: "pages", where: live, req } as unknown as Parameters<Payload["count"]>[0]);
		if (count.totalDocs >= MAX_PAGES_PER_SITE) throw new ChangeSetApplyError(`This site has the most pages it can have (${MAX_PAGES_PER_SITE}).`, 409, true);

		// the sections came back from the AI platform: the same checks again, unchanged (they are inserts, in reverse)
		const ordered = [...plan.sections].reverse();
		const blocks = ordered.map((op) => (op.op === "insert_block" ? op.block : null));
		if (blocks.some((b) => b === null)) throw new ChangeSetApplyError("This new page is not complete. Ask again.", 422, true);
		const checked = await checkPagePatchOps(actor, tenantId, [], sectionOps(blocks as Array<Record<string, unknown>>), "apply");
		if ("error" in checked || !samePlan(checked.ops, plan.sections) || checked.skipped.length > 0) {
			throw new ChangeSetApplyError("This new page no longer passes the site's checks. Ask again.", 422, true);
		}
		const sections = runPagePatch([], checked.ops).next;
		const frame = await homepageFrame(cms, plan.siteId, req).catch(() => ({ nav: null, footer: null, found: false }));
		const layout = normalizeBlocksForPersistence([...(frame.nav ? [frame.nav] : []), ...sections, ...(frame.footer ? [frame.footer] : [])] as Record<string, unknown>[]);
		const page = (await cms.create({
			collection: "pages",
			data: { title, slug: plan.slug, site: Number(plan.siteId), isVisible: true, layout, _status: "draft" },
			req,
		} as Parameters<Payload["create"]>[0]).catch((error: unknown) => {
			// the editor's page manager doesn't take this lock: the address index is the last guard
			if (/unique|duplicate/i.test(error instanceof Error ? error.message : String(error))) {
				throw new ChangeSetApplyError(`A page got the address ${plan.slug} in the meantime. Ask again with another address.`, 409, true);
			}
			throw error;
		})) as unknown as Page;
		const stored = (await cms.findByID({ collection: "pages", id: page.id, draft: true, depth: 0, req })) as Page;

		let menu: { previous: unknown; after: string } | null = null;
		if (plan.menuLabel) {
			const siteRow = await readSite(cms, plan.siteId, req);
			const current = currentFrame(siteRow as never);
			if (frameFingerprint(current).header !== plan.base.header) throw new ChangeSetApplyError("The menu changed after the assistant drafted this. Ask again.", 409, true);
			let header: Record<string, unknown>;
			try {
				header = appendMenuLink(current.header, plan.menuLabel, plan.slug);
			} catch (error) {
				if (error instanceof NavChangeError) throw new ChangeSetApplyError(error.message, 422, true);
				throw error;
			}
			await cms.update({ collection: "sites", id: plan.siteId, data: { pendingHeaderBlock: header }, req } as Parameters<Payload["update"]>[0]);
			await bumpEditorRevision(txExec(cms, req), Number(plan.siteId), { site: true });
			// the fingerprint undo checks comes from what was stored, never from what was sent
			menu = { previous: siteRow.pendingHeaderBlock ?? null, after: blockHash(currentFrame((await readSite(cms, plan.siteId, req)) as never).header) };
		}
		return { pageId: String(page.id), layout: blockHash(layoutOf(stored as never)), menu };
	});
	return {
		entities: [{ kind: "site_page", id: created.pageId }],
		links: links(plan.siteId, created.pageId),
		undo: { kind: "site.page_remove", payload: { siteId: plan.siteId, pageId: created.pageId, layout: created.layout, menu: created.menu }, until: until() },
	};
}

const PageRemoveSchema = z.object({
	siteId: SiteId,
	pageId: PageId,
	/** fingerprint of the page's layout as created */
	layout: z.string(),
	menu: z.object({ previous: z.record(z.string(), z.unknown()).nullable(), after: z.string() }).nullable(),
});

export async function applySitePageRemove(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const input = PageRemoveSchema.parse(raw);
	const { tenantId } = await site(actor, input.siteId);
	const cms = await getPayload({ config });
	await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(input.siteId)], req);
		const page = (await readDraftPage(cms, input.pageId, input.siteId, req)) as Page & { isHomepage?: boolean };
		// a page that went live (or became the homepage) is the merchant's now: removed only by hand.
		// The base row holds the published version once there is one (later drafts are versions only).
		const base = await executeTenantTransaction<{ rows: Array<{ status?: unknown }> }>(cms, req, sql`SELECT _status AS status FROM pages WHERE id = ${Number(input.pageId)}`);
		if (base.rows?.[0]?.status === "published" || page.isHomepage) throw new ChangeSetApplyError("This page is live now. Delete it in the editor's page list if you still want to.", 409);
		if (blockHash(layoutOf(page as never)) !== input.layout) throw new ChangeSetApplyError("The page was edited after the assistant made it. Delete it in the editor if you still want to.", 409);
		if (input.menu) {
			const siteRow = await readSite(cms, input.siteId, req);
			if (blockHash(currentFrame(siteRow as never).header) !== input.menu.after) throw new ChangeSetApplyError("The menu was edited since. Remove the page and its menu link in the editor.", 409);
			if (input.menu.previous !== null && (input.menu.previous as { blockType?: unknown }).blockType !== "navigation") throw new ChangeSetApplyError("This undo is not valid.", 422);
			assertSafeBlock(input.menu.previous);
			await cms.update({ collection: "sites", id: input.siteId, data: { pendingHeaderBlock: input.menu.previous }, req } as Parameters<Payload["update"]>[0]);
			await bumpEditorRevision(txExec(cms, req), Number(input.siteId), { site: true });
		}
		// soft delete, as the editor's page manager does (the base row; the draft rows don't carry deleted_at)
		await executeTenantTransaction(cms, req, sql`UPDATE pages SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${Number(input.pageId)} AND site_id = ${Number(input.siteId)}`);
	});
	try {
		revalidateTag(`site-${input.siteId}`);
	} catch {
		// needs a Next.js request context (absent in tests)
	}
	return { entities: [{ kind: "site_page", id: input.pageId }], links: editorLink(input.siteId) };
}

// ─── Menu and footer ───────────────────────────────────────────────────────

const NavPlanSchema = z.object({
	siteId: SiteId,
	change: NavChangeInputSchema.pick({ header: true, footer: true }),
	base: z.object({ header: z.string(), footer: z.string() }),
});

export async function applySiteNavPatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = NavPlanSchema.parse(raw);
	if (!plan.change.header && !plan.change.footer) throw new ChangeSetApplyError("This change has nothing to apply.", 422, true);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	const undo = await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
		const siteRow = await readSite(cms, plan.siteId, req);
		const current = currentFrame(siteRow as never);
		const now = frameFingerprint(current);
		if ((plan.change.header && now.header !== plan.base.header) || (plan.change.footer && now.footer !== plan.base.footer)) {
			throw new ChangeSetApplyError("The menu or footer changed after the assistant drafted this. Ask again.", 409, true);
		}
		// rebuilt from the stored lists with the same checks as the draft
		let built: ReturnType<typeof buildFrame>;
		try {
			built = buildFrame(current, plan.change);
		} catch (error) {
			if (error instanceof NavChangeError) throw new ChangeSetApplyError(error.message, 422, true);
			throw error;
		}
		const data: Record<string, unknown> = {};
		if (built.header) data.pendingHeaderBlock = built.header;
		if (built.footer) data.pendingFooterBlock = built.footer;
		await cms.update({ collection: "sites", id: plan.siteId, data, req } as Parameters<Payload["update"]>[0]);
		await bumpEditorRevision(txExec(cms, req), Number(plan.siteId), { site: true });
		const saved = currentFrame((await readSite(cms, plan.siteId, req)) as never);
		return {
			header: built.header ? { previous: siteRow.pendingHeaderBlock ?? null, after: blockHash(saved.header) } : null,
			footer: built.footer ? { previous: siteRow.pendingFooterBlock ?? null, after: blockHash(saved.footer) } : null,
		};
	});
	return { entities: [{ kind: "site_navigation", id: plan.siteId }], links: editorLink(plan.siteId), undo: { kind: "site.nav_restore", payload: { siteId: plan.siteId, ...undo }, until: until() } };
}

// ─── Languages (Quick language) ────────────────────────────────────────────

const LanguagesPlanSchema = z.object({
	siteId: SiteId,
	change: SiteLanguagesInputSchema.shape.change,
	locale: z.enum(SITE_LANGUAGES).nullable(),
	base: z.string(),
});

/** Add / remove the second language or change the primary one: the menu draft, rebuilt from the stored one. */
export async function applySiteLanguagesPatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = LanguagesPlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	const undo = await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
		const siteRow = await readSite(cms, plan.siteId, req);
		const header = currentFrame(siteRow as never).header as Record<string, unknown> | null;
		if (!header || blockHash(header as PageBlock) !== plan.base) {
			throw new ChangeSetApplyError("The menu or its languages changed after the assistant drafted this. Ask again.", 409, true);
		}
		const next = languagesHeader(header, siteRow as never, { siteId: plan.siteId, why: "-", change: plan.change, locale: plan.locale });
		if ("error" in next) throw new ChangeSetApplyError(String((next.error as { message: string }).message), 409, true);
		// the editor's Make Default also moves the language it shows (Sites.locale, the language last viewed): it
		// opens in the new primary language, as it does after the merchant made it primary by hand
		const viewed = plan.change === "make_primary" && (plan.locale === "en" || plan.locale === "ms") ? plan.locale : null;
		const previousLocale = (siteRow as { locale?: unknown }).locale;
		await cms.update({ collection: "sites", id: plan.siteId, data: { pendingHeaderBlock: next, ...(viewed ? { locale: viewed } : {}) }, req } as Parameters<Payload["update"]>[0]);
		await bumpEditorRevision(txExec(cms, req), Number(plan.siteId), { site: true });
		const saved = currentFrame((await readSite(cms, plan.siteId, req)) as never);
		return {
			header: { previous: siteRow.pendingHeaderBlock ?? null, after: blockHash(saved.header) },
			footer: null,
			...(viewed && (previousLocale === "en" || previousLocale === "ms") ? { locale: { previous: previousLocale, after: viewed } } : {}),
		};
	});
	return { entities: [{ kind: "site_navigation", id: plan.siteId }], links: editorLink(plan.siteId), undo: { kind: "site.nav_restore", payload: { siteId: plan.siteId, ...undo }, until: until() } };
}

const Restore = (blockType: string) =>
	z.object({ previous: z.record(z.string(), z.unknown()).nullable().refine((b) => b === null || b.blockType === blockType), after: z.string() }).nullable();
const LocaleRestore = z.object({ previous: z.enum(["en", "ms"]), after: z.enum(["en", "ms"]) });
const NavRestoreSchema = z.object({ siteId: SiteId, header: Restore("navigation"), footer: Restore("footer"), locale: LocaleRestore.optional() });

export async function applySiteNavRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const input = NavRestoreSchema.parse(raw);
	const { tenantId } = await site(actor, input.siteId);
	const cms = await getPayload({ config });
	await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
		await lockTenantSiteRows(cms, tenantId, [Number(input.siteId)], req);
		const current = currentFrame((await readSite(cms, input.siteId, req)) as never);
		// each part is as the change left it (put back), or already back (undone in the editor): anything else was edited since
		const part = (now: unknown, saved: { previous: Record<string, unknown> | null; after: string } | null) =>
			!saved ? "skip" : blockHash(now as never) === saved.after ? "undo" : saved.previous && blockHash(now as never) === blockHash(saved.previous as never) ? "done" : "edited";
		const parts = { header: part(current.header, input.header), footer: part(current.footer, input.footer) };
		if (parts.header === "edited" || parts.footer === "edited") {
			throw new ChangeSetApplyError("The menu or footer was edited after the assistant changed it, so this can't be undone from here. Change it back in the editor.", 409);
		}
		const touched = { header: parts.header === "undo", footer: parts.footer === "undo" };
		if (!touched.header && !touched.footer && !input.locale) return;
		assertSafeBlock(input.header?.previous ?? null);
		assertSafeBlock(input.footer?.previous ?? null);
		const data: Record<string, unknown> = {};
		if (input.header && touched.header) data.pendingHeaderBlock = input.header.previous;
		if (input.footer && touched.footer) data.pendingFooterBlock = input.footer.previous;
		// the language shown goes back too, unless the editor moved it since
		const siteRow = (await readSite(cms, input.siteId, req)) as { locale?: unknown };
		if (input.locale && siteRow.locale === input.locale.after) data.locale = input.locale.previous;
		await cms.update({ collection: "sites", id: input.siteId, data, req } as Parameters<Payload["update"]>[0]);
		await bumpEditorRevision(txExec(cms, req), Number(input.siteId), { site: true });
	});
	return { entities: [{ kind: "site_navigation", id: input.siteId }], links: editorLink(input.siteId) };
}

// ─── Publish ───────────────────────────────────────────────────────────────

const PublishPlanSchema = z.object({ siteId: SiteId, pages: z.record(z.string(), z.string()), frame: z.string() });

export async function applySitePublish(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = PublishPlanSchema.parse(raw);
	const { tenantId } = await site(actor, plan.siteId);
	const cms = await getPayload({ config });
	await assertBuilder(cms, tenantId);
	// the same limit as the editor's Publish button
	const limit = await checkTwoTierRateLimit(`publish:${String(actor.user.id)}`, 5, 30);
	if (!limit.allowed) throw new ChangeSetApplyError("The site was published several times just now. Try again in a minute.", 409);
	// Publish exactly what the merchant reviewed, atomically: the check and the publish run in one tenant
	// transaction under the site lock (editor saves and other copilot changes wait for it), and either every
	// page goes live or none does. Cache revalidation runs once it committed.
	const afterCommit: Array<() => void> = [];
	let published: PublishSiteResult;
	try {
		published = await withTenantRowLock(cms, tenantId, async (req: TenantTransactionRequest) => {
			await lockTenantSiteRows(cms, tenantId, [Number(plan.siteId)], req);
			const now = publishFingerprint((await readSite(cms, plan.siteId, req)) as never, await sitePages(cms, plan.siteId, null, req));
			if (now.frame !== plan.frame || blockHash(now.pages) !== blockHash(plan.pages)) {
				throw new ChangeSetApplyError("The site changed after the assistant checked it. Ask again so the check runs on the latest version.", 409, true);
			}
			return publishSite({ payload: cms, user: actor.user as { id: string | number }, siteId: plan.siteId, body: {}, pw1Grant: null, tx: { req, afterCommit: (task) => afterCommit.push(task) } });
		});
		for (const task of afterCommit) task();
	} catch (error) {
		// a page failed: the transaction rolled back, nothing went live
		if (!(error instanceof PublishRolledBack)) throw error;
		published = error.result;
	}
	if (published.status >= 500) throw new Error(`publish failed (${published.status})`);
	if (published.status !== 200) {
		const error = (published.body.error ?? {}) as { message?: string; failures?: Array<{ pageTitle?: string; friendlyDetail?: string }> };
		const detail = error.failures?.map((f) => [f.pageTitle, f.friendlyDetail].filter(Boolean).join(": ")).filter(Boolean).slice(0, 3).join("; ");
		const message = [error.message ?? "The site could not be published.", detail].filter(Boolean).join(" ");
		throw new ChangeSetApplyError(message.slice(0, 500), published.status === 403 ? 403 : published.status === 409 ? 422 : 409, published.status === 409);
	}
	const data = (published.body.data ?? {}) as { url?: string; domain?: string };
	return {
		entities: [{ kind: "site", id: plan.siteId }],
		links: [...(data.url ? [{ label: `Open ${data.domain ?? "the live site"}`, href: data.url }] : []), ...editorLink(plan.siteId)],
	};
}

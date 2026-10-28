import "server-only";

import config from "@payload-config";
import { sql } from "drizzle-orm";
import { getPayload, type Payload, type User } from "payload";
import { z } from "zod";
import { executeTenantTransaction, type TenantTransactionRequest } from "@/lib/payload/tenant-row-lock";
import type { AgentActor } from "../context";
import { blockHash, blockIdOf, blockName, isStableBlockId, type PageBlock, STRUCTURAL_BLOCKS } from "./site-blocks";
import { sectionCopyNotes } from "./site-copy-check";
import { currentFrame, missingPaths } from "./site-nav";
import type { PreparedSiteChange } from "./site-prepare";
import { sampleText } from "./site-samples";
import { layoutOf, siteForActor } from "./site-read";
import type { LocaleContent } from "./site-seo-translate";
import { LANGUAGE_NAME, translationCoverage } from "./site-languages";

/**
 * "What is still missing?" (`site_read` view "check") and publishing
 * (`site.publish`) for the web builder copilot. The check is read-only; each
 * item names the tool that can fix it, so the model can offer to do it.
 */

const Id = z.union([z.string().min(1).max(40), z.number().int().positive()]).transform(String);

type SiteDoc = {
	id: string | number;
	name?: string;
	status?: string;
	generationLocale?: string;
	locale?: string;
	headerBlock?: unknown;
	pendingHeaderBlock?: unknown;
	footerBlock?: unknown;
	pendingFooterBlock?: unknown;
	globalBlocks?: unknown;
	pendingGlobalBlocks?: unknown;
};
type PageDoc = { id: string | number; title?: string; slug?: string; isHomepage?: boolean; isVisible?: boolean; _status?: string; seo?: { title?: string | null; description?: string | null } | null; layout?: unknown; localeContent?: LocaleContent };

/**
 * The site's pages as the editor has them (drafts), soft-deleted ones left out (their draft rows don't say so).
 * With `req` every read runs in that tenant transaction (the publish applier checks under the lock).
 */
export async function sitePages(cms: Payload, siteId: string | number, user: User | null, req?: TenantTransactionRequest, limit = 200): Promise<PageDoc[]> {
	const pool = cms.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> } };
	const execute = (query: ReturnType<typeof sql>) =>
		req ? executeTenantTransaction<{ rows: Array<Record<string, unknown>> }>(cms, req, query) : pool.drizzle.execute(query);
	const deleted = new Set((await execute(sql`SELECT id FROM pages WHERE site_id = ${Number(siteId)} AND deleted_at IS NOT NULL`)).rows.map((r) => String(r.id)));
	const result = await cms.find({
		collection: "pages",
		where: { site: { equals: siteId } },
		draft: true,
		depth: 0,
		limit,
		...(user ? { overrideAccess: false, user } : {}),
		...(req ? { req } : {}),
	} as Parameters<typeof cms.find>[0]);
	const pages = (result.docs as unknown as PageDoc[]).filter((p) => !deleted.has(String(p.id)));
	// the per-section translations (`pages.locale_content`, not a Payload field), in one read
	const ids = pages.map((p) => Number(p.id)).filter(Number.isFinite);
	if (ids.length > 0) {
		const rows = (await execute(sql`SELECT id, locale_content FROM pages WHERE site_id = ${Number(siteId)} AND id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)).rows as Array<{ id: unknown; locale_content?: unknown }>;
		const byId = new Map(rows.map((r) => [String(r.id), r.locale_content && typeof r.locale_content === "object" ? (r.locale_content as LocaleContent) : {}]));
		for (const page of pages) page.localeContent = byId.get(String(page.id)) ?? {};
	}
	return pages;
}

const sectionsOf = (page: PageDoc) => layoutOf(page as never).filter((b) => !STRUCTURAL_BLOCKS.has(String(b.blockType)));

/**
 * What publishing would put live, fingerprinted: every page draft (content, title, address, SEO) and the
 * pending menu/footer/widgets. Drafting and applying compute it the same way, so a change in between is caught.
 */
export function publishFingerprint(site: SiteDoc, pages: PageDoc[]): { pages: Record<string, string>; frame: string } {
	return {
		pages: Object.fromEntries(pages.map((p) => [String(p.id), blockHash({ title: p.title ?? "", slug: p.slug ?? "", seo: p.seo ?? null, visible: p.isVisible !== false, layout: layoutOf(p as never), translations: p.localeContent ?? {} })])),
		frame: blockHash({ header: site.pendingHeaderBlock ?? null, footer: site.pendingFooterBlock ?? null, globals: site.pendingGlobalBlocks ?? null }),
	};
}

type CheckItem = { code: string; message: string; pageId?: string; page?: string; count?: number; fix: string | null };

/** The checks a merchant should see before publishing, each with the tool that fixes it. */
async function checkItems(actor: Pick<AgentActor, "tenantId">, cms: Payload, site: SiteDoc, pages: PageDoc[], options: { light?: boolean } = {}): Promise<CheckItem[]> {
	const items: CheckItem[] = [];
	for (const page of pages) {
		const label = page.title || page.slug || String(page.id);
		const sections = sectionsOf(page);
		if (sections.length === 0) items.push({ code: "empty_page", pageId: String(page.id), page: label, message: `"${label}" has no sections yet.`, fix: "propose_page_patch (insert_block)" });
		const missing = [!page.seo?.title?.trim() && "title", !page.seo?.description?.trim() && "description"].filter(Boolean);
		if (missing.length > 0) items.push({ code: "missing_seo", pageId: String(page.id), page: label, message: `"${label}" has no SEO ${missing.join(" or ")}.`, fix: "propose_page_seo" });
	}

	// anti-slop: made-up sample content and filler copy visitors see as the shop's own words
	let copyItems = 0;
	for (const page of options.light ? [] : pages) {
		const label = page.title || page.slug || String(page.id);
		for (const [i, block] of layoutOf(page as never).entries()) {
			if (STRUCTURAL_BLOCKS.has(String(block.blockType))) continue;
			const section = `"${label}" › ${blockName(block)} (${blockIdOf(block, i)})`;
			const sample = sampleText(block);
			if (sample) items.push({ code: "sample_content", pageId: String(page.id), page: label, message: `${section}: ${sample}`, fix: "propose_page_patch: edit_list with the merchant's own items (ask for them), or remove_block" });
			const notes = copyItems < 12 ? sectionCopyNotes(block, 2) : [];
			copyItems += notes.length;
			for (const note of notes) items.push({ code: "generic_copy", pageId: String(page.id), page: label, message: `${section} → ${note.path}: ${note.text}: ${note.why}.`, fix: "propose_page_patch: set_value with what is true of this shop (ask the merchant for the facts)" });
		}
	}

	const frame = currentFrame(site);
	// every language of the site but the one the pages are written in (the primary one too, after Make Default)
	const coverage = translationCoverage(site, options.light ? [] : pages);
	for (const page of coverage.pages) {
		for (const [locale, untranslated] of Object.entries(page.missing)) {
			if (untranslated === 0 || (locale !== "en" && locale !== "ms")) continue;
			items.push({ code: "missing_translation", pageId: page.pageId, page: page.page, count: untranslated, message: `"${page.page}": ${untranslated} section${untranslated === 1 ? "" : "s"} not translated into ${LANGUAGE_NAME[locale]}.`, fix: `propose_page_translation (locale "${locale}")` });
		}
	}

	const paths = new Set(pages.map((p) => p.slug ?? "").filter(Boolean));
	const cure = (path: string) => `or propose_new_page at ${path} (a products page: a products-grid section) if the shop wants that page`;
	for (const path of missingPaths([frame.header?.links ?? [], frame.footer?.columns ?? []], paths)) {
		items.push({ code: "broken_menu_link", message: `The menu or footer links to ${path}, but no page has that address: visitors get "page not found".`, fix: `propose_navigation with a page that exists, ${cure(path)}` });
	}
	const button = frame.header?.ctaButton as { label?: string; url?: string; show?: boolean } | undefined;
	if (button?.show !== false) {
		for (const path of missingPaths([button ?? null], paths)) {
			items.push({ code: "broken_menu_button", message: `The menu button "${button?.label ?? ""}" links to ${path}, but no page has that address.`, fix: `propose_navigation menuButton with a page that exists, ${cure(path)}` });
		}
	}
	// links inside sections (buttons, cards) that lead nowhere
	for (const page of pages) {
		const label = page.title || page.slug || String(page.id);
		for (const [i, block] of sectionsOf(page).entries()) {
			for (const path of missingPaths(block, paths)) {
				items.push({ code: "broken_link", pageId: String(page.id), page: label, message: `"${label}" › ${blockName(block)} (${blockIdOf(block, i)}) links to ${path}, but no page has that address.`, fix: `propose_page_patch set_value on that link, ${cure(path)}` });
			}
		}
	}

	const drafts = pages.filter((p) => p._status === "draft").length;
	const frameDraft = site.pendingHeaderBlock != null || site.pendingFooterBlock != null || site.pendingGlobalBlocks != null;
	if (site.status !== "published") items.push({ code: "not_published", message: "The website is not published yet.", fix: "propose_publish" });
	else if (drafts > 0 || frameDraft) {
		items.push({ code: "unpublished_changes", count: drafts, message: `Changes are waiting to go live (${drafts} page${drafts === 1 ? "" : "s"}${frameDraft ? ", the menu or footer" : ""}).`, fix: "propose_publish" });
	}

	if (options.light) return items;
	try {
		const { evaluateAuthoritativeLocalSeo } = await import("@/lib/seo/local-seo-evaluation");
		const { response } = await evaluateAuthoritativeLocalSeo(cms as never, String(site.id), actor.tenantId);
		for (const issue of response.issues.slice(0, 10)) {
			if (issue.code === "meta-title" || issue.code === "meta-description" || issue.code === "store-unpublished") continue; // covered above
			items.push({ code: `local_seo:${issue.code}`, count: issue.count, message: `Local SEO: ${issue.code.replace(/-/g, " ")}${issue.count > 1 ? ` (${issue.count})` : ""}.`, fix: null });
		}
	} catch (error) {
		console.warn("[site-check] local SEO evaluation skipped", error instanceof Error ? error.message : error);
	}
	return items;
}

export async function readSiteCheck(actor: AgentActor, siteId: string | number) {
	const { site } = await siteForActor(actor, siteId);
	const cms = await getPayload({ config });
	const pages = await sitePages(cms, site.id, actor.user as unknown as User);
	const items = await checkItems(actor, cms, site as SiteDoc, pages);
	return {
		site: { id: String(site.id), name: site.name ?? "", status: site.status ?? "draft", pages: pages.length },
		note: "Offer to fix these one by one with the tool named in fix; local SEO items without a tool are fixed in the dashboard's SEO page.",
		items: items.slice(0, 40),
		...(items.length > 40 ? { more: items.length - 40 } : {}),
	};
}

/** Most page drafts the To do counts read (the full check reads up to 200). */
export const COUNTS_PAGE_CAP = 60;

/**
 * Counts of what is wrong with a site, for the dashboard's To do card and scheduled checks (no actor, no
 * request): the same checks as `readSiteCheck` minus the slow ones (copy review, translations, local SEO).
 * The site must belong to `tenantId`; anything else reads as "no site" (null).
 */
export async function readSiteCheckCounts(cms: Payload, siteId: string | number, tenantId: string | number) {
	const site = (await cms.findByID({ collection: "sites", id: siteId, depth: 0, overrideAccess: true, disableErrors: true } as Parameters<Payload["findByID"]>[0])) as (SiteDoc & { tenant?: unknown }) | null;
	const owner = site && typeof site.tenant === "object" && site.tenant ? (site.tenant as { id?: unknown }).id : site?.tenant;
	if (!site || String(owner) !== String(tenantId)) return null;
	// the dashboard reads this on a busy page: the first COUNTS_PAGE_CAP pages are enough for a count (a bigger site counts those)
	const pages = await sitePages(cms, site.id, null, undefined, COUNTS_PAGE_CAP);
	const items = await checkItems({ tenantId: String(tenantId) }, cms, site, pages, { light: true });
	const count = (...codes: string[]) => items.filter((item) => codes.includes(item.code)).length;
	return {
		siteId: String(site.id),
		published: site.status === "published",
		pages: pages.length,
		/** pages with a draft that is not live yet (+ the menu / footer when those have a draft) */
		unpublished: (() => {
			const waiting = items.find((item) => item.code === "unpublished_changes");
			return waiting ? Math.max(1, waiting.count ?? 0) : 0;
		})(),
		brokenLinks: count("broken_menu_link", "broken_menu_button", "broken_link"),
		pagesMissingSeo: count("missing_seo"),
	};
}

// ─── Publish ───────────────────────────────────────────────────────────────

export const PublishInputSchema = z.object({ siteId: Id, why: z.string().min(1).max(300) });

export async function preparePublish(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = PublishInputSchema.parse(raw);
	const { site } = await siteForActor(actor, input.siteId);
	const cms = await getPayload({ config });
	const pages = await sitePages(cms, site.id, actor.user as unknown as User);
	const doc = site as SiteDoc;
	const firstTime = doc.status !== "published";
	const changed = firstTime ? pages : pages.filter((p) => p._status === "draft");
	const frameDraft = doc.pendingHeaderBlock != null || doc.pendingFooterBlock != null || doc.pendingGlobalBlocks != null;
	if (pages.length === 0) return { error: { code: "no_pages", message: "This website has no pages to publish." } };
	if (!firstTime && changed.length === 0 && !frameDraft) return { error: { code: "no_change", message: "Everything is already live." } };

	const siteName = doc.name?.trim() || "site";
	const warnings = (await checkItems(actor, cms, doc, pages)).filter((i) => i.code !== "not_published" && i.code !== "unpublished_changes");
	return {
		kind: "site.publish",
		title: `${firstTime ? "Publish" : "Update"} the live site: ${siteName}`.slice(0, 200),
		why: input.why,
		risk: "high",
		diffs: [
			...changed.map((p) => ({ entity: { kind: "site_page", id: String(p.id), label: p.title || p.slug || String(p.id) }, field: "live site", before: firstTime ? "Not live yet" : "What visitors see now", after: `This draft (${p.slug ?? ""})` })),
			...(doc.pendingHeaderBlock != null ? [{ entity: { kind: "site_navigation", id: String(site.id), label: `Menu · ${siteName}` }, field: "menu", before: "Live menu", after: "The menu from the draft" }] : []),
			...(doc.pendingFooterBlock != null ? [{ entity: { kind: "site_navigation", id: String(site.id), label: `Footer · ${siteName}` }, field: "footer", before: "Live footer", after: "The footer from the draft" }] : []),
			...(doc.pendingGlobalBlocks != null ? [{ entity: { kind: "site", id: String(site.id), label: siteName }, field: "widgets", before: "Live widgets", after: "The cart / chat buttons from the draft" }] : []),
		].slice(0, 200),
		guardrails: [
			{ rule: "live", ok: true, detail: "Visitors see these pages right after you approve. It can't be undone from the chat; unpublish or change pages in the editor." },
			{ rule: "version_guard", ok: true, detail: "Only published if nothing on the site changed since this was drafted." },
			...warnings.slice(0, 8).map((w) => ({ rule: w.code, ok: false, detail: w.message })),
			...(warnings.length > 8 ? [{ rule: "more_checks", ok: false, detail: `${warnings.length - 8} more things could be better; ask "what is missing?" to see them.` }] : []),
		],
		confirmText: siteName.slice(0, 200),
		plan: { siteId: String(site.id), ...publishFingerprint(doc, pages) },
	};
}

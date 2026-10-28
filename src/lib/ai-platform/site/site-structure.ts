import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { sanitizeText } from "@/utils/sanitize";
import type { AgentActor } from "../context";
import { blockName, type PageBlock, STRUCTURAL_BLOCKS } from "./site-blocks";
import { appendMenuLink, currentFrame, frameFingerprint, NavChangeError } from "./site-nav";
import { brandOf, slotLocaleOf } from "./site-locale-view";
import { PagePatchError, type PagePatchOp, PagePatchOpSchema, runPagePatch } from "./site-patch";
import { checkPagePatchOps, draftPageEdit, pageEditGuardrails, type PreparedSiteChange } from "./site-prepare";
import { copyGuardrails, copyNotes, copyRefusal } from "./site-copy-check";
import { draftPage, siteForActor } from "./site-read";

/**
 * Site-level changes of the web builder copilot: one edit across several pages
 * (`site.pages_patch`) and a new page (`site.page_create`). Drafted from fresh
 * reads with the merchant's access; applied by `appliers/site-structure.ts`.
 */

const Id = z.union([z.string().min(1).max(40), z.number().int().positive()]).transform(String);
type Refusal = { error: { code: string; message: string } };

// ─── One edit across several pages ─────────────────────────────────────────

export const MAX_PAGES_PER_CHANGE = 10;
/** above this many pages the card asks Yes / No before it applies */
const TYPED_CONFIRM_PAGES = 3;

export const SitePatchInputSchema = z.object({
	siteId: Id,
	why: z.string().min(1).max(300),
	pages: z.array(z.object({ pageId: Id, ops: z.array(PagePatchOpSchema).min(1).max(30) })).min(2).max(MAX_PAGES_PER_CHANGE),
	keepWording: z.boolean().optional(),
	/** the language on the editor canvas (set by the platform from the pin, never by the model) */
	language: z.string().max(12).optional(),
});

export async function prepareSitePatch(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | Refusal> {
	const input = SitePatchInputSchema.parse(raw);
	if (new Set(input.pages.map((p) => p.pageId)).size !== input.pages.length) {
		return { error: { code: "bad_patch", message: "Name each page once, with all of its ops." } };
	}
	const { site, tenantId } = await siteForActor(actor, input.siteId);
	const locale = slotLocaleOf(site, input.language);
	const drafted = [];
	for (const { pageId, ops } of input.pages) {
		const page = await draftPage(actor, site.id, pageId);
		const edit = await draftPageEdit(actor, tenantId, page as never, ops, input.keepWording, locale, brandOf(site));
		if ("error" in edit) return { error: { code: edit.error.code, message: `Page "${page.title ?? pageId}": ${edit.error.message}` } };
		drafted.push(edit);
	}
	const diffs = drafted.flatMap((d) => d.diffs);
	if (diffs.length > 200) return { error: { code: "too_large", message: "That is more than 200 changes in one go — split it into fewer pages." } };
	const sections = drafted.reduce((n, d) => n + d.touched.size, 0);
	const many = drafted.length > TYPED_CONFIRM_PAGES;
	const siteName = site.name?.trim() || "site";
	const hosts = new Set(drafted.flatMap((d) => [...d.hosts]));
	return {
		kind: "site.pages_patch",
		title: `Edit ${drafted.length} pages: ${siteName}`.slice(0, 200),
		why: input.why,
		risk: many ? "high" : "medium",
		diffs,
		guardrails: [
			{ rule: "all_or_nothing", ok: true, detail: `All ${drafted.length} pages change together (${sections} section${sections === 1 ? "" : "s"}), or none does if one of them was edited since.` },
			...pageEditGuardrails(hosts, drafted.flatMap((d) => d.skipped), drafted.flatMap((d) => d.copy).slice(0, 12), drafted.find((d) => d.locale)?.locale ?? null),
		],
		...(many ? { confirmText: siteName.slice(0, 200) } : {}),
		plan: {
			siteId: String(site.id),
			pages: drafted.map((d) => ({ pageId: d.pageId, ops: d.ops, expect: d.expect, ...(d.planLocale ? { locale: d.planLocale as "en" | "ms", localeExpect: d.localeExpect } : {}) })),
		},
	};
}

// ─── A new page ────────────────────────────────────────────────────────────

export const MAX_PAGES_PER_SITE = 100;
/** Addresses the storefront itself serves (`app/sites/[slug]/*`); /products, /shop or /blog are ordinary pages. */
const RESERVED = new Set(["/", "/404", "/checkout", "/order-status"]);
const RESERVED_UNDER = ["/products/", "/blog/", "/blogs/", "/order-status/"];

export const PageCreateInputSchema = z.object({
	siteId: Id,
	why: z.string().min(1).max(300),
	title: z.string().min(1).max(100),
	slug: z.string().min(1).max(80),
	sections: z.array(z.record(z.string(), z.unknown())).min(1).max(12),
	menuLabel: z.string().max(60).nullable().default(null),
	keepWording: z.boolean().optional(),
});

/** "About us" / "about-us" / "/promo/11-11" → "/about-us", "/promo/11-11"; null when it can't be a page path. */
export function normalizeSlug(raw: string): string | null {
	const slug = `/${raw.trim().toLowerCase().replace(/^\/+/, "").replace(/\s+/g, "-").replace(/\/+$/, "")}`;
	return /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/.test(slug) ? slug : null;
}

export function reservedSlug(slug: string): boolean {
	return RESERVED.has(slug) || RESERVED_UNDER.some((prefix) => slug.startsWith(prefix));
}

/** The new page's sections as checked inserts, in order (each inserted at the top, in reverse). */
export function sectionOps(sections: Array<Record<string, unknown>>): PagePatchOp[] {
	return [...sections].reverse().map((block) => ({ op: "insert_block" as const, afterBlockId: null, block }));
}

export async function preparePageCreate(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | Refusal> {
	const input = PageCreateInputSchema.parse(raw);
	const { site, tenantId } = await siteForActor(actor, input.siteId);
	const title = sanitizeText(input.title).trim();
	if (!title) return { error: { code: "bad_title", message: "The page needs a title." } };
	const slug = normalizeSlug(input.slug);
	if (!slug) return { error: { code: "bad_slug", message: `"${input.slug.slice(0, 80)}" can't be a page address. Use lowercase words with dashes, e.g. about-us.` } };
	if (reservedSlug(slug)) return { error: { code: "reserved_slug", message: `${slug} is kept for the shop itself. Choose another address.` } };

	const cms = await getPayload({ config });
	const user = actor.user as unknown as User;
	const live = { and: [{ site: { equals: site.id } }, { deletedAt: { exists: false } }] };
	const [taken, count] = await Promise.all([
		cms.find({ collection: "pages", where: { and: [...live.and, { slug: { equals: slug } }] }, limit: 1, depth: 0, overrideAccess: false, user } as Parameters<typeof cms.find>[0]),
		cms.count({ collection: "pages", where: live, overrideAccess: false, user } as unknown as Parameters<typeof cms.count>[0]),
	]);
	if (taken.docs.length > 0) return { error: { code: "slug_taken", message: `A page already has the address ${slug}. Choose another one.` } };
	if (count.totalDocs >= MAX_PAGES_PER_SITE) return { error: { code: "too_many_pages", message: `This site has the most pages it can have (${MAX_PAGES_PER_SITE}).` } };
	if (input.sections.some((s) => STRUCTURAL_BLOCKS.has(String(s.blockType)))) {
		return { error: { code: "structural", message: "The menu and footer are added to every page by themselves; send only the page's own sections." } };
	}

	const checked = await checkPagePatchOps(actor, tenantId, [], sectionOps(input.sections), "prepare");
	if ("error" in checked) return checked;
	const copy = copyNotes([], checked.ops, title);
	if (copy.length > 0 && !input.keepWording) return copyRefusal(copy);
	let blocks: PageBlock[];
	try {
		blocks = runPagePatch([], checked.ops).next;
	} catch (error) {
		if (error instanceof PagePatchError) return { error: { code: "bad_patch", message: error.message } };
		throw error;
	}

	const frame = currentFrame(site as never);
	let menuLine: PreparedSiteChange["diffs"][number] | null = null;
	// links already leading to this address (they showed "page not found"): the new page fixes them, and the
	// menu needs no second entry for it
	const leadingHere = [
		...menuLinks(frame.header).flatMap((l) => [l, ...(l.children ?? [])]).filter((l) => samePath(l.url, slug)).map((l) => `menu “${l.label}”`),
		...(() => {
			const button = frame.header?.ctaButton as { show?: boolean; label?: string; url?: string } | undefined;
			return button && button.show !== false && samePath(button.url, slug) ? [`the menu button “${button.label ?? ""}”`] : [];
		})(),
	];
	const inMenu = menuLinks(frame.header).some((l) => samePath(l.url, slug));
	const menuLabel = input.menuLabel && !inMenu ? sanitizeText(input.menuLabel).trim() : "";
	if (menuLabel) {
		try {
			const built = { header: appendMenuLink(frame.header, menuLabel, slug) };
			menuLine = {
				entity: { kind: "site_navigation", id: String(site.id), label: `Menu · ${site.name ?? "site"}` },
				field: "menu links",
				before: menuLinks(frame.header).map((l) => l.label).join(" · ") || null,
				after: menuLinks(built.header).map((l) => l.label).join(" · "),
			};
		} catch (error) {
			if (error instanceof NavChangeError) return { error: { code: "invalid_link", message: error.message } };
			throw error;
		}
	}

	const entity = { kind: "site_page", id: slug, label: title };
	return {
		kind: "site.page_create",
		title: `New page: ${title}`.slice(0, 200),
		why: input.why,
		risk: "medium",
		diffs: [
			{ entity, field: "page", before: null, after: `"${title}" at ${slug} (draft)` },
			...blocks.map((block, i) => ({ entity, field: `section ${i + 1}`, before: null, after: `${blockName(block)}` })),
			...(menuLine ? [menuLine] : []),
		],
		guardrails: [
			{ rule: "draft_page", ok: true, detail: "The page is a draft; visitors see it after you publish." },
			{ rule: "frame", ok: true, detail: "It gets the same menu and footer as your other pages." },
			{ rule: "undo", ok: true, detail: "You can undo it for 7 days while the page (and the menu) stay as the assistant left them." },
			...(leadingHere.length > 0 ? [{ rule: "fixes_links", ok: true, detail: `Links to ${slug} work once this page is published: ${leadingHere.slice(0, 5).join(", ")}.` }] : []),
			...(input.menuLabel && inMenu ? [{ rule: "already_in_menu", ok: true, detail: `The menu already links to ${slug}, so no second entry is added.` }] : []),
			...checked.skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
			...copyGuardrails(copy),
		],
		plan: {
			siteId: String(site.id),
			title,
			slug,
			sections: checked.ops,
			menuLabel: menuLabel || null,
			base: frameFingerprint(frame),
		},
	};
}

const samePath = (url: unknown, slug: string) => typeof url === "string" && url.split(/[?#]/)[0]!.replace(/(.)\/+$/, "$1") === slug;

/** The menu's links as the strict {label, url, children} shape `buildFrame` takes. */
export function menuLinks(header: Record<string, unknown> | null): Array<{ label: string; url: string; children?: Array<{ label: string; url: string }> }> {
	const links = Array.isArray(header?.links) ? (header!.links as Array<Record<string, unknown>>) : [];
	return links.map((l) => ({
		label: String(l.label ?? ""),
		url: String(l.url ?? ""),
		...(Array.isArray(l.children) && l.children.length > 0 ? { children: (l.children as Array<Record<string, unknown>>).map((c) => ({ label: String(c.label ?? ""), url: String(c.url ?? "") })) } : {}),
	}));
}

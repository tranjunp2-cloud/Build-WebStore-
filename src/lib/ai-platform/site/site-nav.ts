import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { mergeFooterSocialsWithSite } from "@/lib/site-settings";
import { sanitizeText } from "@/utils/sanitize";
import type { AgentActor } from "../context";
import { blockHash, fieldSchema, forValidation, isSafeLink, linkHosts, previewValue } from "./site-blocks";
import { copyGuardrails, copyProblem, copyRefusal } from "./site-copy-check";
import type { PreparedSiteChange } from "./site-prepare";
import { siteForActor } from "./site-read";

/**
 * The site's menu (navigation) and footer for the web builder copilot. Both are
 * site-wide: the editor saves them to `sites.pendingHeaderBlock` /
 * `pendingFooterBlock`, and Publish promotes them to the live fields. The
 * copilot replaces the menu links, the shop name in the menu and its button,
 * the footer link columns, tagline, copyright and social links in that draft;
 * everything it does not name (logo picture, style, colours…) is kept.
 */

const Id = z.union([z.string().min(1).max(40), z.number().int().positive()]).transform(String);
const Link = z.object({ label: z.string().max(200), url: z.string().max(500) });
const HeaderLink = Link.extend({ children: z.array(Link).max(8).optional() });

export const NavChangeInputSchema = z.object({
	siteId: Id,
	why: z.string().min(1).max(300),
	header: z
		.object({
			links: z.array(HeaderLink).max(12).optional(),
			logoText: z.string().max(200).optional(),
			/** the menu's button (shown by the default style); null hides it */
			cta: z.object({ label: z.string().max(200), url: z.string().max(500) }).nullable().optional(),
		})
		.nullable()
		.default(null),
	footer: z
		.object({
			columns: z.array(z.object({ title: z.string().max(200), links: z.array(Link).max(10) })).max(4).optional(),
			tagline: z.string().max(400).optional(),
			copyrightText: z.string().max(300).optional(),
			socials: z.array(z.object({ platform: z.string().max(40), url: z.string().max(500) })).max(8).optional(),
		})
		.nullable()
		.default(null),
	/** the merchant's own words: generic-sounding copy is kept with a note instead of refused */
	keepWording: z.boolean().optional(),
});
export type NavChange = Pick<z.infer<typeof NavChangeInputSchema>, "header" | "footer">;

type SiteFrame = { headerBlock?: unknown; pendingHeaderBlock?: unknown; footerBlock?: unknown; pendingFooterBlock?: unknown };
type Block = Record<string, unknown>;

/** The menu and footer as the editor shows them: the draft, else the live ones. */
export function currentFrame(site: SiteFrame): { header: Block | null; footer: Block | null } {
	const pick = (pending: unknown, live: unknown) => ((pending ?? live) && typeof (pending ?? live) === "object" ? ((pending ?? live) as Block) : null);
	return { header: pick(site.pendingHeaderBlock, site.headerBlock), footer: pick(site.pendingFooterBlock, site.footerBlock) };
}

export function frameFingerprint(frame: { header: Block | null; footer: Block | null }): { header: string; footer: string } {
	return { header: blockHash(frame.header), footer: blockHash(frame.footer) };
}

export class NavChangeError extends Error {}

const clean = (value: string) => sanitizeText(value).trim();

function checkLink(link: { label: string; url: string }, where: string): { label: string; url: string } {
	const label = clean(link.label);
	const url = link.url.trim();
	if (!label || label.length > 60) throw new NavChangeError(`${where}: a link needs a label of 1–60 characters.`);
	if (!url || !isSafeLink(url)) {
		throw new NavChangeError(`${where}: "${url.slice(0, 80)}" is not a link a menu can hold (use a page path like /about or an https:// address).`);
	}
	return { label, url };
}

/** Locale copies of the replaced lists are dropped: the other language shows the new labels until translated. */
function withoutLocaleKey(block: Block, key: string): { block: Block; hadLocale: boolean } {
	const locales = block._localeContent;
	if (!locales || typeof locales !== "object") return { block, hadLocale: false };
	let hadLocale = false;
	const next = Object.fromEntries(
		Object.entries(locales as Record<string, Record<string, unknown> | undefined>).map(([locale, fields]) => {
			if (!fields || !(key in fields)) return [locale, fields];
			hadLocale = true;
			const { [key]: _dropped, ...rest } = fields;
			return [locale, rest];
		}),
	);
	return { block: { ...block, _localeContent: next }, hadLocale };
}

function sameLinks(next: Array<{ label: string; url: string; children?: Array<{ label: string; url: string }> }>, current: unknown): boolean {
	const shape = (links: unknown): unknown =>
		Array.isArray(links) ? (links as Block[]).map((l) => ({ label: String(l.label ?? "").trim(), url: String(l.url ?? "").trim(), children: shape(l.children ?? []) })) : [];
	return JSON.stringify(shape(next)) === JSON.stringify(shape(current));
}

/**
 * The new menu and footer blocks from the current ones and the requested lists. Pure; throws `NavChangeError`
 * for a value the model must fix. Used when drafting and again, from the stored request, when applying.
 */
export function buildFrame(current: { header: Block | null; footer: Block | null }, change: NavChange): { header: Block | null; footer: Block | null; localeDropped: boolean } {
	let localeDropped = false;
	let header: Block | null = null;
	let footer: Block | null = null;
	// the same links sent back unchanged keep the menu as it is (rebuilding it would drop its translated labels)
	if (change.header?.links && !sameLinks(change.header.links, current.header?.links)) {
		const previous = Array.isArray(current.header?.links) ? (current.header!.links as Block[]) : [];
		const links = change.header.links.map((raw, i) => {
			const link = checkLink(raw, `Menu link ${i + 1}`);
			const before = previous.find((p) => p.url === link.url) ?? {};
			const children = (raw.children ?? []).map((child, j) => checkLink(child, `Menu link ${i + 1}, sub-link ${j + 1}`));
			const { children: _oldChildren, ...kept } = before as Block;
			return { ...kept, ...link, ...(children.length > 0 ? { children } : {}) };
		});
		const schema = fieldSchema("navigation", "links");
		if (schema && !schema.safeParse(forValidation(links)).success) throw new NavChangeError("Those menu links don't fit the menu.");
		const dropped = withoutLocaleKey({ ...(current.header ?? { blockType: "navigation" }), links }, "links");
		header = dropped.block;
		localeDropped ||= dropped.hadLocale;
	}
	if (change.header && (change.header.logoText !== undefined || change.header.cta !== undefined)) {
		let next: Block = header ?? { ...(current.header ?? { blockType: "navigation" }) };
		if (change.header.logoText !== undefined) {
			const logoText = clean(change.header.logoText);
			if (logoText.length > 60) throw new NavChangeError("The shop name in the menu is longer than 60 characters.");
			next = { ...next, logoText };
		}
		if (change.header.cta !== undefined) {
			const before = (next.ctaButton && typeof next.ctaButton === "object" ? next.ctaButton : {}) as Block;
			next = { ...next, ctaButton: change.header.cta === null ? { ...before, show: false } : { ...before, show: true, ...checkLink(change.header.cta, "The menu button") } };
		}
		for (const key of ["logoText", "ctaButton"]) {
			const dropped = withoutLocaleKey(next, key);
			next = dropped.block;
			localeDropped ||= dropped.hadLocale;
		}
		header = next;
	}
	if (change.footer?.columns) {
		const previous = Array.isArray(current.footer?.columns) ? (current.footer!.columns as Block[]) : [];
		const columns = change.footer.columns.map((column, i) => {
			const title = clean(column.title);
			if (title.length > 60) throw new NavChangeError(`Footer column ${i + 1}: the title is longer than 60 characters.`);
			const before = previous.find((p) => p.title === title) ?? previous[i] ?? {};
			const oldLinks = Array.isArray(before.links) ? (before.links as Block[]) : [];
			const links = column.links.map((raw, j) => {
				const link = checkLink(raw, `Footer column ${i + 1}, link ${j + 1}`);
				return { ...(oldLinks.find((p) => p.url === link.url) ?? {}), ...link };
			});
			return { ...(typeof before.text === "string" ? { text: before.text } : {}), title, links };
		});
		const schema = fieldSchema("footer", "columns");
		if (schema && !schema.safeParse(forValidation(columns)).success) throw new NavChangeError("Those footer columns don't fit the footer.");
		const dropped = withoutLocaleKey({ ...(current.footer ?? { blockType: "footer" }), columns }, "columns");
		footer = dropped.block;
		localeDropped ||= dropped.hadLocale;
	}
	if (change.footer && (change.footer.tagline !== undefined || change.footer.copyrightText !== undefined || change.footer.socials !== undefined)) {
		let next: Block = footer ?? { ...(current.footer ?? { blockType: "footer" }) };
		for (const key of ["tagline", "copyrightText"] as const) {
			const value = change.footer[key];
			if (value === undefined) continue;
			const text = clean(value);
			if (text.length > (key === "tagline" ? 200 : 120)) throw new NavChangeError(`The footer ${key === "tagline" ? "tagline" : "copyright line"} is too long.`);
			next = { ...next, [key]: text };
		}
		if (change.footer.socials !== undefined) {
			const socials = change.footer.socials.map((social, i) => {
				const platform = clean(social.platform).toLowerCase();
				const url = social.url.trim();
				if (!platform) throw new NavChangeError(`Social link ${i + 1} needs its platform (facebook, instagram, tiktok…).`);
				if (!/^https:\/\//i.test(url) || !isSafeLink(url)) throw new NavChangeError(`Social link ${i + 1}: "${url.slice(0, 80)}" must be a full https:// address.`);
				return { platform, url };
			});
			next = { ...next, socials };
		}
		for (const key of ["tagline", "copyrightText"]) {
			const dropped = withoutLocaleKey(next, key);
			next = dropped.block;
			localeDropped ||= dropped.hadLocale;
		}
		footer = next;
	}
	return { header, footer, localeDropped };
}

/**
 * The menu with one more link at the end: the existing links (and their locale copies) stay exactly as they are;
 * each locale copy of the links gets the new link too, so the lists keep the same length.
 */
export function appendMenuLink(header: Block | null, label: string, url: string): Block {
	const link = checkLink({ label, url }, "The new menu link");
	const base = header ?? { blockType: "navigation", links: [] };
	const links = [...(Array.isArray(base.links) ? (base.links as Block[]) : []), link];
	const locales = base._localeContent && typeof base._localeContent === "object" ? (base._localeContent as Record<string, Record<string, unknown> | undefined>) : null;
	const localeContent = locales
		? Object.fromEntries(Object.entries(locales).map(([locale, fields]) => [locale, fields && Array.isArray(fields.links) ? { ...fields, links: [...(fields.links as Block[]), link] } : fields]))
		: undefined;
	return { ...base, links, ...(localeContent ? { _localeContent: localeContent } : {}) };
}

const lines = (links: unknown, nested = true): string | null => {
	if (!Array.isArray(links) || links.length === 0) return null;
	return previewValue(
		(links as Block[])
			.map((l) => `${String(l.label ?? "")} → ${String(l.url ?? "")}${nested && Array.isArray(l.children) && l.children.length > 0 ? ` (${(l.children as Block[]).map((c) => String(c.label ?? "")).join(", ")})` : ""}`)
			.join(" · "),
	);
};

/** Page paths of the site, to flag menu links that lead nowhere. */
export async function sitePaths(actor: AgentActor, siteId: string | number): Promise<Set<string>> {
	const cms = await getPayload({ config });
	const pages = await cms.find({
		collection: "pages",
		where: { and: [{ site: { equals: siteId } }, { deletedAt: { exists: false } }] },
		depth: 0,
		limit: 200,
		overrideAccess: false,
		user: actor.user as unknown as User,
		select: { slug: true },
	} as Parameters<typeof cms.find>[0]);
	return new Set((pages.docs as Array<{ slug?: string }>).map((p) => p.slug ?? "").filter(Boolean));
}

/**
 * Addresses the storefront serves without a page record (`app/sites/[slug]/*`): one product, one post,
 * checkout, order status. A bare /products, /shop or /blog is NOT one of them: it needs a page (templates
 * make a "Products" page with a products grid), else visitors get "page not found".
 */
const BUILT_IN = /^\/(checkout|order-status\/[^/]+|products\/[^/]+|blogs?\/[^/]+|sitemap\.xml|robots\.txt|llms\.txt)$/;

/** Is this site-internal address served (a page of the site, or a built-in storefront address)? */
export function servedPath(url: string, paths: Set<string>): boolean {
	const path = url.split(/[?#]/)[0]!.replace(/(.)\/+$/, "$1");
	if (!path.startsWith("/") || path.startsWith("//") || path === "/") return true;
	return paths.has(path) || BUILT_IN.test(path);
}

/** Internal paths among the links (url keys at any depth: menu links, sub-menus, columns, a button) that lead nowhere. */
export function missingPaths(links: unknown, paths: Set<string>, into = new Set<string>()): Set<string> {
	if (Array.isArray(links)) links.forEach((link) => missingPaths(link, paths, into));
	else if (links && typeof links === "object") {
		for (const [key, value] of Object.entries(links as Block)) {
			if (typeof value === "string" && /(url|href|link)$/i.test(key)) {
				if (!servedPath(value, paths)) into.add(value.split(/[?#]/)[0]!);
			} else if (value && typeof value === "object") missingPaths(value, paths, into);
		}
	}
	return into;
}

/** The footer's own values and, where it has none, what visitors see instead (the site's social links, a default copyright line). */
function shownFooter(footer: Block | null, site: Parameters<typeof mergeFooterSocialsWithSite>[1] & { name?: string | null }) {
	const own = Array.isArray(footer?.socials) && footer!.socials.length > 0;
	const merged = mergeFooterSocialsWithSite((footer ?? {}) as { socials?: Array<{ platform: string; url: string }>; logoText?: string }, site);
	return {
		tagline: footer?.tagline ?? null,
		copyright: footer?.copyrightText ?? null,
		...(footer?.copyrightText ? {} : { copyrightShown: `© ${new Date().getFullYear()} ${merged.logoText || "All rights reserved"}` }),
		socials: merged.socials,
		socialsFrom: own ? "footer" : merged.socials.length > 0 ? "the site's social links (settings): a list sent here replaces them in the footer" : "none",
	};
}

export async function readNavigation(actor: AgentActor, siteId: string | number) {
	const { site } = await siteForActor(actor, siteId);
	const frame = currentFrame(site as SiteFrame);
	const paths = await sitePaths(actor, site.id);
	return {
		site: { id: String(site.id), name: site.name ?? "" },
		note: "The menu and footer of every page, as the editor's draft has them; changes go live when the site is published.",
		menu: Array.isArray(frame.header?.links) ? (frame.header!.links as Block[]).map((l) => ({ label: l.label ?? "", url: l.url ?? "", children: Array.isArray(l.children) ? (l.children as Block[]).map((c) => ({ label: c.label ?? "", url: c.url ?? "" })) : [] })) : [],
		shopName: frame.header?.logoText ?? null,
		menuButton: frame.header?.ctaButton ?? null,
		footer: shownFooter(frame.footer, site as never),
		footerColumns: Array.isArray(frame.footer?.columns) ? (frame.footer!.columns as Block[]).map((c) => ({ title: c.title ?? "", links: Array.isArray(c.links) ? (c.links as Block[]).map((l) => ({ label: l.label ?? "", url: l.url ?? "" })) : [] })) : [],
		pages: [...paths].slice(0, 100),
		// links of the menu, its button and the footer that lead to "page not found"
		brokenLinks: [...missingPaths([frame.header?.links ?? [], frame.header?.ctaButton ?? null, frame.footer?.columns ?? []], paths)],
	};
}

export async function prepareNavChange(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = NavChangeInputSchema.parse(raw);
	if (!input.header && !input.footer) return { error: { code: "no_change", message: "Send what changes in the menu (links, shop name, button) and/or the footer (columns, tagline, copyright, social links)." } };
	const { site } = await siteForActor(actor, input.siteId);
	const current = currentFrame(site as SiteFrame);
	let built: ReturnType<typeof buildFrame>;
	try {
		built = buildFrame(current, input);
	} catch (error) {
		if (error instanceof NavChangeError) return { error: { code: "invalid_link", message: error.message } };
		throw error;
	}
	const siteName = site.name?.trim() || "site";
	// anti-slop on the copy this change adds: the footer tagline and the menu button
	const copy = [
		{ key: "tagline", text: built.footer?.tagline, was: current.footer?.tagline, where: `Footer · ${siteName} → tagline` },
		{ key: "ctaLabel", text: (built.header?.ctaButton as Block | undefined)?.label, was: (current.header?.ctaButton as Block | undefined)?.label, where: `Menu · ${siteName} → button` },
	].flatMap(({ key, text, was, where }) => {
		const why = typeof text === "string" && text !== was ? copyProblem(key, text) : null;
		return why ? [{ where, text: `“${String(text).slice(0, 70)}”`, why }] : [];
	});
	if (copy.length > 0 && !input.keepWording) return copyRefusal(copy);
	const diffs: PreparedSiteChange["diffs"] = [];
	const menu = { kind: "site_navigation", id: String(site.id), label: `Menu · ${siteName}` };
	const foot = { kind: "site_navigation", id: String(site.id), label: `Footer · ${siteName}` };
	const button = (b: unknown) => (b && typeof b === "object" && (b as Block).show !== false && (b as Block).label ? `${String((b as Block).label)} → ${String((b as Block).url ?? "")}` : null);
	if (built.header && built.header.logoText !== current.header?.logoText) diffs.push({ entity: menu, field: "shop name", path: "header.logoText", before: previewValue(current.header?.logoText), after: previewValue(built.header.logoText) ?? "(empty)" });
	if (built.header && button(built.header.ctaButton) !== button(current.header?.ctaButton)) diffs.push({ entity: menu, field: "menu button", path: "header.ctaButton", before: button(current.header?.ctaButton), after: button(built.header.ctaButton) ?? "Hidden" });
	for (const key of ["tagline", "copyrightText"] as const) {
		if (built.footer && built.footer[key] !== current.footer?.[key]) diffs.push({ entity: foot, field: key === "tagline" ? "tagline" : "copyright", path: `footer.${key}`, before: previewValue(current.footer?.[key]), after: previewValue(built.footer[key]) ?? "(empty)" });
	}
	const socials = (list: unknown) => (Array.isArray(list) && list.length > 0 ? (list as Block[]).map((s) => `${String(s.platform)} → ${String(s.url)}`).join(" · ") : null);
	// without its own list the footer shows the site's social links: that is the "before"
	if (built.footer && blockHash(built.footer.socials ?? null) !== blockHash(current.footer?.socials ?? null)) diffs.push({ entity: foot, field: "social links", path: "footer.socials", before: previewValue(socials(shownFooter(current.footer, site as never).socials)), after: previewValue(socials(built.footer.socials)) ?? "(none)" });
	if (built.header && blockHash(built.header.links) !== blockHash(current.header?.links ?? [])) {
		diffs.push({ entity: { kind: "site_navigation", id: String(site.id), label: `Menu · ${siteName}` }, field: "menu links", path: "header.links", before: lines(current.header?.links), after: lines(built.header.links) ?? "(no links)" });
	}
	if (built.footer && blockHash(built.footer.columns ?? null) !== blockHash(current.footer?.columns ?? null)) {
		const before = Array.isArray(current.footer?.columns) ? (current.footer!.columns as Block[]) : [];
		const after = (built.footer.columns ?? []) as Block[];
		for (let i = 0; i < Math.max(before.length, after.length); i++) {
			if (blockHash(before[i] ?? null) === blockHash(after[i] ?? null)) continue;
			const label = (c: Block | undefined) => (c ? `${String(c.title || "(no title)")}: ${lines(c.links, false) ?? "(no links)"}` : null);
			diffs.push({ entity: { kind: "site_navigation", id: String(site.id), label: `Footer · ${siteName}` }, field: `footer column ${i + 1}`, path: `footer.columns.${i}`, before: previewValue(label(before[i])), after: previewValue(label(after[i])) ?? "Removed" });
		}
	}
	if (diffs.length === 0) return { error: { code: "no_change", message: "The menu and footer already look like that." } };
	const missing = missingPaths([...(built.header ? [built.header.links, built.header.ctaButton] : []), ...(built.footer ? [built.footer.columns] : [])], await sitePaths(actor, site.id));
	const hosts = linkHosts([built.header?.links ?? [], built.header?.ctaButton ?? null, built.footer?.columns ?? [], built.footer?.socials ?? []]);
	return {
		kind: "site.nav_patch",
		title: `Menu and footer: ${siteName}`.slice(0, 200),
		why: input.why,
		risk: "medium",
		diffs,
		guardrails: [
			{ rule: "site_draft", ok: true, detail: "Changes the menu and footer of every page in the draft; visitors see it after you publish." },
			{ rule: "version_guard", ok: true, detail: "Only applied if the menu and footer are unchanged since." },
			{ rule: "undo", ok: true, detail: "You can undo it for 7 days while the menu and footer stay as the assistant left them." },
			...[...missing].slice(0, 5).map((path) => ({ rule: "missing_page", ok: false, detail: `No page has the address ${path} yet — that link would lead to "page not found".` })),
			...[...hosts].slice(0, 5).map((host) => ({ rule: "external_link", ok: true, detail: `Links to ${host} — check it is the address you want.` })),
			...(built.localeDropped ? [{ rule: "second_language", ok: false, detail: "The second language shows these new labels until you translate them in the editor." }] : []),
			...copyGuardrails(copy),
		],
		plan: { siteId: String(site.id), change: { header: input.header, footer: input.footer }, base: frameFingerprint(current) },
	};
}


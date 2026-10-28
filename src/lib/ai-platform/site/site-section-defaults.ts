import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import { normalizeAddSectionBlock } from "@/lib/ai/add-section";
import { patchBlockCtaUrls } from "@/lib/ai/patch-block-cta-urls";
import type { NavPageLike } from "@/lib/navigation-url";
import type { ThemeData } from "@/types/editor";
import type { AgentActor } from "../context";
import { editableKeys, isMediaKey, unsafeLinks } from "./site-blocks";
import { siteForActor } from "./site-read";

/**
 * Safety nets for a section the copilot adds, the ones the old editor chat had:
 * a section the model left incomplete takes the editor's template copy for what
 * is missing (in the site's language) instead of being refused, and the
 * template's placeholder buttons (`#contact`, `#`) are pointed at the site's
 * real pages. Whatever the model wrote always wins over a template value.
 *
 * Not carried over: the EN/MS `__localeInit` slots (the model writes the
 * section in the site's language; a template copy in the other language would
 * sit next to different text — `propose_page_translation` writes that slot)
 * and the gallery's starter pictures (a gallery without pictures already shows
 * the category's sample pictures, and the card says so).
 */

export type SectionContext = {
	siteName: string;
	/** template copy exists in English and Malay; any other site language gets English */
	locale: "en" | "ms";
	theme: ThemeData;
	/** null when the pages could not be read: placeholder links are then left as they are */
	pages: NavPageLike[] | null;
};

export type SectionContextLoader = () => Promise<SectionContext>;

/** Reads the site once, on first use (only an incomplete section needs it). */
export function sectionContextLoader(actor: AgentActor, siteId: string | number): SectionContextLoader {
	let loaded: Promise<SectionContext> | null = null;
	return () => (loaded ??= loadContext(actor, siteId));
}

async function loadContext(actor: AgentActor, siteId: string | number): Promise<SectionContext> {
	const { site } = await siteForActor(actor, siteId);
	const language = String(site.generationLocale || site.locale || "en");
	let pages: NavPageLike[] | null = null;
	try {
		const cms = await getPayload({ config });
		const found = await cms.find({
			collection: "pages",
			where: { site: { equals: site.id } },
			draft: true,
			depth: 0,
			limit: 50,
			overrideAccess: false,
			user: actor.user as unknown as User,
			select: { slug: true, isHomepage: true },
		} as Parameters<typeof cms.find>[0]);
		// no pages read back means nothing to point links at: keep the template's links
		pages = found.docs.length > 0 ? (found.docs as unknown as NavPageLike[]) : null;
	} catch (error) {
		console.error("[site-section-defaults] pages not read", error);
	}
	return { siteName: (site.name ?? "").trim(), locale: language === "ms" ? "ms" : "en", theme: ((site.theme as ThemeData | undefined) ?? {}) as ThemeData, pages };
}

const NOT_FIELDS = new Set(["blockType", "variant", "id", "__localeInit"]);

/**
 * Sections whose template copy is harmless filler to edit (questions, benefits, an
 * about text, a hero's buttons). Sections that would carry invented facts — reviews,
 * prices, team members, opening hours, phone numbers — never get starter wording.
 */
export const STARTER_TYPES: ReadonlySet<string> = new Set(["faq", "features", "service-cards", "about", "newsletter", "gallery", "hero"]);

/** Only their lists (buttons) are filled: the template's headline text is filler the copy check refuses. */
const LISTS_ONLY: ReadonlySet<string> = new Set(["hero"]);

const isEmpty = (value: unknown) => value === undefined || value === null || (Array.isArray(value) && value.length === 0);

/**
 * The model's fields with the template's values for what it left out: a list it
 * left empty or out (the questions of an FAQ, a hero's buttons), and — when the
 * section is not valid without them — the other fields too. Limited to what an
 * edit may write (no pictures, no unsafe links); the model's own values are never
 * touched. `added` names the fields the template filled.
 */
export function withSectionDefaults(type: string, fields: Record<string, unknown>, context: SectionContext, fillScalars: boolean): { fields: Record<string, unknown>; added: string[] } {
	const template = normalizeAddSectionBlock(
		{ instruction: type, requestedType: type, siteName: context.siteName, theme: context.theme, locale: context.locale },
		{ blockType: type, ...fields },
	) as Record<string, unknown> | undefined;
	if (!template) return { fields, added: [] };
	const allowed = editableKeys(type);
	let defaults: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(template)) {
		if (NOT_FIELDS.has(key) || !allowed.has(key) || isMediaKey(key) || isEmpty(value)) continue;
		if (!isEmpty(fields[key])) continue;
		if (!Array.isArray(value) && (!fillScalars || LISTS_ONLY.has(type))) continue;
		defaults[key] = value;
	}
	// placeholder buttons → real page paths; a template button whose page does not exist is dropped (as in the editor)
	if (context.pages) defaults = patchBlockCtaUrls(defaults, context.pages);
	for (const [key, value] of Object.entries(defaults)) if (isEmpty(value) || unsafeLinks(value, key).length > 0) delete defaults[key];
	return { fields: { ...fields, ...defaults }, added: Object.keys(defaults) };
}

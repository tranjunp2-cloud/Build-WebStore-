import "server-only";

import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { siteLanguagesOf } from "@/lib/site-languages";
import type { AgentActor } from "../context";
import { blockHash, blockIdOf, isStableBlockId, type PageBlock, STRUCTURAL_BLOCKS } from "./site-blocks";
import { sitePages } from "./site-check";
import { currentFrame } from "./site-nav";
import type { PreparedSiteChange } from "./site-prepare";
import { layoutOf, siteForActor } from "./site-read";
import type { LocaleContent } from "./site-seo-translate";
import { brandOf } from "./site-locale-view";
import { lacksTranslation, writtenView } from "./site-translate-source";

/**
 * The website's languages for the copilot (Menu → Quick language in the editor):
 * the language the pages are written in, the primary one visitors get, the
 * second one, and how much of each page is translated. A change to them is
 * staged like any other: it writes the menu draft the editor saves
 * (`pendingHeaderBlock`), and undo puts that menu back (`site.nav_restore`).
 */

/** Languages a website can have today (the editor's Quick language list). */
export const SITE_LANGUAGES = ["en", "ms"] as const;
export const LANGUAGE_NAME: Record<string, string> = { en: "English", ms: "Bahasa Melayu", vi: "Vietnamese", zh: "Chinese", el: "Greek" };
const nameOf = (locale: string) => LANGUAGE_NAME[locale] ?? locale;

type SiteDoc = { id: string | number; name?: string; generationLocale?: string; locale?: string; headerBlock?: unknown; pendingHeaderBlock?: unknown; footerBlock?: unknown; pendingFooterBlock?: unknown };
type PageDoc = { id: string | number; title?: string; slug?: string; layout?: unknown; localeContent?: LocaleContent };
type Header = Record<string, unknown>;

/** The language the pages are written in (their sections as stored). */
export const writtenIn = (site: SiteDoc) => String(site.generationLocale || site.locale || "en");

const filled = (slot: unknown) => Boolean(slot) && typeof slot === "object" && Object.keys(slot as object).length > 0;

/**
 * Per page: how many sections have no translation yet in each language other than the written one. The same
 * rule as `propose_page_translation` onlyMissing (`lacksTranslation`): no copy, or only the editor's template
 * filler, or the written text repeated, is missing — filler is never what visitors should get as a translation.
 */
export function translationCoverage(site: SiteDoc, pages: readonly PageDoc[]) {
	const languages = siteLanguagesOf(site);
	const written = writtenIn(site);
	const toFill = languages.filter((locale) => locale !== written);
	const frame = currentFrame(site as never);
	const menuCopy = (frame.header as Header | null)?._localeContent as Record<string, unknown> | undefined;
	const footerCopy = (frame.footer as Header | null)?._localeContent as Record<string, unknown> | undefined;
	const brand = brandOf(site);
	const isLocale = (locale: string): locale is "en" | "ms" => locale === "en" || locale === "ms";
	return {
		written,
		languages,
		toFill,
		pages: pages.map((page) => {
			const sections = layoutOf(page as never)
				.map((block, index) => ({ block, id: blockIdOf(block as PageBlock, index) }))
				.filter(({ block, id }) => !STRUCTURAL_BLOCKS.has(String(block.blockType)) && isStableBlockId(id));
			const content = page.localeContent ?? {};
			return {
				pageId: String(page.id),
				page: page.title || page.slug || String(page.id),
				sections: sections.length,
				missing: Object.fromEntries(
					toFill.map((locale) => [
						locale,
						sections.filter(({ block, id }) =>
							isLocale(locale)
								? lacksTranslation(writtenView(block as PageBlock, written, content, brand), locale, content[id]?.[locale], brand)
								: !filled(content[id]?.[locale]),
						).length,
					]),
				),
			};
		}),
		// the editor translates the menu and footer itself when the canvas shows that language
		menu: Object.fromEntries(toFill.map((locale) => [locale, filled(menuCopy?.[locale])])),
		footer: Object.fromEntries(toFill.map((locale) => [locale, filled(footerCopy?.[locale])])),
	};
}

export async function readSiteLanguages(actor: AgentActor, siteId: string | number) {
	const { site } = await siteForActor(actor, siteId);
	const cms = await getPayload({ config });
	const pages = await sitePages(cms, site.id, actor.user as unknown as User);
	const coverage = translationCoverage(site as SiteDoc, pages);
	const [primary, second] = coverage.languages;
	return {
		site: { id: String(site.id), name: site.name ?? "" },
		writtenIn: { locale: coverage.written, name: nameOf(coverage.written) },
		primary: { locale: primary!, name: nameOf(primary!) },
		second: second ? { locale: second, name: nameOf(second) } : null,
		canAdd: SITE_LANGUAGES.filter((locale) => !coverage.languages.includes(locale)).map((locale) => ({ locale, name: nameOf(locale) })),
		pages: coverage.pages,
		menuTranslated: coverage.menu,
		footerTranslated: coverage.footer,
		note:
			"Visitors get the primary language; the second one is offered by the language switcher in the menu (the visitor's choice is kept for their visit). Pages are written in writtenIn; every other language is a translation (propose_page_translation, one page at a time). " +
			"The menu and footer are translated by the editor when its canvas shows that language. Language changes go into the draft until the merchant publishes.",
	};
}

export const SiteLanguagesInputSchema = z.object({
	siteId: z.union([z.string(), z.number()]).transform(String),
	why: z.string().trim().min(1).max(300),
	change: z.enum(["add_second", "remove_second", "make_primary"]),
	/** add_second / make_primary: which language */
	locale: z.enum(SITE_LANGUAGES).nullable().optional(),
});

/** The menu draft with the languages changed — exactly what the editor's Quick language writes. */
export function languagesHeader(header: Header, site: SiteDoc, input: z.infer<typeof SiteLanguagesInputSchema>): Header | { error: { code: string; message: string } } {
	const [primary, second] = siteLanguagesOf(site);
	const locale = input.locale ?? null;
	if (input.change === "add_second") {
		if (!locale) return { error: { code: "invalid_input", message: "Say which language to add (locale en or ms)." } };
		if (locale === primary) return { error: { code: "same_language", message: `${nameOf(locale)} is the website's primary language already.` } };
		if (locale === second) return { error: { code: "no_change", message: `${nameOf(locale)} is the website's second language already.` } };
		// one second language at a time: adding replaces the current one
		return { ...header, multilingualEnabled: true, showLanguageSwitcher: true, secondaryLocale: locale };
	}
	if (input.change === "remove_second") {
		if (!second) return { error: { code: "no_change", message: "The website has one language only." } };
		const copies = header._localeContent as Record<string, Record<string, unknown>> | undefined;
		const cleaned = copies
			? Object.fromEntries(Object.entries(copies).map(([key, slot]) => [key, Object.fromEntries(Object.entries(slot ?? {}).filter(([field]) => field !== "showLanguageSwitcher" && field !== "secondaryLocale"))]))
			: undefined;
		return { ...header, showLanguageSwitcher: false, secondaryLocale: "", ...(cleaned ? { _localeContent: cleaned } : {}) };
	}
	if (!locale) return { error: { code: "invalid_input", message: "Say which language becomes primary (locale en or ms)." } };
	if (locale === primary) return { error: { code: "no_change", message: `${nameOf(locale)} is the website's primary language already.` } };
	// the old primary becomes the second language, as Make Default does in the editor
	return { ...header, multilingualEnabled: true, showLanguageSwitcher: true, primaryLocale: locale, secondaryLocale: primary };
}

const describe = (site: SiteDoc) => {
	const [primary, second] = siteLanguagesOf(site);
	return { primary: nameOf(primary!), second: second ? nameOf(second) : null };
};

export async function prepareSiteLanguages(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = SiteLanguagesInputSchema.parse(raw);
	const { site } = await siteForActor(actor, input.siteId);
	const frame = currentFrame(site as never);
	if (!frame.header) return { error: { code: "no_menu", message: "This website has no menu yet, so it has no language switcher. Add a menu first (propose_navigation)." } };
	const next = languagesHeader(frame.header as Header, site as SiteDoc, input);
	if ("error" in next) return next as { error: { code: string; message: string } };
	const before = describe(site as SiteDoc);
	const after = describe({ ...(site as SiteDoc), pendingHeaderBlock: next });
	const entity = { kind: "site_navigation", id: String(site.id), label: `Languages · ${site.name?.trim() || "site"}` };
	const diffs: PreparedSiteChange["diffs"] = [];
	if (before.primary !== after.primary) diffs.push({ entity, field: "primary language", path: "header.primaryLocale", before: before.primary, after: after.primary });
	if (before.second !== after.second) diffs.push({ entity, field: "second language", path: "header.secondaryLocale", before: before.second ?? "None", after: after.second ?? "None" });
	const written = writtenIn(site as SiteDoc);
	const title =
		input.change === "add_second" ? `Add ${nameOf(input.locale!)}` : input.change === "remove_second" ? `Remove ${before.second}` : `Make ${nameOf(input.locale!)} the primary language`;
	const guardrails: PreparedSiteChange["guardrails"] = [
		{ rule: "draft_until_publish", ok: true, detail: "Visitors see this after you publish; the page text is not changed." },
	];
	if (input.change === "add_second") guardrails.push({ rule: "translate_next", ok: true, detail: `Pages still need their ${nameOf(input.locale!)} text: ask to translate them, one page at a time.` });
	if (input.change === "remove_second") guardrails.push({ rule: "translations_kept", ok: true, detail: `The ${before.second} translations are kept; adding it back brings them back.` });
	if (input.change === "make_primary" && input.locale !== written) {
		guardrails.push({ rule: "translate_next", ok: true, detail: `Pages are written in ${nameOf(written)}: visitors get the ${nameOf(input.locale!)} translation, so every page needs one.` });
	}
	return {
		kind: "site.languages_patch",
		title,
		why: input.why,
		risk: "low",
		diffs,
		guardrails,
		// what to do, not the menu itself: the applier rebuilds it from the stored menu (a plan comes back from the AI platform)
		plan: { siteId: String(site.id), change: input.change, locale: input.locale ?? null, base: blockHash(frame.header as PageBlock) },
	};
}

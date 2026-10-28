import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { siteLanguagesOf } from "@/lib/site-languages";
import { sanitizeText } from "@/utils/sanitize";
import type { AgentActor } from "../context";
import { blockHash, blockIdOf, blockName, isStableBlockId, type PageBlock, previewValue, STRUCTURAL_BLOCKS } from "./site-blocks";
import type { PreparedSiteChange } from "./site-prepare";
import { type LocaleContent, readLocaleContent } from "./site-locale-view";
import { draftPage, isPageLive, layoutOf, pageHasContent, siteForActor } from "./site-read";
import { lacksTranslation, translatableStrings, translatedSlot, writtenView } from "./site-translate-source";

/**
 * Page SEO and page translation for the web builder copilot. Both are drafted
 * from a fresh read (the translation itself is produced here, so the review
 * card shows the real text) and applied by `appliers/site-edits.ts`.
 */

const Id = z.union([z.string().min(1).max(40), z.number().int().positive()]).transform(String);

// ─── SEO ───────────────────────────────────────────────────────────────────

// 60 = what the editor's SEO settings warn above
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
// staging asked the model for 150-160; shorter still goes through, with a note on the card
export const SEO_DESCRIPTION_TARGET_MIN = 150;
const SLUG_MAX = 80;

export const SeoChangeInputSchema = z.object({
	siteId: Id,
	pageId: Id,
	why: z.string().min(1).max(300),
	title: z.string().max(500).nullable().default(null),
	description: z.string().max(2_000).nullable().default(null),
	/** new address for a page that was never published; null keeps it */
	slug: z.string().max(200).nullable().default(null),
});

/** URL-safe address from free text (staging's generate-seo rule: lowercase words joined by "-"). */
export function slugFromText(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, SLUG_MAX)
		.replace(/-+$/g, "");
}

type Seo = { title?: string | null; description?: string | null };

export function seoFingerprint(seo: Seo | null | undefined): string {
	return blockHash({ title: seo?.title ?? null, description: seo?.description ?? null });
}

export async function prepareSeoChange(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = SeoChangeInputSchema.parse(raw);
	const { site } = await siteForActor(actor, input.siteId);
	const page = await draftPage(actor, site.id, input.pageId);
	const current = ((page as { seo?: Seo }).seo ?? {}) as Seo;
	const title = input.title === null ? null : sanitizeText(input.title).trim();
	const description = input.description === null ? null : sanitizeText(input.description).trim();
	if (title !== null && (title.length === 0 || title.length > SEO_TITLE_MAX)) {
		return { error: { code: "seo_title_length", message: `The SEO title must be 1–${SEO_TITLE_MAX} characters (it is ${title.length}).` } };
	}
	if (description !== null && (description.length === 0 || description.length > SEO_DESCRIPTION_MAX)) {
		return { error: { code: "seo_description_length", message: `The SEO description must be 1–${SEO_DESCRIPTION_MAX} characters (it is ${description.length}).` } };
	}
	const changes: Seo = {};
	if (title !== null && title !== (current.title ?? "")) changes.title = title;
	if (description !== null && description !== (current.description ?? "")) changes.description = description;
	let slug: { from: string; to: string } | null = null;
	if (input.slug !== null) {
		const word = slugFromText(sanitizeText(input.slug));
		if (!word) return { error: { code: "seo_slug_invalid", message: "The address needs at least one letter or number." } };
		if (page.isHomepage) return { error: { code: "seo_slug_locked", message: "The home page keeps its address." } };
		// a published page's address is already out there (search results, links): only drafts may move
		if (await isPageLive(actor, page.id)) return { error: { code: "seo_slug_locked", message: "This page is published, so its address stays. Leave the slug out." } };
		// page slugs are URL paths with the leading slash ("/about")
		const to = `/${word}`;
		if (to !== (page.slug ?? "")) {
			const cms = await getPayload({ config });
			const clash = await cms.find({ collection: "pages", where: { and: [{ site: { equals: site.id } }, { slug: { equals: to } }, { id: { not_equals: page.id } }] }, depth: 0, limit: 1, draft: true, overrideAccess: false, user: actor.user as never, select: { slug: true } } as Parameters<typeof cms.find>[0]);
			if (clash.docs.length > 0) return { error: { code: "seo_slug_taken", message: `Another page of this site already uses the address ${to}. Pick a different one.` } };
			slug = { from: page.slug ?? "", to };
		}
	}
	if (Object.keys(changes).length === 0 && !slug) return { error: { code: "no_change", message: "The page's SEO already says that." } };
	const pageTitle = page.title ?? "page";
	const entity = { kind: "site_page", id: String(page.id), label: pageTitle };
	return {
		kind: "site.seo_patch",
		title: `SEO: ${pageTitle}`.slice(0, 200),
		why: input.why,
		risk: "low",
		diffs: [
			...(changes.title !== undefined ? [{ entity, field: "SEO title", path: "seoTitle", before: previewValue(current.title), after: String(changes.title) }] : []),
			...(changes.description !== undefined ? [{ entity, field: "SEO description", path: "seoDescription", before: previewValue(current.description), after: String(changes.description) }] : []),
			...(slug ? [{ entity, field: "Page address", path: "slug", before: slug.from || null, after: slug.to }] : []),
		],
		guardrails: [
			...(slug ? [{ rule: "slug_links", ok: false, detail: `Links to ${slug.from || "the old address"} (menu, buttons) must be pointed at ${slug.to}; check them before you publish.` }] : []),
			...(!pageHasContent(page) ? [{ rule: "page_empty", ok: false, detail: "The page has no content yet, so this SEO is a guess. Add the page's text and ask again for a better one." }] : []),
			...(typeof changes.description === "string" && changes.description.length < SEO_DESCRIPTION_TARGET_MIN ? [{ rule: "description_short", ok: false, detail: `The description is ${changes.description.length} characters; search results use ${SEO_DESCRIPTION_TARGET_MIN}–${SEO_DESCRIPTION_MAX}.` }] : []),
			{ rule: "page_draft", ok: true, detail: "Goes into the page draft; search engines see it after you publish." },
			{ rule: "undo", ok: true, detail: "You can undo it for 7 days while the SEO stays as the assistant left it." },
		],
		plan: { siteId: String(site.id), pageId: String(page.id), base: seoFingerprint(current), changes, ...(slug ? { slug } : {}) },
	};
}

// ─── Translation ───────────────────────────────────────────────────────────

/** Locales the editor's second language supports (F26 Phase 1: English + Bahasa Melayu). */
export const TranslateLocaleSchema = z.enum(["en", "ms"]);
const LOCALE_NAME: Record<z.infer<typeof TranslateLocaleSchema>, string> = { en: "English", ms: "Bahasa Melayu" };
const MAX_SECTIONS = 12;
// sections translated at once; with MAX_SECTIONS this stays inside the agent-tools route limit
const CONCURRENCY = 6;

export const TranslatePageInputSchema = z.object({
	siteId: Id,
	pageId: Id,
	why: z.string().min(1).max(300),
	locale: TranslateLocaleSchema,
	/** false = also redo sections that already have a translation in that locale */
	onlyMissing: z.boolean().default(true),
});

export { type LocaleContent, readLocaleContent, translatableStrings, translatedSlot };

export function localeFingerprint(content: LocaleContent, blockId: string, locale: string): string {
	return blockHash(content[blockId]?.[locale] ?? null);
}

/** longest single translated text accepted back */
export const MAX_TRANSLATED_TEXT = 5_000;
/** the review card lists every translated text, up to this many */
const MAX_DIFFS = 190;

async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	let failed = false;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		// after a failure the remaining sections are not sent (no quota spent on a change that can't be drafted)
		while (next < items.length && !failed) {
			const index = next++;
			try {
				out[index] = await run(items[index]!);
			} catch (error) {
				failed = true;
				throw error;
			}
		}
	}));
	return out;
}

type SiteLocales = { generationLocale?: unknown; locale?: unknown };

export async function prepareTranslatePage(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = TranslatePageInputSchema.parse(raw);
	const { site } = await siteForActor(actor, input.siteId);
	// the page's own text is in the site's base language; a slot in that language would shadow it
	const base = String((site as SiteLocales).generationLocale || (site as SiteLocales).locale || "en");
	if (base === input.locale) {
		return { error: { code: "same_language", message: `This website is written in ${LOCALE_NAME[input.locale]} already. Translate into the other language.` } };
	}
	// only into a language the site has (Menu → Quick language): the editor and the site have no view of another one
	if (!siteLanguagesOf(site as Parameters<typeof siteLanguagesOf>[0]).includes(input.locale)) {
		const language = LOCALE_NAME[input.locale];
		return {
			error: {
				code: "language_not_added",
				message: `${language} is not one of this website's languages yet. Add it in the editor under Menu → Quick language (Add a secondary language), then ask again.`,
			},
		};
	}
	const page = await draftPage(actor, site.id, input.pageId);
	const cms = await getPayload({ config });
	const content = await readLocaleContent(cms, page.id);
	const brand = String((site as { name?: unknown }).name ?? "") || "Your Brand";
	const blocks = layoutOf(page)
		.map((block, index) => ({ id: blockIdOf(block, index), block }))
		// the navigation/footer are shared (their translations live on the site), sections need a saved id
		.filter(({ id, block }) => isStableBlockId(id) && !STRUCTURAL_BLOCKS.has(String(block.blockType)))
		// translated FROM the written language (the stored section can hold filler or another language's text)
		.map(({ id, block }) => ({ id, block, written: writtenView(block, base, content, brand) }))
		// "missing" = no copy yet, or only the template's filler / the written text itself (a failed switch left it)
		.filter(({ id, written }) => !input.onlyMissing || lacksTranslation(written, input.locale, content[id]?.[input.locale], brand));
	if (blocks.length === 0) {
		return { error: { code: "no_change", message: input.onlyMissing ? `Every section already has a ${LOCALE_NAME[input.locale]} translation. Ask again with onlyMissing false to redo them.` : "This page has no sections to translate." } };
	}
	if (blocks.length > MAX_SECTIONS) {
		return { error: { code: "too_large", message: `This page has ${blocks.length} sections to translate; at most ${MAX_SECTIONS} per change.` } };
	}

	let translated: Array<{ id: string; block: PageBlock; written: PageBlock; original: Record<string, string>; strings: Record<string, string> } | null>;
	try {
		const { getAiTaskClient } = await import("../task-client");
		const client = getAiTaskClient(actor);
		translated = await mapLimit(blocks, CONCURRENCY, async ({ id, block, written }) => {
			const { fields } = translatableStrings(written);
			if (Object.keys(fields).length === 0) return null;
			const { output } = await client.runTask("i18n.translate-blocks", { targetLocale: input.locale, fields });
			const strings = Object.fromEntries(
				Object.keys(fields)
					.filter((key) => typeof output.fields[key] === "string")
					.map((key) => [key, sanitizeText(String(output.fields[key])).slice(0, MAX_TRANSLATED_TEXT)]),
			);
			return Object.keys(strings).length > 0 ? { id, block, written, original: fields, strings } : null;
		});
	} catch (error) {
		// quota, timeout, outage: the model tells the merchant instead of a broken draft
		const status = (error as { status?: unknown } | null)?.status;
		return { error: { code: status === 429 ? "ai_quota" : "ai_unavailable", message: status === 429 ? "The workspace reached today's AI limit, so the page could not be translated. Try again tomorrow." : "The translation could not be made right now. Try again in a moment." } };
	}
	const entries = translated.filter((t): t is NonNullable<typeof t> => t !== null);
	if (entries.length === 0) return { error: { code: "no_change", message: "This page has no text to translate." } };

	const pageTitle = page.title ?? "page";
	const language = LOCALE_NAME[input.locale];
	// every translated text is on the card (original → translation), so nothing is written unseen
	const diffs = entries.flatMap(({ id, block, original, strings }) =>
		Object.entries(strings).map(([key, text]) => ({
			entity: { kind: "site_block", id, label: `${blockName(block)} · ${pageTitle}` },
			field: `${language} · ${key}`.slice(0, 120),
			before: previewValue(original[key]),
			after: previewValue(text) ?? text,
		})),
	);
	const shown = diffs.slice(0, MAX_DIFFS);
	return {
		kind: "site.translate_page",
		title: `Translate into ${language}: ${pageTitle}`.slice(0, 200),
		why: input.why,
		risk: entries.length > 5 ? "medium" : "low",
		diffs: shown,
		guardrails: [
			{ rule: "locale_only", ok: true, detail: `Only the ${language} version changes; the original text stays as it is.` },
			{ rule: "review_text", ok: true, detail: "Check names, prices and phone numbers in the translation before you publish." },
			...(diffs.length > shown.length ? [{ rule: "long_translation", ok: false, detail: `${diffs.length - shown.length} more translated texts are not listed here; check them in the editor.` }] : []),
			{ rule: "undo", ok: true, detail: "You can undo it for 7 days while these translations stay as the assistant left them." },
		],
		plan: {
			siteId: String(site.id),
			pageId: String(page.id),
			locale: input.locale,
			// only the translated texts travel; the applier rebuilds each slot from the section as it is then
			entries: Object.fromEntries(entries.map(({ id, strings }) => [id, strings])),
			// the text it was made from: the section in the written language
			written: base,
			blocks: Object.fromEntries(entries.map(({ id, written }) => [id, blockHash(written)])),
			expect: Object.fromEntries(entries.map(({ id }) => [id, localeFingerprint(content, id, input.locale)])),
		},
	};
}

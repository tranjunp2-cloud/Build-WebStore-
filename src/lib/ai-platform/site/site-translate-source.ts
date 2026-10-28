import "server-only";

import { applyTranslatedStrings, flattenTranslatableStrings } from "@ech/ai-contracts";
import { isTemplateCopy } from "@/lib/i18n/template-content";
import { NON_TRANSLATABLE_FIELDS } from "@/lib/i18n/non-translatable-fields";
import { sanitizeText } from "@/utils/sanitize";
import { isMediaKey, type PageBlock } from "./site-blocks";
import { localizedBlock, type LocaleSlots } from "@/lib/i18n/locale-display";
import type { LocaleContent } from "./site-locale-view";

/**
 * What a page translation is made FROM and which existing translations count as missing.
 *
 * The editor saves the layout as shown, so a stored section can hold another language's text (or template filler
 * after a failed switch); the written language is the site's `generationLocale` and its text is the section laid
 * under that language's copy (`locale_content[section][written]`). A translation always starts from that view,
 * never from the stored section as is and never from the target language's own copy.
 */

const SKIP = new Set<string>(NON_TRANSLATABLE_FIELDS);
const LINKISH = /(url|href|link|src)$/i;
// option values inside list items (a button's style, a link's target…): a translated value no longer matches its option
const OPTION_KEYS = new Set(["style", "variant", "type", "target", "align", "alignment", "size", "position", "layout", "color", "theme", "iconName"]);
const notText = (key: string) => SKIP.has(key) || OPTION_KEYS.has(key) || isMediaKey(key) || LINKISH.test(key);

/**
 * A field that is the same in every language (links, contact details, pictures, options, structure): a translation
 * never changes it, and an edit to it belongs to the section, not to one language's copy.
 */
export const isLanguageNeutralKey = notText;

/** The section in the language the site was written in. */
export const writtenView = (block: PageBlock, written: string, content: LocaleContent, brand?: string): PageBlock => localizedBlock(block, written, content as LocaleSlots, brand);

/**
 * What a section's locale slot holds — its content without the top-level structure fields, so list items keep their
 * pictures, links and ids (the editor merges a slot over the section key by key) — and the text in it the translator
 * may change: no pictures, links or business data at any depth.
 */
export function translatableStrings(block: PageBlock): { source: Record<string, unknown>; fields: Record<string, string>; paths: Map<string, Array<string | number>> } {
	const source = Object.fromEntries(
		Object.entries(block).filter(([key, v]) => !notText(key) && v !== null && (typeof v === "string" || typeof v === "object")),
	);
	const { fields, paths } = flattenTranslatableStrings(source);
	for (const [key, path] of paths) {
		if (path.some((segment) => typeof segment === "string" && notText(segment))) {
			delete fields[key];
			paths.delete(key);
		}
	}
	return { source, fields, paths };
}

/** The slot for `locale`: the section's content with the given translated texts in place (only at text paths). */
export function translatedSlot(block: PageBlock, translated: Record<string, string>): Record<string, unknown> {
	const { source, paths } = translatableStrings(block);
	const kept = new Map([...paths].filter(([key]) => typeof translated[key] === "string"));
	return applyTranslatedStrings(source, kept, Object.fromEntries([...kept.keys()].map((key) => [key, sanitizeText(translated[key]!)])));
}

const same = (a: string, b: string) => a.trim() === b.trim();

/** A copy that says what the written text says: nothing was translated (a failed translation stored the original). */
export function isUntranslatedCopy(written: PageBlock, slot: Record<string, unknown>): boolean {
	const source = translatableStrings(written).fields;
	const texts = Object.entries(translatableStrings(slot as PageBlock).fields);
	return texts.length > 0 && texts.every(([key, value]) => typeof source[key] === "string" && same(source[key], value));
}

/**
 * Whether a section still needs its `locale` translation: it has none, or what it has is template filler or the
 * written text itself. `written` is the section in the written language (`writtenView`).
 */
export function lacksTranslation(written: PageBlock, locale: "en" | "ms", slot: Record<string, unknown> | undefined, brand: string): boolean {
	if (!slot || Object.keys(slot).length === 0) return true;
	return isTemplateCopy(String(written.blockType ?? ""), locale, slot, brand) || isUntranslatedCopy(written, slot);
}

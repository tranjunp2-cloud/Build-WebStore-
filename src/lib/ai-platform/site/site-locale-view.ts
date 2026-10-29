import { sql } from "drizzle-orm";
import type { Payload } from "payload";
import { STRUCTURAL_BLOCK_FIELDS } from "@/lib/editor/structural-block-fields";
import { localizedBlock, type LocaleSlots } from "@/lib/i18n/locale-display";
import { realFields } from "@/lib/i18n/template-content";
import { siteLanguagesOf } from "@/lib/site-languages";
import { blockHash, blockIdOf, type PageBlock } from "./site-blocks";
import { pathSegments, type PagePatchOp, setAtPath, valueAtPath } from "./site-patch";
import { isLanguageNeutralKey } from "./site-translate-source";

/**
 * Which text a copilot edit works on. The editor shows a page in one language;
 * the sections are stored in the language they were written in (`writtenLocale`)
 * and every other language is a copy in `pages.locale_content[section][locale]`
 * laid over them (lib/i18n/locale-display — the rule the canvas, the preview and
 * the live site share). An edit made while viewing a copy changes that copy; an
 * edit made while viewing the written language changes the sections. The copilot
 * reads, drafts, applies and undoes against the same view, so the card's
 * "before" is the text the merchant sees and the write lands where they see it.
 *
 * Style, pictures, links, contact details and the shape of lists are the same
 * in every language: those ops write the sections (every language), and the
 * language copy that holds the same field follows (`mirrorNeutralChanges`), so
 * the language on screen and the one visitors get never disagree.
 */

export type LocaleContent = Record<string, Record<string, Record<string, unknown>> | undefined>;

/** The page's per-section translations (`pages.locale_content`, raw column, not a Payload field). */
export async function readLocaleContent(cms: Payload, pageId: string | number): Promise<LocaleContent> {
	const db = cms.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ locale_content: unknown }> }> } };
	const result = await db.drizzle.execute(sql`SELECT locale_content FROM pages WHERE id = ${Number(pageId)} LIMIT 1`);
	const value = result.rows?.[0]?.locale_content;
	return value && typeof value === "object" ? (value as LocaleContent) : {};
}

type SiteLocales = { generationLocale?: unknown; locale?: unknown };

/** The language the page sections are stored in. */
export const writtenLocale = (site: object): string => {
	const { generationLocale, locale } = site as SiteLocales;
	return String(generationLocale || locale || "en");
};

/**
 * The language whose copy a text edit changes: the one on the editor canvas
 * when it is a website language other than the written one. Null = the
 * sections as stored (the written language, or no language known).
 */
export function slotLocaleOf(site: object, requested: unknown): string | null {
	if (typeof requested !== "string" || !requested.trim()) return null;
	const locale = requested.trim();
	if (locale === writtenLocale(site)) return null;
	return siteLanguagesOf(site as Parameters<typeof siteLanguagesOf>[0]).includes(locale) ? locale : null;
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", ms: "Bahasa Melayu" };
/** A language in the merchant's words, for cards and refusals. */
export const languageName = (locale: string): string => LANGUAGE_NAMES[locale] ?? locale;


/** The brand the editor's template text is filled with: the site's name. */
export const brandOf = (site: object): string => {
	const { name } = site as { name?: unknown };
	return typeof name === "string" && name ? name : "Your Brand";
};

/**
 * What of a section's copy in `locale` is a translation (or the merchant's own text): the copy, minus the editor's
 * template filler (`realFields`) — the same rule as the canvas, the preview and the live site. Undefined = none.
 */
export function realCopy(content: LocaleContent, blockId: string, blockType: unknown, locale: string, brand: string): Record<string, unknown> | undefined {
	return realFields(blockType, locale, content[blockId]?.[locale], brand);
}

/**
 * The sections as the merchant sees them in `locale` (as stored when `locale` is null). `written` = the language
 * the sections are written in: with no `locale`, its copy is laid over them as well, as the canvas does (a
 * section the editor kept a copy of the written text for shows that, not the stored text).
 */
export function shownLayout(layout: PageBlock[], locale: string | null, content: LocaleContent, brand: string = "Your Brand", written: string | null = null): PageBlock[] {
	const language = locale ?? written;
	return language ? layout.map((block) => localizedBlock(block, language, content as LocaleSlots, brand)) : layout;
}

const isStructuralKey = (key: unknown) => typeof key === "string" && STRUCTURAL_BLOCK_FIELDS.has(key);
const isNeutralKey = (key: unknown) => typeof key === "string" && isLanguageNeutralKey(key);
const isNeutralPath = (segments: Array<string | number>) => segments.some(isNeutralKey);

/**
 * The ops split by where they write while a language copy is on screen. Text goes to that language's copy.
 * Everything that is the same in every language writes the sections instead: style, pictures, structure, and
 * links, contact details and other options (`isLanguageNeutralKey`: url, href, phone, email, address, logoText…),
 * whether set as fields, as a value or inside a list item. An op that mixes both is split in two, as the
 * editor routes its own edits. `shown` = the sections in that language (the rows of a list are counted there).
 */
export function splitLocaleOps(ops: PagePatchOp[], shown: PageBlock[] = []): { text: PagePatchOp[]; base: PagePatchOp[] } {
	const text: PagePatchOp[] = [];
	const base: PagePatchOp[] = [];
	const byId = new Map(shown.map((block, index) => [blockIdOf(block, index), block]));
	for (const op of ops) {
		if (op.op === "set_fields") {
			const sectionWide = (key: string) => isStructuralKey(key) || isNeutralKey(key);
			const content = Object.fromEntries(Object.entries(op.fields).filter(([key]) => !sectionWide(key)));
			const neutral = Object.fromEntries(Object.entries(op.fields).filter(([key]) => sectionWide(key)));
			if (Object.keys(content).length > 0) text.push({ ...op, fields: content });
			if (Object.keys(neutral).length > 0) base.push({ ...op, fields: neutral });
		} else if (op.op === "set_value") {
			const segments = pathSegments(op.path);
			if (isStructuralKey(segments[0]) || isNeutralPath(segments)) base.push(op);
			else text.push(op);
		} else if (op.op === "edit_list") {
			const segments = pathSegments(op.path);
			if (isStructuralKey(segments[0]) || isNeutralPath(segments)) base.push(op);
			else {
				const parts = splitListRows(op, byId.get(op.blockId));
				if (parts.text) text.push(parts.text);
				if (parts.base) base.push(parts.base);
			}
		} else base.push(op);
	}
	return { text, base };
}

type EditList = Extract<PagePatchOp, { op: "edit_list" }>;

/**
 * An edit of a list's items in place (row i keeps item i, no new, moved or removed items, no pictures) that
 * changes both text and neutral fields (a button's label and its link): the text goes to the language copy, the
 * neutral fields to the sections. Any other shape stays whole, as a text op (which a language copy refuses).
 */
function splitListRows(op: EditList, block: PageBlock | undefined): { text?: PagePatchOp; base?: PagePatchOp } {
	const current = block ? valueAtPath(block, pathSegments(op.path)) : undefined;
	const inPlace = Array.isArray(current) && op.rows.length === current.length && op.rows.every((row, index) => row.keep === index && !row.picture);
	if (!inPlace) return { text: op };
	const part = (neutral: boolean): EditList["rows"] =>
		op.rows.map((row, index) => {
			const fields = Object.fromEntries(Object.entries(row.fields ?? {}).filter(([key]) => isNeutralKey(key) === neutral));
			return { keep: index, ...(Object.keys(fields).length > 0 ? { fields } : {}) };
		});
	const neutralRows = part(true);
	const textRows = part(false);
	const hasFields = (rows: EditList["rows"]) => rows.some((row) => row.fields);
	if (!hasFields(neutralRows)) return { text: op };
	return {
		...(hasFields(textRows) ? { text: { ...op, rows: textRows } } : {}),
		base: { ...op, rows: neutralRows },
	};
}

/** A copy of `block` with `value` at the path; the block itself when the path does not exist in it. */
const withLeaf = (block: PageBlock, segments: Array<string | number>, value: unknown): PageBlock => setAtPath(block, segments, value) as PageBlock;

function neutralLeaves(before: unknown, after: unknown, path: Array<string | number>, out: Array<{ path: Array<string | number>; value: unknown }>) {
	if (Array.isArray(before) && Array.isArray(after)) {
		for (let i = 0; i < Math.min(before.length, after.length); i++) neutralLeaves(before[i], after[i], [...path, i], out);
	} else if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
		for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
			if (path.length === 0 && isStructuralKey(key)) continue;
			neutralLeaves((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], [...path, key], out);
		}
	} else if (before !== undefined && after !== undefined && isNeutralPath(path) && blockHash(before) !== blockHash(after)) out.push({ path, value: after });
}

/**
 * The language copy follows an edit of the sections that changed a field every language shares (a link, a phone
 * number, a button's option): where `locale`'s copy of a section holds the same field, it takes the new value, so
 * the language on screen and the other languages agree. `shownNext` = the sections in that language after the
 * text ops; `current` / `baseNext` = the sections as stored before / after the base ops. Returns the changed
 * layout and the ids of the sections whose copy changed.
 */
export function mirrorNeutralChanges(
	shownNext: PageBlock[],
	current: PageBlock[],
	baseNext: PageBlock[],
	content: LocaleContent,
	locale: string,
	brand: string,
): { next: PageBlock[]; touched: Set<string> } {
	const was = new Map(current.map((block, index) => [blockIdOf(block, index), block]));
	const now = new Map(baseNext.map((block, index) => [blockIdOf(block, index), block]));
	const touched = new Set<string>();
	const next = shownNext.map((shown, index) => {
		const id = blockIdOf(shown, index);
		const before = was.get(id);
		const after = now.get(id);
		const copy = before && after ? realCopy(content, id, shown.blockType, locale, brand) : undefined;
		if (!before || !after || !copy) return shown;
		const leaves: Array<{ path: Array<string | number>; value: unknown }> = [];
		neutralLeaves(before, after, [], leaves);
		let out = shown;
		for (const { path, value } of leaves) {
			// only where the copy holds the same field (a copy never gains a field it did not have)
			if (valueAtPath(copy, path) === undefined) continue;
			out = withLeaf(out, path, value);
			touched.add(id);
		}
		return out;
	});
	return { next, touched };
}

export type LocaleProblem = { code: string; message: string };

/**
 * Why a text op can't be written into a language copy, or null. A section with
 * no copy yet (or only the editor's template filler) shows placeholder text there (nothing to edit); a list's items are
 * the same in every language, so only their text may change.
 */
export function localeTextProblem(op: PagePatchOp, shown: PageBlock[], content: LocaleContent, locale: string, language: string, brand: string = "Your Brand"): LocaleProblem | null {
	if (!("blockId" in op)) return null;
	const target = shown.find((b, i) => blockIdOf(b, i) === op.blockId);
	if (!realCopy(content, op.blockId, target?.blockType, locale, brand)) {
		return { code: "not_translated", message: `This section has no ${language} text yet, so there is nothing to edit there. Translate the page first (propose_page_translation), or change the original text (switch the editor to the original language).` };
	}
	if (op.op !== "edit_list") return null;
	const block = shown.find((b, i) => blockIdOf(b, i) === op.blockId);
	const rows = block ? valueAtPath(block, pathSegments(op.path)) : undefined;
	const count = Array.isArray(rows) ? rows.length : 0;
	const inPlace = op.rows.length === count && op.rows.every((row, i) => row.keep === i && !row.picture);
	return inPlace ? null : { code: "list_shape_shared", message: `Adding, removing, reordering or re-picturing the items of ${op.path} is the same in every language. Do it in the original language, then translate the page again; here you can change the text of the items.` };
}

export type SlotEdit = {
	/** the page's locale_content with the language's copy changed */
	content: LocaleContent;
	/** section id → its copy before (null = it had none) */
	previous: Record<string, Record<string, unknown> | null>;
	/** section id → fingerprint of its copy after */
	after: Record<string, string>;
};

/** Fingerprint of a section's copy in a language (the version guard of a slot write). */
export const slotFingerprint = (content: LocaleContent, blockId: string, locale: string): string => blockHash(content[blockId]?.[locale] ?? null);

/** Fingerprints of what the merchant sees of the given sections — the version guard of a text edit. */
export function shownFingerprints(shown: PageBlock[], ids: Iterable<string>): Record<string, string> {
	const byId = new Map(shown.map((block, index) => [blockIdOf(block, index), block]));
	return Object.fromEntries([...ids].flatMap((id) => (byId.has(id) ? [[id, blockHash(byId.get(id))]] : [])));
}

/**
 * The copy of `locale` after a text edit: each touched section's copy takes the
 * fields that differ between what was shown and what the edit produced; its
 * other fields and the other languages' copies stay.
 */
export function slotEdit(content: LocaleContent, locale: string, shown: PageBlock[], next: PageBlock[], touched: Iterable<string>): SlotEdit {
	const before = new Map(shown.map((block, index) => [blockIdOf(block, index), block]));
	const after = new Map(next.map((block, index) => [blockIdOf(block, index), block]));
	const out: LocaleContent = { ...content };
	const previous: SlotEdit["previous"] = {};
	for (const id of touched) {
		const was = before.get(id);
		const now = after.get(id);
		if (!was || !now) continue;
		const keys = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((key) => !isStructuralKey(key) && blockHash(was[key] ?? null) !== blockHash(now[key] ?? null));
		if (keys.length === 0) continue;
		const slot = { ...(content[id]?.[locale] ?? {}) };
		for (const key of keys) {
			if (now[key] === undefined) delete slot[key];
			else slot[key] = now[key];
		}
		previous[id] = content[id]?.[locale] ?? null;
		out[id] = { ...(content[id] ?? {}), [locale]: slot };
	}
	return { content: out, previous, after: Object.fromEntries(Object.keys(previous).map((id) => [id, slotFingerprint(out, id, locale)])) };
}

/** What undo of a text edit needs: the copy of each section before, guarded by the fingerprint the edit left. */
export type SlotRestore = { locale: string; entries: Record<string, Record<string, unknown> | null>; expect: Record<string, string> };

/** The page's copies with the sections' copy put back; null when any of them was edited since. */
export function restoreSlots(content: LocaleContent, restore: SlotRestore): LocaleContent | null {
	if (Object.entries(restore.expect).some(([id, hash]) => slotFingerprint(content, id, restore.locale) !== hash)) return null;
	const out: LocaleContent = { ...content };
	for (const [id, slot] of Object.entries(restore.entries)) {
		const slots = { ...(content[id] ?? {}) };
		if (slot === null) delete slots[restore.locale];
		else slots[restore.locale] = slot;
		out[id] = slots;
	}
	return out;
}

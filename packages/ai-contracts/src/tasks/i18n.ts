import { z } from "zod";

/**
 * Translation of site blocks and product fields — tasks ported from prime-web `/api/ai/*` routes
 * (prompts kept behaviour-equivalent; see apps/ai-platform/src/tasks/catalog/i18n-tasks.ts).
 * Each entry: "<domain>.<task>": { input: <zod schema>, output: <zod schema> }.
 */

/** Locales the site-block translator has a display name for (the prime-web route allows en/ms today). */
export const BlockTranslateLocaleSchema = z.enum(["en", "ms", "zh", "th", "id"]);

/**
 * Site block content flattened to its string leaves. Keys are readable field
 * paths (`headline`, `faq.items.0.question`) so the model keeps context and the
 * caller maps each value back; numbers, booleans and shapes never leave prime-web.
 */
export const TranslateBlocksInputSchema = z.object({
	targetLocale: BlockTranslateLocaleSchema,
	fields: z
		.record(z.string().min(1).max(300), z.string().max(10_000))
		.refine((fields) => Object.keys(fields).length > 0 && Object.keys(fields).length <= 500, {
			message: "Send between 1 and 500 fields",
		})
		.refine((fields) => JSON.stringify(fields).length <= 20_000, { message: "Fields exceed the size limit" }),
});
/** Record in the contract; the model gets a strict object pinned to the input keys. */
export const TranslateBlocksOutputSchema = z.object({
	fields: z.record(z.string(), z.string()),
});

type JsonPath = (string | number)[];
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_FIELD_KEY_LENGTH = 300;

/**
 * Collects every non-blank string leaf of `content` as `{ [fieldPath]: text }`
 * for i18n.translate-blocks, plus where each key lives so the result can be
 * written back with `applyTranslatedStrings`.
 */
export function flattenTranslatableStrings(content: Record<string, unknown>): {
	fields: Record<string, string>;
	paths: Map<string, JsonPath>;
} {
	const fields: Record<string, string> = {};
	const paths = new Map<string, JsonPath>();
	const visit = (value: unknown, path: JsonPath) => {
		if (typeof value === "string") {
			if (!value.trim()) return;
			const joined = path.join(".");
			const base = joined.length > MAX_FIELD_KEY_LENGTH ? `field${paths.size}` : joined;
			let key = base;
			// Keys containing "." can collide with a nested path ({ "a.b": …, a: { b: … } }).
			for (let n = 2; paths.has(key); n++) key = `${base.slice(0, MAX_FIELD_KEY_LENGTH - 6)}#${n}`;
			fields[key] = value;
			paths.set(key, path);
			return;
		}
		if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...path, index]));
		else if (value && typeof value === "object") {
			for (const [key, child] of Object.entries(value)) if (!UNSAFE_KEYS.has(key)) visit(child, [...path, key]);
		}
	};
	visit(content, []);
	return { fields, paths };
}

/** Copy of `content` with each translated string written back at its path (others untouched). */
export function applyTranslatedStrings(
	content: Record<string, unknown>,
	paths: Map<string, JsonPath>,
	translated: Record<string, string>,
): Record<string, unknown> {
	const result = structuredClone(content);
	for (const [key, path] of paths) {
		const value = translated[key];
		if (typeof value !== "string" || path.length === 0) continue;
		let node: unknown = result;
		for (const segment of path.slice(0, -1)) node = (node as Record<string | number, unknown>)[segment];
		(node as Record<string | number, unknown>)[path[path.length - 1]!] = value;
	}
	return result;
}

const Bcp47Schema = z
	.string()
	.min(2)
	.max(20)
	.regex(/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/);

/** One product attribute value, compare (source) locale → locale being edited. */
export const TranslateProductFieldInputSchema = z.object({
	text: z.string().trim().min(1).max(8_000),
	/** "html" keeps every tag/attribute; "plain" keeps line breaks. */
	format: z.enum(["plain", "html"]),
	sourceLocale: Bcp47Schema,
	targetLocale: Bcp47Schema,
});
export const TranslateProductFieldOutputSchema = z.object({
	text: z.string(),
});

/** Shared with prime-web's translate cache key, so a prompt bump invalidates cached results. */
export const I18N_TRANSLATE_BLOCKS_PROMPT_VERSION = "i18n-translate-blocks@2";

export const I18N_TASKS = {
	"i18n.translate-blocks": { input: TranslateBlocksInputSchema, output: TranslateBlocksOutputSchema },
	"i18n.translate-product-field": {
		input: TranslateProductFieldInputSchema,
		output: TranslateProductFieldOutputSchema,
	},
} as const;

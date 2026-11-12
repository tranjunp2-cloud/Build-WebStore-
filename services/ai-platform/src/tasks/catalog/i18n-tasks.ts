import { I18N_TRANSLATE_BLOCKS_PROMPT_VERSION, type I18N_TASKS } from "@ech/ai-contracts";
import { z } from "zod";
import { defineTask, type TaskDefinition } from "../task-definition";

/** Same names prime-web /api/ai/translate used in its prompt. */
const BLOCK_LOCALE_NAMES: Record<string, string> = {
	en: "English",
	ms: "Bahasa Malaysia (Malaysian Malay)",
	zh: "Simplified Chinese",
	th: "Thai",
	id: "Bahasa Indonesia",
};

/** English name of a BCP 47 tag for the prompt ("ms-MY" → "Malay (Malaysia)"). */
export function localeDisplayName(locale: string): string {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale;
	} catch {
		return locale;
	}
}

/**
 * Prompts ported from prime-web /api/ai/translate and /api/ai/translate-product-field.
 * Only the output-format lines changed (structured fields instead of raw JSON/text).
 */
export const I18N_TASK_DEFINITIONS: { [K in keyof typeof I18N_TASKS]: TaskDefinition<K> } = {
	"i18n.translate-blocks": defineTask({
		id: "i18n.translate-blocks",
		alias: "fast",
		promptVersion: I18N_TRANSLATE_BLOCKS_PROMPT_VERSION,
		temperature: 0.3,
		maxOutputTokens: 4096,
		instructions: (input) =>
			[
				"You are a professional translator specializing in marketing and e-commerce copy.",
				// Source-agnostic — site content may be in any language (EN, MS, VI, EL, etc.)
				`Translate ALL string values in the given JSON into natural, idiomatic ${BLOCK_LOCALE_NAMES[input.targetLocale] ?? input.targetLocale}. The source may be in any language — detect and translate automatically.`,
				"Rules:",
				'- Return every key of the given JSON in the "fields" object, each with its translated value.',
				"- Keys are field paths (e.g. faq.items.0.question): keep them exactly; translate only the values.",
				"- Keep brand placeholder tokens like {brand} and {n} unchanged.",
				"- Keep brand names, product names, model numbers, SKUs, units and numbers unchanged: do not translate or transliterate them.",
				"- Translate the same term the same way everywhere in the JSON (glossary consistency): pick one rendering per term and reuse it.",
				"- Use natural, friendly tone appropriate for Malaysian small businesses.",
				"- Do NOT add any explanation or markdown to the values.",
			].join("\n"),
		prompt: (input) => JSON.stringify(input.fields),
		// Strict structured output rejects records: pin the exact keys the caller sent.
		modelOutput: (input) =>
			z.object({ fields: z.object(Object.fromEntries(Object.keys(input.fields).map((key) => [key, z.string()]))) }),
	}),
	"i18n.translate-product-field": defineTask({
		id: "i18n.translate-product-field",
		alias: "fast",
		promptVersion: "i18n-translate-product-field@1",
		temperature: 0.2,
		maxOutputTokens: 4096,
		instructions: (input) =>
			[
				"You are a professional e-commerce translator.",
				`Translate the product text from ${localeDisplayName(input.sourceLocale)} into natural, idiomatic ${localeDisplayName(input.targetLocale)}.`,
				"Rules:",
				'- Return ONLY the translated text in the "text" field, no quotes, notes or markdown.',
				"- Keep brand names, model numbers, SKUs, units and numbers unchanged.",
				input.format === "html"
					? "- The text is HTML: keep every tag and attribute exactly, translate only the text between tags."
					: "- Keep line breaks as they are.",
				"- Do not add, drop or embellish product claims.",
			].join("\n"),
		prompt: (input) => input.text,
	}),
};

import { z } from "zod";

/**
 * Site-generation and onboarding tasks ported from prime-web's in-process
 * OpenAI calls (`lib/ai/openai-generator.ts`, `gen-page-split.ts`, sample
 * products, blog seeds, image keywords, the input translators).
 *
 * The site generator composes its prompts from category recipes, template
 * rules and block schemas that live in prime-web, so these tasks take the
 * caller-composed `system` + `user` messages verbatim; ai-platform owns the
 * model, quota, ledger and gateway. Only prime-web's server can mint the
 * context token these calls need — a browser never supplies a prompt.
 */
export const ComposedPromptInputSchema = z.object({
	/** Static instructions for this step (cache-stable per category/locale). */
	system: z.string().max(80_000).default(""),
	/** The per-request part: business details, page scope, terms to translate. */
	user: z.string().min(1).max(80_000),
	/** Sampling carried over from the original call site. */
	temperature: z.number().min(0).max(1.5).optional(),
	maxOutputTokens: z.number().int().min(16).max(16_000).optional(),
});

/** JSON-object steps: the model answers in JSON mode; prime-web validates the shape. */
export const ComposedJsonOutputSchema = z.record(z.string(), z.unknown());
/** Free-text steps (a JSON array, a short phrase list): prime-web parses the text. */
export const ComposedTextOutputSchema = z.object({ text: z.string() });

/** `/api/ai/extract-from-url`: scraped page text → business details for the onboarding form. */
export const ExtractBusinessInfoInputSchema = z.object({
	/** Pre-processed text of a public web page (untrusted). */
	pageText: z.string().min(1).max(40_000),
});
export const ExtractBusinessInfoOutputSchema = z.record(z.string(), z.unknown());

export const SITEGEN_TASKS = {
	"site.extract-business-info": { input: ExtractBusinessInfoInputSchema, output: ExtractBusinessInfoOutputSchema },
	"sitegen.site-plan": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.page-blocks": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.personalize": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.sample-products": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.blog-seeds": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.blog-post-content": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"sitegen.image-keywords": { input: ComposedPromptInputSchema, output: ComposedJsonOutputSchema },
	"i18n.translate-image-terms": { input: ComposedPromptInputSchema, output: ComposedTextOutputSchema },
	"i18n.translate-user-input": { input: ComposedPromptInputSchema, output: ComposedTextOutputSchema },
} as const;

/** Task ids whose prompts prime-web composes (see ComposedPromptInputSchema). */
export const COMPOSED_PROMPT_TASK_IDS = [
	"sitegen.site-plan",
	"sitegen.page-blocks",
	"sitegen.personalize",
	"sitegen.sample-products",
	"sitegen.blog-seeds",
	"sitegen.blog-post-content",
	"sitegen.image-keywords",
	"i18n.translate-image-terms",
	"i18n.translate-user-input",
] as const;
export type ComposedPromptTaskId = (typeof COMPOSED_PROMPT_TASK_IDS)[number];

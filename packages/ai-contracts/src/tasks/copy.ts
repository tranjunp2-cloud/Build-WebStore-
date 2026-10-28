import { z } from "zod";

/**
 * Copywriting tasks ported from prime-web `/api/ai/*` routes (prompts kept
 * behaviour-equivalent; see apps/ai-platform/src/tasks/catalog/copy-tasks.ts).
 */
export const CopyProductDescriptionInputSchema = z.object({
	name: z.string().trim().min(3).max(500),
	category: z.string().trim().max(200).optional(),
	/** "ms" → Bahasa Melayu, anything else → English (legacy route behaviour). */
	language: z.string().max(20).default("en"),
});
export const CopyProductDescriptionOutputSchema = z.object({
	description: z.string(),
});

export const CopyRewriteTextInputSchema = z.object({
	// Blog "improve" sends the selected passage, which can be a whole post.
	text: z.string().min(1).max(50_000),
	instruction: z.string().min(1).max(4000),
	/** Website section the text belongs to (hero, about…). */
	context: z.string().max(200).optional(),
	/** "vi" → Vietnamese, anything else → English (legacy route behaviour). */
	language: z.string().max(20).default("en"),
});
export const CopyRewriteTextOutputSchema = z.object({
	rewritten: z.string(),
});

export const COPY_TASKS = {
	"copy.product-description": { input: CopyProductDescriptionInputSchema, output: CopyProductDescriptionOutputSchema },
	"copy.rewrite-text": { input: CopyRewriteTextInputSchema, output: CopyRewriteTextOutputSchema },
} as const;

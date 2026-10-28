import { z } from "zod";

/**
 * SEO metadata, SEO fixes and blog drafting — tasks ported from prime-web
 * routes (prompts kept behaviour-equivalent; see
 * apps/ai-platform/src/tasks/catalog/seo-blog-tasks.ts).
 * Each entry: "<domain>.<task>": { input: <zod schema>, output: <zod schema> }.
 */

/** Longest page/product text the SEO tasks accept; callers trim to this. */
export const SEO_CONTEXT_MAX_CHARS = 20_000;

const KeywordsSchema = z.array(z.string().max(120)).max(30).default([]);

/** /api/ai/seo-generate — product listing title, meta description and slug. */
export const SeoPageMetaInputSchema = z.object({
	name: z.string().trim().min(3).max(500),
	category: z.string().trim().max(200).optional(),
	/** "ms" → Bahasa Melayu, anything else → English (legacy route behaviour). */
	language: z.string().max(20).default("en"),
	/** Site tracked keywords (AC-15). */
	keywords: KeywordsSchema,
});
export const SeoPageMetaOutputSchema = z.object({
	title: z.string(),
	description: z.string(),
	slug: z.string(),
});

/** lib/ai/generate-meta — page or product meta title + description. */
export const SeoGenerateMetaInputSchema = z.object({
	type: z.enum(["page", "product"]),
	itemName: z.string().min(1).max(300),
	siteName: z.string().min(1).max(200),
	context: z.string().max(SEO_CONTEXT_MAX_CHARS).optional(),
	keywords: KeywordsSchema,
});
export const SeoGenerateMetaOutputSchema = z.object({
	metaTitle: z.string(),
	metaDescription: z.string(),
});

/** /api/seo/fix — meta title + description from a page's block text. */
export const SeoFixMetaInputSchema = z.object({
	siteName: z.string().max(200),
	pageContent: z.string().min(1).max(SEO_CONTEXT_MAX_CHARS),
});
export const SeoFixMetaOutputSchema = z.object({
	metaTitle: z.string(),
	metaDescription: z.string(),
});

/** /api/ai/generate-blog — full HTML blog post plus its SEO fields. */
export const CopyBlogPostInputSchema = z.object({
	prompt: z.string().min(1).max(8000),
	/** "ms" → Malay, anything else → English (legacy route behaviour). */
	language: z.string().max(20).default("en"),
	tone: z.string().min(1).max(100).default("Professional"),
});
export const CopyBlogPostOutputSchema = z.object({
	title: z.string(),
	content: z.string(),
	seoTitle: z.string(),
	seoDescription: z.string(),
});

/** Blog editor ✦ — meta title + description for one post, written in the post's own language. */
export const SeoBlogMetaInputSchema = z.object({
	title: z.string().trim().max(300).default(""),
	/** the post's text (HTML stripped), trimmed by the caller */
	content: z.string().max(SEO_CONTEXT_MAX_CHARS).default(""),
	/** dashboard locale — used only when the post gives no language to follow */
	fallbackLanguage: z.string().max(20).default("en"),
});
export const SeoBlogMetaOutputSchema = z.object({
	metaTitle: z.string(),
	metaDescription: z.string(),
});

export const SEO_BLOG_TASKS = {
	"seo.page-meta": { input: SeoPageMetaInputSchema, output: SeoPageMetaOutputSchema },
	"seo.generate-meta": { input: SeoGenerateMetaInputSchema, output: SeoGenerateMetaOutputSchema },
	"seo.fix-meta": { input: SeoFixMetaInputSchema, output: SeoFixMetaOutputSchema },
	"copy.blog-post": { input: CopyBlogPostInputSchema, output: CopyBlogPostOutputSchema },
	"seo.blog-meta": { input: SeoBlogMetaInputSchema, output: SeoBlogMetaOutputSchema },
} as const;

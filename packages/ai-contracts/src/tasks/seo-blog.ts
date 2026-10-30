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

/** Most items one `seo.generate-meta-batch` call takes; callers chunk longer lists. */
export const SEO_META_BATCH_MAX_ITEMS = 20;
/** Per-item context cap of the batch task (a page's/product's opening text is enough for a meta tag). */
export const SEO_META_BATCH_CONTEXT_MAX_CHARS = 1_000;

/** lib/seo fix-all — meta title + description for several pages/products in one call, matched back by `id`. */
export const SeoGenerateMetaBatchInputSchema = z.object({
	siteName: z.string().min(1).max(200),
	keywords: KeywordsSchema,
	items: z
		.array(
			z.object({
				/** Caller's own key (echoed back unchanged); must be unique within the call. */
				id: z.string().min(1).max(100),
				type: z.enum(["page", "product"]),
				itemName: z.string().min(1).max(300),
				context: z.string().max(SEO_META_BATCH_CONTEXT_MAX_CHARS).optional(),
			}),
		)
		.min(1)
		.max(SEO_META_BATCH_MAX_ITEMS),
});
export const SeoGenerateMetaBatchOutputSchema = z.object({
	items: z.array(z.object({ id: z.string(), metaTitle: z.string(), metaDescription: z.string() })),
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

/**
 * Copilot "write several posts": the article of ONE post whose title and sections the copilot already planned.
 * Each post of the set is its own call, run in parallel by the platform (one answer for all would not fit).
 */
export const CopyBlogPostDraftInputSchema = z.object({
	title: z.string().trim().min(5).max(160),
	/** the <h2> sections, in order */
	outline: z.array(z.string().trim().min(2).max(200)).min(2).max(8),
	/** facts to use: what the merchant said, the shop's products, prices, place (empty = none) */
	notes: z.string().max(2_000).default(""),
	language: z.enum(["en", "ms", "vi"]),
	shopName: z.string().max(200).default(""),
});
export const CopyBlogPostDraftOutputSchema = z.object({
	contentHtml: z.string().min(200).max(30_000),
	seoTitle: z.string().min(5).max(70),
	seoDescription: z.string().min(20).max(170),
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
	"seo.generate-meta-batch": { input: SeoGenerateMetaBatchInputSchema, output: SeoGenerateMetaBatchOutputSchema },
	"seo.fix-meta": { input: SeoFixMetaInputSchema, output: SeoFixMetaOutputSchema },
	"copy.blog-post": { input: CopyBlogPostInputSchema, output: CopyBlogPostOutputSchema },
	"copy.blog-post-draft": { input: CopyBlogPostDraftInputSchema, output: CopyBlogPostDraftOutputSchema },
	"seo.blog-meta": { input: SeoBlogMetaInputSchema, output: SeoBlogMetaOutputSchema },
} as const;

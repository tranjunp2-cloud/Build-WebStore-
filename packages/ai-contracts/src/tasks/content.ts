import { z } from "zod";

/** Locales the AI platform writes content in (ECH product-edit locales + short blog codes). */
export const ContentLocaleSchema = z.string().min(2).max(20);

export const ProductDescriptionInputSchema = z.object({
	locale: ContentLocaleSchema,
	productName: z.string().min(1).max(200),
	/** Facts the merchant gave (category, material, size…). The model must not invent others. */
	facts: z.array(z.string().max(300)).max(30).default([]),
	tone: z.enum(["neutral", "friendly", "premium"]).default("neutral"),
	maxWords: z.number().int().min(30).max(600).default(160),
});
export const ProductDescriptionOutputSchema = z.object({
	description: z.string().min(1),
	highlights: z.array(z.string()).max(6),
});

export const TranslateInputSchema = z.object({
	targetLocale: ContentLocaleSchema,
	sourceLocale: ContentLocaleSchema.optional(),
	/** Keyed fields so callers can map results back (e.g. { name, description }). */
	fields: z.record(z.string().min(1).max(80), z.string().max(8000)),
	/** Terms that must stay verbatim (brand names, SKUs). */
	glossary: z.array(z.string().max(100)).max(50).default([]),
});
export const TranslateOutputSchema = z.object({
	fields: z.record(z.string(), z.string()),
});

export const SeoMetaInputSchema = z.object({
	locale: ContentLocaleSchema,
	title: z.string().min(1).max(300),
	body: z.string().max(12_000).default(""),
	keywords: z.array(z.string().max(80)).max(10).default([]),
});
export const SeoMetaOutputSchema = z.object({
	metaTitle: z.string().min(1).max(70),
	metaDescription: z.string().min(1).max(170),
});

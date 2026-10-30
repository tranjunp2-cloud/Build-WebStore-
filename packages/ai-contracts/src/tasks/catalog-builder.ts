import { z } from "zod";

/**
 * Bulk product parsing and website block editing — tasks ported from prime-web `/api/ai/*` routes.
 * Each entry: "<domain>.<task>": { input: <zod schema>, output: <zod schema> }.
 *
 * Both tasks answer in JSON mode (their outputs hold free-form objects strict JSON
 * schema can't express). The output schemas are the server-side validator and
 * accept exactly what the legacy routes accepted — never stricter.
 */

const CategoryIdSchema = z.union([z.string(), z.number()]);
const NonBlankStringSchema = z.string().refine((value) => value.trim().length > 0, "must not be blank");

/** `/api/ai/products-bulk-parse`: casual merchant text → product drafts. */
export const CatalogBulkParseProductsInputSchema = z.object({
	promptText: z.string().trim().min(1).max(6_000),
	locale: z.enum(["en", "ms"]).default("en"),
	/** Tenant leaf categories (id + breadcrumb path) the model may pick from; empty = none. */
	categoryCandidates: z
		.array(z.object({ id: CategoryIdSchema, path: z.string().max(240) }))
		.max(500)
		.default([]),
});

// Same acceptance rules as prime-web `isValidBulkParseResult`. Numeric fields stay
// untyped: the legacy route passed them through and the bulk-create modal coerces them.
const BulkParseVariantSchema = z.looseObject({
	name: NonBlankStringSchema,
	sku: z.string().optional(),
});
const BulkParseVariantConfigSchema = z.looseObject({
	name: z.string().optional(),
	options: z.array(z.looseObject({ value: z.string().optional() })).optional(),
});
const BulkParseProductSchema = z.looseObject({
	name: NonBlankStringSchema,
	description: z.string().optional(),
	seoTitle: z.string().optional(),
	seoDescription: z.string().optional(),
	slug: z.string().optional(),
	sku: z.string().optional(),
	categoryId: CategoryIdSchema.nullable().optional(),
	variants: z.array(BulkParseVariantSchema).optional(),
	variantConfigs: z.array(BulkParseVariantConfigSchema).optional(),
});
export const CatalogBulkParseProductsOutputSchema = z.looseObject({
	products: z.array(BulkParseProductSchema),
});

/**
 * Long bulk-add text → one piece of the merchant's own words per product, so prime-web can parse the list in
 * small parallel chunks (one long answer would hit the output limit and the time budget).
 */
export const CatalogSplitProductsInputSchema = z.object({
	promptText: z.string().trim().min(1).max(6_000),
});
export const CatalogSplitProductsOutputSchema = z.object({
	items: z.array(z.object({ text: z.string().trim().min(1).max(2_000) })).max(80),
});

export const CATALOG_BUILDER_TASKS = {
	"catalog.bulk-parse-products": {
		input: CatalogBulkParseProductsInputSchema,
		output: CatalogBulkParseProductsOutputSchema,
	},
	"catalog.split-products": {
		input: CatalogSplitProductsInputSchema,
		output: CatalogSplitProductsOutputSchema,
	},
} as const;

import { z } from "zod";

/**
 * The copilot's Product Master edit tool, shared by ai-platform (what the
 * model calls) and prime-web (which reads the product, validates against
 * @ech/contracts and applies). One call = one product, every section the
 * seller edits by hand in the PM editor. Inputs are nullable rather than
 * optional: one strict JSON schema for every model provider.
 */

export const PRODUCT_CODE_TYPES = ["gtin", "ean", "upc", "jan", "isbn"] as const;
export const VARIANT_STATUSES = ["active", "inactive", "archived"] as const;
export const ASSOCIATION_TYPES = ["accessory", "bundle", "upsell", "cross_sell", "replacement", "compatible"] as const;

export const ProductAttributeChangeSchema = z.object({
	code: z
		.string()
		.min(1)
		.max(120)
		.describe("Field code from read_item's Fields list: item_name (name), description, short_description, brand, tags, meta_title, meta_description, recommended_retail_price, item_weight…"),
	value: z
		.string()
		.max(4_000)
		.nullable()
		.describe("New value as text; null clears it. Options: the option code or label. Tags / lists: comma separated. Yes / no fields: yes | no."),
	unit: z
		.string()
		.max(20)
		.nullable()
		.describe("measurements: one of the field's units (g, kg, cm…); prices: the currency (MYR, VND…); else null"),
});
export type ProductAttributeChange = z.infer<typeof ProductAttributeChangeSchema>;

export const ProductUpdateInputSchema = z.object({
	id: z.string().min(1).max(120).describe("Product Master id from read_item / search_items or the Context line"),
	why: z.string().min(3).max(300).describe("One short line in the merchant's language"),
	sku: z.string().min(1).max(180).nullable().describe("new product SKU, only when the merchant asks"),
	attributes: z.array(ProductAttributeChangeSchema).max(60).nullable().describe("name, description, brand, tags, SEO, price, cost, weight, size, materials… by field code"),
	codes: z
		.array(
			z.object({
				type: z.enum(PRODUCT_CODE_TYPES),
				value: z.string().min(1).max(64),
				remove: z.boolean().describe("true removes this code"),
			}),
		)
		.max(10)
		.nullable()
		.describe("barcodes of the product itself (GTIN / EAN / UPC / JAN / ISBN) — only ones the merchant gave"),
	photos: z
		.object({
			add: z
				.array(z.object({ imageId: z.string().min(1).max(120), alt: z.string().max(300).nullable() }))
				.max(10)
				.nullable()
				.describe("new photos: attached / find_images / generate_image ids"),
			remove: z.array(z.string().min(1).max(120)).max(20).nullable().describe('photos to take off: "photo 2" from read_item, or its id'),
			order: z
				.array(z.string().min(1).max(120))
				.max(30)
				.nullable()
				.describe("the photos in their new order (existing \"photo N\" and new image ids); null keeps the order"),
			cover: z.string().max(120).nullable().describe("the main photo: \"photo N\" or a new image id"),
			alt: z
				.array(z.object({ photo: z.string().min(1).max(120), text: z.string().min(1).max(300) }))
				.max(20)
				.nullable()
				.describe("alt text per photo (\"photo N\")"),
		})
		.nullable(),
	variants: z
		.object({
			addValues: z
				.array(z.object({ option: z.string().min(1).max(80).describe("option code from read_item's Variant options (e.g. size, color)"), values: z.array(z.string().min(1).max(60)).min(1).max(30) }))
				.max(4)
				.nullable()
				.describe("new option values: the missing combinations become new variants"),
			allPrice: z
				.object({ amount: z.number().positive().max(1e10), currency: z.string().length(3) })
				.nullable()
				.describe("one price for every variant (a price the merchant stated)"),
			rows: z
				.array(
					z.object({
						variant: z.string().min(1).max(200).describe("option label (\"Red / XL\"), SKU or id"),
						sku: z.string().min(1).max(180).nullable(),
						price: z.number().positive().max(1e10).nullable(),
						currency: z.string().length(3).nullable(),
						barcode: z.string().max(64).nullable().describe('GTIN / EAN / UPC digits; "" removes it'),
						status: z.enum(VARIANT_STATUSES).nullable().describe("active = selling, inactive = paused, archived = taken off"),
						photo: z.string().max(120).nullable().describe("this variant's own main photo: \"photo N\" or an image id"),
						attributes: z.array(ProductAttributeChangeSchema).max(20).nullable().describe("this variant's own values that differ from the product (codes from the Fields list); null value = back to the product's"),
					}),
				)
				.max(100)
				.nullable(),
			oldVariants: z
				.enum(["pause", "archive", "keep"])
				.nullable()
				.describe("adding a NEW option type (e.g. Color to size-only variants) makes new combinations; what happens to the old variants without it (default pause)"),
		})
		.nullable(),
	family: z.string().max(160).nullable().describe("move the product to another family (code or name) — only unpublished products without variants"),
	categories: z
		.object({
			main: z.string().max(200).nullable().describe("main category: name, path or id; \"\" removes it"),
			also: z.array(z.string().min(1).max(200)).max(20).nullable().describe("extra categories (the whole list)"),
		})
		.nullable(),
	associations: z
		.object({
			add: z
				.array(
					z.object({
						product: z.string().min(1).max(200).describe("the other product: id, SKU or exact name"),
						type: z.enum(ASSOCIATION_TYPES),
					}),
				)
				.max(20)
				.nullable(),
			remove: z.array(z.object({ product: z.string().min(1).max(200), type: z.enum(ASSOCIATION_TYPES).nullable() })).max(20).nullable(),
		})
		.nullable()
		.describe("related products: accessories, bundles, upsell, cross-sell, replacements, compatible"),
	store: z
		.object({
			seoTitle: z.string().min(5).max(70).nullable(),
			seoDescription: z.string().min(20).max(170).nullable(),
			slug: z.string().min(2).max(120).nullable().describe("web store URL slug (a-z, 0-9, -)"),
		})
		.nullable()
		.describe("the web store product's own SEO and URL (Product Store)"),
	channels: z
		.array(
			z.object({
				channel: z.string().min(1).max(120).describe("channel name or Shopee / TikTok / web store, from read_item's Channels list"),
				price: z.number().positive().max(1e10).nullable().describe("a price only this channel shows"),
				currency: z.string().length(3).nullable(),
				status: z.enum(["active", "paused"]).nullable().describe("selling or paused on that channel"),
			}),
		)
		.max(10)
		.nullable()
		.describe("per-channel price and selling status — goes to that marketplace right away"),
});
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;

/** An image the run may place (attachment, library, stock, generated) — what prime-web resolves to a DAM asset. */
export const ProductImageRefSchema = z.object({
	id: z.string().min(1).max(120),
	ref: z.string().min(1).max(200),
	url: z.string().max(2_000),
	alt: z.string().max(300).optional(),
});
export type ProductImageRef = z.infer<typeof ProductImageRefSchema>;

/** The facade request: the model's input plus the pictures this run may use. */
export const ProductPrepareRequestSchema = z.object({
	input: ProductUpdateInputSchema,
	images: z.array(ProductImageRefSchema).max(40).default([]),
});
export type ProductPrepareRequest = z.infer<typeof ProductPrepareRequestSchema>;

/** Publishing a product's working draft; `channels` = whose live listings update now ([] = none). */
export const ProductPublishInputSchema = z.object({
	id: z.string().min(1).max(120),
	why: z.string().min(3).max(300),
	channels: z
		.array(z.string().min(1).max(120))
		.max(10)
		.describe('channels whose listings should update now, from read_item\'s Channels list; [] = publish without updating any listing'),
});
export type ProductPublishInput = z.infer<typeof ProductPublishInputSchema>;

/** A full tool input from the sections that change (every other section null). */
export function productUpdateInput(changes: Pick<ProductUpdateInput, "id" | "why"> & Partial<ProductUpdateInput>): ProductUpdateInput {
	return {
		sku: null,
		attributes: null,
		codes: null,
		photos: null,
		variants: null,
		family: null,
		categories: null,
		associations: null,
		store: null,
		channels: null,
		...changes,
	};
}

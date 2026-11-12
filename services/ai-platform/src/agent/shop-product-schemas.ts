import { z } from "zod";

/**
 * Payload products (capability `shop_products`): the shop's products are prime-web's own
 * `products` collection. Limits mirror `src/collections/Products.ts` on staging: name ≥ 3,
 * price 0..100 000 000, inventory 0..1 000 000, base sku ≤ 50 (variant sku ≤ 100, GH-2379), status draft / active / archived,
 * soft delete through `deletedAt` (the "trash"), at most 5 new photos.
 *
 * Tool inputs are strict JSON schemas: every field is required and nullable ("null = keep"),
 * never optional, so one schema serves every provider.
 */

export const SHOP_PRODUCT_MAX_DRAFTS = 20;
/** `MAX_PRODUCT_IMAGES` of the collection: above it a gallery can only be kept, reordered or trimmed. */
export const SHOP_PRODUCT_MAX_IMAGES = 5;
export const SHOP_PRODUCT_MAX_TAGS = 20;
export const SHOP_PRODUCT_STATUS_TARGETS = ["active", "draft", "archived", "trash"] as const;
export type ShopProductStatusTarget = (typeof SHOP_PRODUCT_STATUS_TARGETS)[number];

const Money = z.number().min(0).max(100_000_000);

/** A picture of a product: a chat picture (find_images / attached / generated) or a photo it already has. */
const ImageRefSchema = z.object({
	id: z
		.string()
		.min(1)
		.max(120)
		.describe('An image id of this chat (img_N, att_…) or one of the product\'s current photos by its ref from read_item ("media:12")'),
	alt: z.string().max(300).nullable().describe("What the photo shows, in the language of the product text; null keeps the current alt text"),
});

const TEXT_FORMAT =
	"Plain text or simple markdown: paragraphs, ## headings, - bullets, 1. numbered lists, **bold**, *italic*. No HTML, links or images";

/** The fields a product edit may set. Shared by propose_shop_product_update (changes) and _drafts (each product). */
const ProductFields = {
	name: z.string().min(3).max(120).describe("Product name, at most 120 characters"),
	shortDescription: z.string().max(500).describe("Short description for cards and search results (plain text)"),
	description: z.string().max(6000).describe(`The product description, the main text. ${TEXT_FORMAT}`),
	descriptionBM: z.string().max(6000).describe(`The Bahasa Melayu description (only when the merchant wants Malay text). ${TEXT_FORMAT}`),
	price: Money.describe("Selling price in the product's currency; only a price the merchant stated"),
	// This service cannot import web constants: keep this limit and description in sync with
	// BASE_SKU_MAX in src/lib/products/sku-limits.ts and the baseSku limit in the product form.
	sku: z.string().trim().min(1).max(50).describe("Only a SKU the merchant gave (max 50 characters)"),
	inventory: z.number().int().min(0).max(1_000_000).describe("Stock quantity; only a number the merchant gave"),
	weight: z.number().min(0).max(1000).describe("Weight in kg"),
	tags: z.array(z.string().min(1).max(50)).max(SHOP_PRODUCT_MAX_TAGS).describe("The COMPLETE tag list"),
	categoryId: z.string().min(1).max(60).describe("Category id from read_item's Categories list"),
	seoTitle: z.string().min(5).max(60).describe("SEO title, 60 characters at most (hard limit)"),
	seoDescription: z.string().min(20).max(160).describe("SEO description, 150–160 characters (hard limit 160)"),
	images: z.array(ImageRefSchema).max(12).describe(`The COMPLETE photo list in order, the first is the main photo; a new product or a product with ${SHOP_PRODUCT_MAX_IMAGES} photos or fewer may hold ${SHOP_PRODUCT_MAX_IMAGES}`),
};

export const ShopProductUpdateInputSchema = z.object({
	id: z.string().min(1).max(120).describe("Product id from read_item / search_items or the Context line"),
	reason: z.string().min(3).max(200).describe("Why, one short line in the merchant's language"),
	changes: z.object({
		name: ProductFields.name.nullable().describe("New name"),
		shortDescription: ProductFields.shortDescription.nullable(),
		description: ProductFields.description.nullable(),
		descriptionBM: ProductFields.descriptionBM.nullable(),
		price: ProductFields.price.nullable(),
		compareAtPrice: Money.nullable().describe("The price before the discount, higher than the price; 0 removes it"),
		sku: ProductFields.sku.nullable(),
		inventory: ProductFields.inventory.nullable().describe("Stock quantity (not for a product with options: its stock is the sum of the options')"),
		weight: ProductFields.weight.nullable(),
		tags: ProductFields.tags.nullable(),
		categoryId: ProductFields.categoryId.nullable(),
		seoTitle: ProductFields.seoTitle.nullable(),
		seoDescription: ProductFields.seoDescription.nullable(),
		images: ProductFields.images.nullable(),
	}),
});
export type ShopProductUpdateInput = z.infer<typeof ShopProductUpdateInputSchema>;

export const ShopProductStatusInputSchema = z.object({
	id: z.string().min(1).max(120),
	status: z.enum(SHOP_PRODUCT_STATUS_TARGETS).describe("active = on sale in the store | draft | archived | trash = moved to the trash; every one can be undone"),
	reason: z.string().min(3).max(200).describe("Why, one short line in the merchant's language"),
});
export type ShopProductStatusInput = z.infer<typeof ShopProductStatusInputSchema>;

export const ShopProductDraftsInputSchema = z.object({
	products: z
		.array(
			z.object({
				name: ProductFields.name,
				shortDescription: ProductFields.shortDescription.nullable(),
				description: ProductFields.description.nullable(),
				descriptionBM: ProductFields.descriptionBM.nullable(),
				price: ProductFields.price.nullable().describe("Only a price the merchant stated; null leaves it empty (0) for them to fill"),
				sku: ProductFields.sku.nullable(),
				inventory: ProductFields.inventory.nullable(),
				weight: ProductFields.weight.nullable(),
				tags: ProductFields.tags.nullable(),
				categoryId: ProductFields.categoryId.nullable(),
				seoTitle: ProductFields.seoTitle.nullable(),
				seoDescription: ProductFields.seoDescription.nullable(),
				images: ProductFields.images.nullable().describe("Attached or found pictures of this product, main photo first"),
			}),
		)
		.min(1)
		.max(SHOP_PRODUCT_MAX_DRAFTS),
	currency: z
		.enum(["MYR", "USD", "SGD"])
		.nullish()
		.describe(
			"Currency of the prices: the one the merchant wrote (RM = MYR, S$ = SGD, US$ = USD), else the shop's (search_items shop.currency); null = MYR. Never convert prices between currencies or assume an exchange rate.",
		),
});
export type ShopProductDraftsInput = z.infer<typeof ShopProductDraftsInputSchema>;

export const SHOP_PRODUCTS_SETUP_MAX = 20;

/**
 * One card that sets price, stock, photos and on-sale / draft for 1–20 EXISTING products at once — the
 * numbers come from the merchant (an ask_user quantities / pictures answer), never from the model.
 * Every product is read again; a value that is already there, or can't be set (options), is left out.
 */
export const ShopProductsSetupInputSchema = z.object({
	reason: z.string().min(3).max(200).describe("Why, one short line in the merchant's language"),
	products: z
		.array(
			z.object({
				id: z.string().min(1).max(120).describe("Product id from read_item / search_items"),
				price: Money.nullable().describe("Selling price the merchant typed; null keeps it (not for a product with options)"),
				inventory: ProductFields.inventory.nullable().describe("Stock the merchant typed; null keeps it (not for a product with options)"),
				images: ProductFields.images.nullable().describe("The COMPLETE photo list in order, the first is the main photo; null keeps the photos"),
				status: z.enum(["active", "draft"]).nullable().describe("active = on sale (needs price, SKU, stock and weight above 0) | draft = off sale; null keeps it"),
			}),
		)
		.min(1)
		.max(SHOP_PRODUCTS_SETUP_MAX),
});
export type ShopProductsSetupInput = z.infer<typeof ShopProductsSetupInputSchema>;

const Named = z.object({ id: z.string().min(1), name: z.string() });

/**
 * What prime-web's `content.snapshot` returns for a Payload product (`kind:"product"`), next to the
 * generic record fields. Rich text arrives as markdown / plain text; `version` is the document's
 * `updatedAt` (the conflict guard). `categories` are the tenant's categories the model may pick from.
 */
export const ShopProductSnapshotSchema = z.object({
	name: z.string(),
	shortDescription: z.string().nullable(),
	description: z.string().nullable(),
	descriptionBM: z.string().nullable(),
	price: z.number(),
	compareAtPrice: z.number().nullable(),
	currency: z.string().min(1).max(8),
	sku: z.string().nullable(),
	inventory: z.number(),
	weight: z.number().nullable(),
	hasVariants: z.boolean(),
	tags: z.array(z.string()).max(100),
	category: Named.nullable(),
	categories: z.array(Named).max(200),
	seo: z.object({ title: z.string().nullable(), description: z.string().nullable() }),
	images: z
		.array(
			z.object({
				ref: z.string().min(1),
				url: z.string(),
				alt: z.string().nullable(),
				/** where the photo came from: the merchant's own upload, a stock library or an AI picture (older snapshots: absent) */
				source: z.enum(["upload", "stock", "ai"]).optional(),
			}),
		)
		.max(30),
	/** false: the description holds pictures or content the copilot can't rewrite — leave it to the product form */
	descriptionEditable: z.boolean().optional(),
	descriptionBMEditable: z.boolean().optional(),
	descriptionNote: z.string().max(300).optional(),
});
export type ShopProductSnapshot = z.infer<typeof ShopProductSnapshotSchema>;

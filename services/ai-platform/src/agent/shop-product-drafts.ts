import type { ChangeSet, DraftField, FieldDiff, FieldSource, ProductDraftDoc } from "@ech/agent-core";
import { base, type BuildContext, type KnownImage, type ProductKnowledge } from "./change-set-builders";
import { capShopImages, resolveShopImages, shopMoney } from "./shop-product-changes";
import type { ShopProductDraftsInput } from "./shop-product-schemas";

type DraftProduct = ShopProductDraftsInput["products"][number];

/** Display-only SKU of a draft that has none: the product keeps no SKU until the merchant gives one. */
const NO_SKU = "—";
/** Collection default when the model gives no currency. */
const DEFAULT_CURRENCY = "MYR";

/** What the applier creates for one product. Nothing here is a default prime-web must guess, except `price: null` (= 0). */
export interface ShopDraftPayload {
	name: string;
	shortDescription: string | null;
	description: string | null;
	descriptionBM: string | null;
	price: number | null;
	sku: string | null;
	inventory: number | null;
	weight: number | null;
	tags: string[];
	categoryId: string | null;
	seo: { title: string | null; description: string | null };
	images: Array<{ ref: string; url: string; alt: string | null }>;
	/** the shop's currency (search_items `shop.currency`); prices are in it */
	currency: string;
}

const sourceOf = (value: string, knowledge: ProductKnowledge): FieldSource => (value && (knowledge.merchantText ?? "").includes(value.toLowerCase()) ? "you" : "ai");

function buildDraft(
	product: DraftProduct,
	index: number,
	known: readonly KnownImage[],
	knowledge: ProductKnowledge,
	currency: string,
	categoryNames: Record<string, string>,
): { payload: ShopDraftPayload; doc: ProductDraftDoc; notes: string[] } {
	const notes: string[] = [];
	const name = product.name.trim();
	// the photos the merchant picked in a question card belong to the first product when the model named none
	const requested = product.images ?? (index === 0 ? (knowledge.defaultImageIds ?? []).map((id) => ({ id, alt: null })) : []);
	const resolved = resolveShopImages(requested, known);
	const capped = capShopImages(resolved.images, 0);
	notes.push(...resolved.notes.map((note) => `${name}: ${note}`), ...capped.notes.map((note) => `${name}: ${note}`));

	const tags = [...new Set((product.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
	const payload: ShopDraftPayload = {
		name,
		shortDescription: product.shortDescription?.trim() || null,
		description: product.description?.trim() || null,
		descriptionBM: product.descriptionBM?.trim() || null,
		price: product.price,
		sku: product.sku?.trim() || null,
		inventory: product.inventory,
		weight: product.weight,
		tags,
		categoryId: product.categoryId,
		seo: { title: product.seoTitle?.trim() || null, description: product.seoDescription?.trim() || null },
		images: capped.images.map(({ ref, url, alt }) => ({ ref, url, alt })),
		currency,
	};

	const field = (key: string, label: string, value: string | null | undefined, group: DraftField["group"], source?: FieldSource): DraftField[] =>
		value ? [{ key, label, value: value.slice(0, 4000), source: source ?? sourceOf(value, knowledge), group }] : [];
	const fields: DraftField[] = [
		{ key: "name", label: "Name", value: name, source: "ai", group: "product" },
		...(product.price !== null
			? field("price", "Price", shopMoney(product.price, currency), "product", (knowledge.merchantText ?? "").includes(String(product.price)) ? "you" : "ai")
			: [{ key: "price", label: "Price", value: "", source: "missing" as const, group: "product" as const }]),
		...field("shortDescription", "Short description", payload.shortDescription, "product", "ai"),
		...field("description", "Description", payload.description, "product", "ai"),
		...field("descriptionBM", "Description (Bahasa Melayu)", payload.descriptionBM, "product", "ai"),
		...field("sku", "SKU", payload.sku, "optional"),
		...field("inventory", "Stock", product.inventory === null ? null : String(product.inventory), "optional"),
		...field("weight", "Weight", product.weight === null ? null : `${product.weight} kg`, "optional"),
		...field("tags", "Tags", tags.join(", "), "optional", "ai"),
		...field("category", "Category", payload.categoryId ? (categoryNames[payload.categoryId] ?? payload.categoryId) : null, "optional", "ai"),
		...field("seo_title", "Meta title", payload.seo.title, "seo", "ai"),
		...field("seo_description", "Meta description", payload.seo.description, "seo", "ai"),
	];
	const doc: ProductDraftDoc = {
		type: "product",
		// the shop's own products: no Product Master family on the card
		catalog: "shop",
		name,
		sku: payload.sku ?? NO_SKU,
		...(product.price !== null ? { price: shopMoney(product.price, currency) } : {}),
		fields,
		images: capped.images.map((image, i) => {
			const source = known.find((candidate) => candidate.ref === image.ref);
			return {
				url: image.url,
				origin: source?.origin ?? "upload",
				ref: image.ref,
				role: i === 0 ? ("main" as const) : ("gallery" as const),
				...(image.alt ? { alt: image.alt } : {}),
				...(source?.credit ? { credit: source.credit } : {}),
			};
		}),
	};
	return { payload, doc, notes };
}

/**
 * 1–20 new draft products. Saved with status `draft` and `aiReviewPending` (the merchant opens each
 * one to review it); nothing goes on sale. `price: null` is saved as 0 and shown as missing.
 */
export function buildShopProductDraftsChangeSet(
	input: ShopProductDraftsInput,
	ctx: BuildContext,
	knowledge: ProductKnowledge = {},
	categoryNames: Record<string, string> = {},
): ChangeSet {
	const known = knowledge.images ?? [];
	const currency = input.currency ?? DEFAULT_CURRENCY;
	const built = input.products.map((product, index) => buildDraft(product, index, known, knowledge, currency, categoryNames));
	const n = built.length;
	const diffs: FieldDiff[] = built.flatMap(({ payload }, index) => {
		const entity = { kind: "product", id: `new-${index + 1}`, label: payload.name };
		return [
			{ entity, field: "name", before: null, after: payload.name, provenance: "generated" as const },
			...(payload.price !== null ? [{ entity, field: "price", before: null, after: shopMoney(payload.price, currency), provenance: "user_input" as const }] : []),
			...(payload.description ? [{ entity, field: "description", before: null, after: payload.description.slice(0, 600), provenance: "generated" as const }] : []),
		];
	});
	const withoutPrice = built.filter(({ payload }) => payload.price === null).length;
	const notes = built.flatMap((b) => b.notes);
	return {
		...base(ctx),
		domain: "products",
		title: n === 1 ? `Create draft product: ${built[0]?.payload.name}` : `Create ${n} draft products`,
		summary: built.map((b) => b.payload.name).join(", "),
		risk: "low",
		blastRadius: { kind: "product", count: n, label: n === 1 ? "1 new draft product" : `${n} new draft products` },
		diffs,
		guardrails: [
			{ rule: "draft_only", ok: true, detail: "Created as drafts for you to review — nothing is on sale yet." },
			...(withoutPrice > 0 ? [{ rule: "price_missing", ok: true, detail: `${withoutPrice === 1 ? "1 product has" : `${withoutPrice} products have`} no price yet — set it before putting it on sale.` }] : []),
			...notes.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		drafts: built.map((b) => b.doc),
		action: {
			kind: "shop_product.create_drafts",
			payload: { version: 1, status: "draft", aiReviewPending: true, products: built.map((b) => b.payload) },
		},
	};
}

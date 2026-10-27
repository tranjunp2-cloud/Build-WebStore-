import type { BlogDraftDoc, ChangeSet, DraftField, DraftImage, FieldDiff, FieldSource, InventoryDraftDoc, ProductDraftDoc } from "@ech/agent-core";
import { PRODUCT_CODE_TYPES, type ProductUpdateInput } from "@ech/agent-core";
import { z } from "zod";
import type { PreparedProductEdit, PreparedSiteChange } from "../shop/shop-tools";
import type { ShopProductSnapshot } from "./shop-product-schemas";

/** Locales the ECH product workspace accepts for claims. */
export const PRODUCT_LOCALES = ["en-US", "ms-MY", "vi-VN", "ja-JP", "en-SG"] as const;
export const BLOG_LOCALES = ["en", "ms", "vi"] as const;
export const CHANGE_SET_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PRODUCTS_PER_CHANGE_SET = 10;
const MAX_VARIANTS = 100;

const CURRENCIES = ["MYR", "VND", "SGD", "USD", "IDR", "THB", "PHP"] as const;
const CURRENCY_SYMBOL: Record<(typeof CURRENCIES)[number], string> = {
	MYR: "RM",
	VND: "₫",
	SGD: "S$",
	USD: "US$",
	IDR: "Rp",
	THB: "฿",
	PHP: "₱",
};

/** "vi" → "vi-VN": models often name the language, not the locale. */
const SHORT_LOCALE: Record<string, (typeof PRODUCT_LOCALES)[number]> = { vi: "vi-VN", ms: "ms-MY", en: "en-US", ja: "ja-JP" };

export const ProductDraftsInputSchema = z.object({
	locale: z
		.enum([...PRODUCT_LOCALES, "vi", "ms", "en", "ja"])
		.transform((value) => SHORT_LOCALE[value] ?? (value as (typeof PRODUCT_LOCALES)[number]))
		.describe("Language of the names/descriptions you write."),
	products: z
		.array(
			z.object({
				name: z.string().min(2).max(200).describe("Product display name."),
				description: z
					.string()
					.max(4000)
					.describe("Plain-text product description, 2–5 short paragraphs. No prices, stock or invented claims."),
				sku: z.string().max(60).optional().describe("Only if the merchant gave a SKU."),
				familyCode: z.string().max(120).nullish().describe("Family code from ask_user's result; null when none."),
				price: z
					.object({ amount: z.number().positive().max(1e10), currency: z.enum(CURRENCIES) })
					.nullish()
					.describe("Only a price the merchant stated."),
				attributes: z
					.array(
						z.object({
							code: z.string().min(1).max(120),
							value: z.string().min(1).max(500),
							unit: z.string().max(20).nullish().describe("measurements: g, kg, cm…; prices: the currency"),
						}),
					)
					.max(80)
					.optional()
					.describe(
						"ask_user's attribute values unchanged (option codes), plus fillable ones from the merchant's facts — any field of the family by code (short_description, brand, tags, purchase_price, item_weight, package_weight…).",
					),
				codes: z
					.array(z.object({ type: z.enum(PRODUCT_CODE_TYPES), value: z.string().min(1).max(64) }))
					.max(5)
					.nullish()
					.describe("barcodes (GTIN / EAN / UPC) the merchant gave"),
				variants: z
					.object({
						axes: z
							.array(
								z.object({
									axis: z.enum(["color", "size", "other"]),
									label: z.string().min(1).max(40),
									values: z.array(z.string().min(1).max(60)).min(1).max(30),
								}),
							)
							.min(1)
							.max(3),
					})
					.nullish()
					.describe("Only variant options the merchant named."),
				variantRows: z
					.array(
						z.object({
							variant: z.string().min(1).max(200).describe('option label, e.g. "Red / XL"'),
							price: z.number().positive().max(1e10).nullish(),
							currency: z.enum(CURRENCIES).nullish(),
							sku: z.string().min(1).max(120).nullish(),
							barcode: z.string().max(64).nullish(),
						}),
					)
					.max(100)
					.nullish()
					.describe("per-variant price / SKU / barcode the merchant gave (currency from price)"),
				imageIds: z.array(z.string().min(1).max(80)).max(12).optional().describe("Attached image ids to use; first is the main photo."),
				imageAlts: z
					.array(z.object({ imageId: z.string().min(1).max(80), alt: z.string().min(1).max(300) }))
					.max(12)
					.nullish()
					.describe("alt text per photo: what it shows, in the product's language"),
				seo: z
					.object({ title: z.string().min(5).max(70), description: z.string().min(20).max(170) })
					.nullish(),
			}),
		)
		.min(1)
		.max(MAX_PRODUCTS_PER_CHANGE_SET),
});
export type ProductDraftsInput = z.infer<typeof ProductDraftsInputSchema>;

const ImagePlacementSchema = z.object({
	imageId: z.string().min(1).max(120).describe("An id from find_images or an attached image id."),
	caption: z.string().max(160).nullish(),
	afterSection: z.number().int().min(0).max(20).describe("Insert after this many <h2> sections (0 = before the first)."),
});

export const BlogDraftInputSchema = z.object({
	locale: z.enum(BLOG_LOCALES).describe("Language of the post."),
	title: z.string().min(5).max(160),
	contentHtml: z
		.string()
		.min(200)
		.max(30_000)
		.describe("Post body as HTML using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>. Images go in coverImageId / images, never in the HTML."),
	seoTitle: z.string().min(5).max(70),
	seoDescription: z.string().min(20).max(170),
	coverImageId: z.string().min(1).max(120).nullish().describe("Cover photo: an id from find_images or an attached image."),
	images: z.array(ImagePlacementSchema).max(4).optional().describe("Up to 4 photos inside the article."),
});
export type BlogDraftInput = z.infer<typeof BlogDraftInputSchema>;

export interface BuildContext {
	id: string;
	runId: string;
	now: Date;
}

/** An image the run may use: an attachment, a library item or a stock photo. */
export interface KnownImage {
	id: string;
	/** what the applier resolves: attachment:<id>, media:<id>, asset:<id>, pixabay:<id> */
	ref: string;
	url: string;
	origin: DraftImage["origin"];
	alt?: string;
	credit?: string;
}

export interface KnownField {
	attributeId: string;
	code: string;
	label: string;
	required: boolean;
	collection: boolean;
	localizable?: boolean;
	dataType: string;
	options: Array<{ code: string; label: string }>;
}

/** What the run learned before drafting — lets the builder say where each value came from. */
export interface ProductKnowledge {
	family?: { id: string; code: string; label: string };
	fields?: KnownField[];
	/** answers from the question flow */
	resolved?: Array<{ code: string; value: string; display: string; source: "you" | "auto" }>;
	/** everything the merchant wrote (prompt + answers), lowercased, to recognise their own values */
	merchantText?: string;
	images?: KnownImage[];
	/** photos the merchant picked in the question card — used when the model names none */
	defaultImageIds?: string[];
	/** asked from Product Store: the new Product Master drafts are also added to the store (as drafts) */
	addToStore?: boolean;
}

function asciiSlug(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[đĐ]/g, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Merchant SKU when given (normalised), else a deterministic one derived from the change set. */
export function draftSku(raw: string | undefined, name: string, changeSetId: string, index: number): string {
	const given = (raw ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	if (given.length >= 3) return given.slice(0, 60);
	const stem = asciiSlug(name).toUpperCase().split("-").slice(0, 3).join("-").slice(0, 24) || "ITEM";
	const salt = changeSetId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
	return `AI-${stem}-${salt}${index + 1}`.slice(0, 60);
}

export function blogSlug(title: string): string {
	return asciiSlug(title).slice(0, 80) || "post";
}

function htmlPreview(html: string, max = 600): string {
	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function base(ctx: BuildContext): Pick<ChangeSet, "id" | "runId" | "status" | "stagedBy" | "stagedAt" | "expiresAt"> {
	return {
		id: ctx.id,
		runId: ctx.runId,
		status: "pending",
		stagedBy: "agent",
		stagedAt: ctx.now.toISOString(),
		expiresAt: new Date(ctx.now.getTime() + CHANGE_SET_TTL_MS).toISOString(),
	};
}

export function formatPrice(price: { amount: number; currency: (typeof CURRENCIES)[number] }): string {
	const digits = price.currency === "VND" || price.currency === "IDR" ? 0 : 2;
	const amount = price.amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
	return `${CURRENCY_SYMBOL[price.currency]} ${amount}`;
}

/** "Grey" → "GR", "XL" → "XL" — readable SKU suffix per variant value. */
function skuPart(value: string): string {
	const clean = asciiSlug(value).toUpperCase().replace(/-/g, "");
	return (clean.length <= 3 ? clean : clean.slice(0, 2)) || "X";
}

function cartesian(axes: Array<{ axis: string; label: string; values: string[] }>): Array<Array<{ axis: string; value: string }>> {
	return axes.reduce<Array<Array<{ axis: string; value: string }>>>(
		(rows, axis) => rows.flatMap((row) => axis.values.map((value) => [...row, { axis: axis.axis, value }])),
		[[]],
	);
}

const AXIS_ID: Record<string, string> = { color: "recommended:color", size: "recommended:size" };

/** What each value is, for the review: the merchant's words, the decision model's pick, or the AI's writing. */
function sourceOf(value: string, knowledge: ProductKnowledge): FieldSource {
	const text = knowledge.merchantText ?? "";
	return value && text.includes(value.toLowerCase()) ? "you" : "ai";
}

interface BuiltProduct {
	payload: Record<string, unknown>;
	doc: ProductDraftDoc;
	notes: string[];
}

function buildProduct(
	product: ProductDraftsInput["products"][number],
	index: number,
	locale: string,
	ctx: BuildContext,
	knowledge: ProductKnowledge,
): BuiltProduct {
	const notes: string[] = [];
	const sku = draftSku(product.sku, product.name, ctx.id, index);
	const name = product.name.trim();
	const description = product.description.trim();
	const fields = knowledge.fields ?? [];
	const byCode = new Map(fields.map((f) => [f.code, f]));
	const family = knowledge.family && (!product.familyCode || product.familyCode === knowledge.family.code) ? knowledge.family : undefined;
	if (product.familyCode && !family) notes.push(`Family "${product.familyCode}" is not in your catalog; the draft has no family.`);

	// attribute values: flow answers win; model values must match the family's schema
	const resolved = new Map((knowledge.resolved ?? []).map((r) => [r.code, r]));
	const values = new Map<string, { value: string; display: string; source: FieldSource }>();
	for (const [code, answer] of resolved) {
		if (byCode.has(code)) values.set(code, { value: answer.value, display: answer.display, source: answer.source });
	}
	// the question flow's answers are saved as before; every value the model adds (brand, tags, cost, weight,
	// sizes…) is checked against the product's real schema once it exists and saved through the same
	// editor-draft path an edit uses (units, currencies, lists, Brands entries)
	const extra: NonNullable<ProductUpdateInput["attributes"]> = [];
	for (const attribute of product.attributes ?? []) {
		const field = byCode.get(attribute.code);
		const raw = attribute.value.trim();
		if (field && values.has(field.code)) continue;
		if (extra.some((e) => e.code === attribute.code)) continue;
		if (field && field.options.length > 0) {
			const option = field.options.find((o) => o.code.toLowerCase() === raw.toLowerCase() || o.label.toLowerCase() === raw.toLowerCase());
			if (!option) {
				notes.push(`Skipped ${field.label} "${attribute.value}": not one of the family's options.`);
				continue;
			}
			values.set(field.code, { value: option.code, display: option.label, source: sourceOf(option.label, knowledge) });
			extra.push({ code: field.code, value: option.code, unit: null });
			continue;
		}
		if (field) values.set(field.code, { value: raw, display: [raw, attribute.unit].filter(Boolean).join(" "), source: sourceOf(raw, knowledge) });
		extra.push({ code: attribute.code, value: raw, unit: attribute.unit ?? null });
	}
	const fromFlow = new Set(resolved.keys());

	const price = product.price ? formatPrice(product.price) : undefined;
	const priceSource: FieldSource = product.price && (knowledge.merchantText ?? "").includes(String(product.price.amount)) ? "you" : "ai";
	const docFields: DraftField[] = [
		{ key: "name", label: "Name", value: name, source: "ai", group: "product" },
		...(price ? [{ key: "price", label: "Price", value: price, source: priceSource, group: "product" as const }] : []),
		{ key: "description", label: "Description", value: description, source: description ? "ai" : "missing", group: "product" },
	];
	for (const field of fields) {
		const value = values.get(field.code);
		docFields.push({
			key: field.code,
			label: field.label,
			value: value?.display ?? "",
			source: value ? value.source : "missing",
			group: field.required ? "required" : "optional",
		});
	}
	for (const e of extra.filter((x) => !byCode.has(x.code))) {
		const label = e.code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
		docFields.push({ key: e.code, label, value: [e.value, e.unit].filter(Boolean).join(" "), source: sourceOf(e.value ?? "", knowledge), group: "optional" });
	}
	// a family accepts only its own attributes: no SEO fields there → said now, not after approval
	const seoAllowed = !family || byCode.has("meta_title");
	if (product.seo && !seoAllowed) notes.push(`SEO title and description are not fields of the family ${family?.label}; set them on the web store product.`);
	if (product.seo && seoAllowed) {
		extra.push({ code: "meta_title", value: product.seo.title, unit: null }, { code: "meta_description", value: product.seo.description, unit: null });
		docFields.push(
			{ key: "seo_title", label: "Meta title", value: product.seo.title, source: "ai", group: "seo" },
			{ key: "seo_description", label: "Meta description", value: product.seo.description, source: "ai", group: "seo" },
		);
	}

	const axes = (product.variants?.axes ?? []).map((axis) => ({
		...axis,
		values: [...new Set(axis.values.map((v) => v.trim()).filter(Boolean))],
	}));
	let combos = axes.length > 0 ? cartesian(axes) : [];
	if (combos.length > MAX_VARIANTS) {
		notes.push(`Only the first ${MAX_VARIANTS} of ${combos.length} variants were drafted.`);
		combos = combos.slice(0, MAX_VARIANTS);
	}
	const currency =
		product.price?.currency ??
		(product.variantRows ?? []).find((r) => r.currency)?.currency ??
		(product.attributes ?? []).map((a) => a.unit?.toUpperCase()).find((u): u is (typeof CURRENCIES)[number] => (CURRENCIES as readonly string[]).includes(u ?? "")) ??
		null;
	const given = new Map((product.variantRows ?? []).map((r) => [r.variant.toLowerCase().replace(/\s*\/\s*/g, "/"), r]));
	const rows = combos.map((combo) => {
		const label = combo.map((c) => c.value).join(" / ");
		const own = given.get(label.toLowerCase().replace(/\s*\/\s*/g, "/"));
		const ownPrice = own?.price && currency ? formatPrice({ amount: own.price, currency: (own.currency as (typeof CURRENCIES)[number] | null | undefined) ?? currency }) : undefined;
		return {
			label,
			sku: (own?.sku?.trim() || `${sku}-${combo.map((c) => skuPart(c.value)).join("-")}`).slice(0, 120),
			values: combo,
			...(ownPrice ?? price ? { price: ownPrice ?? price } : {}),
			stock: 0,
		};
	});
	for (const r of product.variantRows ?? []) {
		if (!rows.some((x) => x.label.toLowerCase().replace(/\s*\/\s*/g, "/") === r.variant.toLowerCase().replace(/\s*\/\s*/g, "/"))) {
			notes.push(`Skipped variant "${r.variant}": not one of the drafted variants.`);
		}
	}
	// every drafted variant gets the SKU and price the card shows (the platform's own SKUs keep accents)
	const variantRows = rows.map((row) => {
		const own = given.get(row.label.toLowerCase().replace(/\s*\/\s*/g, "/"));
		const amount = own?.price ?? product.price?.amount ?? null;
		return {
			variant: row.label,
			sku: row.sku,
			price: amount,
			currency: amount ? ((own?.currency as string | null | undefined) ?? currency) : null,
			barcode: own?.barcode ?? null,
			status: null,
			photo: null,
		};
	});
	if (product.price && axes.length === 0) extra.push({ code: "recommended_retail_price", value: String(product.price.amount), unit: product.price.currency });

	const imagesById = new Map((knowledge.images ?? []).map((image) => [image.id, image]));
	const imageIds = product.imageIds?.length ? product.imageIds : index === 0 ? (knowledge.defaultImageIds ?? []) : [];
	const images = imageIds.flatMap((id, i) => {
		const image = imagesById.get(id);
		if (!image) {
			notes.push(`Skipped image ${id}: not attached to this chat.`);
			return [];
		}
		const alt = product.imageAlts?.find((a) => a.imageId === id)?.alt;
		return [{ ...image, alt, role: i === 0 ? ("main" as const) : ("gallery" as const) }];
	});

	const doc: ProductDraftDoc = {
		type: "product",
		name,
		sku,
		...(price ? { price } : {}),
		...(family ? { family: { code: family.code, label: family.label } } : {}),
		fields: docFields,
		...(rows.length > 0 ? { variants: { axes: axes.map((a) => ({ code: a.axis, label: a.label })), rows } } : {}),
		images: images.map((image) => ({
			url: image.url,
			origin: image.origin,
			ref: image.ref,
			role: image.role,
			...(image.alt ? { alt: image.alt } : {}),
			...(image.credit ? { credit: image.credit } : {}),
		})),
	};

	const payload = {
		sku,
		name,
		description,
		...(family ? { familyId: family.id, familyCode: family.code } : {}),
		...(product.price ? { price: product.price } : {}),
		attributes: [...values.entries()].filter(([code]) => fromFlow.has(code)).flatMap(([code, value]) => {
			const field = byCode.get(code);
			return field
				? [
						{
							code,
							attributeId: field.attributeId,
							value: value.value,
							collection: field.collection,
							localizable: field.localizable ?? false,
							dataType: field.dataType,
						},
					]
				: [];
		}),
		...(axes.length > 0
			? {
					variants: {
						axes: axes.map((axis) => ({ axisId: AXIS_ID[axis.axis] ?? null, label: axis.label, values: axis.values })),
					},
				}
			: {}),
		images: images.map((image) => ({
			ref: image.ref,
			role: image.role === "main" ? "main_image" : "image",
			name: image.alt ?? image.id,
			...(image.alt ? { alt: image.alt } : {}),
			// a stock photo is downloaded at apply (the applier only fetches the stock host)
			...(image.ref.startsWith("pixabay:") ? { url: image.url } : {}),
		})),
		...(extra.length > 0 || product.codes?.length || variantRows.length > 0
			? {
					complete: {
						attributes: extra,
						codes: (product.codes ?? []).map((c) => ({ ...c, remove: false })),
						rows: variantRows,
					},
				}
			: {}),
		locale,
	};
	return { payload, doc, notes };
}

export function buildProductDraftsChangeSet(
	input: ProductDraftsInput,
	ctx: BuildContext,
	knowledge: ProductKnowledge = {},
): ChangeSet {
	const built = input.products.map((product, index) => buildProduct(product, index, input.locale, ctx, knowledge));
	const products = built.map((b) => b.payload as { sku: string; name: string; description: string });
	const diffs: FieldDiff[] = built.flatMap(({ doc }, index) => {
		const entity = { kind: "product", id: `new-${index + 1}`, label: doc.name };
		const rows: FieldDiff[] = [
			{ entity, field: "sku", before: null, after: doc.sku, provenance: "generated" },
			{ entity, field: "name", locale: input.locale, before: null, after: doc.name, provenance: "generated" },
		];
		const description = doc.fields.find((f) => f.key === "description")?.value;
		if (description) {
			rows.push({ entity, field: "description", locale: input.locale, before: null, after: description, provenance: "generated" });
		}
		if (doc.family) rows.push({ entity, field: "family", before: null, after: doc.family.label, provenance: "user_input" });
		for (const field of doc.fields.filter((f) => (f.group === "required" || f.group === "optional") && f.source !== "missing")) {
			rows.push({
				entity,
				field: `attribute.${field.key}`,
				before: null,
				after: field.value,
				provenance: field.source === "you" ? "user_input" : field.source === "auto" ? "inferred" : "generated",
			});
		}
		return rows;
	});
	const n = built.length;
	const variantCount = built.reduce((sum, b) => sum + (b.doc.variants?.rows.length ?? 0), 0);
	const notes = built.flatMap((b) => b.notes);
	const first = built[0]?.doc;
	return {
		...base(ctx),
		domain: "products",
		title: n === 1 ? `Create draft product: ${first?.name}` : `Create ${n} draft products`,
		summary: built.map((b) => b.doc.name).join(", "),
		risk: "low",
		blastRadius: {
			kind: "product",
			count: n,
			label:
				(n === 1 ? "1 new draft product" : `${n} new draft products`) +
				(variantCount > 0 ? `, ${variantCount} variants` : ""),
		},
		diffs,
		guardrails: [
			{ rule: "draft_only", ok: true, detail: "Created as drafts — nothing is published or listed." },
			{ rule: "stock_zero", ok: true, detail: "Stock starts at 0 until you receive goods." },
			...notes.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		drafts: built.map((b) => b.doc),
		action: {
			kind: "product.create_drafts",
			payload: { version: 2, locale: input.locale, products, ...(knowledge.addToStore ? { addToStore: true } : {}) },
		},
	};
}

export const StoreProductsInputSchema = z.object({
	productIds: z
		.array(z.string().min(1).max(120))
		.min(1)
		.max(10)
		.describe("Product Master ids from search_items / read_item results"),
});
export type StoreProductsInput = z.infer<typeof StoreProductsInputSchema>;

/** A Product Master product the run saw (search_items / read_item) — the only ids it may add to the store. */
export interface SeenProduct {
	id: string;
	title: string;
	status?: string;
	meta?: string;
}

/**
 * Product Store is a read model of Product Master: adding to the store never
 * creates a product, it brings existing Product Master products over. Ids the
 * run did not see are dropped (and said so), never guessed.
 */
export function buildStoreProductsChangeSet(input: StoreProductsInput, ctx: BuildContext, seen: readonly SeenProduct[]): ChangeSet {
	const ids = [...new Set(input.productIds)];
	const known = ids.flatMap((id) => seen.filter((p) => p.id === id).slice(0, 1));
	const unknown = ids.filter((id) => !known.some((p) => p.id === id));
	const n = known.length;
	return {
		...base(ctx),
		domain: "products",
		title: n === 1 ? `Add to the store: ${known[0]?.title}` : `Add ${n} products to the store`,
		summary: known.map((p) => p.title).join(", "),
		risk: "low",
		blastRadius: { kind: "product", count: n, label: n === 1 ? "1 product into Product Store" : `${n} products into Product Store` },
		diffs: known.map((p) => ({
			entity: { kind: "product", id: p.id, label: p.title },
			field: "store",
			before: null,
			after: p.status === "active" ? "In the store, live" : "In the store, as a draft",
			provenance: "user_input" as const,
		})),
		guardrails: [
			{ rule: "master_first", ok: true, detail: "Comes from Product Master; edits stay in Product Master." },
			{ rule: "drafts_stay_drafts", ok: true, detail: "Draft products stay hidden in the store until published." },
			...unknown.map((id) => ({ rule: "unknown_product", ok: false, detail: `Skipped ${id}: not found in this shop's Product Master.` })),
		],
		action: { kind: "store.add_products", payload: { productIds: known.map((p) => p.id) } },
	};
}

/** Keeps only the text tags the model may write; every other tag (and attributes) is dropped. */
export function cleanArticleHtml(html: string): string {
	return html
		.replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, "")
		.replace(/<[^>]+>/g, (tag) => {
			const match = tag.match(/^<\/?([a-z0-9]+)/i);
			const name = match?.[1]?.toLowerCase();
			if (!name || !["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "br"].includes(name)) return "";
			return tag.startsWith("</") ? `</${name}>` : name === "br" ? "<br>" : `<${name}>`;
		});
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function figure(image: KnownImage, caption: string | null | undefined): string {
	const text = [image.origin === "stock" ? (image.credit ?? "Pixabay") : null, caption].filter(Boolean).join(" · ");
	return `<figure data-ref="${escapeHtml(image.ref)}"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(caption ?? image.alt ?? "")}">${text ? `<figcaption>${escapeHtml(text)}</figcaption>` : ""}</figure>`;
}

/** Inserts figures after the n-th <h2> section (0 = top). */
function placeImages(html: string, placements: Array<{ image: KnownImage; caption?: string | null; afterSection: number }>): string {
	if (placements.length === 0) return html;
	const parts = html.split(/(?=<h2>)/i);
	const slots: string[][] = parts.map(() => []);
	for (const placement of placements) {
		const slot = Math.min(placement.afterSection, parts.length - 1);
		// after section n = at the end of part n (part 0 is the intro)
		(slots[Math.max(0, slot)] as string[]).push(figure(placement.image, placement.caption));
	}
	return parts.map((part, i) => part + (slots[i] ?? []).join("")).join("");
}

export function buildBlogDraftChangeSet(input: BlogDraftInput, ctx: BuildContext, images: KnownImage[] = []): ChangeSet {
	const entity = { kind: "blog_post", id: "new-1", label: input.title };
	const byId = new Map(images.map((image) => [image.id, image]));
	const notes: string[] = [];
	const cover = input.coverImageId ? byId.get(input.coverImageId) : undefined;
	if (input.coverImageId && !cover) notes.push("The cover photo was not found; the post has no cover yet.");
	const placements = (input.images ?? []).flatMap((placement) => {
		const image = byId.get(placement.imageId);
		if (!image) {
			notes.push(`Skipped photo ${placement.imageId}: not found.`);
			return [];
		}
		return [{ image, caption: placement.caption, afterSection: placement.afterSection }];
	});
	const text = cleanArticleHtml(input.contentHtml);
	const contentHtml = placeImages(text, placements);
	const plainText = htmlPreview(text, 1_000_000);
	const doc: BlogDraftDoc = {
		type: "blog",
		title: input.title.trim(),
		html: contentHtml,
		words: plainText ? plainText.split(/\s+/).length : 0,
		sections: (text.match(/<h2>/gi) ?? []).length,
		...(cover
			? { cover: { url: cover.url, origin: cover.origin, ref: cover.ref, role: "cover" as const, ...(cover.credit ? { credit: cover.credit } : {}) } }
			: {}),
		images: placements.map(({ image, caption }) => ({
			url: image.url,
			origin: image.origin,
			ref: image.ref,
			role: "inline" as const,
			...(caption ? { alt: caption } : {}),
			...(image.credit ? { credit: image.credit } : {}),
		})),
		seo: { title: input.seoTitle.trim(), description: input.seoDescription.trim() },
	};
	return {
		...base(ctx),
		domain: "cms",
		title: `Create blog draft: ${input.title}`,
		summary: input.seoDescription,
		risk: "low",
		blastRadius: { kind: "blog_post", count: 1, label: "1 new draft post" },
		diffs: [
			{ entity, field: "title", locale: input.locale, before: null, after: input.title, provenance: "generated" },
			{ entity, field: "content", locale: input.locale, before: null, after: htmlPreview(text), provenance: "generated" },
			{ entity, field: "seo.metaTitle", locale: input.locale, before: null, after: input.seoTitle, provenance: "generated" },
			{
				entity,
				field: "seo.metaDescription",
				locale: input.locale,
				before: null,
				after: input.seoDescription,
				provenance: "generated",
			},
		],
		guardrails: [
			{ rule: "draft_only", ok: true, detail: "Saved as a draft — you publish it yourself." },
			...notes.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		drafts: [doc],
		action: {
			kind: "blog.create_draft",
			payload: {
				locale: input.locale,
				title: input.title.trim(),
				slug: blogSlug(input.title),
				contentHtml,
				seoTitle: input.seoTitle.trim(),
				seoDescription: input.seoDescription.trim(),
				...(cover ? { cover: { ref: cover.ref, url: cover.url, name: cover.alt ?? cover.id, credit: cover.credit ?? null } } : {}),
				images: placements.map(({ image, caption }) => ({
					ref: image.ref,
					url: image.url,
					caption: caption ?? null,
					credit: image.credit ?? null,
				})),
			},
		},
	};
}

// ─── Edits and archive / trash of existing records ─────────────────────────

/** Inputs nullable, not optional: one strict JSON schema for every provider. */
export const UpdateInputSchema = z.object({
	kind: z.enum(["product", "blog_post"]),
	id: z.string().min(1).max(120).describe("Id from read_item / search_items or the Context line"),
	reason: z.string().min(3).max(200).describe("Why, one short line in the merchant's language"),
	changes: z.object({
		name: z.string().min(1).max(200).nullable().describe("product: new name"),
		description: z.string().max(4_000).nullable().describe("product: new description (plain text)"),
		attributes: z
			.array(z.object({ code: z.string().min(1).max(120), value: z.string().max(500) }))
			.max(20)
			.nullable()
			.describe("product: attribute values by code (codes from read_item)"),
		title: z.string().min(5).max(160).nullable().describe("blog post: new title"),
		contentHtml: z.string().min(200).max(30_000).nullable().describe("blog post: the whole new article (same HTML rules as propose_blog_post)"),
		seoTitle: z.string().min(5).max(70).nullable(),
		seoDescription: z.string().min(20).max(170).nullable(),
		coverImageId: z.string().min(1).max(120).nullable().describe("blog post: new cover, an image id from find_images / generate_image / attachments"),
	}),
});
export type UpdateInput = z.infer<typeof UpdateInputSchema>;

export const StatusChangeInputSchema = z.object({
	kind: z.enum(["product", "blog_post"]),
	id: z.string().min(1).max(120),
	action: z
		.enum(["archive", "restore", "publish", "unpublish", "trash"])
		.describe("product: archive | restore; blog post: publish | unpublish | trash | restore"),
	reason: z.string().min(3).max(200).describe("Why, one short line in the merchant's language"),
});
export type StatusChangeInput = z.infer<typeof StatusChangeInputSchema>;

/** What the record looks like now (prime-web `content.snapshot`). */
export interface RecordState {
	kind: "product" | "blog_post";
	id: string;
	title: string;
	status: string;
	version: string;
	removed: boolean;
	fields: Record<string, string | null>;
	attributes?: Array<{ code: string; label: string; value: string | null; dataType: string }>;
	/** a Payload product (capability shop_products): the editable fields as they are now */
	shopProduct?: ShopProductSnapshot;
}

/** Attribute types a text value can set safely (units, money and references stay in the editor). */
const EDITABLE_TYPES = /^(string|text|textarea|rich_text|enum|select|multiselect|integer|decimal|number|boolean)$/i;

export function preview(value: string | null | undefined, max = 240): string {
	const text = (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const VERSION_GUARD = { rule: "version_guard", ok: true, detail: "Applied only if nobody edited it since this draft — otherwise nothing is written." };
export const UNDO_GUARD = { rule: "undo", ok: true, detail: "Undo stays available for 7 days." };

/** An edit of one existing record; null when nothing would change. */
export function buildUpdateChangeSet(
	input: UpdateInput,
	state: RecordState,
	ctx: BuildContext,
	images: readonly KnownImage[] = [],
): ChangeSet | { error: string } {
	const entity = { kind: state.kind, id: state.id, label: state.title };
	const diffs: FieldDiff[] = [];
	const skipped: string[] = [];
	const changes: Record<string, unknown> = {};
	const c = input.changes;
	const diff = (field: string, before: string | null | undefined, after: string) =>
		diffs.push({ entity, field, before: before == null ? null : preview(before), after: preview(after), provenance: "generated" });

	if (state.kind === "product") {
		for (const key of ["title", "contentHtml", "seoTitle", "seoDescription", "coverImageId"] as const) {
			if (c[key] !== null) skipped.push(`${key} is a blog field — ignored for a product.`);
		}
		if (c.name !== null && c.name.trim() !== (state.fields.name ?? "")) {
			changes.name = c.name.trim();
			diff("name", state.fields.name, c.name.trim());
		}
		if (c.description !== null && preview(c.description, 4_000) !== preview(state.fields.description, 4_000)) {
			changes.description = c.description;
			diff("description", state.fields.description, c.description);
		}
		const attributes: Array<{ code: string; value: string; dataType: string }> = [];
		for (const a of c.attributes ?? []) {
			const known = state.attributes?.find((s) => s.code === a.code);
			if (!known) skipped.push(`No attribute "${a.code}" on this product.`);
			else if (!EDITABLE_TYPES.test(known.dataType)) skipped.push(`${known.label} (${known.dataType}) is set in the editor.`);
			else if ((known.value ?? "") !== a.value) {
				attributes.push({ code: a.code, value: a.value, dataType: known.dataType });
				diff(`attribute.${known.label}`, known.value, a.value);
			}
		}
		if (attributes.length > 0) changes.attributes = attributes;
	} else {
		for (const key of ["name", "description", "attributes"] as const) {
			if (c[key] !== null) skipped.push(`${key} is a product field — ignored for a blog post.`);
		}
		if (c.title !== null && c.title !== state.fields.title) {
			changes.title = c.title;
			diff("title", state.fields.title, c.title);
		}
		if (c.contentHtml !== null) {
			changes.contentHtml = cleanArticleHtml(c.contentHtml);
			diff("article", state.fields.content, changes.contentHtml as string);
		}
		if (c.seoTitle !== null && c.seoTitle !== state.fields.seoTitle) {
			changes.seoTitle = c.seoTitle;
			diff("seo.title", state.fields.seoTitle, c.seoTitle);
		}
		if (c.seoDescription !== null && c.seoDescription !== state.fields.seoDescription) {
			changes.seoDescription = c.seoDescription;
			diff("seo.description", state.fields.seoDescription, c.seoDescription);
		}
		if (c.coverImageId !== null) {
			const image = images.find((i) => i.id === c.coverImageId);
			if (!image) skipped.push(`Unknown image "${c.coverImageId}" — the cover stays.`);
			else {
				changes.cover = { ref: image.ref, url: image.url, name: image.alt ?? "Cover" };
				diff("cover", state.fields.cover, image.alt ?? "new picture");
			}
		}
	}
	if (state.removed) return { error: `This ${state.kind === "product" ? "product is archived" : "post is in the trash"} — restore it first.` };
	if (diffs.length === 0) return { error: skipped.length > 0 ? skipped.join(" ") : "Nothing would change — the values are already like that." };

	const live = state.kind === "blog_post" ? state.status === "published" : state.status === "active";
	return {
		...base(ctx),
		domain: state.kind === "product" ? "products" : "cms",
		title: `Edit ${state.kind === "product" ? "product" : "post"}: ${state.title}`,
		summary: input.reason,
		risk: live && state.kind === "blog_post" ? "medium" : "low",
		blastRadius: { kind: state.kind, count: 1, label: `${diffs.length} field${diffs.length === 1 ? "" : "s"} on 1 ${state.kind === "product" ? "product" : "post"}` },
		diffs,
		guardrails: [
			VERSION_GUARD,
			UNDO_GUARD,
			...(state.kind === "product"
				? [{ rule: "working_draft", ok: true, detail: "Goes into the product's working draft; channels change when you publish it." }]
				: live
					? [{ rule: "live", ok: true, detail: "The post is live: your site shows the change right away." }]
					: []),
			...(changes.contentHtml ? [{ rule: "pictures_kept", ok: true, detail: "The article's pictures are kept." }] : []),
			...skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		action: {
			kind: state.kind === "product" ? "product.update" : "blog.update",
			payload: { id: state.id, base: state.version, changes },
		},
	};
}

export const STATUS_LABEL: Record<string, string> = {
	draft: "Draft",
	active: "Active",
	archived: "Archived",
	discontinued: "Discontinued",
	published: "Published",
	scheduled: "Scheduled",
	trash: "In the trash",
};

/** Archive / restore a product; publish, unpublish, trash or restore a post — always reversible. */
export function buildStatusChangeSet(input: StatusChangeInput, state: RecordState, ctx: BuildContext): ChangeSet | { error: string } {
	const entity = { kind: state.kind, id: state.id, label: state.title };
	const now = state.removed ? (state.kind === "product" ? "archived" : "trash") : state.status;
	let after: string;
	let payload: Record<string, unknown>;
	if (state.kind === "product") {
		if (input.action === "archive" && !state.removed) after = "archived";
		else if (input.action === "restore" && state.removed) after = "draft";
		else return { error: `A product in "${STATUS_LABEL[now] ?? now}" can't be ${input.action}d.` };
		payload = { id: state.id, base: state.status, to: after };
	} else {
		const ok =
			(input.action === "publish" && !state.removed && state.status !== "published") ||
			(input.action === "unpublish" && !state.removed && state.status === "published") ||
			(input.action === "trash" && !state.removed) ||
			(input.action === "restore" && state.removed);
		if (!ok) return { error: `A post in "${STATUS_LABEL[now] ?? now}" can't be ${input.action}ed.` };
		after = input.action === "publish" ? "published" : input.action === "unpublish" ? "draft" : input.action === "trash" ? "trash" : state.status;
		payload = { id: state.id, base: { status: state.status, removed: state.removed }, to: input.action };
	}
	const destructive = input.action === "archive" || input.action === "trash";
	const verb = { archive: "Archive", restore: "Restore", publish: "Publish", unpublish: "Unpublish", trash: "Move to trash" }[input.action];
	return {
		...base(ctx),
		domain: state.kind === "product" ? "products" : "cms",
		title: `${verb}: ${state.title}`,
		summary: input.reason,
		risk: destructive ? "high" : input.action === "publish" || input.action === "unpublish" ? "medium" : "low",
		blastRadius: { kind: state.kind, count: 1, label: `1 ${state.kind === "product" ? "product" : "post"}` },
		diffs: [{ entity, field: "status", before: STATUS_LABEL[now] ?? now, after: STATUS_LABEL[after] ?? after, provenance: "user_input" }],
		guardrails: [
			VERSION_GUARD,
			UNDO_GUARD,
			...(destructive
				? [
						{ rule: "reversible", ok: true, detail: state.kind === "product" ? "Archiving keeps the product and its data; Restore brings it back." : "The post leaves your site and lists but stays in the trash; Restore brings it back." },
						{ rule: "typed_confirm", ok: true, detail: "You will be asked Yes / No before it applies." },
					]
				: []),
			...(input.action === "publish" ? [{ rule: "live", ok: true, detail: "The post goes live on your site." }] : []),
		],
		...(destructive ? { confirmText: state.title.slice(0, 200) } : {}),
		action: { kind: state.kind === "product" ? "product.set_status" : "blog.set_status", payload },
	};
}

// ─── Product Master edit ───────────────────────────────────────────────────

/** prime-web's drafted Product Master edit (`product.prepare`) as a change set: review doc, before → after, plan. */
export function buildProductEditChangeSet(prepared: PreparedProductEdit, ctx: BuildContext): ChangeSet {
	const diffs: FieldDiff[] = prepared.diffs.slice(0, 200).map((d) => ({ ...d, provenance: "generated" as const }));
	const product = prepared.diffs[0]?.entity ?? { kind: "product", id: String(prepared.plan.productId ?? "-") };
	const n = diffs.length;
	return {
		...base(ctx),
		domain: "products",
		title: prepared.title.slice(0, 200),
		summary: prepared.why.slice(0, 300),
		risk: prepared.risk,
		blastRadius: { kind: "product", count: 1, label: `${n} change${n === 1 ? "" : "s"} on 1 product` },
		diffs: diffs.length > 0 ? diffs : [{ entity: product, field: "product", before: null, after: prepared.title, provenance: "generated" }],
		guardrails: prepared.guardrails,
		...(prepared.confirmText ? { confirmText: prepared.confirmText } : {}),
		drafts: [prepared.doc],
		action: { kind: "product_master.update", payload: prepared.plan },
	};
}

// ─── Web builder ───────────────────────────────────────────────────────────

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function siteBlastRadius(prepared: PreparedSiteChange, diffs: FieldDiff[], sections: number): ChangeSet["blastRadius"] {
	switch (prepared.kind) {
		case "site.theme_patch":
			return { kind: "site_theme", count: diffs.length, label: plural(diffs.length, "theme setting") };
		case "site.seo_patch":
			return { kind: "site_page", count: 1, label: "SEO of 1 page" };
		case "site.translate_page":
			return { kind: "site_block", count: sections, label: `${plural(sections, "section")} translated on 1 page` };
		case "site.pages_patch": {
			// the page list prime-web planned; else the distinct pages named in the diffs ("Hero · Home" → Home)
			const planned = (prepared.plan.pages as unknown[] | undefined)?.length;
			const named = new Set(diffs.map((d) => d.entity.label?.split(" · ").pop() ?? d.entity.id)).size;
			const pages = Math.max(planned ?? named, 1);
			return { kind: "site_page", count: pages, label: `${plural(sections, "section")} on ${plural(pages, "page")}` };
		}
		case "site.page_create":
			return { kind: "site_page", count: 1, label: "1 new page (draft)" };
		case "site.nav_patch":
			return { kind: "site_navigation", count: diffs.length, label: "The menu and footer of every page" };
		case "store.categories_patch": {
			const products = new Set(diffs.filter((d) => d.entity.kind === "product").map((d) => d.entity.id)).size;
			const cats = new Set(diffs.filter((d) => d.entity.kind === "store_category").map((d) => d.entity.id)).size;
			return { kind: "store_category", count: cats + products, label: [cats > 0 ? (cats === 1 ? "1 category" : `${cats} categories`) : null, products > 0 ? plural(products, "product") : null].filter(Boolean).join(" and ") };
		}
		case "store.orders_patch": {
			const orders = new Set(diffs.filter((d) => d.entity.kind === "store_order").map((d) => d.entity.id)).size;
			return { kind: "store_order", count: orders, label: plural(orders, "order") };
		}
		case "store.discounts_patch": {
			const discounts = new Set(diffs.filter((d) => d.entity.kind === "store_discount").map((d) => d.entity.id)).size;
			return { kind: "store_discount", count: discounts, label: plural(discounts, "discount code") };
		}
		case "store.customers_patch": {
			// customers, leads (status / one email) and email templates: say each part once
			const count = (kind: string) => new Set(diffs.filter((d) => d.entity.kind === kind).map((d) => d.entity.id)).size;
			const customers = count("store_customer");
			// a reply and its status line are one lead ("reply:5" and "5")
			const leads = new Set(diffs.filter((d) => d.entity.kind === "contact_lead" || d.entity.kind === "lead_reply").map((d) => d.entity.id.replace(/^reply:/, ""))).size;
			const templates = count("email_template");
			const label = [customers > 0 ? plural(customers, "customer") : null, leads > 0 ? plural(leads, "lead") : null, templates > 0 ? plural(templates, "email template") : null].filter(Boolean).join(", ");
			return { kind: "crm_record", count: Math.max(customers + leads + templates, 1), label: label || "1 record" };
		}
		case "site.languages_patch":
			return { kind: "site_navigation", count: 1, label: "The website's languages (every page)" };
		case "site.publish": {
			// the pages that change on the live site (the card's page lines), not every page of the site
			const pages = new Set(diffs.filter((d) => d.entity.kind === "site_page").map((d) => d.entity.id)).size;
			return { kind: "site", count: pages, label: pages > 0 ? `Publish ${plural(pages, "page")} to the live site` : "Publish the menu and footer to the live site" };
		}
		default:
			return { kind: "site_block", count: sections, label: `${plural(sections, "section")} on 1 page` };
	}
}

/** prime-web's drafted web builder change (`site.prepare_*`: page edit, theme, SEO, translation, several pages, new page, menu, publish) as a change set. */
export function buildSiteChangeSet(prepared: PreparedSiteChange, ctx: BuildContext): ChangeSet {
	const diffs: FieldDiff[] = prepared.diffs.slice(0, 200).map((d) => ({ ...d, provenance: "generated" as const }));
	const sections = new Set(diffs.map((d) => d.entity.id)).size;
	return {
		...base(ctx),
		// the Product Store's categories are product data, discount codes are marketing ("campaigns", staged like products), customers / leads / email templates are "crm"; none of them is the website
		domain: prepared.kind === "store.orders_patch" ? "orders" : prepared.kind === "store.discounts_patch" ? "campaigns" : prepared.kind === "store.customers_patch" ? "crm" : prepared.kind.startsWith("store.") ? "products" : "webbuilder",
		title: prepared.title.slice(0, 200),
		summary: prepared.why.slice(0, 300),
		risk: prepared.risk,
		blastRadius: siteBlastRadius(prepared, diffs, sections),
		diffs,
		guardrails: prepared.guardrails,
		...(prepared.confirmText ? { confirmText: prepared.confirmText } : {}),
		...(prepared.requiresClick ? { requiresClick: true } : {}),
		action: { kind: prepared.kind, payload: prepared.plan },
	};
}

// ─── Inventory ─────────────────────────────────────────────────────────────

/** prime-web's drafted inventory change (`inventory.prepare`) as a change set: review doc, before → after, plan. */
export function buildInventoryChangeSet(
	prepared: {
		title: string;
		why: string;
		risk: "low" | "medium" | "high";
		doc: InventoryDraftDoc;
		diffs: Array<{ entity: { kind: string; id: string; label?: string }; field: string; before: string | null; after: string }>;
		guardrails: Array<{ rule: string; ok: boolean; detail: string }>;
		plan: Record<string, unknown>;
	},
	ctx: BuildContext,
): ChangeSet {
	const lines = prepared.doc.lines.length + (prepared.doc.more ?? 0);
	const diffs: FieldDiff[] = prepared.diffs.slice(0, 200).map((d) => ({ ...d, provenance: "inferred" as const }));
	return {
		...base(ctx),
		domain: "inventory",
		title: prepared.title.slice(0, 200),
		summary: prepared.why.slice(0, 300),
		risk: prepared.risk,
		blastRadius: { kind: "inventory", count: Math.max(lines, 1), label: lines === 1 ? "1 line" : `${lines} lines` },
		diffs: diffs.length > 0 ? diffs : [{ entity: { kind: "inventory", id: "-" }, field: "action", before: null, after: prepared.title, provenance: "inferred" }],
		guardrails: prepared.guardrails,
		drafts: [prepared.doc],
		action: { kind: "inventory.apply", payload: prepared.plan },
	};
}

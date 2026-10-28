import "server-only";

import config from "@payload-config";
import { getPayload, type Payload, type Where } from "payload";
import { lexicalToMarkdown } from "@/lib/products/product-rich-text";
import type { AgentActor } from "../context";
import {
	type CategoryOption,
	DEFAULT_SHOP_CURRENCY,
	isTrashed,
	optionsLabel,
	type ProductDoc,
	payloadUser,
	productCategory,
	productId,
	productPhotos,
	descriptionLocks,
	SHOP_CURRENCIES,
	type ShopCurrency,
	shopMoney,
	StoreProductError,
	tenantFilter,
	toSnapshot,
} from "./store-product-doc";

/**
 * Read tools for the shop's own products (Payload `products`), answering the facade's
 * `content.search_items` / `content.read_item` / `content.snapshot` with `kind:"product"`.
 * Every read runs with the caller's own access (`overrideAccess:false, user`) and is also filtered to the
 * workspace they act in, so a member of several shops never sees another shop's products here.
 */

const SEARCH_LIMIT = 10;
const CATEGORY_LIMIT = 200;
const MAX_LIST = 60;
const TEXT_LIMIT = 8000;
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

type Cms = Payload;
export type ProductSearchStatus = "draft" | "published" | "any" | "trash";

async function cms(): Promise<Cms> {
	return getPayload({ config });
}

/** The shop's categories (what a product's `categoryId` can be), in the caller's workspace. */
export async function shopCategories(actor: AgentActor, payload?: Cms): Promise<CategoryOption[]> {
	const client = payload ?? (await cms());
	const result = await client.find({
		collection: "categories",
		where: { and: [{ deletedAt: { exists: false } }, tenantFilter(actor)] },
		limit: CATEGORY_LIMIT,
		depth: 0,
		sort: "name",
		overrideAccess: false,
		user: payloadUser(actor),
	});
	return result.docs.map((doc) => {
		const row = doc as unknown as { id: number | string; name?: string; breadcrumbs?: string | null };
		return { id: String(row.id), name: row.breadcrumbs || row.name || `Category ${row.id}` };
	});
}

/** One product of the actor's workspace, trashed ones included (callers decide), or a 404. */
export async function loadShopProduct(actor: AgentActor, rawId: string, payload?: Cms, depth = 1): Promise<ProductDoc> {
	const id = productId(rawId);
	const client = payload ?? (await cms());
	const found = await client.find({
		collection: "products",
		where: { and: [{ id: { equals: id } }, tenantFilter(actor)] },
		limit: 1,
		pagination: false,
		depth,
		overrideAccess: false,
		user: payloadUser(actor),
	});
	const doc = found.docs[0] as unknown as ProductDoc | undefined;
	if (!doc) throw new StoreProductError("No such product in this shop.", 404);
	return doc;
}

/**
 * The shop's currency: the one most of its (not trashed) products are priced in, MYR when it has none or two
 * are level. A product with no stored currency counts as MYR (the collection default). New drafts are priced in it.
 */
export async function shopCurrency(actor: AgentActor, payload?: Cms): Promise<ShopCurrency> {
	const client = payload ?? (await cms());
	const counts = await Promise.all(
		SHOP_CURRENCIES.map(async (code) => {
			const currency: Where = code === DEFAULT_SHOP_CURRENCY ? { or: [{ currency: { equals: code } }, { currency: { exists: false } }] } : { currency: { equals: code } };
			const found = await client.count({
				collection: "products",
				where: { and: [tenantFilter(actor), { deletedAt: { exists: false } }, currency] },
				overrideAccess: false,
				user: payloadUser(actor),
			});
			return found.totalDocs;
		}),
	);
	let best = 0;
	counts.forEach((count, i) => {
		if (count > (counts[best] ?? 0)) best = i;
	});
	return SHOP_CURRENCIES[best] ?? DEFAULT_SHOP_CURRENCY;
}

function statusFilter(status: ProductSearchStatus | undefined): Where {
	switch (status) {
		case "draft":
			return { and: [{ status: { equals: "draft" } }, { deletedAt: { exists: false } }] };
		case "published":
			return { and: [{ status: { equals: "active" } }, { deletedAt: { exists: false } }] };
		case "trash":
			return { or: [{ status: { equals: "archived" } }, { deletedAt: { exists: true } }] };
		default:
			return { deletedAt: { exists: false } };
	}
}

/** `trash` = soft-deleted; otherwise the stored status. */
const shownStatus = (doc: ProductDoc) => (isTrashed(doc) ? "trash" : doc.status);

function summaryMeta(doc: ProductDoc): string {
	const parts = [shopMoney(doc.price ?? 0, doc.currency), doc.hasVariants ? `stock ${doc.inventory ?? 0} (options)` : `stock ${doc.inventory ?? 0}`];
	const category = productCategory(doc);
	if (category) parts.push(category.name);
	return parts.join(" · ");
}

export async function searchShopProducts(
	actor: AgentActor,
	input: { query?: string; status?: ProductSearchStatus; limit?: number },
) {
	const client = await cms();
	const query = input.query ? squash(input.query).slice(0, 80) : "";
	const result = await client.find({
		collection: "products",
		where: { and: [tenantFilter(actor), statusFilter(input.status), ...(query ? [{ name: { like: query } }] : [])] },
		limit: Math.min(Math.max(input.limit ?? SEARCH_LIMIT, 1), SEARCH_LIMIT),
		sort: ["-createdAt", "-id"],
		depth: 1,
		select: { name: true, status: true, price: true, currency: true, inventory: true, hasVariants: true, category: true, deletedAt: true, updatedAt: true },
		populate: { categories: { name: true, breadcrumbs: true } },
		overrideAccess: false,
		user: payloadUser(actor),
	});
	const [categories, currency] = await Promise.all([shopCategories(actor, client), shopCurrency(actor, client)]);
	return {
		total: result.totalDocs,
		items: (result.docs as unknown as ProductDoc[]).map((doc) => ({
			kind: "product" as const,
			id: String(doc.id),
			title: doc.name,
			status: shownStatus(doc),
			meta: summaryMeta(doc),
			updatedAt: doc.updatedAt,
		})),
		categories,
		/** what new drafts are priced in (`propose_shop_product_drafts` takes it as `currency`) */
		shop: { currency },
	};
}

function cap(text: string): string {
	return text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}…` : text;
}

/** What the copilot reads of one product: facts, description as markdown, photo refs, categories, options. */
export async function readShopProduct(actor: AgentActor, id: string) {
	const client = await cms();
	const doc = await loadShopProduct(actor, id, client);
	const categories = await shopCategories(actor, client);
	const category = productCategory(doc);
	const photos = productPhotos(doc);
	const none = "not set";
	const description = lexicalToMarkdown(doc.description);
	const malay = lexicalToMarkdown(doc.descriptionBM);
	const options = optionsLabel(doc);
	const locks = descriptionLocks(doc);
	const facts = [
		{ label: "SKU", value: doc.sku?.trim() || none },
		{ label: "Price", value: shopMoney(doc.price ?? 0, doc.currency) },
		{ label: "Compare-at price", value: doc.compareAtPrice && doc.compareAtPrice > 0 ? shopMoney(doc.compareAtPrice, doc.currency) : none },
		{ label: "Stock", value: String(doc.inventory ?? 0) },
		{ label: "Weight", value: doc.weight && doc.weight > 0 ? `${doc.weight} kg` : none },
		{ label: "Category", value: category ? `${category.name} (id ${category.id})` : none },
		{ label: "Tags", value: (doc.tags ?? []).map((row) => row.tag?.trim()).filter(Boolean).join(", ") || none },
		{ label: "Short description", value: doc.shortDescription?.trim() || none },
		{ label: "Description editable", value: locks.en ? `no: ${locks.en}` : "yes" },
		...(malay ? [{ label: "Bahasa Melayu description editable", value: locks.bm ? `no: ${locks.bm}` : "yes" }] : []),
		{ label: "SEO title", value: doc.seo?.title?.trim() || none },
		{ label: "SEO description", value: doc.seo?.description?.trim() || none },
		{ label: "Has options", value: doc.hasVariants ? `yes: ${options}` : "no" },
		{ label: "AI review pending", value: doc.aiReviewPending ? "yes" : "no" },
	];
	const variants = (doc.variants ?? []).slice(0, MAX_LIST).map((variant) => {
		const price = typeof variant.price === "number" ? shopMoney(variant.price, doc.currency) : "no price";
		return `${variant.name ?? "option"} · ${variant.sku?.trim() || "no SKU"} · ${price} · stock ${variant.stock ?? 0}`;
	});
	return {
		kind: "product" as const,
		id: String(doc.id),
		title: doc.name,
		status: shownStatus(doc),
		url: `/products/${encodeURIComponent(String(doc.id))}`,
		facts,
		...(description || malay ? { text: cap([description, malay ? `Bahasa Melayu:\n${malay}` : ""].filter(Boolean).join("\n\n")) } : {}),
		lists: [
			{ label: "Photos", items: photos.map((photo, i) => `photo ${i + 1} · ${photo.ref} · ${photo.alt ?? "no alt text"}`).slice(0, MAX_LIST) },
			{ label: "Categories", items: categories.map((option) => `${option.id} · ${option.name}`).slice(0, MAX_LIST) },
			...(doc.hasVariants ? [{ label: "Options", items: variants }] : []),
		],
		media: photos.filter((photo) => photo.url).slice(0, 12).map((photo, i) => ({ url: photo.url, ...(photo.alt ? { alt: photo.alt } : {}), label: `photo ${i + 1}` })),
		updatedAt: doc.updatedAt,
	};
}

/** The exact current state of a product, re-read from the database: what an edit is drafted from. */
export async function snapshotShopProduct(actor: AgentActor, id: string) {
	const client = await cms();
	const doc = await loadShopProduct(actor, id, client);
	return toSnapshot(doc, await shopCategories(actor, client));
}

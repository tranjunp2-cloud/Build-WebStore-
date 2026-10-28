import "server-only";

import type { User } from "payload";
import { descriptionLockMessage, lexicalToMarkdown } from "@/lib/products/product-rich-text";
import type { AgentActor } from "../context";

/**
 * The shop's own products (Payload `products`) as the copilot sees and edits them. Shared by the read
 * tools (`store-product-tools.ts`) and the appliers (`appliers/store-product.ts`).
 */

export class StoreProductError extends Error {
	constructor(
		message: string,
		readonly status: 404 | 409 | 422,
	) {
		super(message);
		this.name = "StoreProductError";
	}
}

type Relation<T> = T | number | string | null | undefined;
export interface MediaRef {
	id: number | string;
	url?: string | null;
}
export interface ProductDoc {
	id: number | string;
	name: string;
	status: "draft" | "active" | "archived";
	shortDescription?: string | null;
	description?: unknown;
	descriptionBM?: unknown;
	price?: number | null;
	compareAtPrice?: number | null;
	currency?: string | null;
	sku?: string | null;
	inventory?: number | null;
	weight?: number | null;
	hasVariants?: boolean | null;
	variantConfigs?: Array<{ name?: string; options?: Array<{ value?: string }> }> | null;
	variants?: Array<{ name?: string; sku?: string | null; price?: number | null; stock?: number | null }> | null;
	tags?: Array<{ tag?: string }> | null;
	category?: Array<Relation<{ id: number | string; name?: string; breadcrumbs?: string | null }>> | null;
	images?: Array<{ image?: Relation<MediaRef>; alt?: string | null }> | null;
	seo?: { title?: string | null; description?: string | null } | null;
	aiReviewPending?: boolean | null;
	tenant?: Relation<{ id: number | string }>;
	deletedAt?: string | null;
	updatedAt: string;
}
export type CategoryOption = { id: string; name: string };

/** Payload user for a local-API call made for this actor (the same cast the site tools use). */
export const payloadUser = (actor: AgentActor) => actor.user as unknown as User;

/** Numeric ids stay numbers: Neon's integer foreign keys reject quoted ids in some filters. */
export function relationId(value: unknown): string | null {
	if (typeof value === "string" || typeof value === "number") return String(value);
	if (value && typeof value === "object" && "id" in value) return relationId((value as { id: unknown }).id);
	return null;
}

export const tenantFilter = (actor: AgentActor) => ({ tenant: { equals: /^\d+$/.test(actor.tenantId) ? Number(actor.tenantId) : actor.tenantId } });

/** A product id from the model: digits only, anything else is "no such product" (never a query). */
export function productId(raw: string): number {
	if (!/^[1-9]\d{0,11}$/.test(raw)) throw new StoreProductError("No such product in this shop.", 404);
	return Number(raw);
}

export function shopMoney(amount: number, currency: string | null | undefined): string {
	const code = currency || "MYR";
	const symbol: Record<string, string> = { MYR: "RM", USD: "US$", SGD: "S$" };
	const text = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return `${symbol[code] ?? code} ${text}`;
}

export const isTrashed = (doc: Pick<ProductDoc, "deletedAt">) => Boolean(doc.deletedAt);

export function mediaOf(row: { image?: Relation<MediaRef> }): MediaRef | null {
	const image = row.image;
	if (image && typeof image === "object") return image;
	return image == null ? null : { id: image };
}

export function productPhotos(doc: ProductDoc): Array<{ ref: string; url: string; alt: string | null }> {
	return (doc.images ?? []).flatMap((row) => {
		const media = mediaOf(row);
		return media ? [{ ref: `media:${media.id}`, url: media.url ?? "", alt: row.alt?.trim() || null }] : [];
	});
}

export function productCategory(doc: ProductDoc): CategoryOption | null {
	const first = doc.category?.[0];
	if (first == null) return null;
	const id = relationId(first);
	if (!id) return null;
	const named = typeof first === "object" ? (first.breadcrumbs || first.name) : undefined;
	return { id, name: named || `Category ${id}` };
}

export const optionsLabel = (doc: ProductDoc) =>
	doc.hasVariants ? (doc.variantConfigs ?? []).map((tier) => tier.name?.trim()).filter(Boolean).join(" × ") || "options" : "";

/** Currencies a product can be priced in (the `currency` options of the Products collection; a test keeps them equal). */
export const SHOP_CURRENCIES = ["MYR", "USD", "SGD"] as const;
export type ShopCurrency = (typeof SHOP_CURRENCIES)[number];
export const DEFAULT_SHOP_CURRENCY: ShopCurrency = "MYR";

/** A currency the collection accepts, else the default (what a draft falls back to). */
export function shopCurrencyOr(value: unknown): ShopCurrency {
	const code = typeof value === "string" ? value.trim().toUpperCase() : "";
	return SHOP_CURRENCIES.find((known) => known === code) ?? DEFAULT_SHOP_CURRENCY;
}

/** Can the copilot rewrite the English / Bahasa Melayu description without losing pictures or formatting? Says why not. */
export function descriptionLocks(doc: Pick<ProductDoc, "description" | "descriptionBM">) {
	return { en: descriptionLockMessage(doc.description), bm: descriptionLockMessage(doc.descriptionBM) };
}

/** What `content.snapshot` answers; `version` is the stored `updatedAt`, the conflict guard of every edit. */
export function toSnapshot(doc: ProductDoc, categories: CategoryOption[]) {
	const category = productCategory(doc);
	const locks = descriptionLocks(doc);
	return {
		kind: "product" as const,
		id: String(doc.id),
		title: doc.name,
		status: doc.status,
		version: doc.updatedAt,
		removed: isTrashed(doc),
		fields: {},
		shopProduct: {
			name: doc.name,
			shortDescription: doc.shortDescription?.trim() || null,
			description: lexicalToMarkdown(doc.description),
			descriptionBM: lexicalToMarkdown(doc.descriptionBM),
			// false = pictures or formatting inside; a description change is refused (the form is the place for it)
			descriptionEditable: locks.en === null,
			descriptionBMEditable: locks.bm === null,
			...(locks.en || locks.bm ? { descriptionNote: locks.en ?? locks.bm } : {}),
			price: doc.price ?? 0,
			compareAtPrice: doc.compareAtPrice && doc.compareAtPrice > 0 ? doc.compareAtPrice : null,
			currency: doc.currency || "MYR",
			sku: doc.sku?.trim() || null,
			inventory: doc.inventory ?? 0,
			weight: doc.weight ?? null,
			hasVariants: Boolean(doc.hasVariants),
			tags: (doc.tags ?? []).map((row) => row.tag?.trim() ?? "").filter(Boolean),
			category,
			categories,
			seo: { title: doc.seo?.title?.trim() || null, description: doc.seo?.description?.trim() || null },
			images: productPhotos(doc),
		},
	};
}

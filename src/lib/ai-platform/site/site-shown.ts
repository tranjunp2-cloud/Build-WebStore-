import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import type { PageBlock } from "./site-blocks";
import { hasPicture, pictureName, sampleRule, sampleText } from "./site-samples";

/**
 * What a section shows the merchant, picture by picture, and where each
 * picture comes from: the section's own field, a product of the store, or a
 * sample picture the block falls back to while the field (or the store) is
 * empty. The stored block alone hides the last two, so the copilot used to
 * answer "this section has no pictures" about a carousel full of them.
 */

export type PictureSource = "own" | "product" | "sample" | "empty";

export type PictureSpot = {
	/** where it is on the section, e.g. "images.2.image", "product prod_…" */
	where: string;
	source: PictureSource;
	/** the merchant's words for what is there now */
	now: string;
	/** how the copilot changes it */
	change: string;
};

export type ShownProduct = { id: string; name: string; photo: boolean };

/** A store product as the section reads it (images populated one level). */
type StoreProductDoc = { id: string | number; name?: string | null; images?: Array<{ image?: { url?: string | null } | number | string | null } | null> | null };

export type Shown = {
	pictures: PictureSpot[];
	products?: { how: "newest"; list: ShownProduct[] };
	notes: string[];
};

/** Single-picture keys `set_image` writes (mirrors site-prepare). */
const SINGLE_PICTURE = new Set(["image", "backgroundImage", "avatar", "logo", "photo", "thumbnail", "poster", "beforeImage", "afterImage"]);
const SKIP = new Set(["blockType", "id", "_id", "_order", "_path", "blockName", "sourceLayout", "products"]);
const MAX_SPOTS = 40;

/** Rows of a list whose items carry a picture key ({ image, caption }, { logo, name }…). */
function pictureKeyOf(rows: unknown[]): string | null {
	for (const row of rows) {
		if (!row || typeof row !== "object" || Array.isArray(row)) continue;
		const key = Object.keys(row).find((k) => SINGLE_PICTURE.has(k));
		if (key) return key;
	}
	return null;
}

/**
 * The section's own picture fields as stored, at any depth: single pictures
 * and lists of rows with a picture. An empty field shows what the block's
 * sample rule says (site-samples.ts), else nothing.
 */
export function ownPictures(block: PageBlock): PictureSpot[] {
	const type = String(block.blockType ?? "");
	const spots: PictureSpot[] = [];
	const visit = (value: unknown, path: string[], listKey: string | null) => {
		if (spots.length >= MAX_SPOTS || !value || typeof value !== "object") return;
		if (Array.isArray(value)) {
			const key = pictureKeyOf(value);
			value.forEach((row, i) => visit(row, [...path, String(i)], key));
			return;
		}
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			if (SKIP.has(key)) continue;
			const at = [...path, key];
			if (SINGLE_PICTURE.has(key)) {
				const where = at.join(".");
				if (hasPicture(child)) spots.push({ where, source: "own", now: pictureName(child), change: `set_image path "${where}"` });
				else {
					const shows = sampleRule(type)?.emptyField?.(where, block);
					spots.push({ where, source: shows?.source ?? "empty", now: shows?.now ?? "no picture", change: `set_image path "${where}"` });
				}
				continue;
			}
			if (Array.isArray(child) || (child && typeof child === "object")) visit(child, at, listKey);
		}
	};
	visit(block, [], null);
	return spots;
}

/** Store products by status, to explain why a product section shows samples. */
async function storeCounts(tenantId: string): Promise<Record<string, number>> {
	const cms = await getPayload({ config });
	const out: Record<string, number> = {};
	for (const status of ["active", "draft", "archived"]) {
		const found = await cms.count({ collection: "products", where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: status } }] }, overrideAccess: true } as Parameters<typeof cms.count>[0]);
		out[status] = found.totalDocs;
	}
	return out;
}

const toShown = (doc: StoreProductDoc): ShownProduct => {
	const first = doc.images?.[0]?.image;
	return { id: String(doc.id), name: String(doc.name ?? "").slice(0, 80), photo: Boolean(first && typeof first === "object" && first.url) };
};

/**
 * The products a product section shows right now: the store's newest products on sale, read the way the
 * block reads them (`/api/storefront/products?site=…&sort=-createdAt` — active, not deleted, this site).
 */
async function productsShown(siteId: string, limit: number): Promise<Shown["products"]> {
	const cms = await getPayload({ config });
	const found = await cms.find({
		collection: "products",
		where: { and: [{ site: { equals: Number(siteId) } }, { status: { equals: "active" } }, { deletedAt: { exists: false } }] },
		sort: "-createdAt",
		limit,
		depth: 1,
		overrideAccess: true,
	} as Parameters<typeof cms.find>[0]);
	return { how: "newest", list: (found.docs as unknown as StoreProductDoc[]).slice(0, limit).map(toShown) };
}

const PRODUCT_PHOTO = (id: string) => `the product's own photo: edit the product in Products (id ${id})`;

/** Featured Products: products of the store, else the section's own pictures, else samples. */
async function featuredShown(block: PageBlock, siteId: string, tenantId: string): Promise<Shown> {
	const carousel = block.variant === "carousel";
	const products = await productsShown(siteId, carousel ? 6 : 2);
	const rows = Array.isArray(block.images) ? (block.images as Array<Record<string, unknown> | null>) : [];
	const own = rows.map((row, i) => ({ i, row })).filter(({ row }) => hasPicture(row?.image));
	const notes: string[] = [];
	const pictures: PictureSpot[] = [];
	const list = (products?.list ?? []).slice(0, carousel ? 6 : 1);
	if (list.length > 0) {
		list.forEach((product, i) => {
			if (product.photo) pictures.push({ where: `product ${product.id}`, source: "product", now: `photo of “${product.name}”`, change: PRODUCT_PHOTO(product.id) });
			else if (own.length > 0) {
				const pick = own[i % own.length]!;
				pictures.push({ where: `product ${product.id}`, source: "own", now: `“${product.name}” has no photo: shows ${pictureName(pick.row?.image)} (images.${pick.i}.image)`, change: `${PRODUCT_PHOTO(product.id)}; or set_pictures path "images"` });
			} else pictures.push({ where: `product ${product.id}`, source: "sample", now: `“${product.name}” has no photo: shows a sample picture`, change: `${PRODUCT_PHOTO(product.id)}; or set_pictures path "images" (the section's own pictures, used for products without a photo)` });
		});
		notes.push(`Shows the store's newest products on sale: their own photos. Products without a photo show the section's own pictures (images), else a sample.`);
	} else {
		// nothing to show from the store: the section's own pictures (a row without one is a sample), like a gallery
		const slots = rows.length > 0 ? rows.length : carousel ? 6 : 1;
		for (let i = 0; i < (carousel ? slots : 1); i++) {
			const row = rows[i];
			const where = `images.${i}.image`;
			if (row && hasPicture(row.image)) pictures.push({ where, source: "own", now: pictureName(row.image), change: `set_image path "${where}", or set_pictures path "images" for the whole list` });
			else pictures.push({ where, source: "sample", now: "a sample picture (industry stock) with the headline over it", change: row ? `set_image path "${where}", or set_pictures path "images" for the whole list` : `set_pictures path "images" (the whole list, in order)` });
		}
		const counts = await storeCounts(tenantId).catch(() => null);
		const waiting = counts ? [counts.draft ? `${counts.draft} draft` : "", counts.archived ? `${counts.archived} archived` : ""].filter(Boolean).join(", ") : "";
		notes.push(
			`No product is on sale in the web store${waiting ? ` (store products: ${waiting})` : ""}, so this section shows ${carousel ? "a carousel of pictures" : "a picture"} with the headline over ${carousel ? "them" : "it"}, not products. These are the section's own pictures (images) — ${own.length > 0 ? `${own.length} set` : "none set yet, so all are samples"}. To replace them: set_pictures path "images" with the chosen pictures. To show products instead: put products on sale in the store.`,
		);
	}
	return { pictures, products: products ? { ...products, list } : undefined, notes };
}

/**
 * Own pictures named by their alt text / file name instead of "media 43", so the copilot can tell which
 * picture is which ("the coffee one"). Ids come from the merchant's own section.
 */
async function nameMedia(shown: Shown): Promise<Shown> {
	const ids = [...new Set(shown.pictures.flatMap((p) => [...p.now.matchAll(/media (\d+)/g)].map((m) => Number(m[1]))))].slice(0, 40);
	if (ids.length === 0) return shown;
	const cms = await getPayload({ config });
	const found = await cms
		.find({ collection: "media", where: { id: { in: ids } }, depth: 0, limit: ids.length, overrideAccess: true, select: { alt: true, filename: true } } as Parameters<typeof cms.find>[0])
		.catch(() => ({ docs: [] }));
	const names = new Map(
		(found.docs as Array<{ id: unknown; alt?: string | null; filename?: string | null }>).map((doc) => [Number(doc.id), (doc.alt || doc.filename || "").replace(/\s+/g, " ").trim().slice(0, 60)]),
	);
	return { ...shown, pictures: shown.pictures.map((p) => ({ ...p, now: p.now.replace(/media (\d+)/g, (all, id) => (names.get(Number(id)) ? `media ${id}: “${names.get(Number(id))}”` : all)) })) };
}

/** What the section shows, for site_read view "block" (and a one-line summary for view "page"). */
export async function describeShown(block: PageBlock, site: { siteId: string; tenantId: string }, named = false): Promise<Shown> {
	const shown = await shownOf(block, site);
	return named ? nameMedia(shown) : shown;
}

async function shownOf(block: PageBlock, site: { siteId: string; tenantId: string }): Promise<Shown> {
	const type = String(block.blockType ?? "");
	if (type === "products-featured") {
		try {
			return await featuredShown(block, site.siteId, site.tenantId);
		} catch {
			return { pictures: ownPictures(block), notes: ["Couldn't read the products this section shows right now; its own pictures are listed."] };
		}
	}
	const rule = sampleRule(type);
	const pictures = rule?.spots ? rule.spots(block) : ownPictures(block);
	const notes = [rule?.note, sampleText(block)].filter((note): note is string => Boolean(note));
	return { pictures, notes };
}

/** "6 pictures: 6 samples" — the page view's hint that a section has pictures and where from. */
export function shownSummary(shown: Shown): string | null {
	if (shown.pictures.length === 0) return null;
	const by = (source: PictureSource) => shown.pictures.filter((p) => p.source === source).length;
	const parts = [
		by("own") ? `${by("own")} own` : "",
		by("product") ? `${by("product")} product photos` : "",
		by("sample") ? `${by("sample")} samples` : "",
		by("empty") ? `${by("empty")} empty` : "",
	].filter(Boolean);
	return `${shown.pictures.length} picture spot${shown.pictures.length === 1 ? "" : "s"}: ${parts.join(", ")}`;
}


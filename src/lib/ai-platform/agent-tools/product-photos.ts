import "server-only";

import type { Payload } from "payload";
import { type MediaLite, resolveAllowedMedia } from "../media-access";

/**
 * "Photos of an existing product": the pictures the workspace's own (not trashed) products use, as the attach
 * menu's product tab and `media.search source:"product"` list them. Each picture is labelled with its product's
 * name and handed out as `media:<id>`; a picture is only listed when it also passes the library rule
 * (`media-access.ts`), so whatever the menu offers can be picked and placed afterwards.
 */

const PRODUCT_LIMIT = 60;
const MAX_IDS = 200;
const escapeLike = (value: string) => value.replace(/[%_\\]/g, " ").trim().slice(0, 80);
const asId = (value: string | number) => (/^\d+$/.test(String(value)) ? Number(value) : value);

function mediaId(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "object") return mediaId((value as { id?: unknown }).id);
	return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export type ProductPhoto = MediaLite & { productName: string };

export async function listProductPhotos(cms: Payload, tenantId: string, input: { query?: string; limit?: number } = {}): Promise<ProductPhoto[]> {
	const limit = Math.min(Math.max(Math.trunc(input.limit ?? 12), 1), 24);
	const query = escapeLike(input.query ?? "");
	const products = await cms.find({
		collection: "products",
		where: {
			and: [{ tenant: { equals: asId(tenantId) } }, { deletedAt: { exists: false } }, { "images.image": { exists: true } }, ...(query ? [{ name: { like: query } }] : [])],
		},
		sort: ["-updatedAt", "-id"],
		limit: PRODUCT_LIMIT,
		pagination: false,
		depth: 0,
		select: { name: true, images: true },
		overrideAccess: true,
	});
	// product order first, a picture shared by two products is listed once (under the first)
	const names = new Map<string, string>();
	for (const product of products.docs as unknown as Array<{ name?: string; images?: Array<{ image?: unknown }> }>) {
		for (const row of product.images ?? []) {
			const id = mediaId(row?.image);
			if (id && /^\d{1,12}$/.test(id) && !names.has(id) && names.size < MAX_IDS) names.set(id, (product.name ?? "").trim() || "Product");
		}
	}
	if (names.size === 0) return [];
	const allowed = await resolveAllowedMedia(cms, tenantId, [...names.keys()]);
	const photos: ProductPhoto[] = [];
	for (const [id, productName] of names) {
		const row = allowed.get(id);
		if (row?.url && row.mimeType.startsWith("image/")) photos.push({ ...row, productName });
		if (photos.length >= limit) break;
	}
	return photos;
}

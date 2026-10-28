import "server-only";

import type { ChangeSet, ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import { allowsProductImages } from "@/lib/products/image-limit";
import { markdownToLexical } from "@/lib/products/product-rich-text";
import { saveProduct, stripRowIds, updateProductField } from "@/lib/products/save-product";
import type { AgentActor } from "../context";
import { descriptionLocks, mediaOf, type ProductDoc, relationId, tenantFilter } from "../agent-tools/store-product-doc";
import { type AttachmentLoader, ChangeSetApplyError, staleChange } from "./errors";
import { samePlan } from "./same-plan";
import { ingestPicture } from "./picture-ingest";
import {
	assertProductManagement,
	assertSameVersion,
	currentProduct,
	isoTime,
	productActor,
	productEntity,
	productLink,
	saveFailure,
	undoUntil,
} from "./store-product-shared";

/**
 * Edits and status changes of the shop's own products (Payload `products`), applied with the approving
 * user's access through `lib/products/save-product`. The change set carries the product's `updatedAt` as
 * `base`: a product edited since is refused (409), never overwritten. The pre-image goes back as `undo`.
 */

const ProductIdSchema = z.string().regex(/^[1-9]\d{0,11}$/);
const Stamp = z.string().min(1).max(40);

const ImageSchema = z.object({
	ref: z.string().min(1).max(160),
	url: z.string().max(2000).optional().default(""),
	alt: z.string().max(300).nullable().optional(),
	existing: z.boolean().optional(),
});

const UpdatePayloadSchema = z.object({
	id: ProductIdSchema,
	base: Stamp,
	changes: z
		.object({
			name: z.string().min(3).max(120),
			shortDescription: z.string().max(500),
			description: z.string().max(6000),
			descriptionBM: z.string().max(6000),
			price: z.number().min(0).max(100_000_000),
			compareAtPrice: z.number().min(0).max(100_000_000).nullable(),
			sku: z.string().min(1).max(100),
			inventory: z.number().int().min(0).max(1_000_000),
			weight: z.number().min(0).max(1000),
			tags: z.array(z.string().min(1).max(50)).max(20),
			categoryId: z.string().regex(/^[1-9]\d{0,11}$/),
			seo: z.object({ title: z.string().min(1).max(60).optional(), description: z.string().min(1).max(160).optional() }),
			images: z.array(ImageSchema).max(12),
		})
		.partial()
		.strict(),
});

const StatusPayloadSchema = z.object({
	id: ProductIdSchema,
	base: Stamp,
	from: z.enum(["draft", "active", "archived", "trash"]),
	to: z.enum(["draft", "active", "archived", "trash"]),
});

const RestorePayloadSchema = z.object({
	id: ProductIdSchema,
	/** the product's `updatedAt` right after the change; an edit since then makes the undo refuse */
	expect: Stamp,
	/** a status undo is guarded by the status itself: the background SEO fill that follows an activation moves `updatedAt` */
	expectState: z.object({ status: z.enum(["draft", "active", "archived"]), trashed: z.boolean() }).optional(),
	fields: z.record(z.string(), z.unknown()),
});

async function cms(): Promise<Payload> {
	return getPayload({ config });
}

const richText = (markdown: string) => (markdown.trim() ? markdownToLexical(markdown) : null);
const tagRows = (tags: string[]) => tags.map((tag) => ({ tag }));

function currentImages(doc: ProductDoc): Array<{ mediaId: string; alt: string | null }> {
	return (doc.images ?? []).flatMap((row) => {
		const media = mediaOf(row);
		return media ? [{ mediaId: String(media.id), alt: row.alt ?? null }] : [];
	});
}

const numeric = (id: string) => (/^\d+$/.test(id) ? Number(id) : id);

/** The category must be one of this shop's (not removed). */
async function assertShopCategory(cms: Payload, actor: AgentActor, categoryId: string, label?: string) {
	const found = await cms.find({
		collection: "categories",
		where: { and: [{ id: { equals: numeric(categoryId) } }, { deletedAt: { exists: false } }, tenantFilter(actor)] },
		limit: 1,
		depth: 0,
		pagination: false,
		overrideAccess: true,
	});
	if (found.docs.length === 0) throw new ChangeSetApplyError(`${label ? `${label}: ` : ""}the category is not one of this shop's categories.`, 422);
}

/** The photo rows to store: kept ones as they are, new ones ingested into the shop's media. */
export async function productPictureRows(
	cms: Payload,
	actor: AgentActor,
	pictures: z.infer<typeof ImageSchema>[],
	fallbackName: string,
	loadAttachment: AttachmentLoader | undefined,
	current: ProductDoc | null,
): Promise<Array<{ image: number | string; alt?: string }>> {
	const kept = new Map(currentImages(current ?? ({ images: [] } as unknown as ProductDoc)).map((row) => [`media:${row.mediaId}`, row]));
	const rows: Array<{ image: number | string; alt?: string }> = [];
	for (const picture of pictures) {
		const own = kept.get(picture.ref);
		if (own) {
			const alt = picture.alt?.trim() || own.alt?.trim();
			rows.push({ image: numeric(own.mediaId), ...(alt ? { alt } : {}) });
			continue;
		}
		const media = await ingestPicture(cms, { ref: picture.ref, url: picture.url || undefined }, picture.alt?.trim() || fallbackName, loadAttachment, actor.tenantId);
		const alt = picture.alt?.trim();
		rows.push({ image: media.id, ...(alt ? { alt } : {}) });
	}
	return rows;
}

function guardImages(next: Array<{ image: number | string }>, doc: ProductDoc) {
	const previous = (doc.images ?? []).map((row) => mediaOf(row)?.id).filter((id): id is number | string => id !== undefined);
	if (!allowsProductImages(next.map((row) => row.image), previous)) {
		throw new ChangeSetApplyError("A product holds 5 photos; this edit would add more.", 422);
	}
}

function productResult(doc: { id: number | string; name: string; updatedAt: string }, undo?: ChangeSetResult["undo"]): ChangeSetResult {
	return { entities: [productEntity(doc.id, doc.name)], links: productLink(doc.id), ...(undo ? { undo } : {}) } as ChangeSetResult;
}

export async function applyShopProductUpdate(raw: unknown, actor: AgentActor, loadAttachment?: AttachmentLoader): Promise<ChangeSetResult> {
	const plan = UpdatePayloadSchema.safeParse(raw);
	if (!plan.success) throw new ChangeSetApplyError("This edit is not valid. Ask the assistant to draft it again.", 422);
	const { id, base, changes } = plan.data;
	const client = await cms();
	await assertProductManagement(client, actor);
	const doc = await currentProduct(client, actor, id);
	assertSameVersion(doc, base);
	if (doc.deletedAt) throw new ChangeSetApplyError("This product is in the trash — restore it first.", 409);
	if (changes.inventory !== undefined && doc.hasVariants) {
		throw new ChangeSetApplyError("This product has options: its stock is the sum of the options' stock. Change it in the product form.", 422);
	}
	// writing a description rebuilds it from markdown: refuse rather than drop the pictures / formatting inside
	const locks = descriptionLocks(doc);
	if (changes.description !== undefined && locks.en) throw new ChangeSetApplyError(locks.en, 422);
	if (changes.descriptionBM !== undefined && locks.bm) throw new ChangeSetApplyError(locks.bm, 422);
	const price = changes.price ?? doc.price ?? 0;
	const compare = changes.compareAtPrice === undefined ? doc.compareAtPrice : changes.compareAtPrice;
	if (compare && compare > 0 && compare <= price && (changes.price !== undefined || changes.compareAtPrice !== undefined)) {
		throw new ChangeSetApplyError("The compare-at price must be higher than the price.", 422);
	}
	if (changes.categoryId !== undefined) await assertShopCategory(client, actor, changes.categoryId);

	// data to write and the pre-image of exactly those fields
	const data: Record<string, unknown> = { name: changes.name ?? doc.name };
	const before: Record<string, unknown> = {};
	const set = (key: string, value: unknown, previous: unknown) => {
		data[key] = value;
		before[key] = previous ?? null;
	};
	if (changes.name !== undefined) before.name = doc.name;
	if (changes.shortDescription !== undefined) set("shortDescription", changes.shortDescription, doc.shortDescription);
	if (changes.description !== undefined) set("description", richText(changes.description), doc.description);
	if (changes.descriptionBM !== undefined) set("descriptionBM", richText(changes.descriptionBM), doc.descriptionBM);
	if (changes.price !== undefined) set("price", changes.price, doc.price);
	if (changes.compareAtPrice !== undefined) set("compareAtPrice", changes.compareAtPrice, doc.compareAtPrice);
	if (changes.sku !== undefined) set("sku", changes.sku, doc.sku);
	if (changes.inventory !== undefined) set("inventory", changes.inventory, doc.inventory);
	if (changes.weight !== undefined) set("weight", changes.weight, doc.weight);
	if (changes.tags !== undefined) set("tags", tagRows(changes.tags), (doc.tags ?? []).map((row) => ({ tag: row.tag ?? "" })));
	if (changes.categoryId !== undefined) {
		set("category", [numeric(changes.categoryId)], (doc.category ?? []).map((entry) => relationId(entry)).filter(Boolean).map((value) => numeric(String(value))));
	}
	if (changes.seo) {
		const next = { title: changes.seo.title ?? doc.seo?.title ?? null, description: changes.seo.description ?? doc.seo?.description ?? null };
		set("seo", next, { title: doc.seo?.title ?? null, description: doc.seo?.description ?? null });
	}
	if (changes.images !== undefined) {
		const rows = await productPictureRows(client, actor, changes.images, changes.name ?? doc.name, loadAttachment, doc);
		guardImages(rows, doc);
		set("images", rows, currentImages(doc));
		before.images = currentImages(doc);
	}
	// a product with options keeps its options: re-passed without row ids (the Payload 3.79 update quirk). Checkout
	// lowers an option's stock without touching updatedAt, so after the photo upload (seconds) they are read again.
	if (doc.hasVariants) {
		const latest = changes.images !== undefined ? await currentProduct(client, actor, id) : doc;
		assertSameVersion(latest, base);
		data.variants = stripRowIds(latest.variants);
		data.variantConfigs = stripRowIds(latest.variantConfigs);
	}

	let saved: { id: number | string; name: string; updatedAt: string };
	try {
		saved = await saveProduct(data, numeric(id), { ...productActor(actor), payload: client, source: "ai", mode: "patch" });
	} catch (error) {
		throw saveFailure(error);
	}
	return productResult(saved, {
		kind: "shop_product.restore",
		payload: { id, expect: saved.updatedAt, fields: before },
		until: undoUntil(),
	});
}

const ACTIVE_STATES = ["draft", "active", "archived"] as const;

export async function applyShopProductStatus(raw: unknown, actor: AgentActor, changeSet: Pick<ChangeSet, "confirmText">): Promise<ChangeSetResult> {
	const plan = StatusPayloadSchema.safeParse(raw);
	if (!plan.success || plan.data.from === plan.data.to) throw new ChangeSetApplyError("This change is not valid. Ask the assistant to draft it again.", 422);
	const { id, base, from, to } = plan.data;
	// archive and trash were drafted with the product name to type; a change set without it was not drafted by us
	if ((to === "archived" || to === "trash") && !changeSet.confirmText) throw new ChangeSetApplyError("This change needs the product name typed to confirm.", 422);
	const client = await cms();
	await assertProductManagement(client, actor);
	const doc = await currentProduct(client, actor, id);
	assertSameVersion(doc, base);
	const now = doc.deletedAt ? "trash" : doc.status;
	if (now !== from) throw staleChange("This product's status changed after the assistant drafted the change. Ask again.");
	if (from === "trash" && to !== "draft") throw new ChangeSetApplyError("A product in the trash is restored to draft first.", 422);

	let update: Record<string, unknown>;
	if (to === "trash") update = { deletedAt: new Date().toISOString() };
	else if (from === "trash") update = { status: "draft", deletedAt: null };
	else update = { status: to };
	let saved: { id: number | string; name: string; updatedAt: string; status?: string; deletedAt?: string | null };
	try {
		saved = await updateProductField(id, update, productActor(actor));
	} catch (error) {
		throw saveFailure(error);
	}
	return productResult(saved, {
		kind: "shop_product.restore",
		payload: {
			id,
			expect: saved.updatedAt,
			expectState: { status: to === "trash" ? doc.status : to, trashed: to === "trash" },
			fields: { status: doc.status, deletedAt: doc.deletedAt ?? null },
		},
		until: undoUntil(),
	});
}

/** Undo of an update or a status change: the pre-image goes back while the product is still as the change left it. */
export async function applyShopProductRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = RestorePayloadSchema.safeParse(raw);
	if (!plan.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
	const { id, expect, expectState, fields } = plan.data;
	const client = await cms();
	await assertProductManagement(client, actor);
	const doc = await currentProduct(client, actor, id);
	const changedSince = "This product was edited after the change, so it can't be undone without overwriting that edit.";
	if (expectState) {
		const state = { status: doc.status, trashed: Boolean(doc.deletedAt) };
		const restore = z
			.object({ status: z.enum(ACTIVE_STATES), deletedAt: z.string().datetime({ offset: true }).nullable() })
			.safeParse(fields);
		if (!restore.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
		// already back where the undo puts it (an undo whose record was lost, a second tab): nothing to write
		if (state.status === restore.data.status && state.trashed === (restore.data.deletedAt !== null)) return productResult(doc as unknown as { id: number | string; name: string; updatedAt: string });
		if (state.status !== expectState.status || state.trashed !== expectState.trashed) throw new ChangeSetApplyError(changedSince, 409);
		try {
			const saved = await updateProductField(id, restore.data, productActor(actor));
			return productResult(saved);
		} catch (error) {
			throw saveFailure(error);
		}
	}
	// already as before the change (an undo whose record was lost, a second tab): nothing to write
	if (!doc.deletedAt && Object.keys(fields).every((key) => (key === "images" || RESTORABLE.has(key)) && samePlan(fieldNow(doc, key), fields[key] ?? null))) {
		return productResult(doc as unknown as { id: number | string; name: string; updatedAt: string });
	}
	if (isoTime(doc.updatedAt) !== isoTime(expect)) throw new ChangeSetApplyError(changedSince, 409);
	if (doc.deletedAt) throw new ChangeSetApplyError("This product is in the trash — restore it first.", 409);
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (key === "images") {
			const rows = z.array(z.object({ mediaId: z.string().regex(/^\d{1,12}$/), alt: z.string().nullable() })).safeParse(value);
			if (!rows.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
			const images = rows.data.map((row) => ({ image: numeric(row.mediaId), ...(row.alt ? { alt: row.alt } : {}) }));
			guardImages(images, doc);
			data.images = images;
		} else if (RESTORABLE.has(key)) data[key] = value;
	}
	if (doc.hasVariants) {
		data.variants = stripRowIds(doc.variants);
		data.variantConfigs = stripRowIds(doc.variantConfigs);
	}
	// written straight back as it was (it was valid then): the form's validation would refuse an empty SKU
	try {
		const saved = (await client.update({
			collection: "products",
			id: numeric(id),
			data,
			user: productActor(actor).user,
			overrideAccess: false,
		})) as unknown as { id: number | string; name: string; updatedAt: string };
		return productResult(saved);
	} catch (error) {
		throw saveFailure(error);
	}
}

/** A field as an update's pre-image holds it (applyShopProductUpdate's `before`), to compare with that pre-image. */
function fieldNow(doc: ProductDoc, key: string): unknown {
	switch (key) {
		case "tags":
			return (doc.tags ?? []).map((row) => ({ tag: row.tag ?? "" }));
		case "category":
			return (doc.category ?? []).map((entry) => relationId(entry)).filter(Boolean).map((value) => numeric(String(value)));
		case "seo":
			return { title: doc.seo?.title ?? null, description: doc.seo?.description ?? null };
		case "images":
			return currentImages(doc);
		default:
			return (doc as unknown as Record<string, unknown>)[key] ?? null;
	}
}

/** The keys an update's pre-image can hold (everything else in a restore payload is ignored). */
const RESTORABLE = new Set(["name", "shortDescription", "description", "descriptionBM", "price", "compareAtPrice", "sku", "inventory", "weight", "tags", "category", "seo"]);

import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import { saveProduct, stripRowIds } from "@/lib/products/save-product";
import type { AgentActor } from "../context";
import type { ProductDoc } from "../agent-tools/store-product-doc";
import { type AttachmentLoader, ChangeSetApplyError } from "./errors";
import { samePlan } from "./same-plan";
import { currentImages, guardImages, productPictureRows } from "./store-product";
import { assertProductManagement, assertSameVersion, currentProduct, productActor, productEntity, saveFailure, undoUntil } from "./store-product-shared";

/**
 * `shop_product.bulk.update` — price, stock, photos and on sale / draft for up to 20 of the shop's products in
 * one approved card, and `shop_product.restore_many`, its single Undo.
 *
 * Checked first, written after: every product is read with the approver's access (inside the workspace) and
 * its version compared with the draft's `base` BEFORE anything is written, so a product edited since refuses the
 * whole card and nothing is half done. Every NEW photo is downloaded into the shop's media after that check and
 * BEFORE the first product is written (the slow part of the job), so a slow or failing download can neither leave
 * products half written nor run the request out of time between two writes: what is left is quick database updates.
 * (The Undo record is part of the result returned at the end; there is no per-product hook before that, so this
 * ordering, plus the tool's cap on products with new photos per card, is what keeps a cut-short request harmless.)
 * A write that fails midway closes the card as applied with the products
 * already done (their Undo is kept) and says which one failed. Undo is guarded by the values the change wrote:
 * a product edited after it is never overwritten, and then none is restored.
 */

const ProductIdSchema = z.string().regex(/^[1-9]\d{0,11}$/);
const ImageSchema = z.object({
	ref: z.string().min(1).max(160),
	url: z.string().max(2000).optional().default(""),
	alt: z.string().max(300).nullable().optional(),
	existing: z.boolean().optional(),
});

const BulkPayloadSchema = z.object({
	items: z
		.array(
			z.object({
				id: ProductIdSchema,
				base: z.string().min(1).max(60),
				name: z.string().max(200).optional(),
				changes: z
					.object({
						price: z.number().min(0).max(100_000_000),
						inventory: z.number().int().min(0).max(1_000_000),
						images: z.array(ImageSchema).max(12),
						status: z.enum(["active", "draft"]),
					})
					.partial()
					.strict(),
			}),
		)
		.min(1)
		.max(20),
});

/** What one product looked like before (to put back) and what the change left in the fields it touched (the Undo guard). */
const RestoreItemSchema = z.object({
	id: ProductIdSchema,
	name: z.string().max(200),
	before: z.object({
		price: z.number(),
		inventory: z.number(),
		images: z.array(z.object({ mediaId: z.string().regex(/^\d{1,12}$/), alt: z.string().nullable() })),
		status: z.enum(["draft", "active", "archived"]),
		aiReviewPending: z.boolean(),
	}).partial().strict(),
	after: z.object({ price: z.number(), inventory: z.number(), images: z.array(z.string().regex(/^\d{1,12}$/)), status: z.enum(["draft", "active", "archived"]) }).partial().strict(),
});
type RestoreItem = z.infer<typeof RestoreItemSchema>;
const RestorePayloadSchema = z.object({ items: z.array(RestoreItemSchema).min(1).max(20) });

const numeric = (id: string) => (/^\d+$/.test(id) ? Number(id) : id);
const quoted = (name: string | undefined, id: string) => `"${name?.trim() || `product ${id}`}"`;
const mediaIds = (doc: ProductDoc) => currentImages(doc).map((row) => row.mediaId);

async function cms(): Promise<Payload> {
	return getPayload({ config });
}

/** The same refusal, said for one product of the batch. */
function aboutProduct(error: unknown, name: string): ChangeSetApplyError {
	const failure = saveFailure(error);
	return new ChangeSetApplyError(`${name}: ${failure.message}`, failure.status, failure.final, { stale: failure.stale });
}

const bulkResult = (done: ReadonlyArray<{ id: string; name: string; before: RestoreItem["before"]; after: RestoreItem["after"] }>): ChangeSetResult =>
	({
		entities: done.map((item) => productEntity(item.id, item.name)),
		links: [{ label: done.length === 1 ? "Open product" : "Open products", href: done.length === 1 ? `/products/${encodeURIComponent(done[0]?.id ?? "")}` : "/products" }],
		undo: { kind: "shop_product.restore_many", payload: { items: done }, until: undoUntil() },
	}) as ChangeSetResult;

export async function applyShopProductsBulk(raw: unknown, actor: AgentActor, loadAttachment?: AttachmentLoader): Promise<ChangeSetResult> {
	const plan = BulkPayloadSchema.safeParse(raw);
	const ids = plan.success ? plan.data.items.map((item) => item.id) : [];
	if (!plan.success || new Set(ids).size !== ids.length) throw new ChangeSetApplyError("This change is not valid. Ask the assistant to draft it again.", 422);
	const client = await cms();
	await assertProductManagement(client, actor);

	// 1. check every product before writing any
	const docs: ProductDoc[] = [];
	for (const item of plan.data.items) {
		const doc = await currentProduct(client, actor, item.id).catch((error: unknown) => {
			throw aboutProduct(error, quoted(item.name, item.id));
		});
		const name = quoted(doc.name, item.id);
		try {
			assertSameVersion(doc, item.base);
		} catch (error) {
			throw aboutProduct(error, name);
		}
		if (doc.deletedAt) throw new ChangeSetApplyError(`${name}: it is in the trash — restore it first.`, 409);
		if (doc.hasVariants && (item.changes.price !== undefined || item.changes.inventory !== undefined)) {
			throw new ChangeSetApplyError(`${name}: it has options, so its prices and stock are set in the product form.`, 422);
		}
		const compare = doc.compareAtPrice;
		if (item.changes.price !== undefined && compare && compare > 0 && compare <= item.changes.price) {
			throw new ChangeSetApplyError(`${name}: the price must stay below the compare-at price.`, 422);
		}
		docs.push(doc);
	}

	// 2. bring in every new photo before any product is written (a failure here changes nothing)
	const pictureRows: Array<Awaited<ReturnType<typeof productPictureRows>> | undefined> = [];
	for (const [index, item] of plan.data.items.entries()) {
		const doc = docs[index] as ProductDoc;
		if (item.changes.images === undefined) {
			pictureRows.push(undefined);
			continue;
		}
		try {
			const rows = await productPictureRows(client, actor, item.changes.images, doc.name, loadAttachment, doc);
			guardImages(rows, doc);
			pictureRows.push(rows);
		} catch (error) {
			throw aboutProduct(error, quoted(doc.name, item.id));
		}
	}

	// 3. write one by one (database updates only); what is done keeps its Undo whatever happens next
	const done: Array<{ id: string; name: string; before: RestoreItem["before"]; after: RestoreItem["after"] }> = [];
	for (const [index, item] of plan.data.items.entries()) {
		const doc = docs[index] as ProductDoc;
		const { changes } = item;
		const data: Record<string, unknown> = { name: doc.name };
		const before: RestoreItem["before"] = {};
		const after: RestoreItem["after"] = {};
		try {
			if (changes.price !== undefined) {
				data.price = changes.price;
				before.price = doc.price ?? 0;
				after.price = changes.price;
			}
			if (changes.inventory !== undefined) {
				data.inventory = changes.inventory;
				before.inventory = doc.inventory ?? 0;
				after.inventory = changes.inventory;
			}
			const rows = pictureRows[index];
			if (changes.images !== undefined && rows) {
				data.images = rows;
				before.images = currentImages(doc);
				after.images = rows.map((row) => String(row.image));
			}
			if (changes.status !== undefined && changes.status !== doc.status) {
				data.status = changes.status;
				before.status = doc.status;
				after.status = changes.status;
				// going on sale means it has been looked at: the AI-review flag clears (same as the status switch)
				if (changes.status === "active" && doc.aiReviewPending) {
					data.aiReviewPending = false;
					before.aiReviewPending = true;
				}
			}
			// a product with options keeps its options: re-passed without row ids (the Payload 3.79 update quirk)
			if (doc.hasVariants) {
				data.variants = stripRowIds(doc.variants);
				data.variantConfigs = stripRowIds(doc.variantConfigs);
			}
			await saveProduct(data, numeric(item.id), { ...productActor(actor), payload: client, source: "ai", mode: "patch" });
			done.push({ id: item.id, name: doc.name, before, after });
		} catch (error) {
			const failure = aboutProduct(error, quoted(doc.name, item.id));
			if (done.length === 0) throw failure;
			const names = done.map((d) => `"${d.name}"`).join(", ");
			throw new ChangeSetApplyError(
				`${failure.message} Done before it: ${names}. The rest were not changed: ask again for them.`,
				failure.status,
				true,
				{ partial: bulkResult(done) },
			);
		}
	}
	return bulkResult(done);
}

/** A field as it is stored now, in the shape the Undo record holds it (photos by media id; their alt text is not compared). */
function stateNow(doc: ProductDoc, key: "price" | "inventory" | "images" | "status"): unknown {
	switch (key) {
		case "price":
			return doc.price ?? 0;
		case "inventory":
			return doc.inventory ?? 0;
		case "images":
			return mediaIds(doc);
		default:
			return doc.status;
	}
}

const FIELDS = ["price", "inventory", "images", "status"] as const;

/** Undo of a batch: every product goes back, but only while none was edited in the fields the change touched. */
export async function applyShopProductsRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = RestorePayloadSchema.safeParse(raw);
	if (!plan.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
	const client = await cms();
	await assertProductManagement(client, actor);

	const pending: Array<{ item: RestoreItem; doc: ProductDoc }> = [];
	const changedSince: string[] = [];
	for (const item of plan.data.items) {
		const doc = await currentProduct(client, actor, item.id).catch(() => null);
		if (!doc || doc.deletedAt) {
			changedSince.push(quoted(item.name, item.id));
			continue;
		}
		const wanted = (key: (typeof FIELDS)[number]) => (key === "images" ? item.before.images?.map((row) => row.mediaId) : item.before[key]);
		const wrote = (key: (typeof FIELDS)[number]) => item.after[key];
		// already back where the undo puts it (an undo that stopped midway, a second tab): nothing to write
		if (FIELDS.filter((key) => item.before[key] !== undefined).every((key) => samePlan(stateNow(doc, key), wanted(key)))) continue;
		// edited after the change in a field it touched: that edit must not be overwritten
		if (FIELDS.filter((key) => item.after[key] !== undefined).some((key) => !samePlan(stateNow(doc, key), wrote(key)))) {
			changedSince.push(quoted(doc.name, item.id));
			continue;
		}
		pending.push({ item, doc });
	}
	if (changedSince.length > 0) {
		throw new ChangeSetApplyError(`${changedSince.join(", ")} ${changedSince.length === 1 ? "was" : "were"} edited after the change, so it can't be undone without overwriting that edit.`, 409);
	}

	const restored: Array<{ id: string; name: string }> = [];
	for (const { item, doc } of pending) {
		const data: Record<string, unknown> = {};
		if (item.before.price !== undefined) data.price = item.before.price;
		if (item.before.inventory !== undefined) data.inventory = item.before.inventory;
		if (item.before.status !== undefined) data.status = item.before.status;
		if (item.before.aiReviewPending !== undefined) data.aiReviewPending = item.before.aiReviewPending;
		try {
			if (item.before.images !== undefined) {
				const rows = item.before.images.map((row) => ({ image: numeric(row.mediaId), ...(row.alt ? { alt: row.alt } : {}) }));
				guardImages(rows, doc);
				data.images = rows;
			}
			if (doc.hasVariants) {
				data.variants = stripRowIds(doc.variants);
				data.variantConfigs = stripRowIds(doc.variantConfigs);
			}
			// written straight back as it was (it was valid then): the form's validation would refuse an empty SKU
			await client.update({ collection: "products", id: numeric(item.id), data, user: productActor(actor).user, overrideAccess: false });
			restored.push({ id: item.id, name: doc.name });
		} catch (error) {
			const failure = aboutProduct(error, quoted(doc.name, item.id));
			// products already put back stay back; Undo can be tried again for the rest
			throw new ChangeSetApplyError(
				restored.length > 0 ? `${failure.message} Already put back: ${restored.map((r) => `"${r.name}"`).join(", ")}. Try Undo again for the rest.` : failure.message,
				failure.status,
			);
		}
	}
	return {
		entities: plan.data.items.map((item) => productEntity(item.id, item.name)),
		links: [{ label: "Open products", href: "/products" }],
	} as ChangeSetResult;
}

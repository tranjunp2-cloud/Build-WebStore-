import "server-only";

import { createHash } from "node:crypto";
import type { ChangeSet, ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";
import slugify from "slugify";
import { z } from "zod";
import { allowsProductImages } from "@/lib/products/image-limit";
import { BASE_SKU_MAX, BASE_SKU_TOO_LONG_MESSAGE } from "@/lib/products/sku-limits";
import { markdownToLexical } from "@/lib/products/product-rich-text";
import { saveProduct } from "@/lib/products/save-product";
import type { AgentActor } from "../context";
import { shopCurrencyOr, tenantFilter } from "../agent-tools/store-product-doc";
import { type AttachmentLoader, ChangeSetApplyError } from "./errors";
import { productPictureRows } from "./store-product";
import {
	assertProductManagement,
	currentProduct,
	isoTime,
	productActor,
	productEntity,
	productLink,
	saveFailure,
	undoUntil,
} from "./store-product-shared";

/**
 * New draft products from the copilot (`shop_product.create_drafts`) and the undo that puts them in the trash.
 * Every product is created as a draft with `aiReviewPending`, so nothing is on sale until the merchant opens
 * it. A retry of the same approval never duplicates a product: the slug carries a key derived from the change
 * set id and the product's place in it (the `-ai-<32 hex>` pattern the collection keeps exact).
 */

const MAX_DRAFTS = 20;
const NAME_MAX = 120;

const DraftSchema = z.object({
	name: z.string().min(3),
	shortDescription: z.string().max(500).nullable(),
	description: z.string().max(6000).nullable(),
	descriptionBM: z.string().max(6000).nullable(),
	price: z.number().min(0).max(100_000_000).nullable(),
	/** the shop's currency (search_items `shop.currency`); an unknown value falls back to MYR, never an error */
	currency: z.unknown().optional(),
	sku: z.string().trim().min(1).max(BASE_SKU_MAX, BASE_SKU_TOO_LONG_MESSAGE).nullable(),
	inventory: z.number().int().min(0).max(1_000_000).nullable(),
	weight: z.number().min(0).max(1000).nullable(),
	tags: z.array(z.string().min(1).max(50)).max(20),
	categoryId: z.string().regex(/^[1-9]\d{0,11}$/).nullable(),
	seo: z.object({ title: z.string().max(60).nullable(), description: z.string().max(160).nullable() }),
	images: z.array(z.object({ ref: z.string().min(1).max(160), url: z.string().max(2000).optional().default(""), alt: z.string().max(300).nullable().optional() })).max(5),
});

const DraftsPayloadSchema = z.object({
	version: z.literal(1),
	status: z.literal("draft"),
	aiReviewPending: z.literal(true),
	products: z.array(DraftSchema).min(1).max(MAX_DRAFTS),
});

const TrashCreatedSchema = z.object({
	ids: z.array(z.string().regex(/^[1-9]\d{0,11}$/)).min(1).max(MAX_DRAFTS),
	/** product id -> its `updatedAt` when the draft was created */
	expect: z.record(z.string(), z.string().min(1).max(40)),
});

const numeric = (id: string) => (/^\d+$/.test(id) ? Number(id) : id);
const richText = (markdown: string | null) => (markdown?.trim() ? markdownToLexical(markdown) : undefined);

/** `<name>-ai-<32 hex>`: stable for one place of one change set, so a retry finds the product it already made. */
export function draftSlug(name: string, changeSetId: string, index: number): string {
	const key = createHash("sha256").update(`${changeSetId}:${index}`).digest("hex").slice(0, 32);
	const base = slugify(name, { lower: true, strict: true }).slice(0, 80) || "product";
	return `${base}-ai-${key}`;
}

export async function applyShopProductDrafts(
	raw: unknown,
	actor: AgentActor,
	changeSet: Pick<ChangeSet, "id">,
	loadAttachment?: AttachmentLoader,
): Promise<ChangeSetResult> {
	const plan = DraftsPayloadSchema.safeParse(raw);
	if (!plan.success) {
		const skuTooLong = plan.error.issues.some((issue) => issue.message === BASE_SKU_TOO_LONG_MESSAGE);
		throw new ChangeSetApplyError(skuTooLong ? BASE_SKU_TOO_LONG_MESSAGE : "These drafts are not valid. Ask the assistant to draft them again.", 422);
	}
	const client: Payload = await getPayload({ config });
	await assertProductManagement(client, actor);

	// everything that can be refused is checked before the first product is created
	const { products } = plan.data;
	products.forEach((product) => {
		if (product.name.trim().length > NAME_MAX) throw new ChangeSetApplyError(`"${product.name.slice(0, 40)}…": the name can have ${NAME_MAX} characters at most.`, 422);
	});
	const categoryIds = [...new Set(products.flatMap((product) => (product.categoryId ? [product.categoryId] : [])))];
	if (categoryIds.length > 0) {
		const found = await client.find({
			collection: "categories",
			where: { and: [{ id: { in: categoryIds.map(numeric) } }, { deletedAt: { exists: false } }, tenantFilter(actor)] },
			limit: categoryIds.length,
			depth: 0,
			pagination: false,
			overrideAccess: true,
		});
		const valid = new Set(found.docs.map((doc) => String((doc as { id: number | string }).id)));
		const bad = products.find((product) => product.categoryId && !valid.has(product.categoryId));
		if (bad) throw new ChangeSetApplyError(`"${bad.name}": the category is not one of this shop's categories.`, 422);
	}

	const created: Array<{ id: string; name: string; updatedAt: string }> = [];
	for (const [index, product] of products.entries()) {
		const slug = draftSlug(product.name, changeSet.id, index);
		// a product made by an earlier try of this same approval is reused, not made again
		const existing = await client.find({
			collection: "products",
			where: { and: [{ slug: { equals: slug } }, { deletedAt: { exists: false } }, tenantFilter(actor)] },
			limit: 1,
			depth: 0,
			pagination: false,
			overrideAccess: true,
		});
		const replay = existing.docs[0] as { id: number | string; name: string; updatedAt: string } | undefined;
		if (replay) {
			created.push({ id: String(replay.id), name: replay.name, updatedAt: replay.updatedAt });
			continue;
		}
		try {
			const rows = product.images.length > 0 ? await productPictureRows(client, actor, product.images, product.name, loadAttachment, null) : [];
			if (!allowsProductImages(rows.map((row) => row.image))) throw new ChangeSetApplyError(`"${product.name}": a product holds 5 photos.`, 422);
			const saved = await saveProduct(
				{
					name: product.name.trim(),
					slug,
					status: "draft",
					aiReviewPending: true,
					price: product.price ?? 0,
					currency: shopCurrencyOr(product.currency),
					inventory: product.inventory ?? 0,
					weight: product.weight ?? 0,
					...(product.sku ? { sku: product.sku.trim() } : {}),
					...(product.shortDescription ? { shortDescription: product.shortDescription.trim() } : {}),
					...(product.description ? { description: richText(product.description) } : {}),
					...(product.descriptionBM ? { descriptionBM: richText(product.descriptionBM) } : {}),
					...(product.tags.length > 0 ? { tags: product.tags.map((tag) => ({ tag })) } : {}),
					...(product.categoryId ? { category: [numeric(product.categoryId)] } : {}),
					...(product.seo.title || product.seo.description ? { seo: { title: product.seo.title ?? undefined, description: product.seo.description ?? undefined } } : {}),
					...(rows.length > 0 ? { images: rows } : {}),
				},
				undefined,
				{ ...productActor(actor), payload: client, source: "ai" },
			);
			created.push({ id: String(saved.id), name: saved.name, updatedAt: saved.updatedAt });
		} catch (error) {
			const failure = saveFailure(error);
			if (created.length === 0) throw new ChangeSetApplyError(`"${product.name}": ${failure.message}`, failure.status);
			// the ones before it exist: the card closes as applied with them (their Undo trashes them), and says which
			const names = created.map((done) => `"${done.name}"`).join(", ");
			throw new ChangeSetApplyError(
				`"${product.name}": ${failure.message} Created before it: ${names}. The rest were not created: ask again for them.`,
				failure.status,
				true,
				{ partial: draftsResult(created) },
			);
		}
	}
	return draftsResult(created);
}

/** The drafts made, with their undo (to the trash while none of them was touched since). */
function draftsResult(created: ReadonlyArray<{ id: string; name: string; updatedAt: string }>): ChangeSetResult {
	return {
		entities: created.map((product) => productEntity(product.id, product.name)),
		links: productLink(created[0]?.id ?? ""),
		undo: {
			kind: "shop_product.trash_created",
			payload: { ids: created.map((product) => product.id), expect: Object.fromEntries(created.map((product) => [product.id, product.updatedAt])) },
			until: undoUntil(),
		},
	} as ChangeSetResult;
}

/** Undo of a draft batch: the products go to the trash, but only while none of them was touched since. */
export async function applyShopProductTrashCreated(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = TrashCreatedSchema.safeParse(raw);
	if (!plan.success) throw new ChangeSetApplyError("This change can't be undone here.", 422);
	const client: Payload = await getPayload({ config });
	await assertProductManagement(client, actor);
	const { ids, expect } = plan.data;
	const docs = [];
	for (const id of ids) {
		const doc = await currentProduct(client, actor, id).catch(() => null);
		// a draft already in the trash (or gone) needs nothing
		if (!doc || doc.deletedAt) continue;
		if (isoTime(doc.updatedAt) !== isoTime(expect[id])) {
			throw new ChangeSetApplyError(`"${doc.name}" was edited after it was created, so the drafts can't be undone together. Move it to the trash yourself.`, 409);
		}
		docs.push(doc);
	}
	const deletedAt = new Date().toISOString();
	for (const doc of docs) {
		try {
			await client.update({ collection: "products", id: doc.id, data: { deletedAt }, user: productActor(actor).user, overrideAccess: false });
		} catch (error) {
			throw saveFailure(error);
		}
	}
	return { entities: docs.map((doc) => productEntity(doc.id, doc.name)), links: [{ label: "Open products", href: "/products" }] } as ChangeSetResult;
}

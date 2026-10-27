import { tool } from "ai";
import { buildShopProductDraftsChangeSet } from "./shop-product-drafts";
import { buildShopProductStatusChangeSet, buildShopProductUpdateChangeSet } from "./shop-product-changes";
import type { MerchantToolDeps } from "./merchant-tools";
import {
	type ShopProductDraftsInput,
	ShopProductDraftsInputSchema,
	type ShopProductStatusInput,
	ShopProductStatusInputSchema,
	type ShopProductUpdateInput,
	ShopProductUpdateInputSchema,
} from "./shop-product-schemas";
import { LIMIT, STAGED_NOTE } from "./tool-notes";

const sameName = (a: string, b: string) => a.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase() === b.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** A new draft named like a product an earlier draft of this chat already became: edit that one instead. */
function alreadyCreated(deps: MerchantToolDeps, name: string) {
	const made = deps.createdInChat().find((record) => record.kind === "product" && record.label !== undefined && sameName(record.label, name));
	if (!made) return undefined;
	return {
		error: {
			code: "already_created",
			message: `The product “${made.label}” was already created from this chat (id ${made.id}). Change it with propose_shop_product_update with id ${JSON.stringify(made.id)} — e.g. new photos — instead of drafting it again.`,
		},
	};
}

/** The shop's category names by id, so the draft card shows "Skincare", not "10" (only when a draft names a category). */
async function categoryNames(deps: MerchantToolDeps, input: ShopProductDraftsInput): Promise<Record<string, string>> {
	if (!input.products.some((product) => product.categoryId)) return {};
	try {
		const list = (await deps.searchItems({ kind: "product", query: null, status: "any", limit: 1 })) as { categories?: Array<{ id: string; name: string }> };
		return Object.fromEntries((list.categories ?? []).map((category) => [String(category.id), category.name]));
	} catch {
		return {};
	}
}

/**
 * The copilot's tools for Payload products (capability `shop_products`). Reads reuse `read_item` /
 * `search_items` with kind "product": prime-web's facade answers them from its own `products`
 * collection in this deployment. An edit is drafted here from `content.snapshot` (current values
 * plus the version to guard against) and applied by prime-web as `shop_product.*` after approval.
 */
export function buildShopProductTools(deps: MerchantToolDeps) {
	return {
		propose_shop_product_update: tool({
			description:
				"Stage changes to ONE existing product for the merchant to approve — anything they edit by hand in the product form: name, short description, description (and the Bahasa Melayu one), price, compare-at price, SKU, stock, weight, tags, category, SEO title and description, and photos (add, take off, reorder, main photo, alt text). Only what changes; null for the rest. The platform reads the product again and shows before → after. Options (sizes, colours) are edited in the product form, not here.",
			inputSchema: ShopProductUpdateInputSchema,
			execute: async (input: ShopProductUpdateInput) => {
				if (!deps.allowEdit()) return LIMIT;
				const state = await deps.snapshot({ kind: "product", id: input.id });
				if ("error" in state) return state;
				const built = buildShopProductUpdateChangeSet(input, state, { id: deps.newChangeSetId(), runId: deps.runId, now: deps.now() }, deps.images());
				if ("error" in built) return { error: { code: built.code ?? "no_change", message: built.error } };
				await deps.stage(built);
				const skipped = built.guardrails.filter((g) => !g.ok).map((g) => g.detail);
				return { changeSetId: built.id, fields: built.diffs.length, note: STAGED_NOTE, ...(skipped.length > 0 ? { skipped } : {}) };
			},
		}),
		propose_shop_product_status: tool({
			description:
				"Stage a status change of ONE product: activate (on sale in the store; needs price, SKU, stock and weight), move to draft, archive, or move to the trash (a product in the trash or archived comes back as a draft). Nothing is deleted for good; archive and trash ask the merchant Yes / No before they apply.",
			inputSchema: ShopProductStatusInputSchema,
			execute: async (input: ShopProductStatusInput) => {
				if (!deps.allowEdit()) return LIMIT;
				const state = await deps.snapshot({ kind: "product", id: input.id });
				if ("error" in state) return state;
				const built = buildShopProductStatusChangeSet(input, state, { id: deps.newChangeSetId(), runId: deps.runId, now: deps.now() });
				if ("error" in built) return { error: { code: built.code ?? "not_allowed", message: built.error } };
				await deps.stage(built);
				return { changeSetId: built.id, note: built.confirmText ? `${STAGED_NOTE} Approving asks the merchant Yes / No first.` : STAGED_NOTE };
			},
		}),
		propose_shop_product_drafts: tool({
			description:
				"Stage 1 to 20 NEW draft products for the merchant to approve, from what they wrote or showed in photos: name, descriptions, price (only if stated), SKU, stock, weight, tags, category, SEO and the attached or found photos. They are created as drafts for the merchant to review; nothing goes on sale.",
			inputSchema: ShopProductDraftsInputSchema,
			execute: async (input: ShopProductDraftsInput) => {
				for (const product of input.products) {
					const again = alreadyCreated(deps, product.name);
					if (again) return again;
				}
				const built = buildShopProductDraftsChangeSet(input, { id: deps.newChangeSetId(), runId: deps.runId, now: deps.now() }, await deps.productKnowledge(), await categoryNames(deps, input));
				await deps.stage(built);
				const skipped = built.guardrails.filter((g) => !g.ok).map((g) => g.detail);
				return { changeSetId: built.id, products: input.products.length, note: STAGED_NOTE, ...(skipped.length > 0 ? { skipped } : {}) };
			},
		}),
	};
}

export type ShopProductTools = ReturnType<typeof buildShopProductTools>;

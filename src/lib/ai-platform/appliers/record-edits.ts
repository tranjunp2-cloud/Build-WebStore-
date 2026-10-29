import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import type { AgentActor } from "../context";
import { applyBlogTrashCreated } from "./blog-draft";
import { applyBlogRestoreFields, applyBlogStatus } from "./blog-edits";
import { ChangeSetApplyError } from "./errors";
import { applyShopProductRestore } from "./store-product";
import { applyShopProductsRestore } from "./store-product-setup";
import { applyStoreCategoriesRestore } from "./store-categories";
import { applyStoreDiscountsRestore } from "./store-discounts";
import { applyStoreCustomersRestore } from "./store-customers";
import { applyStoreOrdersRestore } from "./store-orders";
import { applyShopProductTrashCreated } from "./store-product-drafts";
import { applySiteLocaleRestore, applySitePageRestore, applySiteSeoRestore, applySiteThemeRestore } from "./site-edits";
import { applySiteNavRestore, applySitePageRemove, applySitePagesRestore } from "./site-structure";

/**
 * Undo of an applied change, from the pre-image it saved. Each restore keeps the version guard of the change
 * itself: the record must still be exactly as the change left it, so a later edit is never overwritten.
 *
 * Covers the web builder (`site.*`) and blog posts (`blog.*`, in blog-edits.ts). Store-product restores join
 * this switch with their applier (phase 6); an undo of any other kind fails closed.
 */
export async function applyUndo(
	undo: { kind: string; payload: Record<string, unknown>; until: string },
	actor: AgentActor,
	_changeSetId: string,
): Promise<ChangeSetResult> {
	if (new Date(undo.until).getTime() < Date.now()) throw new ChangeSetApplyError("Undo is no longer available for this change.", 409);
	switch (undo.kind) {
		case "blog.restore_fields":
			return applyBlogRestoreFields(undo.payload, actor);
		case "blog.set_status":
			return applyBlogStatus(undo.payload, actor, { undo: true });
		case "blog.trash_created":
			return applyBlogTrashCreated(undo.payload, actor);
		case "shop_product.restore":
			return applyShopProductRestore(undo.payload, actor);
		case "shop_product.restore_many":
			return applyShopProductsRestore(undo.payload, actor);
		case "shop_product.trash_created":
			return applyShopProductTrashCreated(undo.payload, actor);
		case "site.page_restore":
			return applySitePageRestore(undo.payload, actor);
		case "site.seo_restore":
			return applySiteSeoRestore(undo.payload, actor);
		case "site.locale_restore":
			return applySiteLocaleRestore(undo.payload, actor);
		case "site.theme_restore":
			return applySiteThemeRestore(undo.payload, actor);
		case "site.pages_restore":
			return applySitePagesRestore(undo.payload, actor);
		case "site.page_remove":
			return applySitePageRemove(undo.payload, actor);
		case "site.nav_restore":
			return applySiteNavRestore(undo.payload, actor);
		case "store.categories_restore":
			return applyStoreCategoriesRestore(undo.payload, actor);
		case "store.discounts_restore":
			return applyStoreDiscountsRestore(undo.payload, actor);
		case "store.orders_restore":
			return applyStoreOrdersRestore(undo.payload, actor);
		case "store.customers_restore":
			return applyStoreCustomersRestore(undo.payload, actor);
		default:
			throw new ChangeSetApplyError("This change can't be undone here.", 422);
	}
}

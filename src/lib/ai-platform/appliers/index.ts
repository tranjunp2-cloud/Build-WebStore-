import "server-only";

import type { ChangeSet, ChangeSetResult } from "@ech/agent-core";
import type { AgentActor } from "../context";
import { applyBlogDraft } from "./blog-draft";
import { applyBlogStatus, applyBlogUpdate } from "./blog-edits";
import type { AttachmentLoader } from "./errors";
import { applyShopProductStatus, applyShopProductUpdate } from "./store-product";
import { applyStoreCategoriesPatch } from "./store-categories";
import { applyStoreDiscountsPatch } from "./store-discounts";
import { applyStoreCustomersPatch } from "./store-customers";
import { applyStoreOrdersPatch } from "./store-orders";
import { applyShopProductDrafts } from "./store-product-drafts";
import { applySitePagePatch, applySiteSeoPatch, applySiteThemePatch, applySiteTranslatePage } from "./site-edits";
import { applySiteLanguagesPatch, applySiteNavPatch, applySitePageCreate, applySitePagesPatch, applySitePublish } from "./site-structure";

export class UnsupportedChangeSetError extends Error {}

/**
 * prime-web is the domain owner for these actions: it applies an approved
 * change set with the approving user's permissions. Unknown kinds fail closed.
 *
 * Applies the web builder (`site.*`) and blog posts (`blog.*`). Store products arrive with their applier in
 * phase 6; until then that kind is refused like any unknown kind.
 */
export async function applyChangeSet(
	changeSet: ChangeSet,
	actor: AgentActor,
	loadAttachment?: AttachmentLoader,
): Promise<ChangeSetResult> {
	const action = changeSet.action;
	switch (action?.kind) {
		case "blog.create_draft":
			return applyBlogDraft(action.payload, actor, loadAttachment, changeSet);
		case "blog.update":
			return applyBlogUpdate(action.payload, actor, loadAttachment);
		case "blog.set_status":
			return applyBlogStatus(action.payload, actor);
		case "shop_product.update":
			return applyShopProductUpdate(action.payload, actor, loadAttachment);
		case "shop_product.set_status":
			return applyShopProductStatus(action.payload, actor, changeSet);
		case "shop_product.create_drafts":
			return applyShopProductDrafts(action.payload, actor, changeSet, loadAttachment);
		case "site.page_patch":
			return applySitePagePatch(action.payload, actor, loadAttachment);
		case "site.seo_patch":
			return applySiteSeoPatch(action.payload, actor);
		case "site.translate_page":
			return applySiteTranslatePage(action.payload, actor);
		case "site.theme_patch":
			return applySiteThemePatch(action.payload, actor);
		case "site.pages_patch":
			return applySitePagesPatch(action.payload, actor, loadAttachment);
		case "site.page_create":
			return applySitePageCreate(action.payload, actor);
		case "site.nav_patch":
			return applySiteNavPatch(action.payload, actor);
		case "site.languages_patch":
			return applySiteLanguagesPatch(action.payload, actor);
		case "store.categories_patch":
			return applyStoreCategoriesPatch(action.payload, actor);
		case "store.discounts_patch":
			return applyStoreDiscountsPatch(action.payload, actor);
		case "store.orders_patch":
			return applyStoreOrdersPatch(action.payload, actor, changeSet);
		case "store.customers_patch":
			return applyStoreCustomersPatch(action.payload, actor);
		case "site.publish":
			return applySitePublish(action.payload, actor);
		default:
			throw new UnsupportedChangeSetError(`This kind of change (${action?.kind ?? "none"}) can't be applied here.`);
	}
}

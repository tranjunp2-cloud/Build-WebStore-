import type { ChangeSet, FieldDiff } from "@ech/agent-core";
import {
	base,
	type BuildContext,
	type KnownImage,
	preview,
	type RecordState,
	STATUS_LABEL,
	UNDO_GUARD,
	VERSION_GUARD,
} from "./change-set-builders";
import {
	SHOP_PRODUCT_MAX_IMAGES,
	type ShopProductSnapshot,
	type ShopProductStatusInput,
	type ShopProductUpdateInput,
} from "./shop-product-schemas";

/**
 * Change sets for Payload products (capability `shop_products`): `shop_product.update`,
 * `shop_product.set_status` and (see shop-product-drafts.ts) `shop_product.create_drafts`.
 * Built from prime-web's snapshot of the product; the change set carries the snapshot's
 * `version` (updatedAt) so prime-web refuses to apply it over a newer edit.
 */

export interface ShopBuildError {
	error: string;
	/** tool error code; the default is the tool's own ("no_change", "not_allowed") */
	code?: "not_ready" | "too_many_new_photos";
}

/** A photo as the applier receives it: `existing` ones are already on the product (keep, reorder). */
export interface ShopImagePayload {
	ref: string;
	url: string;
	alt: string | null;
	existing: boolean;
}

const SYMBOL: Record<string, string> = { MYR: "RM", USD: "US$", SGD: "S$" };

/** "RM 49.90" — the three currencies the collection offers; anything else shows its code. */
export function shopMoney(amount: number, currency: string): string {
	const text = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return `${SYMBOL[currency] ?? currency} ${text}`;
}

const squash = (value: string | null | undefined) => (value ?? "").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

/**
 * Photos named by the model → what the applier gets. Chat pictures win over a photo of the product with the
 * same ref. Alt text is the model's or the product's own, never the picture's file name.
 */
export function resolveShopImages(
	requested: ReadonlyArray<{ id: string; alt: string | null }>,
	known: readonly KnownImage[],
	current: ShopProductSnapshot["images"] = [],
): { images: ShopImagePayload[]; notes: string[] } {
	const notes: string[] = [];
	const images: ShopImagePayload[] = [];
	const seen = new Set<string>();
	for (const request of requested) {
		const chat = known.find((image) => image.id === request.id);
		const own = chat ? current.find((photo) => photo.ref === chat.ref) : current.find((photo) => photo.ref === request.id);
		const resolved: ShopImagePayload | undefined = chat
			? { ref: chat.ref, url: chat.url, alt: request.alt ?? own?.alt ?? null, existing: own !== undefined }
			: own
				? { ref: own.ref, url: own.url, alt: request.alt ?? own.alt, existing: true }
				: undefined;
		if (!resolved) {
			notes.push(`Skipped photo ${request.id}: not a picture of this chat or of the product.`);
			continue;
		}
		if (seen.has(resolved.ref)) continue;
		seen.add(resolved.ref);
		images.push(resolved);
	}
	return { images, notes };
}

/** The collection's photo limit: 5, unless the product already holds more and the list only keeps, reorders or trims them. */
export function capShopImages(images: ShopImagePayload[], previousCount: number): { images: ShopImagePayload[]; notes: string[] } {
	const keepsOnly = previousCount > SHOP_PRODUCT_MAX_IMAGES && images.length <= previousCount && images.every((image) => image.existing);
	if (images.length <= SHOP_PRODUCT_MAX_IMAGES || keepsOnly) return { images, notes: [] };
	return { images: images.slice(0, SHOP_PRODUCT_MAX_IMAGES), notes: [`A product holds ${SHOP_PRODUCT_MAX_IMAGES} photos; only the first ${SHOP_PRODUCT_MAX_IMAGES} were used.`] };
}

const photoCount = (n: number) => `${n} photo${n === 1 ? "" : "s"}`;

const sameImages = (a: ShopProductSnapshot["images"], b: readonly ShopImagePayload[]) =>
	a.length === b.length && a.every((photo, i) => photo.ref === b[i]?.ref && squash(photo.alt) === squash(b[i]?.alt));

/**
 * The same publish gate prime-web enforces (`productPublishBlocks`): a product goes on sale with a
 * price, a SKU, stock and a weight above 0. A product with options needs its SKU and an options
 * matrix that prime-web checks itself. Checked here so the merchant is told before approving.
 */
export function shopPublishBlocks(product: ShopProductSnapshot): string[] {
	const missing: string[] = [];
	if (!product.sku?.trim()) missing.push("SKU");
	if (!product.hasVariants) {
		if (!Number.isFinite(product.price)) missing.push("price");
		if (!Number.isFinite(product.inventory)) missing.push("stock");
	}
	if (!(typeof product.weight === "number" && product.weight > 0)) missing.push("weight");
	return missing;
}

/** An edit of one existing product; an error when nothing would change or the product can't be edited. */
export function buildShopProductUpdateChangeSet(
	input: ShopProductUpdateInput,
	state: RecordState,
	ctx: BuildContext,
	known: readonly KnownImage[] = [],
): ChangeSet | ShopBuildError {
	const product = state.shopProduct;
	if (!product) return { error: "This record has no editable product fields." };
	if (state.removed) return { error: "This product is in the trash — restore it first." };
	const entity = { kind: "product", id: state.id, label: state.title };
	const c = input.changes;
	const diffs: FieldDiff[] = [];
	const skipped: string[] = [];
	const changes: Record<string, unknown> = {};
	const diff = (field: string, before: string | null | undefined, after: string) =>
		diffs.push({ entity, field, before: before == null || before === "" ? null : preview(before), after: preview(after), provenance: "generated" });

	if (c.name !== null && squash(c.name) !== squash(product.name)) {
		changes.name = c.name.trim();
		diff("name", product.name, c.name.trim());
	}
	for (const key of ["shortDescription", "description", "descriptionBM"] as const) {
		const next = c[key];
		const locked = (key === "description" && product.descriptionEditable === false) || (key === "descriptionBM" && product.descriptionBMEditable === false);
		if (next !== null && locked && squash(next) !== squash(product[key])) {
			skipped.push(product.descriptionNote ?? "This description has pictures inside; change it in the product form.");
			continue;
		}
		if (next !== null && squash(next) !== squash(product[key])) {
			changes[key] = next.trim();
			diff(key, product[key], next.trim());
		}
	}

	// price and compare-at price must stay in order (the collection refuses a compare-at price at or under the price)
	const compareChange = c.compareAtPrice === null ? undefined : c.compareAtPrice === 0 ? null : c.compareAtPrice;
	const compare = compareChange === undefined ? product.compareAtPrice : compareChange;
	const price = c.price ?? product.price;
	let priceOk = c.price !== null && c.price !== product.price;
	let compareOk = compareChange !== undefined && compareChange !== product.compareAtPrice;
	if (compare !== null && compare > 0 && compare <= price && (priceOk || compareOk)) {
		if (compareOk) skipped.push(`The compare-at price (${shopMoney(compare, product.currency)}) must be higher than the price (${shopMoney(price, product.currency)}).`);
		else skipped.push(`The price can't reach the compare-at price (${shopMoney(compare, product.currency)}); lower it or change the compare-at price too.`);
		priceOk = false;
		compareOk = false;
	}
	if (priceOk) {
		changes.price = price;
		diff("price", shopMoney(product.price, product.currency), shopMoney(price, product.currency));
	}
	if (compareOk) {
		changes.compareAtPrice = compareChange;
		diff("compareAtPrice", product.compareAtPrice ? shopMoney(product.compareAtPrice, product.currency) : null, compareChange == null ? "No compare-at price" : shopMoney(compareChange, product.currency));
	}

	if (c.sku !== null && c.sku.trim() !== (product.sku ?? "")) {
		changes.sku = c.sku.trim();
		diff("sku", product.sku, c.sku.trim());
	}
	if (c.inventory !== null) {
		if (product.hasVariants) skipped.push("This product has options: its stock is the sum of the options' stock, set in the product form.");
		else if (c.inventory !== product.inventory) {
			changes.inventory = c.inventory;
			diff("inventory", String(product.inventory), String(c.inventory));
		}
	}
	if (c.weight !== null && c.weight !== (product.weight ?? 0)) {
		changes.weight = c.weight;
		diff("weight", product.weight == null ? null : `${product.weight} kg`, `${c.weight} kg`);
	}
	if (c.tags !== null) {
		const tags = [...new Set(c.tags.map((tag) => tag.trim()).filter(Boolean))];
		if (tags.join("\n") !== product.tags.join("\n")) {
			changes.tags = tags;
			diff("tags", product.tags.join(", "), tags.join(", ") || "No tags");
		}
	}
	if (c.categoryId !== null && c.categoryId !== product.category?.id) {
		const category = product.categories.find((option) => option.id === c.categoryId);
		if (!category) skipped.push(`Category "${c.categoryId}" is not one of the shop's categories — the category stays.`);
		else {
			changes.categoryId = category.id;
			diff("category", product.category?.name, category.name);
		}
	}
	const seo: { title?: string; description?: string } = {};
	if (c.seoTitle !== null && c.seoTitle.trim() !== (product.seo.title ?? "")) {
		seo.title = c.seoTitle.trim();
		diff("seo.title", product.seo.title, seo.title);
	}
	if (c.seoDescription !== null && c.seoDescription.trim() !== (product.seo.description ?? "")) {
		seo.description = c.seoDescription.trim();
		diff("seo.description", product.seo.description, seo.description);
	}
	if (Object.keys(seo).length > 0) changes.seo = seo;

	if (c.images !== null) {
		const resolved = resolveShopImages(c.images, known, product.images);
		const capped = capShopImages(resolved.images, product.images.length);
		skipped.push(...resolved.notes, ...capped.notes);
		if (capped.images.length === 0 && c.images.length > 0) skipped.push("None of the photos could be used — the photos stay.");
		else if (!sameImages(product.images, capped.images)) {
			const added = capped.images.filter((image) => !image.existing).length;
			changes.images = capped.images;
			diff("photos", photoCount(product.images.length), `${photoCount(capped.images.length)}${added > 0 ? `, ${added} new` : ""}`);
		}
	}

	if (diffs.length === 0) return { error: skipped.length > 0 ? skipped.join(" ") : "Nothing would change — the values are already like that." };

	const live = state.status === "active";
	// Price and stock on a product that is on sale move money at checkout: never Auto-approve them (a lead or a
	// document the assistant read could have asked for an RM 0.01 price). Same rule as live discount codes.
	const moneyLive = live && (changes.price !== undefined || changes.compareAtPrice !== undefined || changes.inventory !== undefined);
	return {
		...base(ctx),
		domain: "products",
		title: `Edit product: ${state.title}`,
		summary: input.reason,
		risk: live ? "medium" : "low",
		blastRadius: { kind: "product", count: 1, label: `${diffs.length} field${diffs.length === 1 ? "" : "s"} on 1 product` },
		diffs,
		guardrails: [
			VERSION_GUARD,
			UNDO_GUARD,
			...(live ? [{ rule: "live", ok: true, detail: "The product is on sale: your store shows the change right away." }] : []),
			...skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		...(moneyLive ? { requiresClick: true } : {}),
		action: { kind: "shop_product.update", payload: { id: state.id, base: state.version, changes } },
	};
}

const TARGET_LABEL: Record<ShopProductStatusInput["status"], string> = { active: "Activate", draft: "Move to draft", archived: "Archive", trash: "Move to trash" };

/** Activate, move to draft, archive or trash a product (and bring one back from the trash) — always reversible. */
export function buildShopProductStatusChangeSet(input: ShopProductStatusInput, state: RecordState, ctx: BuildContext): ChangeSet | ShopBuildError {
	const now = state.removed ? "trash" : state.status;
	const target = input.status;
	if (now === target) return { error: `This product is already "${STATUS_LABEL[now] ?? now}".` };
	if (state.removed && target !== "draft") return { error: "A product in the trash is restored to draft first; then it can be activated or archived." };
	if (target === "active" && state.shopProduct) {
		const missing = shopPublishBlocks(state.shopProduct);
		if (missing.length > 0) {
			return { code: "not_ready", error: `Can't activate yet — missing: ${missing.join(", ")}. Set them with propose_shop_product_update first.` };
		}
	}
	const destructive = target === "archived" || target === "trash";
	const leavesStore = state.status === "active" && !state.removed && target !== "active";
	const entity = { kind: "product", id: state.id, label: state.title };
	return {
		...base(ctx),
		domain: "products",
		title: `${TARGET_LABEL[target]}: ${state.title}`,
		summary: input.reason,
		risk: destructive ? "high" : target === "active" || leavesStore ? "medium" : "low",
		blastRadius: { kind: "product", count: 1, label: "1 product" },
		diffs: [{ entity, field: "status", before: STATUS_LABEL[now] ?? now, after: STATUS_LABEL[target] ?? target, provenance: "user_input" }],
		guardrails: [
			VERSION_GUARD,
			UNDO_GUARD,
			...(target === "active" ? [{ rule: "live", ok: true, detail: "The product goes on sale in your store." }] : []),
			...(leavesStore ? [{ rule: "live", ok: true, detail: "The product leaves your store." }] : []),
			...(destructive
				? [
						{ rule: "reversible", ok: true, detail: target === "trash" ? "The product leaves your store and lists but stays in the trash; Restore brings it back as a draft." : "Archiving keeps the product and its data; Restore brings it back as a draft." },
						{ rule: "typed_confirm", ok: true, detail: "You will be asked Yes / No before it applies." },
					]
				: []),
		],
		...(destructive ? { confirmText: state.title.slice(0, 200) } : {}),
		// going on sale (or off it) changes what buyers can order: a person clicks Approve
		...(target === "active" || leavesStore ? { requiresClick: true } : {}),
		action: { kind: "shop_product.set_status", payload: { id: state.id, base: state.version, from: now, to: target } },
	};
}

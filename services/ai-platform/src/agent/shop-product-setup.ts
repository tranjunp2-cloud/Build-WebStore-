import type { ChangeSet, FieldDiff, ProductEditDoc } from "@ech/agent-core";
import { base, type BuildContext, type KnownImage, type RecordState, STATUS_LABEL, UNDO_GUARD, VERSION_GUARD } from "./change-set-builders";
import { capShopImages, resolveShopImages, type ShopBuildError, type ShopImagePayload, shopMoney, shopPublishBlocks } from "./shop-product-changes";
import type { ShopProductsSetupInput } from "./shop-product-schemas";

/**
 * `shop_product.bulk.update` — one card that finishes up to 20 existing products (price, stock, photos,
 * on sale / draft). Built from a fresh snapshot of every product; each carries its own `base` version so
 * prime-web refuses the card when any of them was edited since. Shown as the product-edit review: one row per
 * product, "Price RM 0.00 · Stock 0" → "Price RM 59.00 · Stock 12" (the rows of one "Changes" list).
 */

/**
 * Most products one card may bring NEW photos to. Approving downloads every new photo and then writes the products
 * inside one serverless request: more than this risks the request being cut short. The model splits bigger jobs.
 */
export const SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS = 5;

export interface SetupItem {
	id: string;
	base: string;
	name: string;
	changes: { price?: number; inventory?: number; images?: ShopImagePayload[]; status?: "active" | "draft" };
}

const squash = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const photoCount = (n: number) => `${n} photo${n === 1 ? "" : "s"}`;

type Cell = { field: string; before: string; after: string };

/** Why a product could not be read: the tool's own message when it has one. */
function readFailure(error: unknown): string {
	const message = (error as { message?: unknown } | null)?.message;
	return typeof message === "string" && message.trim() ? message.trim().replace(/[.\s]+$/, "") : "it could not be read";
}

/** One product's row: what would change, the lines for the review table, and what was left out and why. */
function planRow(row: ShopProductsSetupInput["products"][number], state: RecordState, known: readonly KnownImage[]) {
	const product = state.shopProduct;
	const name = state.title;
	const notes: string[] = [];
	if (!product) return { notes: [`${name}: this record has no editable product fields.`] };
	if (state.removed) return { notes: [`${name}: it is in the trash — restore it first.`] };
	const changes: SetupItem["changes"] = {};
	const cells: Cell[] = [];
	const diffs: Array<Pick<FieldDiff, "field" | "before" | "after">> = [];
	const note = (text: string) => notes.push(`${name}: ${text}`);

	let price = product.price;
	if (row.price !== null && row.price !== product.price) {
		const compare = product.compareAtPrice;
		if (product.hasVariants) note("it has options, so its prices are set in the product form.");
		else if (compare !== null && compare > 0 && compare <= row.price) note(`the price can't reach the compare-at price (${shopMoney(compare, product.currency)}).`);
		else {
			price = row.price;
			changes.price = row.price;
			cells.push({ field: "Price", before: shopMoney(product.price, product.currency), after: shopMoney(row.price, product.currency) });
			diffs.push({ field: "price", before: shopMoney(product.price, product.currency), after: shopMoney(row.price, product.currency) });
		}
	}

	let inventory = product.inventory;
	if (row.inventory !== null && row.inventory !== product.inventory) {
		if (product.hasVariants) note("it has options: its stock is the sum of the options' stock, set in the product form.");
		else {
			inventory = row.inventory;
			changes.inventory = row.inventory;
			cells.push({ field: "Stock", before: String(product.inventory), after: String(row.inventory) });
			diffs.push({ field: "stock", before: String(product.inventory), after: String(row.inventory) });
		}
	}

	if (row.images !== null) {
		const resolved = resolveShopImages(row.images, known, product.images);
		const capped = capShopImages(resolved.images, product.images.length);
		for (const text of [...resolved.notes, ...capped.notes]) note(text);
		const same = capped.images.length === product.images.length && capped.images.every((image, i) => image.ref === product.images[i]?.ref && squash(image.alt) === squash(product.images[i]?.alt));
		if (capped.images.length === 0 && row.images.length > 0) note("none of the photos could be used — the photos stay.");
		else if (!same) {
			const added = capped.images.filter((image) => !image.existing).length;
			const after = `${photoCount(capped.images.length)}${added > 0 ? `, ${added} new` : ""}`;
			changes.images = capped.images;
			cells.push({ field: "Photos", before: photoCount(product.images.length), after });
			diffs.push({ field: "photos", before: photoCount(product.images.length), after });
		}
	}

	if (row.status !== null && row.status !== state.status) {
		// the same gate prime-web enforces, on the values this card would leave the product with
		const blocks = row.status === "active" ? shopPublishBlocks({ ...product, price, inventory }) : [];
		if (blocks.length > 0) note(`can't go on sale yet — missing: ${blocks.join(", ")}.`);
		else {
			changes.status = row.status;
			cells.push({ field: "Status", before: STATUS_LABEL[state.status] ?? state.status, after: STATUS_LABEL[row.status] ?? row.status });
			diffs.push({ field: "status", before: STATUS_LABEL[state.status] ?? state.status, after: STATUS_LABEL[row.status] ?? row.status });
		}
	}
	if (diffs.length === 0) note("nothing to change — the values are already like that.");
	return { notes, changes, cells, diffs };
}

/** The setup card; an error when no product would change at all. */
export function buildShopProductsSetupChangeSet(
	input: ShopProductsSetupInput,
	states: ReadonlyArray<RecordState | { error: unknown }>,
	ctx: BuildContext,
	known: readonly KnownImage[] = [],
): ChangeSet | ShopBuildError {
	const items: SetupItem[] = [];
	const diffs: FieldDiff[] = [];
	const rows: ProductEditDoc["sections"][number]["rows"] = [];
	const skipped: string[] = [];
	let live = false;
	let touchesSale = false;
	for (const [index, row] of input.products.entries()) {
		const state = states[index];
		if (!state || "error" in state) {
			skipped.push(`Product ${row.id}: ${readFailure(state?.error)}.`);
			continue;
		}
		const plan = planRow(row, state, known);
		skipped.push(...plan.notes);
		if (!plan.changes || !plan.cells || !plan.diffs || plan.diffs.length === 0) continue;
		const entity = { kind: "product", id: state.id, label: state.title };
		items.push({ id: state.id, base: state.version, name: state.title, changes: plan.changes });
		const line = (side: "before" | "after") => plan.cells.map((cell) => `${cell.field} ${cell[side]}`).join(" · ").slice(0, 600);
		rows.push({ label: state.title.slice(0, 160), before: line("before"), after: line("after") });
		diffs.push(...plan.diffs.map((diff) => ({ entity, ...diff, provenance: "user_input" as const })));
		const onSale = state.status === "active";
		live ||= onSale;
		// price / stock of a product on sale move money at checkout, and going on or off sale changes what buyers can order
		touchesSale ||= (onSale && (plan.changes.price !== undefined || plan.changes.inventory !== undefined)) || plan.changes.status !== undefined;
	}
	const withNewPhotos = items.filter((item) => item.changes.images?.some((image) => !image.existing)).length;
	if (withNewPhotos > SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS) {
		return {
			error: `This card brings new photos to ${withNewPhotos} products; one card takes at most ${SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS} (every new photo is downloaded when the merchant approves). Stage ${SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS} or fewer products with new photos per card, in separate propose_shop_products_setup calls (prices, stock and on-sale for the other products can go in any card).`,
			code: "too_many_new_photos",
		};
	}
	if (items.length === 0) return { error: skipped.length > 0 ? skipped.join(" ") : "Nothing would change — the values are already like that." };

	const n = items.length;
	const touched = [
		items.some((item) => item.changes.price !== undefined) && "price",
		items.some((item) => item.changes.inventory !== undefined) && "stock",
		items.some((item) => item.changes.images !== undefined) && "photos",
		items.some((item) => item.changes.status !== undefined) && "on sale",
	].filter((part): part is string => Boolean(part));
	const doc: ProductEditDoc = {
		type: "product_edit",
		name: `Set up ${n} product${n === 1 ? "" : "s"}`,
		sections: [{ key: "products", rows }],
		undo: { notes: ["Undo puts every product back while none of them was edited after this change."] },
	};
	return {
		...base(ctx),
		domain: "products",
		title: `Set up ${n} product${n === 1 ? "" : "s"}: ${touched.join(", ")}`,
		summary: input.reason,
		risk: live ? "medium" : "low",
		blastRadius: { kind: "product", count: n, label: `${n} product${n === 1 ? "" : "s"}` },
		diffs,
		guardrails: [
			VERSION_GUARD,
			{ rule: "all_or_nothing_check", ok: true, detail: "Checked together first: if any of these products was edited since, nothing is written." },
			UNDO_GUARD,
			...(live ? [{ rule: "live", ok: true, detail: "Products on sale show the change in your store right away." }] : []),
			...skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		drafts: [doc],
		...(touchesSale ? { requiresClick: true } : {}),
		action: { kind: "shop_product.bulk.update", payload: { items } },
	};
}

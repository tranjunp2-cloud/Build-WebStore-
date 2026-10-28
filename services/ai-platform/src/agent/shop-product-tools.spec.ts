import { type ChangeSet, ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import type { KnownImage, ProductKnowledge, RecordState } from "./change-set-builders";
import { capabilitySet } from "./merchant-capabilities";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";
import { buildShopProductDraftsChangeSet } from "./shop-product-drafts";
import { buildShopProductStatusChangeSet, buildShopProductUpdateChangeSet, shopMoney, shopPublishBlocks } from "./shop-product-changes";
import {
	ShopProductDraftsInputSchema,
	type ShopProductSnapshot,
	ShopProductStatusInputSchema,
	ShopProductUpdateInputSchema,
} from "./shop-product-schemas";

const ctx = { id: "cs_shop_1", runId: "run_1", now: new Date("2026-10-21T08:00:00Z") };
const VERSION = "2026-10-20T09:30:00.000Z";

const snapshot = (over: Partial<ShopProductSnapshot> = {}): ShopProductSnapshot => ({
	name: "Batik Scarf",
	shortDescription: "Hand-drawn scarf",
	description: "A soft scarf.\n\n- cotton\n- 90 cm",
	descriptionBM: null,
	price: 49,
	compareAtPrice: 59,
	currency: "MYR",
	sku: "BAT-001",
	inventory: 12,
	weight: 0.2,
	hasVariants: false,
	tags: ["batik", "scarf"],
	category: { id: "3", name: "Scarves" },
	categories: [
		{ id: "3", name: "Scarves" },
		{ id: "4", name: "Bags" },
	],
	seo: { title: "Batik Scarf | Kedai", description: null },
	images: [
		{ ref: "media:11", url: "/api/media/file/11.jpg", alt: "Front" },
		{ ref: "media:12", url: "/api/media/file/12.jpg", alt: null },
	],
	...over,
});

const state = (over: Partial<RecordState> = {}, shop: Partial<ShopProductSnapshot> = {}): RecordState => ({
	kind: "product",
	id: "42",
	title: "Batik Scarf",
	status: "draft",
	version: VERSION,
	removed: false,
	fields: {},
	shopProduct: snapshot(shop),
	...over,
});

const none: Record<string, unknown> = {
	name: null,
	shortDescription: null,
	description: null,
	descriptionBM: null,
	price: null,
	compareAtPrice: null,
	sku: null,
	inventory: null,
	weight: null,
	tags: null,
	categoryId: null,
	seoTitle: null,
	seoDescription: null,
	images: null,
};
const update = (changes: Record<string, unknown>, id = "42") => ShopProductUpdateInputSchema.parse({ id, reason: "Merchant asked", changes: { ...none, ...changes } });

const chatImage = (over: Partial<KnownImage> = {}): KnownImage => ({ id: "img_1", ref: "attachment:att_9", url: "/api/agent/attachments/att_9", origin: "upload", alt: "scarf.jpg", ...over });

const built = (result: ChangeSet | { error: string }) => {
	if ("error" in result) throw new Error(result.error);
	return result;
};

describe("shop_product.update change set [TC-AIREL-55]", () => {
	it("shows before → after for each changed field and guards the saved version", () => {
		// Arrange
		const input = update({
			name: "Batik Silk Scarf",
			description: "A soft silk scarf.\n\n- silk\n- 90 cm",
			price: 55,
			sku: "BAT-002",
			inventory: 8,
			weight: 0.25,
			tags: ["batik", "silk"],
			categoryId: "4",
			seoDescription: "Hand-drawn batik silk scarf made in Kuala Lumpur, ready to ship.",
		});

		// Act
		const cs = built(buildShopProductUpdateChangeSet(input, state(), ctx));

		// Assert
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.domain).toBe("products");
		expect(cs.title).toBe("Edit product: Batik Scarf");
		expect(cs.summary).toBe("Merchant asked");
		expect(cs.risk).toBe("low");
		expect(Object.fromEntries(cs.diffs.map((d) => [d.field, [d.before, d.after]]))).toEqual({
			name: ["Batik Scarf", "Batik Silk Scarf"],
			description: ["A soft scarf. - cotton - 90 cm", "A soft silk scarf. - silk - 90 cm"],
			price: ["RM 49.00", "RM 55.00"],
			sku: ["BAT-001", "BAT-002"],
			inventory: ["12", "8"],
			weight: ["0.2 kg", "0.25 kg"],
			tags: ["batik, scarf", "batik, silk"],
			category: ["Scarves", "Bags"],
			"seo.description": [null, "Hand-drawn batik silk scarf made in Kuala Lumpur, ready to ship."],
		});
		expect(cs.diffs.every((d) => d.entity.kind === "product" && d.entity.id === "42" && d.entity.label === "Batik Scarf")).toBe(true);
		expect(cs.action).toEqual({
			kind: "shop_product.update",
			payload: {
				id: "42",
				base: VERSION,
				changes: {
					name: "Batik Silk Scarf",
					description: "A soft silk scarf.\n\n- silk\n- 90 cm",
					price: 55,
					sku: "BAT-002",
					inventory: 8,
					weight: 0.25,
					tags: ["batik", "silk"],
					categoryId: "4",
					seo: { description: "Hand-drawn batik silk scarf made in Kuala Lumpur, ready to ship." },
				},
			},
		});
		expect(cs.guardrails.map((g) => g.rule)).toEqual(expect.arrayContaining(["version_guard", "undo"]));
		expect(cs.blastRadius).toEqual({ kind: "product", count: 1, label: "9 fields on 1 product" });
	});

	it("sends only what changed and refuses a no-op, saying why", () => {
		const same = update({ name: "Batik  Scarf", price: 49, tags: ["batik", "scarf"], categoryId: "3" });
		expect(buildShopProductUpdateChangeSet(same, state(), ctx)).toEqual({ error: "Nothing would change — the values are already like that." });
		const one = built(buildShopProductUpdateChangeSet(update({ shortDescription: "Soft batik scarf", price: 49 }), state(), ctx));
		expect(one.action?.payload).toMatchObject({ changes: { shortDescription: "Soft batik scarf" } });
		expect(Object.keys((one.action?.payload as { changes: object }).changes)).toEqual(["shortDescription"]);
	});

	it("marks an edit of a product on sale as live and medium risk", () => {
		const cs = built(buildShopProductUpdateChangeSet(update({ price: 45 }), state({ status: "active" }), ctx));
		expect(cs.risk).toBe("medium");
		expect(cs.guardrails.some((g) => g.rule === "live")).toBe(true);
	});

	it("refuses a record that is not a Payload product, or is in the trash", () => {
		expect(buildShopProductUpdateChangeSet(update({ price: 45 }), state({ shopProduct: undefined }), ctx)).toEqual({ error: "This record has no editable product fields." });
		expect(buildShopProductUpdateChangeSet(update({ price: 45 }), state({ removed: true }), ctx)).toEqual({ error: "This product is in the trash — restore it first." });
	});
});

describe("shop_product.update guards [TC-AIREL-56]", () => {
	it("TC-AIREL-68: leaves a description with pictures inside to the product form", () => {
		// Arrange
		const locked = state({}, { descriptionEditable: false, descriptionNote: "This description has pictures inside; change it in the product form." });

		// Act
		const onlyDescription = buildShopProductUpdateChangeSet(update({ description: "New text" }), locked, ctx);
		const withName = built(buildShopProductUpdateChangeSet(update({ description: "New text", name: "Batik Silk Scarf" }), locked, ctx));

		// Assert
		expect(onlyDescription).toEqual({ error: expect.stringContaining("pictures inside") });
		expect((withName.action?.payload as { changes: object }).changes).not.toHaveProperty("description");
		expect(withName.guardrails.find((g) => !g.ok)?.detail).toContain("change it in the product form");
	});

	it("keeps the compare-at price above the price, as the collection requires", () => {
		// compare-at at or under the price is skipped and said
		const low = built(buildShopProductUpdateChangeSet(update({ compareAtPrice: 40, tags: ["new"] }), state(), ctx));
		expect(low.action?.payload).toMatchObject({ changes: { tags: ["new"] } });
		expect((low.action?.payload as { changes: object }).changes).not.toHaveProperty("compareAtPrice");
		expect(low.guardrails.find((g) => !g.ok)?.detail).toContain("compare-at price (RM 40.00) must be higher than the price (RM 49.00)");
		// a price that reaches the existing compare-at price is skipped too
		const high = buildShopProductUpdateChangeSet(update({ price: 60 }), state(), ctx);
		expect(high).toEqual({ error: expect.stringContaining("The price can't reach the compare-at price (RM 59.00)") });
		// both together, in order, are fine; 0 removes the compare-at price
		const both = built(buildShopProductUpdateChangeSet(update({ price: 60, compareAtPrice: 80 }), state(), ctx));
		expect(both.action?.payload).toMatchObject({ changes: { price: 60, compareAtPrice: 80 } });
		const removed = built(buildShopProductUpdateChangeSet(update({ compareAtPrice: 0 }), state(), ctx));
		expect(removed.action?.payload).toMatchObject({ changes: { compareAtPrice: null } });
		expect(removed.diffs[0]).toMatchObject({ field: "compareAtPrice", before: "RM 59.00", after: "No compare-at price" });
	});

	it("leaves the stock of a product with options to the product form", () => {
		const cs = built(buildShopProductUpdateChangeSet(update({ inventory: 5, name: "Batik Scarf 2" }), state({}, { hasVariants: true }), ctx));
		expect((cs.action?.payload as { changes: object }).changes).not.toHaveProperty("inventory");
		expect(cs.guardrails.find((g) => !g.ok)?.detail).toContain("has options");
	});

	it("takes a category only from the shop's own list", () => {
		const cs = built(buildShopProductUpdateChangeSet(update({ categoryId: "99", price: 45 }), state(), ctx));
		expect(cs.guardrails.find((g) => !g.ok)?.detail).toContain('Category "99" is not one of the shop\'s categories');
		expect((cs.action?.payload as { changes: object }).changes).not.toHaveProperty("categoryId");
	});

	it("resolves photos: current ones by media ref, chat pictures by id, in the order given", () => {
		// Arrange: keep photo 12 first, drop 11, add a chat picture with its own alt
		const input = update({ images: [{ id: "media:12", alt: "Side" }, { id: "img_1", alt: "On a hanger" }] });

		// Act
		const cs = built(buildShopProductUpdateChangeSet(input, state(), ctx, [chatImage()]));

		// Assert
		expect((cs.action?.payload as { changes: { images: unknown } }).changes.images).toEqual([
			{ ref: "media:12", url: "/api/media/file/12.jpg", alt: "Side", existing: true },
			{ ref: "attachment:att_9", url: "/api/agent/attachments/att_9", alt: "On a hanger", existing: false },
		]);
		expect(cs.diffs).toEqual([expect.objectContaining({ field: "photos", before: "2 photos", after: "2 photos, 1 new" })]);
	});

	it("skips a photo that is neither in the chat nor on the product, and a list that leaves nothing usable", () => {
		const some = built(buildShopProductUpdateChangeSet(update({ images: [{ id: "media:11", alt: null }, { id: "img_77", alt: null }] }), state(), ctx));
		expect((some.action?.payload as { changes: { images: unknown[] } }).changes.images).toHaveLength(1);
		expect(some.guardrails.find((g) => !g.ok)?.detail).toContain("Skipped photo img_77");
		const unusable = buildShopProductUpdateChangeSet(update({ images: [{ id: "img_77", alt: null }] }), state(), ctx);
		expect(unusable).toEqual({ error: expect.stringContaining("None of the photos could be used") });
	});

	it("holds five photos, unless the product already has more and the list only keeps, reorders or trims them", () => {
		const chat = Array.from({ length: 6 }, (_, i) => chatImage({ id: `img_${i + 1}`, ref: `attachment:att_${i + 1}`, url: `/a/${i + 1}` }));
		const six = built(buildShopProductUpdateChangeSet(update({ images: chat.map((c) => ({ id: c.id, alt: null })) }), state(), ctx, chat));
		expect((six.action?.payload as { changes: { images: unknown[] } }).changes.images).toHaveLength(5);
		expect(six.guardrails.find((g) => !g.ok)?.detail).toContain("holds 5 photos");

		const many = Array.from({ length: 7 }, (_, i) => ({ ref: `media:${i + 1}`, url: `/m/${i + 1}`, alt: null }));
		const trimmed = built(buildShopProductUpdateChangeSet(update({ images: [{ id: "media:7", alt: null }, { id: "media:1", alt: null }, { id: "media:2", alt: null }, { id: "media:3", alt: null }, { id: "media:4", alt: null }, { id: "media:5", alt: null }] }), state({}, { images: many }), ctx));
		expect((trimmed.action?.payload as { changes: { images: unknown[] } }).changes.images).toHaveLength(6);
		const added = built(buildShopProductUpdateChangeSet(update({ images: [...many.map((m) => ({ id: m.ref, alt: null })), { id: "img_1", alt: null }] }), state({}, { images: many }), ctx, [chatImage()]));
		expect((added.action?.payload as { changes: { images: unknown[] } }).changes.images).toHaveLength(5);
	});
});

describe("shop_product.set_status change set [TC-AIREL-57]", () => {
	const status = (to: string) => ShopProductStatusInputSchema.parse({ id: "42", status: to, reason: "Merchant asked" });

	it("activates a ready draft: medium risk, live note, version guard, no typed confirmation", () => {
		const cs = built(buildShopProductStatusChangeSet(status("active"), state(), ctx));
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.title).toBe("Activate: Batik Scarf");
		expect(cs.risk).toBe("medium");
		expect(cs.confirmText).toBeUndefined();
		expect(cs.diffs).toEqual([expect.objectContaining({ field: "status", before: "Draft", after: "Active" })]);
		expect(cs.action).toEqual({ kind: "shop_product.set_status", payload: { id: "42", base: VERSION, from: "draft", to: "active" } });
		expect(cs.guardrails.some((g) => g.rule === "live" && g.detail?.includes("goes on sale"))).toBe(true);
	});

	it("tells what is missing before staging an activation, mirroring the publish gate", () => {
		const out = buildShopProductStatusChangeSet(status("active"), state({}, { sku: null, weight: 0 }), ctx);
		expect(out).toEqual({ code: "not_ready", error: "Can't activate yet — missing: SKU, weight. Set them with propose_shop_product_update first." });
		expect(shopPublishBlocks(snapshot())).toEqual([]);
		expect(shopPublishBlocks(snapshot({ hasVariants: true, inventory: 0, weight: null }))).toEqual(["weight"]);
		// the variants matrix is prime-web's to check; a product with options needs its SKU and a weight only here
		expect(shopPublishBlocks(snapshot({ hasVariants: true, sku: " " }))).toEqual(["SKU"]);
	});

	it("needs the typed name for archive and trash, which are high risk and can be restored", () => {
		for (const to of ["archived", "trash"]) {
			const cs = built(buildShopProductStatusChangeSet(status(to), state({ status: "active" }), ctx));
			expect(cs.risk).toBe("high");
			expect(cs.confirmText).toBe("Batik Scarf");
			expect(cs.guardrails.map((g) => g.rule)).toEqual(expect.arrayContaining(["reversible", "typed_confirm", "undo", "version_guard"]));
			expect(cs.guardrails.some((g) => g.detail === "The product leaves your store.")).toBe(true);
		}
		expect(built(buildShopProductStatusChangeSet(status("trash"), state(), ctx)).diffs[0]).toMatchObject({ before: "Draft", after: "In the trash" });
	});

	it("brings a trashed or archived product back as a draft, and nothing else straight from the trash", () => {
		const restored = built(buildShopProductStatusChangeSet(status("draft"), state({ removed: true, status: "active" }), ctx));
		expect(restored.diffs[0]).toMatchObject({ before: "In the trash", after: "Draft" });
		expect(restored.action?.payload).toMatchObject({ from: "trash", to: "draft" });
		expect(restored.risk).toBe("low");
		expect(built(buildShopProductStatusChangeSet(status("draft"), state({ status: "archived" }), ctx)).risk).toBe("low");
		expect(buildShopProductStatusChangeSet(status("active"), state({ removed: true }), ctx)).toEqual({ error: expect.stringContaining("restored to draft first") });
	});

	it("refuses a status the product already has", () => {
		expect(buildShopProductStatusChangeSet(status("draft"), state(), ctx)).toEqual({ error: 'This product is already "Draft".' });
		expect(buildShopProductStatusChangeSet(status("trash"), state({ removed: true }), ctx)).toEqual({ error: 'This product is already "In the trash".' });
	});
});

describe("shop_product.create_drafts change set [TC-AIREL-58]", () => {
	const product = (name: string, over: Record<string, unknown> = {}) => ({ ...Object.fromEntries(Object.keys(none).map((k) => [k, null])), name, ...over });
	const draftInput = (products: unknown[], currency: string | null = null) => ShopProductDraftsInputSchema.parse({ products, currency });
	const knowledge: ProductKnowledge = { merchantText: "batik scarf rm 49, 12 pcs", images: [chatImage(), chatImage({ id: "img_2", ref: "pixabay:99", url: "https://cdn.pixabay.com/99.jpg", origin: "stock", credit: "Pixabay" })] };

	it("TC-AIREL-65: prices drafts in the shop's currency", () => {
		// Arrange
		const input = draftInput([product("Batik Scarf", { price: 20 })], "SGD");

		// Act
		const cs = buildShopProductDraftsChangeSet(input, ctx);

		// Assert
		expect((cs.action?.payload as { products: Array<{ currency: string }> }).products[0]?.currency).toBe("SGD");
		expect(cs.drafts?.[0]).toMatchObject({ catalog: "shop", price: "S$ 20.00" });
		expect(cs.diffs.find((d) => d.field === "price")?.after).toBe("S$ 20.00");
	});

	it("TC-AIREL-70: shows the category by name on the draft card", () => {
		// Arrange
		const input = draftInput([product("Batik Scarf", { categoryId: "10" })], "MYR");

		// Act
		const cs = buildShopProductDraftsChangeSet(input, ctx, {}, { "10": "Skincare" });

		// Assert
		const doc = cs.drafts?.[0];
		expect(doc?.type === "product" ? doc.fields.find((f) => f.key === "category")?.value : undefined).toBe("Skincare");
		expect((cs.action?.payload as { products: Array<{ categoryId: string }> }).products[0]?.categoryId).toBe("10");
	});

	it("creates drafts with aiReviewPending and prices only where the merchant gave one", () => {
		// Arrange
		const input = draftInput([
			product("Batik Scarf", { description: "A soft scarf.", price: 49, inventory: 12, tags: ["batik"], seoTitle: "Batik Scarf | Kedai", images: [{ id: "img_1", alt: "Front" }, { id: "img_2", alt: null }] }),
			product("Songket Bag"),
		]);

		// Act
		const cs = buildShopProductDraftsChangeSet(input, ctx, knowledge);

		// Assert
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.title).toBe("Create 2 draft products");
		expect(cs.risk).toBe("low");
		expect(cs.action?.kind).toBe("shop_product.create_drafts");
		expect(cs.action?.payload).toMatchObject({ version: 1, status: "draft", aiReviewPending: true });
		const products = (cs.action?.payload as { products: Array<Record<string, unknown>> }).products;
		expect(products[0]).toEqual({
			name: "Batik Scarf",
			shortDescription: null,
			description: "A soft scarf.",
			descriptionBM: null,
			price: 49,
			sku: null,
			inventory: 12,
			weight: null,
			tags: ["batik"],
			categoryId: null,
			seo: { title: "Batik Scarf | Kedai", description: null },
			images: [
				{ ref: "attachment:att_9", url: "/api/agent/attachments/att_9", alt: "Front" },
				{ ref: "pixabay:99", url: "https://cdn.pixabay.com/99.jpg", alt: null },
			],
			currency: "MYR",
		});
		expect(products[1]).toMatchObject({ name: "Songket Bag", price: null, images: [] });
		expect(cs.guardrails.find((g) => g.rule === "price_missing")?.detail).toBe("1 product has no price yet — set it before putting it on sale.");
		// the review card: product docs with where each value came from
		const [first, second] = cs.drafts ?? [];
		expect(first).toMatchObject({ type: "product", catalog: "shop", name: "Batik Scarf", sku: "—", price: "RM 49.00" });
		expect(first?.type === "product" && first.fields.find((f) => f.key === "price")).toMatchObject({ value: "RM 49.00", source: "you" });
		expect(first?.type === "product" && first.images.map((i) => [i.role, i.origin, i.credit])).toEqual([["main", "upload", undefined], ["gallery", "stock", "Pixabay"]]);
		expect(second?.type === "product" && second.fields.find((f) => f.key === "price")).toMatchObject({ source: "missing" });
		expect(cs.diffs.filter((d) => d.entity.id === "new-1").map((d) => d.field)).toEqual(["name", "price", "description"]);
	});

	it("gives the first draft the photos the merchant picked in a question card when the model named none", () => {
		const cs = buildShopProductDraftsChangeSet(draftInput([product("Batik Scarf"), product("Songket Bag")]), ctx, { ...knowledge, defaultImageIds: ["img_1"] });
		const products = (cs.action?.payload as { products: Array<{ images: unknown[] }> }).products;
		expect(products.map((p) => p.images.length)).toEqual([1, 0]);
	});

	it("skips unknown photos and photos past five, and says so", () => {
		const many = Array.from({ length: 7 }, (_, i) => chatImage({ id: `img_${i + 1}`, ref: `attachment:att_${i + 1}`, url: `/a/${i + 1}` }));
		const input = draftInput([product("Batik Scarf", { images: [...many.map((m) => ({ id: m.id, alt: null })), { id: "img_99", alt: null }] })]);
		const cs = buildShopProductDraftsChangeSet(input, ctx, { images: many });
		expect((cs.action?.payload as { products: Array<{ images: unknown[] }> }).products[0]?.images).toHaveLength(5);
		expect(cs.guardrails.filter((g) => !g.ok).map((g) => g.detail)).toEqual([
			"Batik Scarf: Skipped photo img_99: not a picture of this chat or of the product.",
			"Batik Scarf: A product holds 5 photos; only the first 5 were used.",
		]);
	});

	it("holds 20 drafts in one change set and refuses 21 at the tool boundary", () => {
		const twenty = Array.from({ length: 20 }, (_, i) => product(`Product ${i + 1}`));
		const cs = buildShopProductDraftsChangeSet(draftInput(twenty), ctx);
		expect(ChangeSetSchema.parse(cs).drafts).toHaveLength(20);
		expect(ShopProductDraftsInputSchema.safeParse({ products: [...twenty, product("One more")] }).success).toBe(false);
		expect(ShopProductDraftsInputSchema.safeParse({ products: [] }).success).toBe(false);
	});

	it("rejects inputs outside the collection's limits", () => {
		expect(ShopProductDraftsInputSchema.safeParse({ products: [product("ab")] }).success).toBe(false);
		expect(ShopProductDraftsInputSchema.safeParse({ products: [product("Scarf", { price: -1 })] }).success).toBe(false);
		expect(ShopProductDraftsInputSchema.safeParse({ products: [product("Scarf", { seoTitle: "x".repeat(61) })] }).success).toBe(false);
		expect(ShopProductUpdateInputSchema.safeParse({ id: "1", reason: "why", changes: { ...none, seoDescription: "x".repeat(161) } }).success).toBe(false);
		expect(ShopProductUpdateInputSchema.safeParse({ id: "1", reason: "why", changes: { ...none, inventory: 1.5 } }).success).toBe(false);
	});
});

describe("shop product tools [TC-AIREL-59]", () => {
	const shop = capabilitySet(["site", "blog", "stock_photos", "shop_products"]);
	function setup(over: Partial<MerchantToolDeps> = {}) {
		const staged: ChangeSet[] = [];
		const deps = {
			runId: "run_1",
			newChangeSetId: () => "cs_tool_1",
			now: () => new Date("2026-10-21T08:00:00Z"),
			stage: vi.fn(async (changeSet: ChangeSet) => void staged.push(changeSet)),
			snapshot: vi.fn(async () => state()),
			allowEdit: () => true,
			images: () => [chatImage()],
			createdInChat: () => [],
			productKnowledge: async () => ({}),
			...over,
		} as unknown as MerchantToolDeps;
		const tools = createMerchantTools(deps, shop) as unknown as Record<string, { execute: (input: unknown) => Promise<any> }>;
		return { deps, staged, run: (name: string, input: unknown) => (tools[name] as { execute: (input: unknown) => Promise<any> }).execute(input) };
	}

	it("stages an edit read from a fresh snapshot of the product and answers with the change set", async () => {
		// Arrange
		const { deps, staged, run } = setup();

		// Act
		const out = await run("propose_shop_product_update", update({ price: 45, images: [{ id: "img_1", alt: null }] }));

		// Assert
		expect(deps.snapshot).toHaveBeenCalledWith({ kind: "product", id: "42" });
		expect(out).toEqual({ changeSetId: "cs_tool_1", fields: 2, note: "Staged for the merchant's approval. Nothing has been created yet." });
		expect(staged[0]?.action).toMatchObject({ kind: "shop_product.update", payload: { id: "42", base: VERSION } });
	});

	it("hands the model the reason when nothing changes, the snapshot error as it came, and the per-request limit", async () => {
		expect(await setup().run("propose_shop_product_update", update({ price: 49 }))).toEqual({ error: { code: "no_change", message: "Nothing would change — the values are already like that." } });
		const missing = { error: { code: "not_found", message: "No such product." } };
		expect(await setup({ snapshot: async () => missing } as never).run("propose_shop_product_update", update({ price: 45 }))).toEqual(missing);
		const limited = setup({ allowEdit: () => false });
		expect(await limited.run("propose_shop_product_update", update({ price: 45 }))).toMatchObject({ error: { code: "limit" } });
		expect(await limited.run("propose_shop_product_status", { id: "42", status: "trash", reason: "Merchant asked" })).toMatchObject({ error: { code: "limit" } });
		expect(limited.deps.snapshot).not.toHaveBeenCalled();
	});

	it("stages a status change, asks for the name on archive, and answers not_ready for an incomplete product", async () => {
		const { staged, run } = setup({ snapshot: async () => state({ status: "active" }) } as never);
		const out = await run("propose_shop_product_status", { id: "42", status: "archived", reason: "Merchant asked" });
		expect(out.note).toContain("Approving asks the merchant Yes / No first.");
		expect(staged[0]?.action?.kind).toBe("shop_product.set_status");
		const incomplete = setup({ snapshot: async () => state({}, { sku: null }) } as never);
		expect(await incomplete.run("propose_shop_product_status", { id: "42", status: "active", reason: "Merchant asked" })).toMatchObject({ error: { code: "not_ready" } });
		expect(await setup().run("propose_shop_product_status", { id: "42", status: "draft", reason: "Merchant asked" })).toMatchObject({ error: { code: "not_allowed", message: 'This product is already "Draft".' } });
	});

	it("stages new drafts with the run's knowledge, and sends the model to edit a product this chat already created", async () => {
		// Arrange
		const { staged, run, deps } = setup({ productKnowledge: async () => ({ images: [chatImage()], merchantText: "scarf" }) } as never);
		const input = ShopProductDraftsInputSchema.parse({ products: [{ ...Object.fromEntries(Object.keys(none).map((k) => [k, null])), name: "Batik Scarf", images: [{ id: "img_1", alt: null }] }], currency: null });

		// Act
		const out = await run("propose_shop_product_drafts", input);
		const again = await setup({ createdInChat: () => [{ kind: "product", id: "88", label: "batik  scarf" }] } as never).run("propose_shop_product_drafts", input);

		// Assert
		expect(out).toEqual({ changeSetId: "cs_tool_1", products: 1, note: "Staged for the merchant's approval. Nothing has been created yet." });
		expect(staged[0]?.drafts?.[0]).toMatchObject({ type: "product", name: "Batik Scarf" });
		expect(deps.stage).toHaveBeenCalledOnce();
		expect(again.error.code).toBe("already_created");
		expect(again.error.message).toContain('propose_shop_product_update with id "88"');
	});
});

describe("shopMoney", () => {
	it("shows the collection's three currencies and falls back to the code", () => {
		expect(shopMoney(1234.5, "MYR")).toBe("RM 1,234.50");
		expect(shopMoney(5, "USD")).toBe("US$ 5.00");
		expect(shopMoney(5, "SGD")).toBe("S$ 5.00");
		expect(shopMoney(5, "VND")).toBe("VND 5.00");
	});
});

describe("hand approval on products that are on sale [TC-AISEC-006]", () => {
	const status = (to: string) => ShopProductStatusInputSchema.parse({ id: "42", status: to, reason: "Merchant asked" });

	it("needs a click for price, compare-at price or stock on a live product, never Auto-approve", () => {
		for (const changes of [{ price: 0.01 }, { compareAtPrice: 99 }, { inventory: 0 }]) {
			const cs = built(buildShopProductUpdateChangeSet(update(changes), state({ status: "active" }), ctx));
			expect(cs.requiresClick).toBe(true);
			expect(ChangeSetSchema.parse(cs).requiresClick).toBe(true);
		}
	});

	it("leaves text edits on a live product and price edits on a draft to Auto-approve", () => {
		expect(built(buildShopProductUpdateChangeSet(update({ name: "Batik Silk Scarf" }), state({ status: "active" }), ctx)).requiresClick).toBeUndefined();
		expect(built(buildShopProductUpdateChangeSet(update({ price: 55 }), state(), ctx)).requiresClick).toBeUndefined();
	});

	it("needs a click to put a product on sale or take it off sale; draft ↔ archive stays as it was", () => {
		expect(built(buildShopProductStatusChangeSet(status("active"), state(), ctx)).requiresClick).toBe(true);
		expect(built(buildShopProductStatusChangeSet(status("draft"), state({ status: "active" }), ctx)).requiresClick).toBe(true);
		expect(built(buildShopProductStatusChangeSet(status("draft"), state({ status: "archived" }), ctx)).requiresClick).toBeUndefined();
	});
});

import { type ChangeSet, ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import type { KnownImage, RecordState } from "./change-set-builders";
import { capabilitySet, toolAllowed } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";
import { buildShopProductsSetupChangeSet, SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS } from "./shop-product-setup";
import { SHOP_PRODUCTS_SETUP_MAX, type ShopProductSnapshot, ShopProductsSetupInputSchema } from "./shop-product-schemas";

// TC-AIAUD-106..109 — propose_shop_products_setup: ONE card that sets price, stock, photos and on-sale for up
// to 20 existing products, one table row each (before → after), validated per row against a fresh snapshot.

const ctx = { id: "cs_setup_1", runId: "run_1", now: new Date("2026-10-29T08:00:00Z") };
const VERSION = "2026-10-28T09:30:00.000Z";

const snapshot = (over: Partial<ShopProductSnapshot> = {}): ShopProductSnapshot => ({
	name: "Rose serum",
	shortDescription: null,
	description: null,
	descriptionBM: null,
	price: 0,
	compareAtPrice: null,
	currency: "MYR",
	sku: "ROSE-1",
	inventory: 0,
	weight: 0.1,
	hasVariants: false,
	tags: [],
	category: null,
	categories: [],
	seo: { title: null, description: null },
	images: [{ ref: "media:7", url: "/api/media/file/7.jpg", alt: null, source: "stock" }],
	...over,
});

const state = (id: string, title: string, over: Partial<RecordState> = {}, shop: Partial<ShopProductSnapshot> = {}): RecordState => ({
	kind: "product",
	id,
	title,
	status: "active",
	version: `${VERSION}#${id}`,
	removed: false,
	fields: {},
	shopProduct: snapshot({ name: title, ...shop }),
	...over,
});

const row = (id: string, over: Record<string, unknown> = {}) => ({ id, price: null, inventory: null, images: null, status: null, ...over });
const input = (products: Array<ReturnType<typeof row>>) => ShopProductsSetupInputSchema.parse({ reason: "Merchant gave the numbers", products });
const chatImage = (over: Partial<KnownImage> = {}): KnownImage => ({ id: "att_9", ref: "attachment:att_9", url: "/api/agent/attachments/att_9", origin: "upload", alt: "serum.jpg", ...over });

const built = (result: ChangeSet | { error: string }) => {
	if ("error" in result) throw new Error(result.error);
	return result;
};

describe("shop_product.bulk.update change set [TC-AIAUD-106]", () => {
	const states = [state("11", "Rose serum", {}, { price: 0, inventory: 0 }), state("12", "Night cream", {}, { price: 35, inventory: 3 })];

	it("is one valid card with one before → after row per product, guarded by each product's version", () => {
		const cs = built(
			buildShopProductsSetupChangeSet(
				input([row("11", { price: 59, inventory: 12, images: [{ id: "att_9", alt: "Rose serum bottle" }] }), row("12", { inventory: 8 })]),
				states,
				ctx,
				[chatImage()],
			),
		);

		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.domain).toBe("products");
		expect(cs.title).toBe("Set up 2 products: price, stock, photos");
		expect(cs.blastRadius).toEqual({ kind: "product", count: 2, label: "2 products" });
		const doc = cs.drafts?.[0];
		expect(doc).toMatchObject({ type: "product_edit", name: "Set up 2 products", sections: [{ key: "products" }] });
		const rows = doc?.type === "product_edit" ? doc.sections[0]?.rows : undefined;
		expect(rows).toEqual([
			{ label: "Rose serum", before: "Price RM 0.00 · Stock 0 · Photos 1 photo", after: "Price RM 59.00 · Stock 12 · Photos 1 photo, 1 new" },
			{ label: "Night cream", before: "Stock 3", after: "Stock 8" },
		]);
		expect(cs.diffs.map((d) => [d.entity.id, d.field, d.before, d.after, d.provenance])).toEqual([
			["11", "price", "RM 0.00", "RM 59.00", "user_input"],
			["11", "stock", "0", "12", "user_input"],
			["11", "photos", "1 photo", "1 photo, 1 new", "user_input"],
			["12", "stock", "3", "8", "user_input"],
		]);
		expect(cs.action).toMatchObject({
			kind: "shop_product.bulk.update",
			payload: {
				items: [
					{ id: "11", base: `${VERSION}#11`, name: "Rose serum", changes: { price: 59, inventory: 12, images: [{ ref: "attachment:att_9", existing: false, alt: "Rose serum bottle" }] } },
					{ id: "12", base: `${VERSION}#12`, name: "Night cream", changes: { inventory: 8 } },
				],
			},
		});
	});

	it("needs a click when price or stock of a product on sale moves, and is Auto-approvable for products still in draft", () => {
		const live = built(buildShopProductsSetupChangeSet(input([row("11", { inventory: 5 })]), [states[0] as RecordState], ctx));
		expect(live.requiresClick).toBe(true);
		expect(live.risk).toBe("medium");
		expect(live.guardrails.some((g) => g.rule === "live" && g.ok)).toBe(true);

		const draft = built(buildShopProductsSetupChangeSet(input([row("11", { inventory: 5 })]), [state("11", "Rose serum", { status: "draft" })], ctx));
		expect(draft.requiresClick).toBeUndefined();
		expect(draft.risk).toBe("low");
	});

	it("shows a single-product card in the singular", () => {
		const cs = built(buildShopProductsSetupChangeSet(input([row("11", { inventory: 5 })]), [states[0] as RecordState], ctx));
		expect(cs.title).toBe("Set up 1 product: stock");
	});
});

describe("per-row validation [TC-AIAUD-107]", () => {
	it("leaves price and stock of a product with options alone, says why, and still applies its photos", () => {
		const options = state("20", "Linen shirt", { status: "draft" }, { hasVariants: true });
		const cs = built(buildShopProductsSetupChangeSet(input([row("20", { price: 50, inventory: 9, images: [{ id: "att_9", alt: null }] })]), [options], ctx, [chatImage()]));

		const item = (cs.action?.payload as { items: Array<{ changes: Record<string, unknown> }> }).items[0];
		expect(Object.keys(item?.changes ?? {})).toEqual(["images"]);
		const skipped = cs.guardrails.filter((g) => !g.ok).map((g) => g.detail);
		expect(skipped).toEqual(["Linen shirt: it has options, so its prices are set in the product form.", "Linen shirt: it has options: its stock is the sum of the options' stock, set in the product form."]);
	});

	it("skips a product in the trash, one that can't be read and one with nothing to change; the rest still go", () => {
		const cs = built(
			buildShopProductsSetupChangeSet(
				input([row("1", { inventory: 4 }), row("2", { inventory: 4 }), row("3", { inventory: 4 }), row("4", { inventory: 4 })]),
				[state("1", "Alpha", {}, { inventory: 0 }), state("2", "Bravo", { removed: true }), { error: { code: "not_found", message: "No such product in this shop" } }, state("4", "Delta", {}, { inventory: 4 })],
				ctx,
			),
		);

		expect((cs.action?.payload as { items: Array<{ id: string }> }).items.map((i) => i.id)).toEqual(["1"]);
		expect(cs.guardrails.filter((g) => !g.ok).map((g) => g.detail)).toEqual([
			"Bravo: it is in the trash — restore it first.",
			"Product 3: No such product in this shop.",
			"Delta: nothing to change — the values are already like that.",
		]);
	});

	it("keeps the publish gate: a draft only goes on sale when price, SKU, stock and weight are there after this card", () => {
		const missingSku = state("1", "Alpha", { status: "draft" }, { sku: null, price: 10, inventory: 1 });
		const ready = state("2", "Bravo", { status: "draft" }, { price: 0, inventory: 0 });
		const cs = built(buildShopProductsSetupChangeSet(input([row("1", { inventory: 6, status: "active" }), row("2", { price: 20, inventory: 6, status: "active" })]), [missingSku, ready], ctx));

		const items = (cs.action?.payload as { items: Array<{ id: string; changes: Record<string, unknown> }> }).items;
		expect(items.find((i) => i.id === "1")?.changes).toEqual({ inventory: 6 });
		expect(items.find((i) => i.id === "2")?.changes).toEqual({ price: 20, inventory: 6, status: "active" });
		expect(cs.guardrails.filter((g) => !g.ok).map((g) => g.detail)).toEqual(["Alpha: can't go on sale yet — missing: SKU."]);
		expect(cs.requiresClick).toBe(true);
	});

	it("refuses a price that would reach the compare-at price, and a photo that is not in the chat or on the product", () => {
		const cs = built(
			buildShopProductsSetupChangeSet(
				input([row("1", { price: 30, inventory: 2, images: [{ id: "img_404", alt: null }] })]),
				[state("1", "Alpha", {}, { compareAtPrice: 30 })],
				ctx,
			),
		);

		const item = (cs.action?.payload as { items: Array<{ changes: Record<string, unknown> }> }).items[0];
		expect(Object.keys(item?.changes ?? {})).toEqual(["inventory"]);
		const skipped = cs.guardrails.filter((g) => !g.ok).map((g) => g.detail);
		expect(skipped[0]).toContain("can't reach the compare-at price (RM 30.00)");
		expect(skipped.join(" ")).toContain("Skipped photo img_404");
	});

	it("answers an error when no product would change at all", () => {
		const out = buildShopProductsSetupChangeSet(input([row("1", { inventory: 0 })]), [state("1", "Alpha")], ctx);
		expect(out).toEqual({ error: "Alpha: nothing to change — the values are already like that." });
	});
});

describe("propose_shop_products_setup tool [TC-AIAUD-108..109]", () => {
	const shop = capabilitySet(["site", "blog", "stock_photos", "shop_products"]);
	function setup(over: Partial<MerchantToolDeps> = {}) {
		const staged: ChangeSet[] = [];
		const deps = {
			runId: "run_1",
			newChangeSetId: () => "cs_tool_1",
			now: () => new Date("2026-10-29T08:00:00Z"),
			stage: vi.fn(async (changeSet: ChangeSet) => void staged.push(changeSet)),
			snapshot: vi.fn(async ({ id }: { id: string }) => state(id, `Product ${id}`)),
			allowEdit: () => true,
			images: () => [chatImage()],
			createdInChat: () => [],
			productKnowledge: async () => ({}),
			...over,
		} as unknown as MerchantToolDeps;
		const tools = createMerchantTools(deps, shop) as unknown as Record<string, { execute: (input: unknown) => Promise<any> }>;
		return { deps, staged, tools, run: (value: unknown) => (tools.propose_shop_products_setup as { execute: (input: unknown) => Promise<any> }).execute(value) };
	}

	it("reads every product again and stages ONE change set", async () => {
		const { deps, staged, run } = setup();

		const out = await run(input([row("11", { inventory: 5 }), row("12", { inventory: 6 }), row("13", { inventory: 7 })]));

		expect((deps.snapshot as ReturnType<typeof vi.fn>).mock.calls.map(([arg]) => arg)).toEqual([
			{ kind: "product", id: "11" },
			{ kind: "product", id: "12" },
			{ kind: "product", id: "13" },
		]);
		expect(staged).toHaveLength(1);
		expect(out).toEqual({ changeSetId: "cs_tool_1", products: 3, note: "Staged for the merchant's approval. Nothing has been created yet." });
	});

	it("answers the skipped rows, a duplicate id, the per-request limit and no_change as errors the model can act on", async () => {
		const some = setup({ snapshot: vi.fn(async ({ id }: { id: string }) => (id === "12" ? { error: { code: "not_found", message: "No such product." } } : state(id, `Product ${id}`))) } as never);
		expect(await some.run(input([row("11", { inventory: 5 }), row("12", { inventory: 6 })]))).toMatchObject({ products: 1, skipped: ["Product 12: No such product."] });

		expect(await setup().run(input([row("11", { inventory: 5 }), row("11", { inventory: 6 })]))).toMatchObject({ error: { code: "duplicate" } });
		const limited = setup({ allowEdit: () => false });
		expect(await limited.run(input([row("11", { inventory: 5 })]))).toMatchObject({ error: { code: "limit" } });
		expect(limited.deps.snapshot).not.toHaveBeenCalled();
		expect(await setup().run(input([row("11", { inventory: 0 })]))).toMatchObject({ error: { code: "no_change" } });
	});

	it("TC-AIAUD-153: a card brings new photos to at most 5 products; more is a clear error that tells the model to split, and nothing is staged", async () => {
		const { staged, run } = setup();
		const photos = (n: number) => input(Array.from({ length: n }, (_, i) => row(String(i + 11), { images: [{ id: "att_9", alt: null }] })));

		const out = await run(photos(SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS + 1));

		expect(out).toMatchObject({ error: { code: "too_many_new_photos", message: expect.stringContaining("at most 5") } });
		expect(out.error.message).toContain("separate propose_shop_products_setup calls");
		expect(staged).toHaveLength(0);
		expect(await run(photos(SETUP_MAX_PRODUCTS_WITH_NEW_PHOTOS))).toMatchObject({ changeSetId: "cs_tool_1", products: 5 });
	});

	it("TC-AIAUD-153: rows that only reorder photos already on the product, or set price / stock, do not count against the photo cap", async () => {
		const { staged, run } = setup();
		const rows = [
			...Array.from({ length: 5 }, (_, i) => row(String(i + 11), { images: [{ id: "att_9", alt: null }] })),
			...Array.from({ length: 6 }, (_, i) => row(String(i + 21), { price: 10 + i, inventory: 3 })),
		];

		const out = await run(input(rows));

		expect(out).toMatchObject({ changeSetId: "cs_tool_1", products: 11 });
		expect(staged).toHaveLength(1);
	});

	it("holds 1–20 products, only with shop_products, and never takes a negative or fractional stock", () => {
		const many = (n: number) => Array.from({ length: n }, (_, i) => row(String(i + 1)));
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: many(SHOP_PRODUCTS_SETUP_MAX) }).success).toBe(true);
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: many(SHOP_PRODUCTS_SETUP_MAX + 1) }).success).toBe(false);
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: [] }).success).toBe(false);
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: [row("1", { inventory: -1 })] }).success).toBe(false);
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: [row("1", { inventory: 1.5 })] }).success).toBe(false);
		expect(ShopProductsSetupInputSchema.safeParse({ reason: "why", products: [row("1", { status: "archived" })] }).success).toBe(false);

		expect(toolAllowed("propose_shop_products_setup", capabilitySet(["shop_products"]))).toBe(true);
		expect(toolAllowed("propose_shop_products_setup", capabilitySet(["site", "blog"]))).toBe(false);
		expect(Object.keys(createMerchantTools(setup().deps, capabilitySet(["site", "blog"])))).not.toContain("propose_shop_products_setup");
	});
});

describe("the finish-your-store guidance [TC-AIAUD-122]", () => {
	it("is in the instructions only where the tool is, and tells the model to ask once and never invent numbers", () => {
		const shop = merchantInstructions(capabilitySet(["shop_products"]));
		expect(shop).toContain("propose_shop_products_setup");
		expect(shop).toContain("ONE propose_shop_products_setup");
		expect(shop).toMatch(/Never put a number you invented in a row/);
		expect(shop).toMatch(/at most 3 questions in that one call/);
		expect(merchantInstructions(capabilitySet(["blog", "site"]))).not.toContain("propose_shop_products_setup");
	});

	it("names the setup list in store_todos' description and guidance, and no tool a set does not have", () => {
		const set = capabilitySet(["shop_products", "store_reports"]);
		const tools = createMerchantTools({ runId: "r" } as unknown as MerchantToolDeps, set) as unknown as Record<string, { description: string }>;
		expect(tools.store_todos?.description).toContain("`setup`");
		expect(tools.store_todos?.description).toContain("is my shop ready to sell");
		const text = merchantInstructions(set);
		expect(text).toContain("its separate `setup` list");
		expect(text).toContain("ready to sell");
		// reports without products: nothing about a tool it lacks
		expect(merchantInstructions(capabilitySet(["store_reports"]))).not.toContain("propose_shop_products_setup");
	});
});

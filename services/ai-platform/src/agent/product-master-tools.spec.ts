import { ChangeSetSchema, ProductUpdateInputSchema, productUpdateInput } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import { buildProductDraftsChangeSet, buildProductEditChangeSet, type ProductKnowledge, ProductDraftsInputSchema, UpdateInputSchema } from "./change-set-builders";
import { createMerchantTools, type MerchantToolDeps, productEditFromUpdate } from "./merchant-tools";

const ctx = { id: "cs_abc123def456", runId: "run_1", now: new Date("2026-10-20T08:00:00Z") };

const field = (code: string, label: string, dataType: string, options: Array<{ code: string; label: string }> = []) => ({
	attributeId: `pattr_${code}`,
	code,
	label,
	required: code === "item_name",
	collection: code === "tags",
	dataType,
	options,
});

const knowledge: ProductKnowledge = {
	family: { id: "pfam_tops", code: "apparel_tops", label: "Tops & Shirts" },
	fields: [
		field("apparel_fit", "Fit", "enum", [{ code: "regular", label: "Regular" }]),
		field("tags", "Tags", "string"),
		field("package_weight", "Shipping package weight", "measurement"),
		field("brand", "Brand", "commerce_entity_ref"),
	],
	resolved: [{ code: "apparel_fit", value: "regular", display: "Regular", source: "you" }],
	merchantText: "áo thun cotton 59 myr",
	images: [{ id: "img_1", ref: "asset:asset_shirt0001", url: "/api/agent/media/assets/asset_shirt0001/thumbnail", origin: "media", alt: "att_8ac720d6.jpg" }],
};

describe("product drafts: every field the merchant gave is saved [TC-AICP-82]", () => {
	const input = ProductDraftsInputSchema.parse({
		locale: "vi-VN",
		products: [
			{
				name: "Áo thun cotton PrimeLab Daily",
				description: "Áo thun 100% cotton.",
				familyCode: "apparel_tops",
				price: { amount: 59, currency: "MYR" },
				attributes: [
					{ code: "tags", value: "áo thun, cotton, basic" },
					{ code: "package_weight", value: "200", unit: "g" },
					{ code: "brand", value: "PrimeLab" },
					{ code: "purchase_price", value: "25", unit: "MYR" },
				],
				variants: { axes: [{ axis: "color", label: "Màu", values: ["Trắng", "Đen"] }, { axis: "size", label: "Size", values: ["S", "L"] }] },
				variantRows: [{ variant: "Trắng / L", price: 65 }, { variant: "Đỏ / XL", price: 70 }],
				imageIds: ["img_1"],
				imageAlts: [{ imageId: "img_1", alt: "Áo thun trắng trên móc" }],
				codes: [{ type: "ean", value: "8935001234562" }],
				seo: { title: "Áo thun cotton PrimeLab Daily", description: "Áo thun cotton thoáng mát, dáng regular, đủ size cho mỗi ngày." },
			},
		],
	});
	const cs = buildProductDraftsChangeSet(input, ctx, knowledge);
	const product = (cs.action?.payload.products as Array<Record<string, unknown>>)[0] as {
		attributes: Array<{ code: string }>;
		complete: { attributes: Array<{ code: string; value: string; unit: string | null }>; codes: unknown[]; rows: Array<Record<string, unknown>> };
		images: Array<{ alt?: string }>;
	};

	it("is a valid change set", () => {
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
	});

	it("keeps the question flow's answers on the old path and sends every value the model added through the checked one", () => {
		expect(product.attributes.map((a) => a.code)).toEqual(["apparel_fit"]);
		expect(product.complete.attributes).toEqual(
			expect.arrayContaining([
				{ code: "tags", value: "áo thun, cotton, basic", unit: null },
				{ code: "package_weight", value: "200", unit: "g" },
				{ code: "brand", value: "PrimeLab", unit: null },
				{ code: "purchase_price", value: "25", unit: "MYR" },
			]),
		);
		// this family has no SEO fields: said on the card, not saved, not shown as if it would be
		expect(product.complete.attributes.some((a) => a.code === "meta_title")).toBe(false);
		expect(cs.guardrails.some((g) => !g.ok && g.detail?.includes("SEO title and description are not fields of the family Tops & Shirts"))).toBe(true);
		expect(cs.drafts?.[0]?.type === "product" && cs.drafts[0].fields.some((f) => f.group === "seo")).toBe(false);
		expect(product.complete.codes).toEqual([{ type: "ean", value: "8935001234562", remove: false }]);
	});

	it("gives every drafted variant the SKU and price the card shows; an unknown variant is said, not guessed", () => {
		const rows = product.complete.rows;
		expect(rows).toHaveLength(4);
		expect(rows.find((r) => r.variant === "Trắng / L")).toMatchObject({ price: 65, currency: "MYR", sku: expect.stringMatching(/^AI-AO-THUN-COTTON-[A-Z0-9]+-TR-L$/) });
		expect(rows.find((r) => r.variant === "Đen / S")).toMatchObject({ price: 59, currency: "MYR" });
		expect(cs.drafts?.[0]?.type === "product" && cs.drafts[0].variants?.rows.find((r) => r.label === "Trắng / L")?.price).toBe("RM 65.00");
		expect(cs.guardrails.some((g) => !g.ok && g.detail?.includes("Đỏ / XL"))).toBe(true);
	});

	it("writes alt text only when the model wrote one (library names are file names)", () => {
		expect(product.images[0]?.alt).toBe("Áo thun trắng trên móc");
		const bare = buildProductDraftsChangeSet(ProductDraftsInputSchema.parse({ locale: "vi-VN", products: [{ name: "Áo", description: "", imageIds: ["img_1"] }] }), ctx, knowledge);
		expect((bare.action?.payload.products as Array<{ images: Array<{ alt?: string }> }>)[0]?.images[0]?.alt).toBeUndefined();
	});
});

const prepared = {
	title: "Edit product: Grey Shirt",
	why: "Hoàn thiện",
	risk: "high" as const,
	confirmText: "Grey Shirt",
	doc: { type: "product_edit" as const, name: "Grey Shirt", sections: [{ key: "basics", rows: [{ label: "Brand", before: null, after: "PrimeLab" }] }] },
	diffs: [{ entity: { kind: "product", id: "prod_1", label: "Grey Shirt" }, field: "Brand", before: null, after: "PrimeLab" }],
	guardrails: [{ rule: "typed_confirm", ok: true, detail: "To approve, type “Grey Shirt”." }],
	plan: { productId: "prod_1", label: "1 change", steps: [{ op: "draft" }] },
};

describe("Product Master edits are staged from prime-web's draft [TC-AICP-83]", () => {
	it("builds a product_master.update change set with the review doc and the typed confirmation", () => {
		const cs = buildProductEditChangeSet(prepared, ctx);
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs).toMatchObject({ domain: "products", risk: "high", confirmText: "Grey Shirt", action: { kind: "product_master.update", payload: prepared.plan } });
		expect(cs.drafts?.[0]?.type).toBe("product_edit");
	});
});

function deps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	let edits = 0;
	return {
		runId: "run_1",
		newChangeSetId: () => "cs_new",
		now: () => ctx.now,
		stage: vi.fn(async () => undefined),
		productKnowledge: async () => ({}),
		images: () => [],
		findImages: async () => [],
		generateImages: async () => ({}),
		inventoryRead: async () => ({}),
		inventoryPrepare: async () => ({ error: "x" }),
		productPrepare: vi.fn(async () => prepared),
		productPreparePublish: vi.fn(async () => prepared),
		snapshot: async () => ({ error: "x" }),
		allowEdit: () => ++edits <= 10,
		seenProducts: () => [],
		readItem: async () => ({}),
		searchItems: async () => ({}),
		currentPage: async () => ({}),
		createdInChat: () => [],
		siteRead: async () => ({}),
		sitePrepare: async () => ({ error: "x" }),
		storeCategories: async () => ({}),
		storeDiscounts: async () => ({}),
		storeCustomers: async () => ({}),
		...overrides,
	};
}

const call = (tools: ReturnType<typeof createMerchantTools>, name: "propose_product_update" | "propose_update", input: unknown) =>
	(tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });

describe("propose_product_update [TC-AICP-84]", () => {
	const input = ProductUpdateInputSchema.parse(productUpdateInput({ id: "prod_1", why: "Hoàn thiện", attributes: [{ code: "brand", value: "PrimeLab", unit: null }] }));

	it("stages prime-web's draft and tells the model the merchant confirms Yes / No", async () => {
		const d = deps();
		const out = await call(createMerchantTools(d), "propose_product_update", input);
		expect(d.productPrepare).toHaveBeenCalledWith(input);
		expect(d.stage).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ kind: "product_master.update" }) }));
		expect(out).toMatchObject({ changeSetId: "cs_new", changes: 1 });
		expect(String(out.note)).toContain("Approving asks the merchant Yes / No first.");
	});

	it("passes prime-web's refusal back to the model and stages nothing", async () => {
		const d = deps({ productPrepare: vi.fn(async () => ({ error: { code: "no_change", message: "Nothing would change" } })) });
		expect(await call(createMerchantTools(d), "propose_product_update", input)).toEqual({ error: { code: "no_change", message: "Nothing would change" } });
		expect(d.stage).not.toHaveBeenCalled();
	});

	it("stages publishing from prime-web's draft, counted as an edit, the Yes / No confirm in the note", async () => {
		const d = deps();
		const tools = createMerchantTools(d);
		const out = await (tools.propose_product_publish as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute({ id: "prod_1", why: "đăng", channels: ["Shopee"] }, { toolCallId: "t", messages: [] });
		expect(d.productPreparePublish).toHaveBeenCalledWith({ id: "prod_1", why: "đăng", channels: ["Shopee"] });
		expect(d.stage).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ kind: "product_master.update" }), confirmText: "Grey Shirt" }));
		expect(String(out.note)).toContain("Approving asks the merchant Yes / No first.");
	});

	it("stops after 10 changes to existing records in one request", async () => {
		const d = deps({ allowEdit: () => false });
		expect(await call(createMerchantTools(d), "propose_product_update", input)).toMatchObject({ error: { code: "limit" } });
		expect(d.productPrepare).not.toHaveBeenCalled();
	});

	it("routes the old product shape of propose_update to the same Product Master edit", async () => {
		const update = UpdateInputSchema.parse({
			kind: "product",
			id: "prod_1",
			reason: "đổi tên",
			changes: { name: "Áo mới", description: null, attributes: [{ code: "apparel_fit", value: "relaxed" }], title: null, contentHtml: null, seoTitle: null, seoDescription: null, coverImageId: null },
		});
		expect(productEditFromUpdate(update).attributes).toEqual([
			{ code: "item_name", value: "Áo mới", unit: null },
			{ code: "apparel_fit", value: "relaxed", unit: null },
		]);
		const d = deps();
		await call(createMerchantTools(d), "propose_update", update);
		expect(d.productPrepare).toHaveBeenCalledWith(expect.objectContaining({ id: "prod_1", why: "đổi tên" }));
	});
});

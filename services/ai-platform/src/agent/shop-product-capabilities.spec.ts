import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type Capability, parseCapabilityList } from "../config/capabilities";
import { parseEnv } from "../config/env";
import {
	ALL_CAPABILITIES,
	capabilityKey,
	capabilitySet,
	effectiveCapabilities,
	TOOL_CAPABILITIES,
	type MerchantToolName,
} from "./merchant-capabilities";
import { MERCHANT_INSTRUCTIONS, merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";

const baseEnv = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
};

const set = (...capabilities: Capability[]) => capabilitySet(capabilities);
const deps = () => ({ stage: vi.fn(), newChangeSetId: () => "cs_1", now: () => new Date(), runId: "run_1" }) as unknown as MerchantToolDeps;
const names = (capabilities: ReturnType<typeof set>) => Object.keys(createMerchantTools(deps(), capabilities));
const jsonSchema = (schema: unknown) => z.toJSONSchema(schema as z.ZodType, { io: "input", unrepresentable: "any" }) as Record<string, any>;
const tool = (capabilities: ReturnType<typeof set>, name: MerchantToolName) =>
	(createMerchantTools(deps(), capabilities) as unknown as Record<string, { description: string; inputSchema: z.ZodType }>)[name] as { description: string; inputSchema: z.ZodType };

const SHOP_TOOLS = ["propose_shop_product_update", "propose_shop_product_status", "propose_shop_product_drafts", "propose_shop_products_setup"];
const STAGING: Capability[] = ["site", "blog", "stock_photos", "shop_products"];

describe("shop_products capability config [TC-AIREL-51]", () => {
	it("is opt-in: unset AI_AGENT_CAPABILITIES keeps today's set, without the Payload product tools", () => {
		// Arrange / Act
		const unset = parseEnv(baseEnv);

		// Assert
		expect(unset.AI_AGENT_CAPABILITIES).toBeUndefined();
		expect(capabilitySet(unset.AI_AGENT_CAPABILITIES)).toBe(ALL_CAPABILITIES);
		expect(ALL_CAPABILITIES.has("shop_products")).toBe(false);
		// every tool except the opt-in shop_products ones (counted from the map, so a new tool does not need a new number)
		expect(names(ALL_CAPABILITIES)).toHaveLength(Object.keys(TOOL_CAPABILITIES).length - SHOP_TOOLS.length);
		for (const name of SHOP_TOOLS) expect(names(ALL_CAPABILITIES)).not.toContain(name);
		expect(MERCHANT_INSTRUCTIONS).not.toMatch(/shop_product|Payload/);
	});

	it("takes the staging value site,blog,stock_photos,shop_products in canonical order", () => {
		expect(parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "shop_products, stock_photos,blog,site" }).AI_AGENT_CAPABILITIES).toEqual(["site", "blog", "stock_photos", "shop_products"]);
		expect(capabilityKey(set(...STAGING))).toBe("site,blog,stock_photos,shop_products");
	});

	it("stops boot when shop_products meets product_master or store_products", () => {
		expect(() => parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "site,product_master,shop_products" })).toThrow(/shop_products cannot be combined with product_master/);
		expect(() => parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "shop_products,product_master,store_products" })).toThrow(/cannot be combined with product_master/);
		expect(parseCapabilityList("shop_products,inventory")).toEqual({ capabilities: ["inventory", "shop_products"] });
	});

	it("keeps a hand-built set coherent: shop_products loses against Product Master; a claim never adds it", () => {
		expect(capabilityKey(set("product_master", "shop_products"))).toBe("product_master");
		expect(capabilityKey(effectiveCapabilities(["site"], ["site", "shop_products"]))).toBe("site");
		expect(capabilityKey(effectiveCapabilities(["site", "shop_products"], ["shop_products"]))).toBe("shop_products");
	});
});

describe("tools per set with shop_products [TC-AIREL-52]", () => {
	it("maps the four Payload product tools to shop_products only", () => {
		for (const name of SHOP_TOOLS) expect(TOOL_CAPABILITIES[name as MerchantToolName]).toEqual(["shop_products"]);
		expect(TOOL_CAPABILITIES.read_item).toContain("shop_products");
		expect(TOOL_CAPABILITIES.search_items).toContain("shop_products");
		// status changes of products are propose_shop_product_status; the Product Master tool stays out
		expect(TOOL_CAPABILITIES.propose_status_change).not.toContain("shop_products");
	});

	it("offers the staging set the site and blog tools, the item reads and the shop product tools, in a stable order", () => {
		const staging = names(set(...STAGING));
		expect(staging).toEqual([
			"ask_user", "find_images", "read_item", "search_items", "current_page", "propose_update", "propose_status_change", "propose_blog_post",
			"site_read", "propose_page_patch", "propose_site_patch", "propose_new_page", "propose_page_seo", "propose_page_translation", "propose_theme_change", "propose_navigation", "propose_site_languages", "propose_publish",
			...SHOP_TOOLS,
		]);
		for (const hidden of ["propose_product_drafts", "propose_product_update", "propose_product_publish", "propose_store_products", "inventory_read", "generate_image"]) {
			expect(staging).not.toContain(hidden);
		}
	});

	it("offers shop_products alone the reads, the four tools and ask_user / current_page", () => {
		expect(names(set("shop_products"))).toEqual(["ask_user", "read_item", "search_items", "current_page", ...SHOP_TOOLS]);
	});
});

describe("narrowed schemas with shop_products [TC-AIREL-53]", () => {
	const kinds = (capabilities: ReturnType<typeof set>, name: MerchantToolName) => jsonSchema(tool(capabilities, name).inputSchema).properties.kind.enum;

	it("lets the item reads name products, and keeps the blog-only write tools off the product kind", () => {
		expect(kinds(set("shop_products"), "read_item")).toEqual(["product"]);
		expect(kinds(set("shop_products"), "search_items")).toEqual(["product"]);
		expect(kinds(set("shop_products", "blog"), "read_item")).toEqual(["product", "blog_post"]);
		expect(kinds(set("shop_products", "blog"), "propose_update")).toEqual(["blog_post"]);
		expect(kinds(set("shop_products", "blog"), "propose_status_change")).toEqual(["blog_post"]);
		expect(jsonSchema(tool(set("shop_products", "blog"), "propose_status_change").inputSchema).properties.action.enum).toEqual(["restore", "publish", "unpublish", "trash"]);
	});

	it("words the reads for shop products without Product Master talk", () => {
		const read = tool(set("shop_products"), "read_item").description;
		expect(read).toContain("descriptions, price, stock, category, tags, photos");
		expect(read).not.toMatch(/Product Master|attributes|variants/);
		expect(tool(set("shop_products"), "search_items").description).toContain("check whether a product already exists");
	});

	it("points find_images at the shop product tools", () => {
		const description = tool(set("stock_photos", "shop_products"), "find_images").description;
		expect(description).toContain("for a product");
		expect(description).toContain("propose_shop_product_update / propose_shop_product_drafts");
		expect(description).not.toMatch(/imageIds|propose_product_update/);
	});

	it("takes strict, null-for-keep inputs with the collection's limits", () => {
		const update = jsonSchema(tool(set("shop_products"), "propose_shop_product_update").inputSchema);
		const changes = update.properties.changes;
		expect(changes.required.sort()).toEqual(Object.keys(changes.properties).sort());
		expect(changes.properties.seoTitle.anyOf[0].maxLength).toBe(60);
		expect(changes.properties.seoDescription.anyOf[0].maxLength).toBe(160);
		expect(changes.properties.name.anyOf[0].minLength).toBe(3);
		expect(changes.properties.price.anyOf[0].maximum).toBe(100_000_000);
		expect(changes.properties.inventory.anyOf[0].maximum).toBe(1_000_000);
		const status = jsonSchema(tool(set("shop_products"), "propose_shop_product_status").inputSchema);
		expect(status.properties.status.enum).toEqual(["active", "draft", "archived", "trash"]);
		const drafts = jsonSchema(tool(set("shop_products"), "propose_shop_product_drafts").inputSchema);
		expect(drafts.properties.products).toMatchObject({ minItems: 1, maxItems: 20 });
	});
});

describe("instructions with shop_products [TC-AIREL-54]", () => {
	const sets: Array<[string, Capability[]]> = [
		["shop_products alone", ["shop_products"]],
		["staging (site, blog, stock photos, shop_products)", STAGING],
		["shop_products + image generation + media library", ["shop_products", "image_generation", "media_library"]],
	];

	it.each(sets)("never names a tool that %s does not offer", (_label, capabilities) => {
		const text = merchantInstructions(set(...capabilities));
		const offered = new Set(names(set(...capabilities)));
		for (const name of Object.keys(TOOL_CAPABILITIES)) {
			if (!offered.has(name)) expect(text, name).not.toContain(name);
		}
		expect(text).not.toMatch(/undefined|\[object/);
	});

	it("describes the Payload product world in the shop's own words, with none of the Product Master one", () => {
		const text = merchantInstructions(set(...STAGING));
		for (const tool of SHOP_TOOLS) expect(text).toContain(tool);
		expect(text).toContain("the shop's own products, blog posts and website pages, draft new ones, and draft edits, archiving or trashing of existing ones");
		expect(text).toContain("At most 20 new products per request");
		expect(text).toContain('"products" (or "store") = the product list and product pages');
		expect(text).toContain("search_items also lists the shop's categories");
		expect(text).toContain("propose_shop_product_update for a product, propose_update for a post");
		expect(text).toContain("one record per propose_update / propose_shop_product_update / propose_status_change / propose_shop_product_status call");
		expect(text).not.toMatch(/Product Master|Product Store|SSOT|channel|marketplace|variants|inventory_read|product_details|pm:<id>|family/);
	});

	it("keeps Product Master and the blog's status tool apart from the shop product status tool", () => {
		const blogOnly = merchantInstructions(set("shop_products", "blog"));
		expect(blogOnly).toContain("propose_status_change — blog post: publish / unpublish / trash / restore");
		expect(blogOnly).not.toContain("product: archive / restore");
		const shopOnly = merchantInstructions(set("shop_products"));
		expect(shopOnly).not.toContain("propose_status_change");
		expect(shopOnly).toContain("one record per propose_shop_product_update / propose_shop_product_status call (all of a product's changes in that one call)");
		expect(shopOnly).toContain("Never put a picture made for something else in this chat");
	});

	it("leaves the default and Product Master texts as they were", () => {
		expect(merchantInstructions(ALL_CAPABILITIES)).toBe(MERCHANT_INSTRUCTIONS);
		expect(merchantInstructions(set("product_master", "store_products", "site"))).not.toMatch(/shop_product|Payload/);
		expect(capabilityKey(set("product_master", "shop_products"))).toBe("product_master");
	});
});

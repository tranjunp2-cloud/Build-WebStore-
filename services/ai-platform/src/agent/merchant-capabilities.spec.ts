import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CAPABILITIES, type Capability, parseCapabilityList } from "../config/capabilities";
import { parseEnv } from "../config/env";
import { askUserInputSchemaFor, askUserToolFor } from "./ask/ask-tool";
import {
	ALL_CAPABILITIES,
	capabilityKey,
	capabilitySet,
	effectiveCapabilities,
	TOOL_CAPABILITIES,
	type MerchantToolName,
} from "./merchant-capabilities";
import { MERCHANT_INSTRUCTIONS, merchantInstructions } from "./merchant-instructions";
import { askUserOptions, createMerchantTools, type MerchantToolDeps, pagePatchRequest } from "./merchant-tools";

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

describe("AI_AGENT_CAPABILITIES [TC-AIREL-30]", () => {
	it("is unset = every capability (today's behaviour), and parses a comma list in canonical order", () => {
		// Arrange / Act
		const unset = parseEnv(baseEnv);
		const listed = parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: " blog , site,stock_photos,,site " });
		const blank = parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "" });

		// Assert
		expect(unset.AI_AGENT_CAPABILITIES).toBeUndefined();
		expect(blank.AI_AGENT_CAPABILITIES).toBeUndefined();
		expect(listed.AI_AGENT_CAPABILITIES).toEqual(["site", "blog", "stock_photos"]);
		expect(capabilitySet(unset.AI_AGENT_CAPABILITIES)).toBe(ALL_CAPABILITIES);
	});

	it("refuses a typo, an empty list and store_products without product_master, so a misconfiguration is loud", () => {
		expect(() => parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "site,stock_photo" })).toThrow(/unknown capability stock_photo/);
		expect(() => parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: " , " })).toThrow(/list at least one/);
		expect(() => parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "site,store_products" })).toThrow(/store_products needs product_master/);
		expect(parseCapabilityList("product_master,store_products")).toEqual({ capabilities: ["product_master", "store_products"] });
	});

	it("keeps the staging value valid: site, blog and stock photos", () => {
		expect(parseEnv({ ...baseEnv, AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }).AI_AGENT_CAPABILITIES).toEqual(["site", "blog", "stock_photos"]);
	});
});

describe("effective capabilities of a request [TC-AIREL-31]", () => {
	it("is the server set when the token carries no claim", () => {
		expect(effectiveCapabilities(undefined, undefined)).toBe(ALL_CAPABILITIES);
		expect(capabilityKey(effectiveCapabilities(["site", "blog"], undefined))).toBe("site,blog");
	});

	it("lets the signed claim narrow the server set but never widen it, ignoring unknown names", () => {
		const narrowed = effectiveCapabilities(["site", "blog", "stock_photos"], ["blog", "inventory", "made_up"]);
		expect(capabilityKey(narrowed)).toBe("blog");
		expect(capabilityKey(effectiveCapabilities(undefined, ["site", "inventory"]))).toBe("site,inventory");
		// an empty claim leaves only the tools that need no shop data
		expect(names(effectiveCapabilities(["site", "blog"], []))).toEqual(["ask_user", "current_page"]);
	});

	it("drops store_products when product_master is not in the effective set", () => {
		expect(capabilityKey(effectiveCapabilities(["product_master", "store_products"], ["store_products"]))).toBe("");
		expect(capabilityKey(set("store_products", "site"))).toBe("site");
	});
});

describe("tools per capability set [TC-AIREL-32]", () => {
	it("maps exactly the tools createMerchantTools builds, in the original order, and the full set offers all of them", () => {
		// Arrange
		const all = createMerchantTools(deps());
		// the Payload product tools (opt-in shop_products) are mapped too, but never in the default set
		const shopOnly = names(set("shop_products")).filter((name) => !Object.keys(all).includes(name));

		// Act
		const offered = names(ALL_CAPABILITIES);

		// Assert
		expect(Object.keys(TOOL_CAPABILITIES).sort()).toEqual([...Object.keys(all), ...shopOnly].sort());
		expect(shopOnly).toEqual(["propose_shop_product_update", "propose_shop_product_status", "propose_shop_product_drafts", "propose_shop_products_setup"]);
		expect(offered).toEqual(Object.keys(all));
		// everything except the opt-in shop_products tools (counted from the map: a new tool needs no new number here)
		expect(offered).toHaveLength(Object.keys(TOOL_CAPABILITIES).length - shopOnly.length);
	});

	it.each<[string, Capability[], string[]]>([
		["nothing", [], ["ask_user", "current_page"]],
		[
			"site",
			["site"],
			["ask_user", "current_page", "site_read", "propose_page_patch", "propose_site_patch", "propose_new_page", "propose_page_seo", "propose_page_translation", "propose_theme_change", "propose_navigation", "propose_site_languages", "propose_publish"],
		],
		["blog + stock photos", ["blog", "stock_photos"], ["ask_user", "find_images", "read_item", "search_items", "current_page", "propose_update", "propose_status_change", "propose_blog_post"]],
		["stock photos only", ["stock_photos"], ["ask_user", "find_images", "current_page"]],
		["image generation only", ["image_generation"], ["ask_user", "generate_image", "current_page"]],
		["inventory", ["inventory"], ["ask_user", "current_page", "inventory_read", "propose_inventory"]],
		[
			"product master + store",
			["product_master", "store_products"],
			["ask_user", "read_item", "search_items", "current_page", "propose_product_drafts", "propose_product_update", "propose_product_publish", "propose_status_change", "propose_store_products"],
		],
	])("offers for %s only the tools it unlocks", (_label, capabilities, expected) => {
		// ask_user / current_page first, then the rest in createMerchantTools' order
		const order = Object.keys(createMerchantTools(deps()));
		expect(names(set(...capabilities))).toEqual(order.filter((name) => expected.includes(name)));
	});

	it("hides the Product Master, inventory and store tools from the staging set", () => {
		const staging = names(set("site", "blog", "stock_photos"));
		for (const hidden of ["propose_product_drafts", "propose_product_update", "propose_product_publish", "inventory_read", "propose_inventory", "propose_store_products", "generate_image"]) {
			expect(staging).not.toContain(hidden);
		}
		for (const kept of ["ask_user", "find_images", "current_page", "propose_blog_post", "propose_update", "propose_status_change", "site_read", "propose_publish"]) {
			expect(staging).toContain(kept);
		}
	});
});

describe("narrowed tool schemas [TC-AIREL-33]", () => {
	it("narrows the kind of read_item, search_items, propose_update and propose_status_change to what the set can read", () => {
		const kinds = (capabilities: ReturnType<typeof set>, name: MerchantToolName) => jsonSchema(tool(capabilities, name).inputSchema).properties.kind.enum;

		expect(kinds(set("blog", "site"), "read_item")).toEqual(["blog_post"]);
		expect(kinds(set("blog"), "search_items")).toEqual(["blog_post"]);
		expect(kinds(set("blog"), "propose_update")).toEqual(["blog_post"]);
		expect(kinds(set("blog"), "propose_status_change")).toEqual(["blog_post"]);
		expect(kinds(set("product_master"), "read_item")).toEqual(["product"]);
		expect(kinds(set("product_master"), "propose_status_change")).toEqual(["product"]);
		expect(kinds(set("product_master", "blog"), "read_item")).toEqual(["product", "blog_post"]);
	});

	it("narrows the status actions and the tool text to the same kinds, and leaves the full set's schema untouched", () => {
		const blogOnly = tool(set("blog"), "propose_status_change");
		expect(jsonSchema(blogOnly.inputSchema).properties.action.enum).toEqual(["restore", "publish", "unpublish", "trash"]);
		expect(blogOnly.description).not.toMatch(/product/i);
		expect(tool(set("blog"), "read_item").description).not.toMatch(/Product Master/);
		expect(tool(set("blog"), "propose_update").description).not.toMatch(/propose_product_update/);
		const full = tool(ALL_CAPABILITIES, "propose_status_change");
		expect(jsonSchema(full.inputSchema).properties.action.enum).toEqual(["archive", "restore", "publish", "unpublish", "trash"]);
		expect(full.description).toMatch(/archiving \/ restoring ONE product/);
	});

	it("narrows find_images to the photo sources the set has", () => {
		const source = (capabilities: ReturnType<typeof set>) => jsonSchema(tool(capabilities, "find_images").inputSchema).properties.source.enum;
		expect(source(set("stock_photos"))).toEqual(["stock"]);
		expect(source(set("media_library"))).toEqual(["library"]);
		expect(source(set("stock_photos", "media_library"))).toEqual(["stock", "library"]);
		const description = tool(set("stock_photos", "site"), "find_images").description;
		expect(description).toContain("stock photos (Pixabay)");
		expect(description).not.toMatch(/media library|propose_blog_post|photos of a product/);
		expect(description).toContain("set_image op of propose_page_patch");
	});
});

describe("page patch addToStore and ask_user narrowing [TC-AIREL-34]", () => {
	it("offers addToStore on a page patch only with store_products, and a patch without it still builds", () => {
		const properties = (capabilities: ReturnType<typeof set>) => Object.keys(jsonSchema(tool(capabilities, "propose_page_patch").inputSchema).properties);
		expect(properties(set("site"))).not.toContain("addToStore");
		expect(properties(set("site", "product_master"))).not.toContain("addToStore");
		expect(properties(set("site", "product_master", "store_products"))).toContain("addToStore");

		const request = pagePatchRequest({ siteId: "5", pageId: "p1", why: "w", ops: [{ op: "remove_block", blockId: "b1" } as never] });
		expect(request).toMatchObject({ siteId: "5", pageId: "p1" });
		expect(request).not.toHaveProperty("addToStore");
	});

	it("takes the product_details purpose away from ask_user without product_master, and keeps custom questions working", () => {
		// Arrange
		const without = askUserInputSchemaFor(askUserOptions(set("site", "blog", "stock_photos")));
		const custom = { purpose: "custom", product: null, questions: [{ id: "angle", title: "Which angle?", why: null, options: [], multiple: false, pictures: null }] };

		// Act / Assert
		expect(without.safeParse(custom).success).toBe(true);
		expect(without.safeParse({ ...custom, purpose: "product_details", product: { name: "x", facts: [], variants: "none", variantAxes: [] } }).success).toBe(false);
		expect(jsonSchema(without).properties.purpose.enum).toEqual(["custom"]);
		expect(askUserToolFor(askUserOptions(set("blog"))).description).not.toMatch(/product_details|catalog/);
	});

	it("offers ask_user photo questions only for the sources the set has, and none without any", () => {
		const question = (capabilities: ReturnType<typeof set>) => jsonSchema(askUserInputSchemaFor(askUserOptions(capabilities))).properties.questions.items.properties.pictures;
		expect(question(set("stock_photos")).anyOf[0].properties.source.enum).toEqual(["stock"]);
		expect(question(set("media_library")).anyOf[0].properties.source.enum).toEqual(["library"]);
		expect(question(set("stock_photos", "media_library")).anyOf[0].properties.source.enum).toEqual(["stock", "library", "both"]);
		expect(question(set("site"))).toMatchObject({ type: "null" });
	});

	it("hands the original ask_user tool to the full set", () => {
		expect(askUserToolFor(askUserOptions(ALL_CAPABILITIES))).toBe(createMerchantTools(deps()).ask_user);
	});
});

describe("instructions per capability set [TC-AIREL-35]", () => {
	const sets: Array<[string, Capability[]]> = [
		["nothing", []],
		["staging (site, blog, stock photos)", ["site", "blog", "stock_photos"]],
		["site only", ["site"]],
		["blog + media", ["blog", "media_library", "image_generation"]],
		["product master", ["product_master"]],
		["inventory", ["inventory"]],
		["product master + store + site", ["product_master", "store_products", "site"]],
	];

	it("renders the full set as MERCHANT_INSTRUCTIONS, once per set, with the same bytes for equal sets", () => {
		expect(merchantInstructions(ALL_CAPABILITIES)).toBe(MERCHANT_INSTRUCTIONS);
		expect(merchantInstructions(set(...CAPABILITIES))).toBe(MERCHANT_INSTRUCTIONS);
		expect(merchantInstructions(set("site", "blog"))).toBe(merchantInstructions(set("blog", "site")));
		expect(merchantInstructions(set("site"))).not.toBe(merchantInstructions(set("blog")));
		expect(MERCHANT_INSTRUCTIONS).toContain("propose_inventory");
		expect(MERCHANT_INSTRUCTIONS).toContain('ask_user — ask before drafting. For a product, call it once with purpose "product_details"');
	});

	it.each(sets)("never names a tool that %s does not offer", (_label, capabilities) => {
		// Arrange
		const text = merchantInstructions(set(...capabilities));
		const offered = new Set(names(set(...capabilities)));

		// Assert
		for (const tool of Object.keys(TOOL_CAPABILITIES)) {
			if (!offered.has(tool)) expect(text, tool).not.toContain(tool);
		}
		expect(text).not.toMatch(/undefined|\[object/);
	});

	it("describes the product, store and inventory worlds only where the set has them", () => {
		const staging = merchantInstructions(set("site", "blog", "stock_photos"));
		expect(staging).not.toMatch(/Product Master|Product Store|inventory|archive|"product_details"|pm:<id>|generate pictures|media library/);
		expect(staging).toContain("blog posts and website pages");
		expect(staging).toContain("stock photos (Pixabay)");
		expect(staging).toContain('Use purpose "custom" with at most 3 questions');
		expect(staging).toContain('"editor" = the site editor, "dashboard" = the home screen');
		const store = merchantInstructions(set("product_master", "store_products"));
		expect(store).toContain('"store" = Product Store');
		expect(merchantInstructions(set("product_master"))).not.toContain("Product Store");
		expect(merchantInstructions(set("site", "product_master"))).not.toContain("pm:<id>");
		expect(merchantInstructions(set("site", "product_master", "store_products"))).toContain("pm:<id>");
	});
});

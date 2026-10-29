import { describe, expect, it } from "vitest";
import type { Capability } from "../config/capabilities";
import { ALL_CAPABILITIES, capabilityKey, capabilitySet } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { availableGroups, groupsInUserTurn, routedCapabilities, routeGroups, ToolRouter, USE_TOOLS } from "./tool-routing";

// TC-AISEC-080 — tool routing picks the groups a message needs (page, record, words in en / ms / vi, the
// To do task), never more than the deployment allows, and a chat's set only grows (its history prefix keeps
// hitting the prompt cache).

const STAGING: Capability[] = [
	"site",
	"blog",
	"stock_photos",
	"media_library",
	"image_generation",
	"shop_products",
	"store_categories",
	"store_discounts",
	"store_customers",
	"campaigns",
	"store_orders",
	"store_reports",
];
const full = capabilitySet(STAGING);
const turn = (module: string, request: string, extra = "") =>
	`Context: the merchant is on "${module}" (address "/${module}", module "${module}")${extra}, UI locale en-MY. Today is 2026-10-22.\n\n${request}`;

describe("routing a message to tool groups [TC-AISEC-080]", () => {
	it("routes by the page's module, never by the Context line's words", () => {
		// Arrange
		const turns = { editor: turn("editor", "hi"), orders: turn("orders", "hi"), dashboard: turn("dashboard", "hi"), leads: turn("contact-leads", "hi") };

		// Act
		const groups = Object.fromEntries(Object.entries(turns).map(([key, text]) => [key, [...groupsInUserTurn(text)]]));

		// Assert: "Today is …" on every Context line does not load the reports outside the dashboard
		expect(groups).toEqual({ editor: ["website"], orders: ["orders"], dashboard: ["reports"], leads: ["customers"] });
	});

	it("matches what the merchant asks for in English, Malay and Vietnamese", () => {
		// Arrange
		const asked = {
			en: "Create a 10% discount code for this weekend",
			ms: "Berapa jualan hari ini?",
			vi: "Xác nhận các đơn hàng đang chờ",
			viBlog: "Viết bài blog về cà phê",
			msProduct: "Tukar harga produk batik",
		};

		// Act
		const groups = Object.fromEntries(Object.entries(asked).map(([key, text]) => [key, routeGroups({ turns: [text] })]));

		// Assert
		expect(groups.en).toContain("discounts");
		expect(groups.ms).toContain("reports");
		expect(groups.vi).toContain("orders");
		expect(groups.viBlog).toContain("blog");
		expect(groups.msProduct).toContain("products");
		// "đơn giản" (simple) is not an order
		expect(routeGroups({ turns: ["Viết ngắn gọn, đơn giản"] })).not.toContain("orders");
	});

	it("reads the record, the Ask AI picks, attached files and the To do task", () => {
		// Arrange + Act
		const post = groupsInUserTurn(turn("dashboard", "shorter please", ', viewing blog post id "12" ("Batik care")'));
		const picked = groupsInUserTurn(`${turn("editor", "this one").replace("\n\n", '\nSelected on the page (the merchant means exactly these): button "Shop now"\n\n')}`);
		const files = groupsInUserTurn(turn("dashboard", "add these").replace("\n\n", "\nAttached: att_1 (image: a.png); att_2 (document: list.csv)\n\n"));
		const task = routeGroups({ turns: ["fix it"], taskKey: "payment_proofs" });

		// Assert
		expect([...post]).toContain("blog");
		expect([...picked]).toContain("website");
		expect([...files]).toEqual(expect.arrayContaining(["pictures", "products"]));
		expect(task).toEqual(["orders"]);
	});

	it("keeps a chat's groups growing: a later turn has every group of the earlier ones", () => {
		// Arrange
		const first = turn("discounts", "Create a 10% code");
		const second = turn("dashboard", "yes please");
		const third = turn("dashboard", "thanks");

		// Act
		const one = routeGroups({ turns: [first] });
		const two = routeGroups({ turns: [first, second], replies: ["Done.\n<staged_draft id=\"cs_1\">Discount code WEEKEND10</staged_draft>"] });
		const three = routeGroups({ turns: [first, second, third], replies: ["Done.\n<staged_draft id=\"cs_1\">Discount code WEEKEND10</staged_draft>", "Glad to help."] });

		// Assert
		for (const group of one) expect(two).toContain(group);
		expect(three).toEqual(two);
	});

	it("never loads a capability the deployment does not have, and pictures come with content", () => {
		// Arrange
		const small = capabilitySet(["site", "blog", "stock_photos"]);

		// Act
		const orders = routedCapabilities(["orders"], small);
		const blog = routedCapabilities(["blog"], full);
		const campaign = routedCapabilities(["campaigns"], capabilitySet(["campaigns", "store_discounts"]));

		// Assert
		expect(capabilityKey(orders)).toBe("");
		expect(capabilityKey(blog)).toBe("blog,stock_photos,media_library,image_generation");
		// campaigns needs site: without it the group loads only what is allowed
		expect([...campaign]).not.toContain("campaigns");
		expect(availableGroups(small)).toEqual(["website", "blog", "pictures"]);
	});

	it("is complete (sent exactly as unrouted, no use_tools) once every group is loaded", () => {
		// Arrange
		const router = new ToolRouter(full, { groups: [] });

		// Act
		const before = router.sentTools(["ask_user", "current_page", "store_orders", USE_TOOLS]);
		router.load(availableGroups(full));

		// Assert
		expect([...before]).toEqual(["ask_user", "current_page", USE_TOOLS]);
		expect(router.complete).toBe(true);
		expect(router.capabilities).toBe(full);
		expect(router.sentTools(["ask_user", "store_orders", USE_TOOLS]).has(USE_TOOLS)).toBe(false);
		expect(merchantInstructions(router.capabilities, full)).toBe(merchantInstructions(full));
		expect(merchantInstructions(ALL_CAPABILITIES, ALL_CAPABILITIES)).toBe(merchantInstructions());
	});
});

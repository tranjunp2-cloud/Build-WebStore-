import { describe, expect, it } from "vitest";
import { entityFromPath } from "./page-entity";

// TC-AICP-53 — the copilot knows which record the merchant is looking at.

describe("entityFromPath [TC-AICP-53]", () => {
	it("maps dashboard and portal detail pages to the record they show", () => {
		expect(entityFromPath("/blog/42", "dashboard")).toEqual({ kind: "blog_post", id: "42" });
		expect(entityFromPath("/catalog/products/prod_01abc", "dashboard")).toEqual({ kind: "product", id: "prod_01abc" });
		expect(entityFromPath("/products/prod_01abc/edit", "portal")).toEqual({ kind: "product", id: "prod_01abc" });
	});

	it("ignores list, create and category pages", () => {
		expect(entityFromPath("/blog", "dashboard")).toBeUndefined();
		expect(entityFromPath("/blog/new", "dashboard")).toBeUndefined();
		expect(entityFromPath("/blog/categories", "dashboard")).toBeUndefined();
		expect(entityFromPath("/products/new", "portal")).toBeUndefined();
	});
});

// TC-AIREL-50 — a deployment whose products are Payload products: /products/:id is a product, /products the list.

describe("entityFromPath for a shop (Payload products) deployment [TC-AIREL-50]", () => {
	it("maps /products/:id to a product and keeps the blog route", () => {
		expect(entityFromPath("/products/42", "shop")).toEqual({ kind: "product", id: "42" });
		expect(entityFromPath("/products/42?tab=seo", "shop")).toEqual({ kind: "product", id: "42" });
		expect(entityFromPath("/blog/7", "shop")).toEqual({ kind: "blog_post", id: "7" });
	});

	it("ignores the list, new-product and category pages, and the Product Master route", () => {
		expect(entityFromPath("/products", "shop")).toBeUndefined();
		expect(entityFromPath("/products/new", "shop")).toBeUndefined();
		expect(entityFromPath("/products/categories", "shop")).toBeUndefined();
		expect(entityFromPath("/catalog/products/prod_01abc", "shop")).toBeUndefined();
	});

	it("leaves the dashboard surface alone: there /products/:id is not a Product Master product", () => {
		expect(entityFromPath("/products/42", "dashboard")).toBeUndefined();
	});
});

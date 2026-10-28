import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AICP-247 — an applied card for a store record (discount, category, order, customer, lead, email template)
// names what its link opens ("Open discount"), never "Open in editor"; with no link the action is not shown.

const applied = (kind: string, links: Array<{ label: string; href: string }>): ChangeSet => ({
	id: "cs_store",
	runId: "run_1",
	domain: "campaigns",
	title: "Change",
	summary: "Raya campaign",
	risk: "medium",
	blastRadius: { kind: "store_discount", count: 1, label: "1 record" },
	diffs: [{ entity: { kind: "store_discount", id: "2", label: "RAYA5" }, field: "Status", before: "Active", after: "Paused", provenance: "generated" }],
	guardrails: [],
	status: "applied",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind, payload: { steps: [], base: {} } },
	result: { entities: [], links },
});

const render = (changeSet: ChangeSet) => renderToStaticMarkup(<DraftCard changeSet={changeSet} onOpenEditor={() => undefined} />);

describe("open link on an applied store card [TC-AICP-247]", () => {
	it.each([
		["store.discounts_patch", { label: "Open discount", href: "/discounts/2" }],
		["store.categories_patch", { label: "Open categories", href: "/products/categories" }],
		["store.orders_patch", { label: "Open order", href: "/orders/7" }],
		["store.customers_patch", { label: "Open customer", href: "/customers/12" }],
		["store.customers_patch", { label: "Open contact leads", href: "/contact-leads" }],
		["store.customers_patch", { label: "Open email templates", href: "/settings/email-templates" }],
	])("%s shows the link's own label, not Open in editor (%j)", (kind, link) => {
		const html = render(applied(kind, [link]));

		expect(html).toContain(link.label);
		expect(html).not.toContain("Open in editor");
	});

	it("shows no open action when the change left no link", () => {
		const html = render(applied("store.customers_patch", []));

		expect(html).not.toContain("ech-ag-link");
		expect(html).not.toContain("Open in editor");
	});

	it("says Open product on an applied shop product draft", () => {
		const shop = {
			...applied("shop_product.create_drafts", [{ label: "Open product", href: "/products/9" }]),
			drafts: [{ type: "product" as const, catalog: "shop" as const, name: "Batik Scarf", sku: "-", price: "S$ 20.00", fields: [], images: [] }],
		};

		const html = render(shop);

		expect(html).toContain("Open product");
		expect(html).not.toContain("Open in editor");
	});

	it("keeps Open in editor on a site change", () => {
		const html = render(applied("site.page_edit", [{ label: "Open in the editor", href: "/editor/s1?pageId=p1" }]));

		expect(html).toContain("Open in editor");
	});
});

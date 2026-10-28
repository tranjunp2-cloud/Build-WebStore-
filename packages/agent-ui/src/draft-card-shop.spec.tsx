import type { ChangeSet, ProductDraftDoc } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AIREL-66 — a draft of the shop's own products (catalog "shop") shows no Product Master
// family row; a Product Master draft still flags a missing family.

const doc = (over: Partial<ProductDraftDoc> = {}): ProductDraftDoc => ({
	type: "product",
	name: "Batik Scarf",
	sku: "—",
	price: "S$ 20.00",
	fields: [{ key: "name", label: "Name", value: "Batik Scarf", source: "ai", group: "product" }],
	images: [],
	...over,
});

const draft = (drafts: ProductDraftDoc[]): ChangeSet => ({
	id: "cs_1",
	runId: "run_1",
	domain: "products",
	title: "Create draft product: Batik Scarf",
	summary: "Batik Scarf",
	risk: "low",
	blastRadius: { kind: "product", count: 1, label: "1 new draft product" },
	diffs: [],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-21T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	drafts,
	action: { kind: "shop_product.create_drafts", payload: {} },
});

describe("DraftCard shop products [TC-AIREL-66]", () => {
	it("TC-AIREL-66: hides the family row for the shop's own products and keeps it for Product Master", () => {
		// Act
		const shop = renderToStaticMarkup(<DraftCard changeSet={draft([doc({ catalog: "shop" })])} onApprove={() => undefined} />);
		const master = renderToStaticMarkup(<DraftCard changeSet={draft([doc()])} onApprove={() => undefined} />);

		// Assert
		expect(shop).not.toContain("Family");
		expect(shop).toContain("S$ 20.00");
		expect(master).toContain("Family");
	});
});

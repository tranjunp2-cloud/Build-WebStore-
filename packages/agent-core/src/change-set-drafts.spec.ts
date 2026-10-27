import { describe, expect, it } from "vitest";
import { ChangeSetSchema } from "./schemas";

// TC-AIREL-63 — one change set may carry up to 20 draft products (the Payload product copilot), not more.

const draft = (n: number) => ({ type: "product", name: `Product ${n}`, sku: "—", fields: [], images: [] });
const changeSet = (drafts: number) => ({
	id: "cs_1",
	runId: "run_1",
	domain: "products",
	title: "Create draft products",
	summary: "",
	risk: "low",
	blastRadius: { kind: "product", count: drafts, label: `${drafts} new draft products` },
	diffs: [{ entity: { kind: "product", id: "new-1" }, field: "name", before: null, after: "Product 1", provenance: "generated" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-21T08:00:00.000Z",
	expiresAt: "2026-10-22T08:00:00.000Z",
	drafts: Array.from({ length: drafts }, (_, i) => draft(i + 1)),
	action: { kind: "shop_product.create_drafts", payload: { products: [] } },
});

describe("change set drafts [TC-AIREL-63]", () => {
	it("holds 20 product drafts", () => {
		expect(ChangeSetSchema.parse(changeSet(20)).drafts).toHaveLength(20);
	});

	it("refuses 21", () => {
		expect(ChangeSetSchema.safeParse(changeSet(21)).success).toBe(false);
	});
});

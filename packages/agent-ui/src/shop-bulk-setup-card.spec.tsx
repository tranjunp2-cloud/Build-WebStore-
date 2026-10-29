import { type ChangeSet, ChangeSetSchema } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AIAUD-123 — the "set up N products" card (shop_product.bulk.update): one row per product, what it was → what it
// becomes (price, stock, photos, on sale), a click-to-approve note
// for products on sale, and the undo days once applied. It reads as an edit, not as an unknown kind.

const pending: ChangeSet = ChangeSetSchema.parse({
	id: "cs_setup",
	runId: "run_1",
	domain: "products",
	title: "Set up 2 products: price, stock",
	summary: "You gave the numbers",
	risk: "medium",
	blastRadius: { kind: "product", count: 2, label: "2 products" },
	diffs: [
		{ entity: { kind: "product", id: "11", label: "Rose serum" }, field: "price", before: "RM 0.00", after: "RM 59.00", provenance: "user_input" },
		{ entity: { kind: "product", id: "11", label: "Rose serum" }, field: "stock", before: "0", after: "12", provenance: "user_input" },
		{ entity: { kind: "product", id: "12", label: "Night cream" }, field: "stock", before: "3", after: "8", provenance: "user_input" },
	],
	guardrails: [
		{ rule: "version_guard", ok: true, detail: "Applied only if nobody edited it since this draft — otherwise nothing is written." },
		{ rule: "live", ok: true, detail: "Products on sale show the change in your store right away." },
		{ rule: "skipped_value", ok: false, detail: "Linen shirt: it has options, so its prices are set in the product form." },
	],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-29T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	requiresClick: true,
	drafts: [
		{
			type: "product_edit",
			name: "Set up 2 products",
			sections: [
				{
					key: "products",
					rows: [
						{ label: "Rose serum", before: "Price RM 0.00 · Stock 0", after: "Price RM 59.00 · Stock 12" },
						{ label: "Night cream", before: "Stock 3", after: "Stock 8" },
					],
				},
			],
			undo: { notes: ["Undo puts every product back while none of them was edited after this change."] },
		},
	],
	action: { kind: "shop_product.bulk.update", payload: { items: [] } },
});

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("set up N products card [TC-AIAUD-123]", () => {
	it("shows one row per product with what it was and what it becomes, in plain words", () => {
		const t = text(renderToStaticMarkup(<DraftCard changeSet={pending} onApprove={() => undefined} />));

		expect(t).toContain("Set up 2 products");
		expect(t).toContain("Changes 2");
		expect(t).toMatch(/Rose serum\s+Price RM 0\.00 · Stock 0\s+Price RM 59\.00 · Stock 12/);
		expect(t).toMatch(/Night cream\s+Stock 3\s+Stock 8/);
		// no wording about variants over a list of products
		expect(t).not.toMatch(/variant/i);
		// the live note and what was left out are in front of the merchant before approving
		expect(t).toContain("Products on sale show the change in your store right away.");
		expect(t).toContain("Linen shirt: it has options, so its prices are set in the product form.");
		expect(t).toContain("Undo puts every product back while none of them was edited after this change.");
	});

	it("reads as an edit (kicker, saved state once applied) and never as an unknown draft", () => {
		const applied: ChangeSet = { ...pending, status: "applied", result: { entities: [{ kind: "product", id: "11", label: "Rose serum" }], links: [{ label: "Open products", href: "/products" }], undo: { kind: "shop_product.restore_many", payload: { items: [] }, until: "2099-01-01T00:00:00Z" } } };
		const t = text(renderToStaticMarkup(<DraftCard changeSet={applied} onApprove={() => undefined} />));

		expect(t).toContain("Edit");
		expect(t).not.toMatch(/\bDraft\b/);
		expect(t).toMatch(/Saved|Undo/);
	});
});

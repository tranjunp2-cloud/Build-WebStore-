import { type ChangeSet, ChangeSetSchema, type ProductEditDoc } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";
import { PRODUCT_EDIT_LABELS } from "./locales/product-edit-labels";
import { pendingEditHref } from "./assistant-panel";
import { ReviewSheet } from "./review-sheet";

// TC-AICP-91 — the Product Master edit card (option A): what it overwrites or takes off first,
// the empty fields it fills grouped by editor section, the photos after the change, the variants
// that change, plain notes while pending; days of Undo left once saved; the undone note.
// TC-AICP-92 — the same edit in the wide review on the right, a red Approve that asks Yes / No (no typing).

const doc: ProductEditDoc = {
	type: "product_edit",
	name: "Grey Oversized Poplin Shirt",
	sku: "AI-GREY-OVERSIZED-POPLIN-BE9F1",
	imageUrl: "/api/agent/media/assets/asset_main/thumbnail",
	sections: [
		{ key: "basics", rows: [{ label: "Brand", before: null, after: "PrimeLab" }] },
		{ key: "attributes", rows: [{ label: "Fit", before: "Oversized", after: "Relaxed" }] },
		{ key: "shipping", rows: [{ label: "Shipping package size", before: null, after: "30 × 25 × 3 cm" }] },
	],
	photos: {
		before: 2,
		items: [
			{ url: "/api/agent/media/assets/asset_main/thumbnail", cover: true },
			{ url: "/api/agent/media/assets/asset_new/thumbnail", added: true, alt: "Cốc gốm" },
			{ url: "/api/agent/media/assets/asset_old/thumbnail", removed: true },
			{ url: "javascript:alert(1)", added: true },
		],
	},
	variants: {
		rows: [
			{ label: "XXL", change: "added", cells: [{ field: "Status", before: null, after: "Draft" }, { field: "Price", before: null, after: "MYR 95.00" }] },
			{ label: "S", change: "changed", cells: [{ field: "Price", before: "MYR 95.00", after: "MYR 99.00" }, { field: "Barcode", before: null, after: "8935001234562" }] },
			{ label: "M", change: "archived", cells: [{ field: "Status", before: "Draft", after: "Archived" }] },
		],
	},
	undo: { archivesVariants: ["XXL"] },
};

const base: ChangeSet = ChangeSetSchema.parse({
	id: "cs_pm",
	runId: "run_1",
	domain: "products",
	title: "Edit product: Grey Oversized Poplin Shirt",
	summary: "Hoàn thiện sản phẩm",
	risk: "high",
	blastRadius: { kind: "product", count: 1, label: "7 changes on 1 product" },
	diffs: [{ entity: { kind: "product", id: "prod_1", label: "Grey Oversized Poplin Shirt" }, field: "Brand", before: null, after: "PrimeLab", provenance: "generated" }],
	guardrails: [
		{ rule: "version_guard", ok: true, detail: "Applied only if nobody edited the product since this draft — otherwise nothing is written." },
		{ rule: "skipped_value", ok: false, detail: "SEO title / description are not fields of the family Tops & Shirts; set them on the web store product." },
	],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-20T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	confirmText: "Grey Oversized Poplin Shirt",
	drafts: [doc],
	action: { kind: "product_master.update", payload: {} },
});

const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ");

describe("Product Master edit card [TC-AICP-91]", () => {
	it("puts what it overwrites or takes off first, then the empty fields it fills by section", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} />);
		const t = text(html);
		expect(t).toContain("Changes 1 · fills 2 empty fields · 2 new photos · 1 new variant · changes 1 variant · takes off 1 photo · archives 1 variant");
		expect(t.indexOf("Changes and removals")).toBeLessThan(t.indexOf("Fills empty fields"));
		expect(t).toMatch(/Fit\s+Oversized\s+Relaxed/);
		expect(t).toContain("Photo 3 Taken off the product, stays in your library");
		expect(t).toContain("Variant M Archived — stops selling, not deleted");
		expect(t).toMatch(/Basics Brand PrimeLab Shipping Shipping package size 30 × 25 × 3 cm/);
		// a "before" is never "empty" filler for a fill
		expect(t).not.toContain("empty →");
	});

	it("shows the photos after the change (main, new, taken off) and only safe picture URLs", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} />);
		expect(html).toMatch(/data-added=""[^>]*><em>New<\/em>/);
		expect(html).toMatch(/data-removed=""[^>]*><em>Off<\/em>/);
		expect(html).toContain("<em>Main</em>");
		expect(html).not.toContain("javascript:");
		expect(text(html)).toContain("Photos 2 → 3");
	});

	it("tables the variants that change with their price before → after and other changes under the name", () => {
		const t = text(renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} />));
		expect(t).toContain("XXL New MYR 95.00");
		expect(t).toContain("S Barcode 8935001234562 Changed MYR 95.00 MYR 99.00");
		expect(t).toContain("M Archived —");
	});

	it("says plainly where the change goes, what Undo can't delete and what was skipped; a red Approve, no name to type", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} />);
		const t = text(html);
		expect(t).toContain("Goes into the product's draft; sales channels change only when you publish.");
		expect(t).toContain("Undo archives XXL — variants can't be deleted.");
		expect(t).toContain("SEO title / description are not fields of the family");
		expect(t).not.toContain("nobody edited the product since");
		expect(html).toMatch(/<button[^>]*is-danger[^>]*>Approve/);
		expect(html).not.toContain('type="text"');
	});

	it("says the channel change goes out now instead of \"only when you publish\"", () => {
		const live = { ...base, guardrails: [...base.guardrails, { rule: "live", ok: true, detail: "Channel changes go to Shopee MY right away; Undo sends the old values again." }] };
		const t = text(renderToStaticMarkup(<DraftCard changeSet={live} onApprove={() => undefined} />));
		expect(t).toContain("Channel changes go to Shopee MY right away");
		expect(t).not.toContain("change only when you publish");
	});

	it("once saved offers Undo with the days left and links to the product; once undone says it is back", () => {
		const saved = { ...base, status: "applied" as const, result: { entities: [], links: [{ label: "Open product", href: "/catalog/products/prod_1" }], undo: { kind: "product_master.update", payload: {}, until: new Date(Date.now() + 6.5 * 86_400_000).toISOString() } } };
		const t = text(renderToStaticMarkup(<DraftCard changeSet={saved} onUndo={() => undefined} onOpenEditor={() => undefined} />));
		expect(t).toContain("Undo 7 days left");
		expect(t).toContain("Open product");
		expect(t).not.toContain("Goes into the product's draft");
		const undone = text(renderToStaticMarkup(<DraftCard changeSet={{ ...saved, status: "reverted" }} />));
		expect(undone).toContain("The product is back to how it was before this edit. XXL archived.");
	});

	it("reads in Vietnamese with the host's labels", () => {
		const t = text(renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} labels={PRODUCT_EDIT_LABELS.vi} />));
		expect(t).toContain("Sửa 1 · điền 2 trường trống");
		expect(t).toContain("Sửa hoặc gỡ thứ đang có");
		expect(t).toContain("Duyệt");
		expect(t).not.toContain("Gõ “");
	});
});

describe("Product Master edit in the wide review [TC-AICP-92]", () => {
	it("shows the whole edit with a red Approve changes that asks Yes / No, nothing to type", () => {
		const html = renderToStaticMarkup(<ReviewSheet changeSet={base} onApprove={() => undefined} />);
		const t = text(html);
		expect(t).toContain("Grey Oversized Poplin Shirt AI-GREY-OVERSIZED-POPLIN-BE9F1");
		expect(t).toContain("Changes and removals");
		expect(html).not.toContain('type="text"');
		expect(html).toMatch(/<button[^>]*is-danger[^>]*>Approve changes/);
	});

	it("opens the product from a pending edit without approving it", () => {
		expect(pendingEditHref(base)).toBe("/catalog/products/prod_1");
		expect(pendingEditHref({ ...base, status: "applied" })).toBeUndefined();
	});
});

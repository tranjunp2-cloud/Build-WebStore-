import { describe, expect, it } from "vitest";
import { DraftDocSchema, ProductPrepareRequestSchema, ProductUpdateInputSchema, productUpdateInput } from "./index";

// TC-AICP-93 — the Product Master edit contract shared by ai-platform and prime-web: one strict
// input (every section nullable, nothing optional) and the review doc the chat card renders.

describe("Product Master edit contract [TC-AICP-93]", () => {
	it("takes every section as nullable, never optional (one strict JSON schema for every provider)", () => {
		const none = productUpdateInput({ id: "prod_1", why: "Hoàn thiện" });
		expect(ProductUpdateInputSchema.parse(none)).toEqual(none);
		const { photos: _photos, ...missing } = none;
		expect(ProductUpdateInputSchema.safeParse(missing).success).toBe(false);
		expect(ProductPrepareRequestSchema.parse({ input: none })).toEqual({ input: none, images: [] });
	});

	it("bounds what one edit may carry", () => {
		const big = productUpdateInput({ id: "prod_1", why: "xxx", attributes: Array.from({ length: 61 }, (_, i) => ({ code: `a${i}`, value: "v", unit: null })) });
		expect(ProductUpdateInputSchema.safeParse(big).success).toBe(false);
	});

	it("parses the product_edit review doc as a draft doc", () => {
		const doc = DraftDocSchema.parse({
			type: "product_edit",
			name: "Grey Shirt",
			sections: [{ key: "basics", rows: [{ label: "Brand", before: null, after: "PrimeLab" }] }],
			photos: { before: 1, items: [{ url: "/x", cover: true }, { url: "/y", removed: true }] },
			variants: { rows: [{ label: "XXL", change: "added", cells: [] }] },
			undo: { archivesVariants: ["XXL"] },
		});
		expect(doc.type).toBe("product_edit");
	});
});

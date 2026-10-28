import { ReceiptRecordSchema } from "@ech/agent-core";
import { describe, expect, it } from "vitest";
import { itemRecord } from "./receipt-records";

// TC-AICP-133 — what the run read or found goes to the chat as a record card (not the record's
// photos): name, status, price (else SKU), an in-app link and the main photo as its picture.
describe("itemRecord [TC-AICP-133]", () => {
	it("makes a product card with its price, link and main photo", () => {
		const record = itemRecord(
			{ kind: "product", id: "p1", title: "Kemeja-T Gaya Pejabat", status: "draft", url: "/catalog/products/p1", facts: [{ label: "SKU", value: "KT-1" }, { label: "Price", value: "RM 59" }] },
			"https://cdn.example/p1.jpg",
		);

		expect(record).toEqual({ kind: "product", id: "p1", title: "Kemeja-T Gaya Pejabat", status: "draft", meta: "Price: RM 59", href: "/catalog/products/p1", thumb: "https://cdn.example/p1.jpg" });
		expect(ReceiptRecordSchema.safeParse(record).success).toBe(true);
	});

	it("a post keeps its search line; links and pictures from elsewhere are dropped", () => {
		expect(itemRecord({ kind: "blog_post", id: "b1", title: "Batik care", meta: "Published · 3 Oct", url: "https://evil.example/x" }, "javascript:alert(1)")).toEqual({
			kind: "post",
			id: "b1",
			title: "Batik care",
			meta: "Published · 3 Oct",
		});
	});
});

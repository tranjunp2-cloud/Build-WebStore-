import { ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it } from "vitest";
import {
	BlogDraftInputSchema,
	blogSlug,
	buildBlogDraftChangeSet,
	buildProductDraftsChangeSet,
	draftSku,
	ProductDraftsInputSchema,
} from "./change-set-builders";

const ctx = { id: "cs_abc123def456", runId: "run_1", now: new Date("2026-10-19T08:00:00Z") };

describe("draftSku", () => {
	it("keeps a merchant SKU, normalised to the ECH alphabet", () => {
		expect(draftSku(" bt-001 / red ", "Batik", ctx.id, 0)).toBe("BT-001-RED");
	});

	it("derives a deterministic SKU from the name and change set when none is given", () => {
		const a = draftSku(undefined, "Áo dài lụa tơ tằm cao cấp", ctx.id, 1);
		expect(a).toBe("AI-AO-DAI-LUA-F4562");
		expect(draftSku(undefined, "Áo dài lụa tơ tằm cao cấp", ctx.id, 1)).toBe(a);
	});
});

describe("buildProductDraftsChangeSet", () => {
	it("stages draft-only products with a domain action and wire-valid shape", () => {
		const input = ProductDraftsInputSchema.parse({
			locale: "ms-MY",
			products: [
				{ name: "Baju Kurung Sutera", description: "Baju kurung sutera lembut." },
				{ name: "Tudung Bawal", description: "" },
			],
		});
		const cs = buildProductDraftsChangeSet(input, ctx);
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.status).toBe("pending");
		expect(cs.blastRadius.count).toBe(2);
		expect(cs.action?.kind).toBe("product.create_drafts");
		expect(cs.action?.payload.products).toHaveLength(2);
		// empty description produces no description diff
		expect(cs.diffs.filter((d) => d.field === "description")).toHaveLength(1);
		expect(new Date(cs.expiresAt).getTime() - ctx.now.getTime()).toBe(24 * 60 * 60 * 1000);
	});

	it("rejects more than 10 products at the schema boundary", () => {
		const products = Array.from({ length: 11 }, (_, i) => ({ name: `Item ${i}`, description: "x" }));
		expect(ProductDraftsInputSchema.safeParse({ locale: "en-US", products }).success).toBe(false);
	});
});

describe("buildBlogDraftChangeSet", () => {
	it("stages a blog draft with slug, SEO and a text preview diff", () => {
		const html = `<h2>Cara jaga batik</h2><p>${"Rendam dalam air sejuk. ".repeat(20)}</p>`;
		const input = BlogDraftInputSchema.parse({
			locale: "ms",
			title: "Cara Menjaga Kain Batik",
			contentHtml: html,
			seoTitle: "Cara Menjaga Kain Batik",
			seoDescription: "Panduan ringkas menjaga kain batik supaya warna kekal cantik.",
		});
		const cs = buildBlogDraftChangeSet(input, ctx);
		expect(ChangeSetSchema.parse(cs)).toBeTruthy();
		expect(cs.domain).toBe("cms");
		expect(cs.action?.payload).toMatchObject({ slug: "cara-menjaga-kain-batik", contentHtml: html });
		const content = cs.diffs.find((d) => d.field === "content");
		expect(content?.after).not.toContain("<h2>");
	});

	it("slugs Vietnamese titles to ASCII", () => {
		expect(blogSlug("Đặc sản Đà Lạt: mứt dâu")).toBe("dac-san-da-lat-mut-dau");
	});
});

import { ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { buildSiteChangeSet } from "./change-set-builders";
import type { PreparedSiteChange } from "../shop/shop-tools";
import { MERCHANT_INSTRUCTIONS } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps, pagePatchRequest, type PagePatchToolInput } from "./merchant-tools";

// TC-AIWB-09 — the copilot's web builder tools: strict tool input → prime-web ops, the change set the
// merchant approves, and the propose tools that stage prime-web's draft (never write it).

const ctx = { id: "cs_abc123def456", runId: "run_1", now: new Date("2026-10-21T08:00:00Z") };
const BLOCK = "00000000-0000-4000-8000-0000000000b1";
const PAGE = "10";

const nulls = { afterBlockId: null, blockType: null, variant: null, fields: null, path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null } as const;

describe("pagePatchRequest — strict tool ops to prime-web ops [TC-AIWB-09]", () => {
	const request = pagePatchRequest({
		siteId: "5",
		pageId: PAGE,
		why: "Warmer hero",
		addToStore: null,
		ops: [
			{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "headline", valueJson: '"Hello"' }, { name: "ctaButtons", valueJson: '[{"label":"Shop","url":"/shop"}]' }] },
			{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "subheadline", valueJson: "Hand-made in Kelantan" }, { name: "overlayOpacity", valueJson: "0.5" }] },
			{ ...nulls, op: "set_variant", blockId: BLOCK, variant: "split-left" },
			{ ...nulls, op: "insert_block", afterBlockId: BLOCK, blockType: "faq", variant: "accordion", fields: [{ name: "headline", valueJson: "Shipping" }] },
			{ ...nulls, op: "insert_block", afterBlockId: null, blockType: "faq", fields: [{ name: "headline", valueJson: '"Returns"' }] },
			{ ...nulls, op: "remove_block", blockId: "00000000-0000-4000-8000-0000000000c1" },
			{ ...nulls, op: "move_block", blockId: "00000000-0000-4000-8000-0000000000d1", afterBlockId: null },
		] as PagePatchToolInput["ops"],
	});
	const ops = (request as { ops: Array<Record<string, unknown>> }).ops;

	it("keeps the identifiers and the reason, and parses each field value from JSON", () => {
		expect(request).toMatchObject({ siteId: "5", pageId: PAGE, why: "Warmer hero" });
		expect(ops[0]).toEqual({ op: "set_fields", blockId: BLOCK, fields: { headline: "Hello", ctaButtons: [{ label: "Shop", url: "/shop" }] } });
	});

	it("parses numbers and keeps a bare, unquoted string as the string it is", () => {
		expect(ops[1]).toEqual({ op: "set_fields", blockId: BLOCK, fields: { subheadline: "Hand-made in Kelantan", overlayOpacity: 0.5 } });
	});

	it("maps a style change and carries the type and style on an inserted section", () => {
		expect(ops[2]).toEqual({ op: "set_variant", blockId: BLOCK, variant: "split-left" });
		expect(ops[3]).toEqual({ op: "insert_block", afterBlockId: BLOCK, block: { headline: "Shipping", blockType: "faq", variant: "accordion" } });
	});

	it("leaves the style off an inserted section that did not name one", () => {
		expect(ops[4]).toEqual({ op: "insert_block", afterBlockId: null, block: { headline: "Returns", blockType: "faq" } });
		expect((ops[4] as { block: object }).block).not.toHaveProperty("variant");
	});

	it("maps removals and moves by section id, with the anchor for a move", () => {
		expect(ops[5]).toEqual({ op: "remove_block", blockId: "00000000-0000-4000-8000-0000000000c1" });
		expect(ops[6]).toEqual({ op: "move_block", blockId: "00000000-0000-4000-8000-0000000000d1", afterBlockId: null });
	});
});

describe("buildSiteChangeSet — the change the merchant approves [TC-AIWB-09]", () => {
	it("builds a valid web builder change set for a page edit", () => {
		const cs = buildSiteChangeSet(
			{
				kind: "site.page_patch" as const,
				title: "Edit page: Home",
				why: "Warmer hero",
				risk: "low" as const,
				diffs: [
					{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "headline", before: "Old", after: "New" },
					{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "subheadline", before: null, after: "Hand-made" },
				],
				guardrails: [{ rule: "undo", ok: true, detail: "You can undo it for 7 days." }],
				plan: { siteId: "5", pageId: PAGE, ops: [], expect: {} },
			} as never,
			ctx,
		);

		expect(() => ChangeSetSchema.parse(cs)).not.toThrow();
		expect(cs).toMatchObject({ domain: "webbuilder", action: { kind: "site.page_patch" }, blastRadius: { kind: "site_block", count: 1 } });
		expect(cs.confirmText).toBeUndefined();
	});

	it("builds a theme change that must be confirmed by typing the site name", () => {
		const cs = buildSiteChangeSet(
			{
				kind: "site.theme_patch" as const,
				title: "Change theme: Kedai Batik",
				why: "Warmer look",
				risk: "high" as const,
				diffs: [{ entity: { kind: "site_theme", id: "5", label: "Kedai Batik" }, field: "primaryColor", before: "#0ea5e9", after: "#f97316" }],
				guardrails: [{ rule: "live", ok: true, detail: "Your live site shows it right away." }],
				confirmText: "Kedai Batik",
				plan: { siteId: "5", base: "abc", changes: { primaryColor: "#f97316" } },
			} as never,
			ctx,
		);

		expect(() => ChangeSetSchema.parse(cs)).not.toThrow();
		expect(cs).toMatchObject({ domain: "webbuilder", confirmText: "Kedai Batik", action: { kind: "site.theme_patch" }, blastRadius: { kind: "site_theme", count: 1 } });
	});
});

function deps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	let edits = 0;
	return {
		runId: "run_1",
		newChangeSetId: () => ctx.id,
		now: () => ctx.now,
		stage: vi.fn(async () => undefined),
		productKnowledge: async () => ({}),
		images: () => [],
		findImages: async () => [],
		generateImages: async () => ({}),
		inventoryRead: async () => ({}),
		inventoryPrepare: async () => ({ error: "x" }),
		productPrepare: async () => ({ error: "x" }),
		productPreparePublish: async () => ({ error: "x" }),
		snapshot: async () => ({ error: "x" }),
		allowEdit: () => ++edits <= 10,
		seenProducts: () => [],
		readItem: async () => ({}),
		searchItems: async () => ({}),
		currentPage: async () => ({}),
		createdInChat: () => [],
		siteRead: vi.fn(async () => ({ blocks: [] })),
		sitePrepare: vi.fn(async () => ({ error: { code: "x", message: "x" } })),
		storeCategories: vi.fn(async () => ({ categories: [] })),
		...overrides,
	} as MerchantToolDeps;
}

const run = (tools: ReturnType<typeof createMerchantTools>, name: "propose_page_patch" | "propose_site_patch" | "propose_new_page" | "propose_page_seo" | "propose_page_translation" | "propose_theme_change" | "propose_navigation" | "propose_site_languages" | "store_categories" | "propose_store_categories" | "propose_publish" | "site_read", input: unknown) =>
	(tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });

const patchInput = {
	siteId: "5",
	pageId: PAGE,
	why: "Warmer hero",
	ops: [{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "headline", valueJson: '"Hello"' }] }] as PagePatchToolInput["ops"],
};

describe("web builder propose tools [TC-AIWB-09]", () => {
	it("stages prime-web's page draft as a change set and returns the change count", async () => {
		const d = deps({
			sitePrepare: vi.fn(async () => ({
				kind: "site.page_patch" as const,
				title: "Edit page: Home",
				why: "Warmer hero",
				risk: "low" as const,
				diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "headline", before: "Old", after: "Hello" }],
				guardrails: [{ rule: "undo", ok: true, detail: "undo" }],
				plan: { siteId: "5", pageId: PAGE, ops: [], expect: {} },
			})),
		});

		const out = await run(createMerchantTools(d), "propose_page_patch", patchInput);

		expect(d.sitePrepare).toHaveBeenCalledWith("patch", expect.objectContaining({ siteId: "5", pageId: PAGE, ops: [expect.objectContaining({ op: "set_fields" })] }));
		expect(d.stage).toHaveBeenCalledTimes(1);
		expect((d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ domain: "webbuilder", action: { kind: "site.page_patch" } });
		expect(out).toMatchObject({ changeSetId: ctx.id, changes: 1 });
		expect(String(out.note)).toMatch(/Staged for the merchant's approval/);
		expect(String(out.note)).not.toMatch(/types/);
	});

	it("tells the model the merchant must type the site name to approve a theme change", async () => {
		const d = deps({
			sitePrepare: vi.fn(async () => ({
				kind: "site.theme_patch" as const,
				title: "Change theme: Kedai Batik",
				why: "Warmer look",
				risk: "high" as const,
				diffs: [{ entity: { kind: "site_theme", id: "5", label: "Kedai Batik" }, field: "primaryColor", before: "#0ea5e9", after: "#f97316" }],
				guardrails: [],
				confirmText: "Kedai Batik",
				plan: { siteId: "5", base: "abc", changes: { primaryColor: "#f97316" } },
			})),
		});

		const out = await run(createMerchantTools(d), "propose_theme_change", { siteId: "5", why: "Warmer look", changes: [{ name: "primaryColor", value: "#f97316" }] });

		expect(d.sitePrepare).toHaveBeenCalledWith("theme", { siteId: "5", why: "Warmer look", changes: { primaryColor: "#f97316" } });
		expect(String(out.note)).toContain("Approving asks the merchant Yes / No first.");
	});

	it("returns a refused draft exactly as prime-web said it (the model can fix its input)", async () => {
		const refusal = { error: { code: "invalid_section", message: "That change doesn't fit the Hero section." } };
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });

		const out = await run(createMerchantTools(d), "propose_page_patch", patchInput);

		expect(out).toEqual(refusal);
		expect(d.stage).not.toHaveBeenCalled();
	});

	it("surfaces skipped values as notes on the staged change", async () => {
		const d = deps({
			sitePrepare: vi.fn(async () => ({
				kind: "site.page_patch" as const,
				title: "Edit page: Home",
				why: "w",
				risk: "low" as const,
				diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "headline", before: "Old", after: "Hello" }],
				guardrails: [{ rule: "skipped_value", ok: false, detail: 'Hero has no field "id" an edit can set.' }],
				plan: { siteId: "5", pageId: PAGE, ops: [], expect: {} },
			})),
		});

		const out = await run(createMerchantTools(d), "propose_page_patch", patchInput);

		expect(out.skipped).toEqual(['Hero has no field "id" an edit can set.']);
	});

	it("respects the per-run edit limit before drafting anything", async () => {
		const d = deps({ allowEdit: () => false });

		const out = await run(createMerchantTools(d), "propose_page_patch", patchInput);

		expect(out).toMatchObject({ error: { code: "limit" } });
		expect(d.sitePrepare).not.toHaveBeenCalled();
	});

	it("reads the site through the site_read tool", async () => {
		const d = deps({ siteRead: vi.fn(async () => ({ pages: [{ id: PAGE }] })) });

		const out = await run(createMerchantTools(d), "site_read", { view: "pages", siteId: "5", pageId: null, blockId: null, query: null });

		expect(d.siteRead).toHaveBeenCalledWith(expect.objectContaining({ view: "pages", siteId: "5" }));
		expect(out).toEqual({ pages: [{ id: PAGE }] });
	});
});

// TC-AIWB-43 — products not in the store yet go on the page in the same change: only ones this run read.
describe("pagePatchRequest — addToStore [TC-AIWB-43]", () => {
	const seen = [{ id: "prod_scarf", title: "Batik silk scarf", status: "active" }];
	const input = (addToStore: string[] | null) => ({
		siteId: "5",
		pageId: PAGE,
		why: "Best sellers on the home page",
		addToStore,
		ops: [{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "productIds", valueJson: '["12","pm:prod_scarf"]' }] }] as PagePatchToolInput["ops"],
	});

	it("passes the Product Master products the run read, with their names, and the pm: refs as written", () => {
		const request = pagePatchRequest(input(["prod_scarf", "prod_scarf"]), [], seen) as { addToStore: unknown; ops: Array<{ fields: unknown }> };
		expect(request.addToStore).toEqual([{ id: "prod_scarf", title: "Batik silk scarf" }]);
		expect(request.ops[0]!.fields).toEqual({ productIds: ["12", "pm:prod_scarf"] });
	});

	it("refuses a product id the run never read, and sends no addToStore when there is none", () => {
		expect(pagePatchRequest(input(["prod_unknown"]), [], seen)).toEqual({ error: expect.objectContaining({ code: "unknown_products" }) });
		expect(pagePatchRequest(input(null), [], seen)).not.toHaveProperty("addToStore");
	});
});

// TC-AIWB-20 — a picture in a section: only a picture found or made in this chat, by its id.
describe("pagePatchRequest — set_image [TC-AIWB-20]", () => {
	const image = { id: "img_1", ref: "pixabay:123", url: "https://cdn.pixabay.com/a.jpg", origin: "stock" as const, alt: "Batik cloth" };
	const input = (imageId: string) => ({
		siteId: "5",
		pageId: PAGE,
		why: "Better hero picture",
		addToStore: null,
		ops: [{ ...nulls, op: "set_image", blockId: BLOCK, path: "backgroundImage", imageId }] as PagePatchToolInput["ops"],
	});

	it("resolves the chat's picture id to the ref the applier ingests, with its alt as the name", () => {
		const request = pagePatchRequest(input("img_1"), [image]) as { ops: unknown[] };
		expect(request.ops[0]).toEqual({ op: "set_image", blockId: BLOCK, path: "backgroundImage", image: { ref: "pixabay:123", url: "https://cdn.pixabay.com/a.jpg", name: "Batik cloth" } });
	});

	it("refuses a picture id the chat never saw, so the model finds one first", () => {
		expect(pagePatchRequest(input("img_9"), [image])).toEqual({ error: expect.objectContaining({ code: "unknown_image" }) });
	});

	it("does not stage anything for an unknown picture", async () => {
		const d = deps({ images: () => [image] });
		const out = await run(createMerchantTools(d), "propose_page_patch", input("img_9"));
		expect(out).toEqual({ error: expect.objectContaining({ code: "unknown_image" }) });
		expect(d.sitePrepare).not.toHaveBeenCalled();
	});
});

// TC-AIWB-21 — page SEO and page translation go through prime-web's prepare and are staged, never written.
describe("propose_page_seo / propose_page_translation [TC-AIWB-21]", () => {
	it("stages an SEO change prepared by prime-web", async () => {
		const d = deps({
			sitePrepare: vi.fn(async () => ({
				kind: "site.seo_patch" as const,
				title: "SEO: Home",
				why: "Clearer search result",
				risk: "low" as const,
				diffs: [{ entity: { kind: "site_page", id: PAGE, label: "Home" }, field: "SEO title", before: "(empty)", after: "Batik from Kelantan" }],
				guardrails: [],
				plan: { siteId: "5", pageId: PAGE, base: "abc", changes: { title: "Batik from Kelantan" } },
			})),
		});
		const input = { siteId: "5", pageId: PAGE, why: "Clearer search result", title: "Batik from Kelantan", description: null, slug: null };

		const out = await run(createMerchantTools(d), "propose_page_seo", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("seo", input);
		expect((d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ domain: "webbuilder", action: { kind: "site.seo_patch" } });
		expect(out).toMatchObject({ changeSetId: ctx.id, changes: 1 });
	});

	// TC-AIWB-84 — the SEO tool tells the model staging's rules and takes a slug for draft pages
	it("describes the SEO length, keyword and slug rules and takes a slug [TC-AIWB-84]", () => {
		const tool = createMerchantTools(deps()).propose_page_seo as unknown as { description: string; inputSchema: z.ZodType };
		expect(tool.description).toContain("150–160 characters");
		expect(tool.description).toContain("tracked keywords");
		expect(tool.description).toContain("slugEditable");
		const base = { siteId: "5", pageId: PAGE, why: "w", title: null, description: null };
		expect(tool.inputSchema.safeParse({ ...base, slug: "our-story" }).success).toBe(true);
		expect(tool.inputSchema.safeParse({ ...base, slug: null }).success).toBe(true);
		expect(tool.inputSchema.safeParse({ ...base, slug: null, title: "t".repeat(61) }).success).toBe(false);
		expect(tool.inputSchema.safeParse({ ...base, slug: null, description: "d".repeat(161) }).success).toBe(false);
	});

	it("stages a page translation, and passes a refusal (quota, nothing to do) back as is", async () => {
		const refusal = { error: { code: "ai_quota", message: "The workspace reached today's AI limit." } };
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		const input = { siteId: "5", pageId: PAGE, why: "Malay version", locale: "ms", onlyMissing: true };

		const out = await run(createMerchantTools(d), "propose_page_translation", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("translate", input);
		expect(out).toEqual(refusal);
		expect(d.stage).not.toHaveBeenCalled();
	});
});

const prepared = (kind: PreparedSiteChange["kind"], extra: Record<string, unknown> = {}) => ({
	kind,
	title: "T",
	why: "w",
	risk: "high" as const,
	diffs: [{ entity: { kind: "site_page", id: PAGE, label: "Home" }, field: "f", before: null, after: "x" }],
	guardrails: [],
	plan: {},
	...extra,
});
const stagedOf = (d: MerchantToolDeps) => (d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0];
const refusal = { error: { code: "invalid_section", message: "That change doesn't fit." } };

// TC-AIWB-28 — one change across several pages.
describe("propose_site_patch [TC-AIWB-28]", () => {
	const PAGE_B = "11";
	const input = {
		siteId: "5",
		why: "New phone number",
		pages: [
			{ pageId: PAGE, ops: [{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "phone", valueJson: '"012-3456789"' }] }] },
			{ pageId: PAGE_B, ops: [{ ...nulls, op: "remove_block", blockId: "00000000-0000-4000-8000-0000000000c1" }] },
		] as Array<{ pageId: string; ops: PagePatchToolInput["ops"] }>,
	};

	it("maps each page's ops like propose_page_patch and sends them to site.prepare_pages", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.pages_patch", { plan: { pages: [{}, {}] } })) });

		const out = await run(createMerchantTools(d), "propose_site_patch", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("pages", {
			siteId: "5",
			why: "New phone number",
			pages: [
				{ pageId: PAGE, ops: [{ op: "set_fields", blockId: BLOCK, fields: { phone: "012-3456789" } }] },
				{ pageId: PAGE_B, ops: [{ op: "remove_block", blockId: "00000000-0000-4000-8000-0000000000c1" }] },
			],
		});
		expect(stagedOf(d)).toMatchObject({ domain: "webbuilder", action: { kind: "site.pages_patch" }, blastRadius: { kind: "site_page", count: 2 } });
		expect(out).toMatchObject({ changeSetId: ctx.id });
	});

	it("tells the model to have the merchant type the site name when prime-web asks for it", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.pages_patch", { confirmText: "Kedai Batik", plan: { pages: [{}, {}, {}, {}] } })) });

		const out = await run(createMerchantTools(d), "propose_site_patch", input);

		expect(String(out.note)).toContain("Approving asks the merchant Yes / No first.");
	});

	it("resolves set_image like a single page patch and prefixes the page on a per-page error", async () => {
		const d = deps();
		const bad = { ...input, pages: [input.pages[0]!, { pageId: PAGE_B, ops: [{ ...nulls, op: "set_image", blockId: BLOCK, path: "image", imageId: "img_9" }] as PagePatchToolInput["ops"] }] };

		const out = await run(createMerchantTools(d), "propose_site_patch", bad);

		expect(out).toEqual({ error: { code: "unknown_image", message: expect.stringMatching(/^Page 11: No picture "img_9"/) } });
		expect(d.sitePrepare).not.toHaveBeenCalled();
	});

	it("passes a refusal through and respects the edit limit", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		expect(await run(createMerchantTools(d), "propose_site_patch", input)).toEqual(refusal);
		expect(d.stage).not.toHaveBeenCalled();

		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_site_patch", input)).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});

	it("builds a pages change set with a section and page count label", () => {
		const cs = buildSiteChangeSet(
			prepared("site.pages_patch", {
				diffs: [
					{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "phone", before: "a", after: "b" },
					{ entity: { kind: "site_block", id: "b2", label: "Footer · About" }, field: "phone", before: "a", after: "b" },
					{ entity: { kind: "site_block", id: "b3", label: "Footer · About" }, field: "phone", before: "a", after: "b" },
				],
				plan: { pages: [{}, {}] },
			}) as never,
			ctx,
		);
		expect(() => ChangeSetSchema.parse(cs)).not.toThrow();
		expect(cs.blastRadius).toEqual({ kind: "site_page", count: 2, label: "3 sections on 2 pages" });
	});
});

// TC-AIWB-29 — a new page as a draft.
describe("propose_new_page [TC-AIWB-29]", () => {
	const input = {
		siteId: "5",
		why: "Promo page",
		title: "11.11 Sale",
		slug: "/promo/11-11",
		sections: [
			{ blockType: "hero", variant: "split-left", fields: [{ name: "headline", valueJson: '"11.11"' }, { name: "overlayOpacity", valueJson: "0.5" }] },
			{ blockType: "faq", variant: null, fields: [{ name: "headline", valueJson: "Shipping" }] },
		],
		menuLabel: "Sale",
	};

	it("maps sections like insert_block and stages a one-page draft", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.page_create")) });

		const out = await run(createMerchantTools(d), "propose_new_page", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("page_create", {
			siteId: "5",
			why: "Promo page",
			title: "11.11 Sale",
			slug: "/promo/11-11",
			sections: [
				{ headline: "11.11", overlayOpacity: 0.5, blockType: "hero", variant: "split-left" },
				{ headline: "Shipping", blockType: "faq" },
			],
			menuLabel: "Sale",
		});
		expect(stagedOf(d)).toMatchObject({ action: { kind: "site.page_create" }, blastRadius: { kind: "site_page", count: 1, label: "1 new page (draft)" } });
		expect(out).toMatchObject({ changeSetId: ctx.id });
		expect((d.sitePrepare as ReturnType<typeof vi.fn>).mock.calls[0]![1].sections[1]).not.toHaveProperty("variant");
	});

	it("passes a refusal through and respects the edit limit", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		expect(await run(createMerchantTools(d), "propose_new_page", input)).toEqual(refusal);
		expect(d.stage).not.toHaveBeenCalled();

		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_new_page", input)).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});
});

// TC-AIWB-30 — the menu and footer.
describe("propose_navigation [TC-AIWB-30]", () => {
	const base = { siteId: "5", why: "Add About" };

	it("sends complete header links (children only when there are some) and footer columns", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.nav_patch", { diffs: [{ entity: { kind: "site_nav", id: "5" }, field: "menu", before: "a", after: "b" }, { entity: { kind: "site_nav", id: "5" }, field: "footer", before: "a", after: "b" }] })) });
		const footerColumns = [{ title: "Help", links: [{ label: "FAQ", url: "/faq" }] }];

		const out = await run(createMerchantTools(d), "propose_navigation", {
			...base,
			headerLinks: [
				{ label: "Shop", url: "/shop", children: [{ label: "Sale", url: "/sale" }] },
				{ label: "About", url: "/about", children: null },
				{ label: "Contact", url: "https://example.com", children: [] },
			],
			footerColumns,
		});

		expect(d.sitePrepare).toHaveBeenCalledWith("nav", {
			siteId: "5",
			why: "Add About",
			header: {
				links: [
					{ label: "Shop", url: "/shop", children: [{ label: "Sale", url: "/sale" }] },
					{ label: "About", url: "/about" },
					{ label: "Contact", url: "https://example.com" },
				],
			},
			footer: { columns: footerColumns },
		});
		expect(stagedOf(d)).toMatchObject({ action: { kind: "site.nav_patch" }, blastRadius: { kind: "site_navigation", count: 2, label: "The menu and footer of every page" } });
		expect(out).toMatchObject({ changeSetId: ctx.id, changes: 2 });
	});

	it("keeps the footer when only the menu is sent (null)", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.nav_patch")) });

		await run(createMerchantTools(d), "propose_navigation", { ...base, headerLinks: [{ label: "Shop", url: "/shop", children: null }], footerColumns: null });

		expect(d.sitePrepare).toHaveBeenCalledWith("nav", expect.objectContaining({ footer: null, header: { links: [{ label: "Shop", url: "/shop" }] } }));
	});

	it("answers no_change without calling prime-web when both lists are null", async () => {
		const d = deps();

		const out = await run(createMerchantTools(d), "propose_navigation", { ...base, headerLinks: null, footerColumns: null });

		expect(out).toMatchObject({ error: { code: "no_change" } });
		expect(d.sitePrepare).not.toHaveBeenCalled();
		expect(d.stage).not.toHaveBeenCalled();
	});

	it("passes a refusal through and respects the edit limit", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		const input = { ...base, headerLinks: [{ label: "Shop", url: "/shop", children: null }], footerColumns: null };
		expect(await run(createMerchantTools(d), "propose_navigation", input)).toEqual(refusal);

		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_navigation", input)).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});
});

// TC-AIWB-109 — the website's languages: site_read view "languages", propose_site_languages
// (add / remove the second language, make one primary) and the prompt's rules to ask, not guess.
describe("website languages [TC-AIWB-109]", () => {
	const input = { siteId: "5", why: "Malay for local buyers", change: "add_second" as const, locale: "ms" as const };

	it("reads the languages through site_read", async () => {
		const d = deps({ siteRead: vi.fn(async () => ({ primary: { locale: "en" }, second: null })) });

		await run(createMerchantTools(d), "site_read", { view: "languages", siteId: "5", pageId: null, blockId: null, query: null });

		expect(d.siteRead).toHaveBeenCalledWith(expect.objectContaining({ view: "languages", siteId: "5" }));
	});

	it("stages a language change from prime-web's draft, labelled as site-wide", async () => {
		const line = { entity: { kind: "site_navigation", id: "5", label: "Languages · Kedai" }, field: "second language", before: null, after: "Bahasa Melayu" };
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.languages_patch", { diffs: [line] })) });

		const out = await run(createMerchantTools(d), "propose_site_languages", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("languages", input);
		expect(stagedOf(d)).toMatchObject({ action: { kind: "site.languages_patch" }, blastRadius: { kind: "site_navigation", count: 1, label: "The website's languages (every page)" } });
		expect(out).toMatchObject({ changeSetId: ctx.id, changes: 1 });
	});

	it("passes a refusal through and respects the edit limit", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		expect(await run(createMerchantTools(d), "propose_site_languages", input)).toEqual(refusal);

		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_site_languages", input)).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});

	it("tells the model what the Context language fields mean and when to ask", () => {
		expect(MERCHANT_INSTRUCTIONS).toContain("siteLanguages (primary first");
		expect(MERCHANT_INSTRUCTIONS).toContain("pagesWrittenIn");
		expect(MERCHANT_INSTRUCTIONS).toContain("Ask, don't guess, about languages");
		expect(MERCHANT_INSTRUCTIONS).toContain("propose_site_languages first");
	});
});

// TC-AICP-138 — the Product Store's categories: read the tree (and products by name), stage one card of
// up to 10 steps (create with products, sub-categories, rename, move, delete, move products) as product data.
describe("store categories [TC-AICP-138]", () => {
	const create = { op: "create" as const, ref: "tees", name: "Áo thun", parentId: "1", parentRef: null, description: null, productIds: ["11"] };

	it("reads the categories, with products found by name", async () => {
		const d = deps();

		await run(createMerchantTools(d), "store_categories", { query: "áo thun" });

		expect(d.storeCategories).toHaveBeenCalledWith({ query: "áo thun" });
	});

	it("stages a category change as product data, labelled with what it touches", async () => {
		const lines = [
			{ entity: { kind: "store_category", id: "new:-1", label: "Fesyen Wanita > Áo thun" }, field: "new category", before: null, after: "Fesyen Wanita > Áo thun" },
			{ entity: { kind: "product", id: "11", label: "Áo thun tay ngắn" }, field: "category", before: "Pakaian", after: "Fesyen Wanita > Áo thun" },
		];
		const d = deps({ sitePrepare: vi.fn(async () => prepared("store.categories_patch", { diffs: lines })) });

		await run(createMerchantTools(d), "propose_store_categories", { why: "Group the tees", changes: [create] });

		expect(d.sitePrepare).toHaveBeenCalledWith("categories", { why: "Group the tees", changes: [create] });
		expect(stagedOf(d)).toMatchObject({ domain: "products", action: { kind: "store.categories_patch" }, blastRadius: { kind: "store_category", count: 2, label: "1 category and 1 product" } });
	});

	it("respects the edit limit and tells the model when to ask", async () => {
		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_store_categories", { why: "x", changes: [create] })).toMatchObject({ error: { code: "limit" } });
		expect(MERCHANT_INSTRUCTIONS).toContain("propose_store_categories card can make a category and put products in it");
	});
});

// TC-AIWB-31 — publishing, and the two new site_read views.
describe("propose_publish / site_read check + navigation [TC-AIWB-31]", () => {
	const input = { siteId: "5", why: "Go live" };

	it("stages a publish that needs the site name typed, counting the pages that change on the live site", async () => {
		// the plan fingerprints every page; only the three listed on the card go live with changes
		const pageLine = (id: string) => ({ entity: { kind: "site_page", id, label: `Page ${id}` }, field: "live site", before: "What visitors see now", after: "This draft" });
		const menuLine = { entity: { kind: "site_navigation", id: "5", label: "Menu" }, field: "menu", before: "Live menu", after: "The menu from the draft" };
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.publish", { confirmText: "Kedai Batik", diffs: [pageLine("10"), pageLine("11"), pageLine("12"), menuLine], plan: { pages: { "10": "h1", "11": "h2", "12": "h3", "13": "h4", "14": "h5" } } })) });

		const out = await run(createMerchantTools(d), "propose_publish", input);

		expect(d.sitePrepare).toHaveBeenCalledWith("publish", input);
		expect(stagedOf(d)).toMatchObject({ action: { kind: "site.publish" }, confirmText: "Kedai Batik", blastRadius: { kind: "site", count: 3, label: "Publish 3 pages to the live site" } });
		expect(String(out.note)).toContain("Approving asks the merchant Yes / No first.");
	});

	it("labels a publish of only the menu and footer", async () => {
		const menuLine = { entity: { kind: "site_navigation", id: "5", label: "Menu" }, field: "menu", before: "Live menu", after: "The menu from the draft" };
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.publish", { confirmText: "Kedai Batik", diffs: [menuLine], plan: { pages: { "10": "h1" } } })) });

		await run(createMerchantTools(d), "propose_publish", input);

		expect(stagedOf(d)).toMatchObject({ blastRadius: { kind: "site", count: 0, label: "Publish the menu and footer to the live site" } });
	});

	it("passes a refusal through and respects the edit limit", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => refusal) });
		expect(await run(createMerchantTools(d), "propose_publish", input)).toEqual(refusal);
		expect(d.stage).not.toHaveBeenCalled();

		const limited = deps({ allowEdit: () => false });
		expect(await run(createMerchantTools(limited), "propose_publish", input)).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});

	it.each(["check", "navigation"] as const)("reads view %s through site_read", async (view) => {
		const d = deps({ siteRead: vi.fn(async () => ({ ok: true })) });

		const out = await run(createMerchantTools(d), "site_read", { view, siteId: "5", pageId: null, blockId: null, query: null });

		expect(d.siteRead).toHaveBeenCalledWith(expect.objectContaining({ view, siteId: "5" }));
		expect(out).toEqual({ ok: true });
	});
});

// TC-AIWB-46 — a gallery's whole picture list from the chat's picture ids, in order, with captions.
describe("pagePatchRequest — set_pictures [TC-AIWB-46]", () => {
	const known = [
		{ id: "img_1", ref: "pixabay:1", url: "https://cdn.pixabay.com/1.jpg", origin: "stock" as const, alt: "Beans" },
		{ id: "img_2", ref: "asset:a2", url: "/api/agent/media/assets/a2/thumbnail", origin: "media" as const, alt: "Cup" },
	];
	const input = (imageIds: string[] | null, captions: string[] | null = null) => ({
		siteId: "5",
		pageId: PAGE,
		why: "New gallery",
		addToStore: null,
		ops: [{ ...nulls, op: "set_pictures", blockId: BLOCK, path: "images", imageIds, captions }] as PagePatchToolInput["ops"],
	});

	it("maps the ids to pictures in order, with a caption only where one was given", () => {
		const request = pagePatchRequest(input(["img_2", "img_1"], ["The cup"]), known) as { ops: unknown[] };
		expect(request.ops[0]).toEqual({
			op: "set_pictures",
			blockId: BLOCK,
			path: "images",
			items: [
				{ image: { ref: "asset:a2", url: "/api/agent/media/assets/a2/thumbnail", name: "Cup" }, caption: "The cup" },
				{ image: { ref: "pixabay:1", url: "https://cdn.pixabay.com/1.jpg", name: "Beans" } },
			],
		});
	});

	it("refuses an empty list and a picture the chat never had", () => {
		expect(pagePatchRequest(input(null), known)).toEqual({ error: expect.objectContaining({ code: "bad_patch" }) });
		expect(pagePatchRequest(input(["img_1", "img_9"]), known)).toEqual({ error: expect.objectContaining({ code: "unknown_image" }) });
	});
});

// TC-AIWB-49 / 50 — list items in their new order (kept by id or "#N", new ones with their text) and one value by path.
describe("pagePatchRequest — edit_list / set_value [TC-AIWB-49] [TC-AIWB-50]", () => {
	const input = (ops: Array<Record<string, unknown>>) => ({ siteId: "5", pageId: PAGE, why: "Tidy", addToStore: null, ops: ops.map((op) => ({ ...nulls, ...op })) as PagePatchToolInput["ops"] });

	it("maps kept items by id or position and new items with their fields", () => {
		const request = pagePatchRequest(
			input([
				{
					op: "edit_list",
					blockId: BLOCK,
					path: "features",
					rows: [
						{ keep: "6ad84ef5637f4c23b1c016d7", fields: null },
						{ keep: "#0", fields: [{ name: "title", valueJson: '"Fast delivery"' }] },
						{ keep: null, fields: [{ name: "title", valueJson: '"Gift wrap"' }, { name: "description", valueJson: '"Free"' }] },
					],
				},
			]),
		) as { ops: unknown[] };
		expect(request.ops[0]).toEqual({
			op: "edit_list",
			blockId: BLOCK,
			path: "features",
			rows: [{ keep: "6ad84ef5637f4c23b1c016d7" }, { keep: 0, fields: { title: "Fast delivery" } }, { fields: { title: "Gift wrap", description: "Free" } }],
		});
		expect(pagePatchRequest(input([{ op: "edit_list", blockId: BLOCK, path: "features" }]))).toEqual({ error: expect.objectContaining({ code: "bad_patch" }) });
	});

	it("maps one value by path, and refuses a missing or structured value", () => {
		const request = pagePatchRequest(input([{ op: "set_value", blockId: BLOCK, path: "ctaButtons.0.url", valueJson: '"/sale"' }])) as { ops: unknown[] };
		expect(request.ops[0]).toEqual({ op: "set_value", blockId: BLOCK, path: "ctaButtons.0.url", value: "/sale" });
		expect(pagePatchRequest(input([{ op: "set_value", blockId: BLOCK, path: "headline" }]))).toEqual({ error: expect.objectContaining({ code: "bad_patch" }) });
		expect(pagePatchRequest(input([{ op: "set_value", blockId: BLOCK, path: "features", valueJson: "[]" }]))).toEqual({ error: expect.objectContaining({ code: "bad_patch" }) });
	});
});

// TC-AIWB-53 / 57 / 59 — keepWording passes through; an item's picture by chat id; the menu and footer settings.
describe("pagePatchRequest / propose_navigation — round 2 [TC-AIWB-53] [TC-AIWB-57] [TC-AIWB-59]", () => {
	const known = [{ id: "img_1", ref: "pixabay:1", url: "https://cdn.pixabay.com/1.jpg", origin: "stock" as const, alt: "Hijab" }];
	const input = (ops: Array<Record<string, unknown>>, keepWording: boolean | null = null) => ({ siteId: "5", pageId: PAGE, why: "Edit", addToStore: null, keepWording, ops: ops.map((op) => ({ ...nulls, ...op })) as PagePatchToolInput["ops"] });

	it("maps an item's imageId to the chat picture and passes keepWording only when true", () => {
		const request = pagePatchRequest(input([{ op: "edit_list", blockId: BLOCK, path: "members", rows: [{ keep: null, fields: [{ name: "name", valueJson: '"Dina"' }], imageId: "img_1" }] }], true), known) as Record<string, unknown> & { ops: unknown[] };
		expect(request.ops[0]).toEqual({ op: "edit_list", blockId: BLOCK, path: "members", rows: [{ fields: { name: "Dina" }, picture: { image: { ref: "pixabay:1", url: "https://cdn.pixabay.com/1.jpg", name: "Hijab" } } }] });
		expect(request.keepWording).toBe(true);
		expect("keepWording" in (pagePatchRequest(input([{ op: "set_value", blockId: BLOCK, path: "headline", valueJson: '"A"' }]), known) as object)).toBe(false);
		expect(pagePatchRequest(input([{ op: "edit_list", blockId: BLOCK, path: "members", rows: [{ keep: "#0", fields: null, imageId: "img_9" }] }]), known)).toEqual({ error: expect.objectContaining({ code: "unknown_image" }) });
	});

	it("sends the menu's shop name and button, the footer's tagline, copyright and socials; hide = null button", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared("site.nav_patch")) });
		await run(createMerchantTools(d), "propose_navigation", {
			siteId: "5",
			why: "Footer",
			headerLinks: null,
			footerColumns: null,
			shopName: "Kedai Demo",
			menuButton: { label: "x", url: "/x", hide: true },
			tagline: "Áo dài may tại Kelantan",
			copyright: null,
			socials: [{ platform: "instagram", url: "https://instagram.com/kedai" }],
			keepWording: null,
		});
		expect(d.sitePrepare).toHaveBeenCalledWith("nav", {
			siteId: "5",
			why: "Footer",
			header: { logoText: "Kedai Demo", cta: null },
			footer: { tagline: "Áo dài may tại Kelantan", socials: [{ platform: "instagram", url: "https://instagram.com/kedai" }] },
		});
	});
});

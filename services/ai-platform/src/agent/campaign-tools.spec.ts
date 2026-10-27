import { ChangeSetSchema, type ChangeSet } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import { CAPABILITIES, type Capability, OPT_IN_CAPABILITIES, parseCapabilityList } from "../config/capabilities";
import type { PreparedSiteChange } from "../shop/shop-tools";
import { type CampaignState, createCampaignRun } from "./campaign-group";
import { ALL_CAPABILITIES, capabilitySet, TOOL_CAPABILITIES } from "./merchant-capabilities";
import { MERCHANT_INSTRUCTIONS, merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps, pagePatchRequest } from "./merchant-tools";

// TC-AICP-216..219 — one-prompt promo campaigns: the `campaigns` capability (needs store_discounts and
// site), the instructions, start_campaign linking the cards staged after it, and `group` on change sets.

const set = (...capabilities: Capability[]) => capabilitySet(capabilities);
const STAGING: Capability[] = ["site", "blog", "stock_photos", "shop_products", "store_discounts"];
const CAMPAIGN_TOOLS = ["start_campaign"];

let counter = 0;
function deps(holder: { campaign?: CampaignState } = {}, overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps & { staged: ChangeSet[] } {
	const staged: ChangeSet[] = [];
	return {
		runId: "run_7",
		newChangeSetId: () => `cs_${String(++counter).padStart(12, "0")}`,
		now: () => new Date("2026-10-22T04:00:00Z"),
		stage: vi.fn(async (changeSet: ChangeSet) => {
			staged.push(changeSet);
		}),
		allowEdit: () => true,
		campaign: createCampaignRun("run_7", holder),
		createdInChat: () => [],
		images: () => [],
		seenProducts: () => [],
		sitePrepare: vi.fn(async (kind: string) => prepared(kind)),
		staged,
		...overrides,
	} as unknown as MerchantToolDeps & { staged: ChangeSet[] };
}

const KINDS: Record<string, string> = { discounts: "store.discounts_patch", patch: "site.page_patch", publish: "site.publish", theme: "site.theme_patch" };
function prepared(kind: string, extra: Record<string, unknown> = {}): PreparedSiteChange {
	return {
		kind: KINDS[kind] ?? kind,
		title: `Change ${kind}`,
		why: "11.11 sale",
		risk: "medium",
		diffs: [{ entity: { kind: "store_discount", id: "1", label: "SALE1111" }, field: "Discount", before: null, after: "15% off" }],
		guardrails: [],
		plan: { steps: [] },
		...extra,
	} as PreparedSiteChange;
}

const call = (tools: object, name: string, input: unknown) =>
	((tools as Record<string, unknown>)[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, any>> }).execute(input, { toolCallId: "t", messages: [] });
const blogPost = { locale: "vi", title: "Khuyến mãi 11.11 giảm 15%", contentHtml: `<h2>11.11</h2><p>${"Mã SALE1111 giảm 15% đến 15/11. ".repeat(10)}</p>`, seoTitle: "Khuyến mãi 11.11", seoDescription: "Giảm 15% với mã SALE1111 đến 15/11" };
const discountInput = { why: "11.11", changes: [{ op: "pause", discountId: "1" }] };
const patchInput = { siteId: "5", pageId: "10", why: "Banner 11.11", addToStore: null, keepWording: null, ops: [] };

describe("campaigns capability [TC-AICP-216]", () => {
	it("is on by default, not opt-in, and maps start_campaign to itself", () => {
		expect(CAPABILITIES).toContain("campaigns");
		expect(OPT_IN_CAPABILITIES).not.toContain("campaigns");
		expect(ALL_CAPABILITIES.has("campaigns")).toBe(true);
		for (const name of CAMPAIGN_TOOLS) expect(TOOL_CAPABILITIES[name as keyof typeof TOOL_CAPABILITIES]).toEqual(["campaigns"]);
		expect(Object.keys(createMerchantTools(deps(), ALL_CAPABILITIES))).toEqual(expect.arrayContaining(CAMPAIGN_TOOLS));
	});

	it("needs store_discounts and site: a list without either is refused, a hand-built set loses it", () => {
		expect(parseCapabilityList("site,store_discounts,campaigns")).toEqual({ capabilities: ["site", "store_discounts", "campaigns"] });
		expect(parseCapabilityList("site,campaigns")).toEqual({ error: "campaigns needs store_discounts" });
		expect(parseCapabilityList("store_discounts,campaigns")).toEqual({ error: "campaigns needs site" });
		expect(parseCapabilityList("blog,campaigns")).toEqual({ error: "campaigns needs store_discounts and site" });
		expect(capabilitySet(["site", "campaigns"]).has("campaigns")).toBe(false);
		expect(capabilitySet(["site", "store_discounts", "campaigns"]).has("campaigns")).toBe(true);
	});

	it("a deployment that lists the staging set without campaigns offers no campaign tool", () => {
		expect(parseCapabilityList(STAGING.join(","))).toMatchObject({ capabilities: expect.not.arrayContaining(["campaigns"]) });
		expect(Object.keys(createMerchantTools(deps(), set(...STAGING)))).not.toEqual(expect.arrayContaining(CAMPAIGN_TOOLS));
		expect(Object.keys(createMerchantTools(deps(), set(...STAGING, "campaigns")))).toEqual(expect.arrayContaining([...CAMPAIGN_TOOLS, "propose_store_discounts", "propose_page_patch", "propose_blog_post"]));
	});
});

describe("campaign instructions [TC-AICP-217]", () => {
	const text = merchantInstructions(set(...STAGING, "campaigns"));

	it("plans in one reply, asks only for missing facts and stages code, banner, post in that order", () => {
		expect(text).toContain("start_campaign");
		expect(text).toMatch(/Plan it in one short reply and ask \(ask_user/);
		expect(text).toMatch(/the discount \(% or RM and how much\), the end date, the code name/);
		expect(text.indexOf("(1) propose_store_discounts")).toBeLessThan(text.indexOf("(2) propose_page_patch"));
		expect(text.indexOf("(2) propose_page_patch")).toBeLessThan(text.indexOf("(3) propose_blog_post"));
		expect(text).toContain("must contain the exact code, the discount and the end date");
		expect(text).toContain("never add stock, price or quality claims the merchant did not give");
		expect(text).toContain("Website copy rules apply (no AI slop)");
		expect(text).toContain("cta in its banner variant, or an announcement-bar");
	});

	it("says the code is store-wide, keeps the blog step to sets with blog, and offers the translation after approval", () => {
		expect(text).toContain("a code cannot be limited to products");
		expect(text).toContain("offer in one sentence to translate the banner once it is approved");
		const noBlog = merchantInstructions(set("site", "store_discounts", "campaigns"));
		expect(noBlog).toContain("start_campaign");
		expect(noBlog).not.toContain("propose_blog_post");
		expect(noBlog).not.toContain("(3)");
	});

	it("is absent where the capability is off", () => {
		expect(merchantInstructions(set(...STAGING))).not.toContain("start_campaign");
		expect(merchantInstructions(set("site", "store_discounts"))).not.toMatch(/start_campaign|run a promotion/);
		expect(MERCHANT_INSTRUCTIONS).toContain("start_campaign");
		expect(text).toContain("run a promotion");
	});
});

describe("start_campaign links the cards staged after it [TC-AICP-218]", () => {
	it("stamps one shared group, in staging order: code, banner, post", async () => {
		const d = deps();
		const tools = createMerchantTools(d, set(...STAGING, "campaigns"));

		const started = await call(tools, "start_campaign", { label: "  11.11 " });
		await call(tools, "propose_store_discounts", discountInput);
		await call(tools, "propose_page_patch", patchInput);
		await call(tools, "propose_blog_post", blogPost);

		expect(started).toMatchObject({ campaign: "11.11" });
		expect(started.order).toHaveLength(3);
		expect(d.staged).toHaveLength(3);
		const groups = d.staged.map((c) => c.group);
		expect(groups.map((g) => g?.id)).toEqual(Array(3).fill("cmp_run_7_1"));
		expect(groups.map((g) => g?.label)).toEqual(Array(3).fill("11.11"));
		expect(groups.map((g) => g?.step)).toEqual([1, 2, 3]);
		expect(d.staged.map((c) => c.action?.kind)).toEqual(["store.discounts_patch", "site.page_patch", "blog.create_draft"]);
		for (const changeSet of d.staged) expect(ChangeSetSchema.safeParse(changeSet).success).toBe(true);
	});

	it("leaves cards staged before start_campaign, and in a set without it, ungrouped", async () => {
		const d = deps();
		const tools = createMerchantTools(d, set(...STAGING, "campaigns"));
		await call(tools, "propose_store_discounts", discountInput);
		expect(d.staged[0]?.group).toBeUndefined();

		const plain = deps({}, { campaign: undefined });
		const plainTools = createMerchantTools(plain, set(...STAGING));
		await call(plainTools, "propose_blog_post", blogPost);
		expect(plain.staged[0]?.group).toBeUndefined();
	});

	it("keeps typed-confirm and live-at-once changes (publish, theme) out of the campaign", async () => {
		const sitePrepare = vi.fn(async (kind: string) => (kind === "discounts" ? prepared(kind, { confirmText: "SALE1111" }) : prepared(kind)));
		const d = deps({}, { sitePrepare } as unknown as Partial<MerchantToolDeps>);
		const tools = createMerchantTools(d, set(...STAGING, "campaigns"));
		await call(tools, "start_campaign", { label: "11.11" });

		await call(tools, "propose_store_discounts", { why: "x", changes: [{ op: "delete", discountId: "1" }] });
		await call(tools, "propose_theme_change", { siteId: "5", why: "x", changes: [] });
		await call(tools, "propose_publish", { siteId: "5", why: "x" });
		await call(tools, "propose_page_patch", patchInput);

		expect(d.staged.map((c) => [c.action?.kind, c.group?.step])).toEqual([
			["store.discounts_patch", undefined],
			["site.theme_patch", undefined],
			["site.publish", undefined],
			["site.page_patch", 1],
		]);
	});

	it("survives the tools being rebuilt after a pause, and a second campaign gets its own group", async () => {
		const holder: { campaign?: CampaignState } = {};
		const first = deps(holder);
		await call(createMerchantTools(first, set(...STAGING, "campaigns")), "start_campaign", { label: "11.11" });
		await call(createMerchantTools(first, set(...STAGING, "campaigns")), "propose_store_discounts", discountInput);
		// the run state is saved on a pause; the tools are rebuilt on resume from it
		const resumed = deps(JSON.parse(JSON.stringify(holder)));
		const tools = createMerchantTools(resumed, set(...STAGING, "campaigns"));
		await call(tools, "propose_page_patch", patchInput);
		await call(tools, "start_campaign", { label: "Weekend" });
		await call(tools, "propose_store_discounts", discountInput);

		expect(first.staged[0]?.group).toEqual({ id: "cmp_run_7_1", label: "11.11", step: 1 });
		expect(resumed.staged.map((c) => c.group)).toEqual([
			{ id: "cmp_run_7_1", label: "11.11", step: 2 },
			{ id: "cmp_run_7_2", label: "Weekend", step: 1 },
		]);
	});

	it("an ungrouped deployment still answers start_campaign without linking anything", async () => {
		const d = deps({}, { campaign: undefined });
		const out = await call(createMerchantTools(d, set(...STAGING, "campaigns")), "start_campaign", { label: "11.11" });
		await call(createMerchantTools(d, set(...STAGING, "campaigns")), "propose_store_discounts", discountInput);

		expect(out.campaign).toBe("11.11");
		expect(d.staged[0]?.group).toBeUndefined();
	});

	it("builds the banner from an existing block type: an announcement-bar insert_block with the code and dates", () => {
		const request = pagePatchRequest({
			siteId: "5",
			pageId: "10",
			why: "Banner 11.11",
			addToStore: null,
			ops: [
				{
					op: "insert_block",
					blockId: null,
					afterBlockId: null,
					blockType: "announcement-bar",
					variant: "gradient",
					fields: [
						{ name: "message", valueJson: '"Giảm 15% với mã SALE1111, đến hết 15/11"' },
						{ name: "linkText", valueJson: '"Xem bộ skincare"' },
						{ name: "linkUrl", valueJson: '"/collections/skincare"' },
					],
					path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null,
				},
			],
		});

		expect(request).toMatchObject({
			ops: [{ op: "insert_block", afterBlockId: null, block: { blockType: "announcement-bar", variant: "gradient", message: "Giảm 15% với mã SALE1111, đến hết 15/11", linkUrl: "/collections/skincare" } }],
		});
	});
});

describe("change set group [TC-AICP-219]", () => {
	const base = {
		id: "cs_1",
		runId: "run_1",
		domain: "campaigns",
		title: "t",
		summary: "",
		risk: "low",
		blastRadius: { kind: "x", count: 1, label: "x" },
		diffs: [{ entity: { kind: "k", id: "1" }, field: "f", before: null, after: "a", provenance: "generated" }],
		status: "pending",
		stagedBy: "agent",
		stagedAt: "2026-10-22T00:00:00Z",
		expiresAt: "2026-10-23T00:00:00Z",
	};

	it("is optional (older change sets parse unchanged) and survives a parse when present", () => {
		const old = ChangeSetSchema.parse(base);
		expect(old.group).toBeUndefined();
		expect("group" in old).toBe(false);
		const grouped = ChangeSetSchema.parse({ ...base, group: { id: "cmp_1", label: "11.11", step: 2 } });
		expect(grouped.group).toEqual({ id: "cmp_1", label: "11.11", step: 2 });
		expect(ChangeSetSchema.parse({ ...base, group: { id: "cmp_1", label: "11.11" } }).group).toEqual({ id: "cmp_1", label: "11.11" });
	});

	it("refuses an empty id or label", () => {
		expect(ChangeSetSchema.safeParse({ ...base, group: { id: "", label: "11.11" } }).success).toBe(false);
		expect(ChangeSetSchema.safeParse({ ...base, group: { id: "cmp_1", label: "" } }).success).toBe(false);
	});

	it("keeps the label short and single-line", () => {
		const group = createCampaignRun("run_1", {}).begin(`  ${"x ".repeat(100)}\n `);
		expect(group.label.length).toBeLessThanOrEqual(60);
		expect(group.label).not.toMatch(/\s{2}|\n/);
	});
});

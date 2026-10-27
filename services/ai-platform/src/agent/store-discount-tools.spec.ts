import { ChangeSetSchema } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CAPABILITIES, type Capability, OPT_IN_CAPABILITIES, parseCapabilityList } from "../config/capabilities";
import type { PreparedSiteChange } from "../shop/shop-tools";
import { buildSiteChangeSet } from "./change-set-builders";
import { ALL_CAPABILITIES, capabilitySet, TOOL_CAPABILITIES } from "./merchant-capabilities";
import { MERCHANT_INSTRUCTIONS, merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";
import { StoreDiscountsReadInputSchema, StoreDiscountsToolInputSchema } from "./store-discount-schemas";

// TC-AICP-141..144 — the copilot's discount tools: the capability (on by default, next to shop_products
// too), the strict tool inputs, the card staged as marketing ("campaigns") data, and the instructions.

const ctx = { id: "cs_disc00000001", runId: "run_1", now: new Date("2026-10-22T04:00:00Z") };
const set = (...capabilities: Capability[]) => capabilitySet(capabilities);
const STAGING: Capability[] = ["site", "blog", "stock_photos", "shop_products"];
const DISCOUNT_TOOLS = ["store_discounts", "propose_store_discounts"];

function deps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	let edits = 0;
	return {
		runId: "run_1",
		newChangeSetId: () => ctx.id,
		now: () => ctx.now,
		stage: vi.fn(async () => undefined),
		allowEdit: () => ++edits <= 10,
		storeDiscounts: vi.fn(async () => ({ discounts: [] })),
		sitePrepare: vi.fn(async () => ({ error: { code: "x", message: "x" } })),
		createdInChat: () => [],
		...overrides,
	} as unknown as MerchantToolDeps;
}

const names = (capabilities: ReturnType<typeof set>) => Object.keys(createMerchantTools(deps(), capabilities));
const run = (tools: ReturnType<typeof createMerchantTools>, name: "store_discounts" | "propose_store_discounts", input: unknown) =>
	(tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });
const jsonSchema = (schema: unknown) => z.toJSONSchema(schema as z.ZodType, { io: "input", unrepresentable: "any" }) as Record<string, any>;

const line = (field: string, before: string | null, after: string, id = "1") => ({ entity: { kind: "store_discount", id, label: "SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used" }, field, before, after });
const prepared = (extra: Record<string, unknown> = {}): PreparedSiteChange =>
	({
		kind: "store.discounts_patch",
		title: "Change discount: SUMMER10",
		why: "Raya",
		risk: "medium",
		diffs: [line("Discount", "10% off", "15% off"), line("Ends", "31 Dec 2026", "15 Jan 2027")],
		guardrails: [{ rule: "undo", ok: true, detail: "You can undo it for 7 days." }],
		plan: { steps: [{ op: "update", discountId: 1, data: { value: 15 } }], base: { "1": "u1" } },
		...extra,
	}) as PreparedSiteChange;
const stagedOf = (d: MerchantToolDeps) => (d.stage as ReturnType<typeof vi.fn>).mock.calls[0]![0];

const update = { op: "update" as const, discountId: "1", code: null, type: null, amount: 15, description: null, usageLimit: null, removeLimit: false, startsOn: null, removeStart: false, endsOn: "2027-01-15", removeEnd: false, siteId: null, allSites: false };

describe("store_discounts capability [TC-AICP-141]", () => {
	it("is on by default (not opt-in), maps both tools to itself, and needs and excludes nothing", () => {
		expect(CAPABILITIES).toContain("store_discounts");
		expect(OPT_IN_CAPABILITIES).not.toContain("store_discounts");
		expect(ALL_CAPABILITIES.has("store_discounts")).toBe(true);
		for (const tool of DISCOUNT_TOOLS) expect(TOOL_CAPABILITIES[tool as keyof typeof TOOL_CAPABILITIES]).toEqual(["store_discounts"]);
		expect(names(ALL_CAPABILITIES)).toEqual(expect.arrayContaining(DISCOUNT_TOOLS));
		expect(names(set("store_discounts"))).toEqual(["ask_user", "current_page", ...DISCOUNT_TOOLS]);
		expect(names(set("site", "blog"))).not.toEqual(expect.arrayContaining(DISCOUNT_TOOLS));
	});

	it("works next to shop_products: the staging list plus store_discounts parses and offers the tools after the site ones", () => {
		const parsed = parseCapabilityList("site,blog,stock_photos,shop_products,store_discounts");

		expect(parsed).toEqual({ capabilities: ["site", "blog", "stock_photos", "shop_products", "store_discounts"] });
		const offered = names(set(...STAGING, "store_discounts"));
		expect(offered).toEqual(expect.arrayContaining([...DISCOUNT_TOOLS, "propose_shop_product_update", "propose_publish"]));
		expect(offered.indexOf("store_discounts")).toBeGreaterThan(offered.indexOf("propose_site_languages"));
		expect(offered.indexOf("propose_store_discounts")).toBeLessThan(offered.indexOf("propose_publish"));
		// a deployment without it keeps exactly the staging tools
		expect(names(set(...STAGING))).not.toEqual(expect.arrayContaining(DISCOUNT_TOOLS));
	});

	it("tells the model about the discount tools only where the set has them, in the shop's own words", () => {
		const staging = merchantInstructions(set(...STAGING, "store_discounts"));

		expect(staging).toContain("store_discounts / propose_store_discounts");
		expect(staging).toContain("manage discount codes");
		expect(staging).not.toMatch(/Product Master|Product Store|SSOT|undefined|\[object/);
		expect(merchantInstructions(set(...STAGING))).not.toMatch(/discount/i);
		expect(MERCHANT_INSTRUCTIONS).toContain("store_discounts / propose_store_discounts");
		// alone, it names no tool it does not offer
		const alone = merchantInstructions(set("store_discounts"));
		for (const name of Object.keys(TOOL_CAPABILITIES)) if (!["ask_user", "current_page", ...DISCOUNT_TOOLS].includes(name)) expect(alone, name).not.toContain(name);
	});
});

describe("discount tool inputs [TC-AICP-142]", () => {
	it("takes strict, null-for-keep inputs: every field present, ten steps at most, amounts and dates bounded", () => {
		const read = jsonSchema(StoreDiscountsReadInputSchema);
		const propose = jsonSchema(StoreDiscountsToolInputSchema);
		const steps = propose.properties.changes.items.oneOf;
		const stepNamed = (op: string) => steps.find((s: any) => s.properties.op.const === op);

		expect(read.required.sort()).toEqual(Object.keys(read.properties).sort());
		expect(read.properties.filter.enum).toEqual(["all", "active", "inactive", "scheduled", "expired", "used_up", "expiring_soon", "unused"]);
		expect(propose.properties.changes).toMatchObject({ minItems: 1, maxItems: 10 });
		expect(steps.map((s: any) => s.properties.op.const)).toEqual(["create", "update", "activate", "pause", "delete"]);
		for (const step of steps) expect(step.required.sort()).toEqual(Object.keys(step.properties).sort());
		expect(stepNamed("create").properties.amount).toMatchObject({ exclusiveMinimum: 0, maximum: 1_000_000 });
		expect(stepNamed("create").properties.startsOn.anyOf[0].pattern).toBe("^\\d{4}-\\d{2}-\\d{2}$");
		expect(stepNamed("create").properties.status.anyOf[0].enum).toEqual(["active", "paused"]);
		expect(stepNamed("update").properties.removeEnd.type).toBe("boolean");
	});

	it("refuses a malformed card before anything is drafted", () => {
		const parse = (changes: unknown[]) => StoreDiscountsToolInputSchema.safeParse({ why: "x", changes }).success;

		expect(parse([update])).toBe(true);
		expect(parse([{ ...update, endsOn: "31/12/2026" }])).toBe(false);
		expect(parse([{ ...update, discountId: "abc" }])).toBe(false);
		expect(parse([{ op: "delete" }])).toBe(false);
		expect(parse(Array.from({ length: 11 }, () => ({ op: "pause", discountId: "1" })))).toBe(false);
		expect(StoreDiscountsReadInputSchema.safeParse({ id: null, code: null, query: null, filter: "all", limit: 50 }).success).toBe(false);
	});
});

describe("discount cards [TC-AICP-143]", () => {
	it("reads through the platform with the model's input", async () => {
		const d = deps();
		const input = { id: null, code: null, query: "raya", filter: "unused", limit: 10 };

		await run(createMerchantTools(d), "store_discounts", input);

		expect(d.storeDiscounts).toHaveBeenCalledWith(input);
	});

	it("stages prime-web's card as a campaigns change set, labelled with the codes it touches", async () => {
		const d = deps({ sitePrepare: vi.fn(async () => prepared()) });

		const out = await run(createMerchantTools(d), "propose_store_discounts", { why: "Raya", changes: [update] });

		expect(d.sitePrepare).toHaveBeenCalledWith("discounts", { why: "Raya", changes: [update] });
		expect(out).toMatchObject({ changeSetId: ctx.id, changes: 2 });
		const staged = stagedOf(d);
		expect(() => ChangeSetSchema.parse(staged)).not.toThrow();
		expect(staged).toMatchObject({ domain: "campaigns", risk: "medium", action: { kind: "store.discounts_patch" }, blastRadius: { kind: "store_discount", count: 1, label: "1 discount code" } });
		expect(staged.confirmText).toBeUndefined();
	});

	it("asks for the code(s) typed when one is deleted, and counts every code on the card", () => {
		const cs = buildSiteChangeSet(
			prepared({ title: "Delete discount: SUMMER10", risk: "high", confirmText: "SUMMER10, OLD20", diffs: [line("Deleted", "Used 23 times", "Deleted — the code stops working", "1"), line("Deleted", null, "Deleted — the code stops working", "3")] }),
			ctx,
		);

		expect(() => ChangeSetSchema.parse(cs)).not.toThrow();
		expect(cs).toMatchObject({ domain: "campaigns", risk: "high", confirmText: "SUMMER10, OLD20", blastRadius: { count: 2, label: "2 discount codes" } });
	});

	it("passes a refusal back to the model and stages nothing; respects the edit limit", async () => {
		const refusal = { error: { code: "code_taken", message: "The code SUMMER10 already exists." } };
		const refused = deps({ sitePrepare: vi.fn(async () => refusal) });
		const limited = deps({ allowEdit: () => false, sitePrepare: vi.fn() });

		expect(await run(createMerchantTools(refused), "propose_store_discounts", { why: "x", changes: [update] })).toEqual(refusal);
		expect(refused.stage).not.toHaveBeenCalled();
		expect(await run(createMerchantTools(limited), "propose_store_discounts", { why: "x", changes: [update] })).toMatchObject({ error: { code: "limit" } });
		expect(limited.sitePrepare).not.toHaveBeenCalled();
	});
});

describe("discount instructions [TC-AICP-144]", () => {
	const text = merchantInstructions(set("store_discounts", "shop_products"));

	it("asks instead of guessing a missing amount, type or end date, and never reuses a code", () => {
		expect(text).toContain("Read store_discounts first: a code can't be used twice");
		expect(text).toContain("no amount or no type (% or RM) → ask_user");
		expect(text).toContain("a campaign with no end date given → ask_user until when");
		expect(text).toContain("suggest one from the campaign");
	});

	it("states the defaults it may use, the activation limits and the delete rule", () => {
		expect(text).toContain("Left unsaid, a code starts now, has no usage limit, applies to every site and is active");
		expect(text).toContain("A code that ended or used up its limit can't be switched on");
		expect(text).toContain("Delete only when asked (they type the code to approve); when they only want it to stop, pause it");
	});
});

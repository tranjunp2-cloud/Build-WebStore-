import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CAPABILITIES, type Capability, OPT_IN_CAPABILITIES, parseCapabilityList } from "../config/capabilities";
import { ALL_CAPABILITIES, capabilitySet, TOOL_CAPABILITIES } from "./merchant-capabilities";
import { MERCHANT_INSTRUCTIONS, merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";
import { REPORT_PERIODS, StoreReportsInputSchema, StoreTodosInputSchema } from "./store-report-schemas";

// TC-AICP-181..185 — the copilot's read-only reports and insights: the capability (on by default, read-only, works
// next to shop_products too), the strict tool inputs, the calls through the platform, and the "exact numbers" rules.

const set = (...capabilities: Capability[]) => capabilitySet(capabilities);
const STAGING: Capability[] = ["site", "blog", "stock_photos", "shop_products"];
const REPORT_TOOLS = ["store_reports", "store_todos"];

function deps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	return {
		runId: "run_1",
		newChangeSetId: () => "cs_1",
		now: () => new Date("2026-10-22T04:00:00Z"),
		stage: vi.fn(async () => undefined),
		allowEdit: () => true,
		createdInChat: () => [],
		...overrides,
	} as unknown as MerchantToolDeps;
}

const names = (capabilities: ReturnType<typeof set>) => Object.keys(createMerchantTools(deps(), capabilities));
const run = (tools: Partial<ReturnType<typeof createMerchantTools>>, name: "store_reports" | "store_todos", input: unknown) =>
	(tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });
const jsonSchema = (schema: unknown) => z.toJSONSchema(schema as z.ZodType, { io: "input", unrepresentable: "any" }) as Record<string, any>;

const sales = { metric: "sales" as const, period: "last_7_days" as const, from: null, to: null, compare: true, rankBy: null, limit: null };

describe("store_reports capability [TC-AICP-181]", () => {
	it("is on by default (not opt-in), maps both read tools to itself, and needs and excludes nothing", () => {
		expect(CAPABILITIES).toContain("store_reports");
		expect(OPT_IN_CAPABILITIES).not.toContain("store_reports");
		expect(ALL_CAPABILITIES.has("store_reports")).toBe(true);
		for (const tool of REPORT_TOOLS) expect(TOOL_CAPABILITIES[tool as keyof typeof TOOL_CAPABILITIES]).toEqual(["store_reports"]);
		expect(names(set("store_reports"))).toEqual(["ask_user", "current_page", ...REPORT_TOOLS]);
		expect(names(set("site", "blog"))).not.toEqual(expect.arrayContaining(REPORT_TOOLS));
	});

	it("works next to shop_products: the staging list plus store_reports parses and offers the tools before publish", () => {
		const parsed = parseCapabilityList("site,blog,stock_photos,shop_products,store_reports");

		expect(parsed).toEqual({ capabilities: ["site", "blog", "stock_photos", "shop_products", "store_reports"] });
		const offered = names(set(...STAGING, "store_reports"));
		expect(offered).toEqual(expect.arrayContaining([...REPORT_TOOLS, "propose_shop_product_update", "propose_publish"]));
		expect(offered.indexOf("store_reports")).toBeLessThan(offered.indexOf("propose_publish"));
		expect(names(set(...STAGING))).not.toEqual(expect.arrayContaining(REPORT_TOOLS));
	});

	it("is read-only: no write tool and no change set comes with it", async () => {
		const offered = names(set("store_reports"));
		const d = deps({ storeReports: vi.fn(async () => ({ ok: true })) });

		await run(createMerchantTools(d, set("store_reports")), "store_reports", sales);

		expect(offered.filter((n) => n.startsWith("propose_"))).toEqual([]);
		expect(d.stage).not.toHaveBeenCalled();
	});
});

describe("report tool inputs [TC-AICP-182]", () => {
	it("takes strict inputs: every field present, null = default, periods and metrics from fixed lists", () => {
		const reports = jsonSchema(StoreReportsInputSchema);
		const todos = jsonSchema(StoreTodosInputSchema);

		expect(reports.required.sort()).toEqual(Object.keys(reports.properties).sort());
		expect(reports.properties.metric.enum).toEqual(["sales", "top_products", "discounts", "traffic", "orders_by_status"]);
		expect(reports.properties.period.anyOf[0].enum).toEqual([...REPORT_PERIODS]);
		expect(REPORT_PERIODS).toEqual(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]);
		expect(reports.properties.limit.anyOf[0]).toMatchObject({ minimum: 1, maximum: 20 });
		expect(todos.required).toEqual(["limit"]);
	});

	it("refuses a malformed request before anything is read", () => {
		const parse = (patch: Record<string, unknown>) => StoreReportsInputSchema.safeParse({ ...sales, ...patch }).success;

		expect(parse({})).toBe(true);
		expect(parse({ period: "custom", from: "2026-10-01", to: "2026-10-15" })).toBe(true);
		expect(parse({ period: "last_year" })).toBe(false);
		expect(parse({ period: "custom", from: "01/10/2026", to: "2026-10-15" })).toBe(false);
		expect(parse({ metric: "profit" })).toBe(false);
		expect(parse({ limit: 50 })).toBe(false);
		expect(StoreReportsInputSchema.safeParse({ metric: "sales" }).success).toBe(false);
	});
});

describe("report tools [TC-AICP-183]", () => {
	it("reads through the platform with the model's input and returns the numbers untouched", async () => {
		const numbers = { metric: "sales", current: { revenue: 1234.5, orders: 12 }, change: { revenuePercent: null } };
		const d = deps({ storeReports: vi.fn(async () => numbers), storeTodos: vi.fn(async () => ({ total: 0, allClear: true })) });
		const tools = createMerchantTools(d, set("store_reports"));

		expect(await run(tools, "store_reports", sales)).toEqual(numbers);
		expect(d.storeReports).toHaveBeenCalledWith(sales);
		expect(await run(tools, "store_todos", { limit: 5 })).toEqual({ total: 0, allClear: true });
		expect(d.storeTodos).toHaveBeenCalledWith({ limit: 5 });
	});

	it("answers 'unavailable' instead of inventing numbers when the platform has no reports", async () => {
		const tools = createMerchantTools(deps(), set("store_reports"));

		expect(await run(tools, "store_reports", sales)).toMatchObject({ error: { code: "unavailable" } });
		expect(await run(tools, "store_todos", { limit: null })).toMatchObject({ error: { code: "unavailable" } });
	});

	it("describes the exact-numbers contract in the tool itself", () => {
		const tools = createMerchantTools(deps(), set("store_reports")) as Record<string, { description?: string }>;

		expect(tools.store_reports?.description).toContain("Answer ONLY with the numbers the tool returns");
		expect(tools.store_reports?.description).toContain("never estimate");
		expect(tools.store_todos?.description).toContain("ready `prompt`");
	});
});

describe("report instructions [TC-AICP-184]", () => {
	const text = merchantInstructions(set("store_reports", "shop_products"));

	it("tells the model to state period, currency and the sales definition, and never to estimate", () => {
		expect(text).toContain("answer ONLY with the numbers it returns");
		expect(text).toContain("the period (the from – to days), the currency (RM, Malaysia time)");
		expect(text).toContain("sales = accepted orders (not pending, cancelled, failed or refunded)");
		expect(text).toContain("Never estimate, round up or compare with a period you did not read");
		expect(text).toContain("A percent of null = nothing to compare with");
		expect(text).toContain("No data for the period: say there are no orders, do not invent a trend");
	});

	it("handles the to do list: counts first, then the first task, honest about what the chat can not do", () => {
		expect(text).toContain("store_todos lists what needs attention now");
		expect(text).toContain("give the counts and offer to start on the first task");
		expect(text).toContain("tell the merchant plainly which part you cannot do from the chat");
	});
});

describe("report instructions only where the capability is [TC-AICP-185]", () => {
	it("names the tools in the full set and in a reports-only set, and nowhere else", () => {
		expect(MERCHANT_INSTRUCTIONS).toContain("store_reports / store_todos");
		expect(merchantInstructions(set("store_reports"))).toContain("report on sales, best sellers, discount codes and traffic");
		expect(merchantInstructions(set(...STAGING))).not.toMatch(/store_reports|store_todos/);
		const alone = merchantInstructions(set("store_reports"));
		for (const name of Object.keys(TOOL_CAPABILITIES)) if (!["ask_user", "current_page", ...REPORT_TOOLS].includes(name)) expect(alone, name).not.toContain(name);
	});
});

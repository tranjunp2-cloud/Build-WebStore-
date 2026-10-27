import { describe, expect, it, vi } from "vitest";
import { capabilitySet } from "./merchant-capabilities";
import { messageLanguage } from "./message-language";
import { type Call, ctx, runHarness, scripted } from "./run-harness.spec-helper";
import { READ_SHORTCUTS } from "./run-intents";
import { ruleSuggestions } from "./suggest-next";

// TC-AISEC-083..084 — next-message suggestions without the run's whole prompt: built from what the run did when
// a rule fits (staged cards, reads, the To do list's ready prompts), else one tiny call on the FAST model (no
// tools, no copilot instructions); AI_SUGGEST_MODE=model|off.

const full = capabilitySet(["site", "blog", "store_discounts", "store_reports", "store_orders", "campaigns"]);
const facts = (overrides: Partial<Parameters<typeof ruleSuggestions>[0]>) => ({ staged: [], reads: [], prompt: "x", language: "en" as const, capabilities: full, ...overrides });

describe("suggestions from what the run did [TC-AISEC-083]", () => {
	it("after a discount code: a banner, an announcement and the sales — only what the deployment can do", () => {
		// Arrange + Act
		const withSite = ruleSuggestions(facts({ staged: ["store.discounts_patch"] }));
		const withoutSite = ruleSuggestions(facts({ staged: ["store.discounts_patch"], capabilities: capabilitySet(["store_discounts", "store_reports"]) }));

		// Assert
		expect(withSite.map((s) => s.prompt)).toEqual(["Add a homepage banner for this code", "Write a blog post announcing this code", READ_SHORTCUTS.sales_7_days.text.en]);
		expect(withoutSite).toEqual([]);
	});

	it("[TC-AISEC-132] says they were made by rules (not by the model)", () => {
		// Arrange + Act
		const out = ruleSuggestions(facts({ staged: ["store.discounts_patch"] }));

		// Assert
		expect(out.length).toBeGreaterThan(0);
		expect(new Set(out.map((s) => s.source))).toEqual(new Set(["rules"]));
	});

	it("after a sales read: the next reads as chips the platform answers itself, never the question just asked", () => {
		// Arrange + Act
		const out = ruleSuggestions(facts({ reads: [{ tool: "store_reports", input: { metric: "sales", period: "today" } }], prompt: "What needs my attention today?" }));

		// Assert
		expect(out.map((s) => s.prompt)).toEqual([READ_SHORTCUTS.top_this_month.text.en, READ_SHORTCUTS.sales_last_month.text.en]);
	});

	it("offers the To do list's own ready prompts in the merchant's language", () => {
		// Arrange
		const value = { items: [{ prompt: "Confirm the 2 pending orders" }, { prompt: "Write descriptions for 3 products" }, { prompt: "Pastikan 2 pesanan untuk saya" }] };

		// Act
		const english = ruleSuggestions(facts({ reads: [{ tool: "store_todos", value }] }));

		// Assert
		expect(english.map((s) => s.prompt)).toEqual(["Confirm the 2 pending orders", "Write descriptions for 3 products"]);
	});

	it("writes Vietnamese and Malay chips for Vietnamese and Malay messages", () => {
		// Arrange + Act
		const vi = ruleSuggestions(facts({ staged: ["site.page_patch"], language: messageLanguage("Sửa tiêu đề trang chủ") }));
		const ms = ruleSuggestions(facts({ staged: ["site.page_patch"], language: messageLanguage("Tolong tukar tajuk halaman utama saya") }));

		// Assert
		expect(vi.map((s) => s.prompt)).toEqual(["Kiểm tra website trước khi xuất bản", "Xuất bản website của tôi"]);
		expect(ms.map((s) => s.prompt)).toEqual(["Semak laman web saya sebelum terbit", "Terbitkan laman web saya"]);
	});

	it("in a run, a rule's suggestions cost no model call", async () => {
		// Arrange
		const storeReports = vi.fn(async () => ({ metric: "sales" }));
		const input = { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null };
		const { service, model, recorded } = runHarness({ turns: [{ tool: "store_reports", input }, { text: "RM 10 today." }], shop: { storeReports }, cacheRead: 500 });

		// Act
		const run = await service.start(ctx, { prompt: "how did we do today?", context: { module: "dashboard" } }, () => undefined);

		// Assert
		expect(run.suggestions?.map((s) => s.prompt)).toEqual([READ_SHORTCUTS.top_this_month.text.en, READ_SHORTCUTS.sales_last_month.text.en, READ_SHORTCUTS.todos.text.en]);
		expect(model.doGenerateCalls).toHaveLength(2);
		expect(recorded.map((e) => e.task)).toEqual(["agent.merchant-copilot"]);
	});
});

describe("the tiny suggestion call [TC-AISEC-084]", () => {
	it("when no rule fits: one call on the FAST model with no tools, no copilot instructions and a short prompt", async () => {
		// Arrange
		const fast = scripted([{ text: "Write a post about batik care\nFind photos for it" }]);
		const { service, recorded } = runHarness({ turns: [{ text: "Here is an idea list." }], fast, cacheRead: 500 });

		// Act
		const run = await service.start(ctx, { prompt: "give me blog ideas", context: { module: "blog" } }, () => undefined);
		const call = fast.doGenerateCalls[0] as Call;

		// Assert
		expect(run.suggestions?.map((s) => s.prompt)).toEqual(["Write a post about batik care", "Find photos for it"]);
		expect(call.tools ?? []).toEqual([]);
		expect(JSON.stringify(call.prompt).length).toBeLessThan(3_000);
		expect(JSON.stringify(call.prompt)).toContain("Merchant: give me blog ideas");
		expect(recorded.find((e) => e.task === "agent.suggest-next")).toMatchObject({ model: "gpt-4.1-nano" });
	});

	it("AI_SUGGEST_MODE=off makes none; =model skips the rules", async () => {
		// Arrange
		const storeReports = vi.fn(async () => ({ metric: "sales" }));
		const input = { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null };
		const turns = [{ tool: "store_reports", input }, { text: "RM 10 today." }];
		const fast = scripted([{ text: "Show this week's sales\nCompare with last week" }]);
		const off = runHarness({ turns, shop: { storeReports }, cacheRead: 500, env: { AI_SUGGEST_MODE: "off" } });
		const model = runHarness({ turns, shop: { storeReports }, cacheRead: 500, env: { AI_SUGGEST_MODE: "model" }, fast });

		// Act
		const quiet = await off.service.start(ctx, { prompt: "how did we do today?" }, () => undefined);
		const asked = await model.service.start(ctx, { prompt: "how did we do today?" }, () => undefined);

		// Assert
		expect(quiet.suggestions).toBeUndefined();
		expect(asked.suggestions?.map((s) => s.prompt)).toEqual(["Show this week's sales", "Compare with last week"]);
	});
});

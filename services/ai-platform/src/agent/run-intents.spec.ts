import { describe, expect, it, vi } from "vitest";
import { capabilitySet } from "./merchant-capabilities";
import { ctx, runHarness } from "./run-harness.spec-helper";
import { intentAnswer, intentForPrompt, READ_SHORTCUTS, resolveIntent } from "./run-intents";

// TC-AISEC-087..089 — read-only shortcuts: a chip the platform wrote or a start-run intent runs the read tool
// directly and answers from its numbers with no provider call (en / ms / vi); only read-only tools the request
// may use, valid arguments; anything else, or a result a template can't word, goes to the model.

const all = capabilitySet(["store_reports", "store_orders", "site"]);
const salesToday = {
	metric: "sales",
	shop: { currency: "MYR", timezone: "Asia/Kuala_Lumpur", today: "2026-10-22" },
	period: { key: "today", from: "2026-10-22", to: "2026-10-22", days: 1 },
	comparedWith: { from: "2026-10-21", to: "2026-10-21", days: 1 },
	currency: "MYR",
	definition: "Sales = orders the shop accepted…",
	current: { from: "2026-10-22", to: "2026-10-22", revenue: 1234.5, orders: 12, averageOrderValue: 102.88, completedRevenue: 980, completedOrders: 9, discountGiven: 0, otherCurrencyOrders: 0 },
	daily: [],
	previous: { from: "2026-10-21", to: "2026-10-21", revenue: 980, orders: 10, averageOrderValue: 98, completedRevenue: 980, completedOrders: 10, discountGiven: 0, otherCurrencyOrders: 0 },
	change: { revenuePercent: 26, ordersPercent: 20, averageOrderValuePercent: 5, revenueDifference: 254.5 },
};

describe("which requests may skip the model [TC-AISEC-087]", () => {
	it("accepts read-only tools the request may use, with valid arguments, and fills the defaults", () => {
		// Arrange + Act
		const sales = resolveIntent({ tool: "store_reports", args: { metric: "sales", period: "today" } }, all);
		const todos = resolveIntent({ tool: "store_todos" }, all);

		// Assert
		expect(sales).toEqual({ tool: "store_reports", args: { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null } });
		expect(todos).toEqual({ tool: "store_todos", args: { limit: null } });
	});

	it("refuses tools that stage changes, tools the capabilities don't allow, bad arguments and metrics no template words", () => {
		// Arrange
		const cases = [
			{ tool: "propose_store_orders", args: {} },
			{ tool: "store_orders", args: { view: "needs_action" } },
			{ tool: "store_reports", args: { metric: "refunds" } },
			{ tool: "store_reports", args: { metric: "traffic" } },
		];

		// Act + Assert
		for (const intent of cases) expect(resolveIntent(intent, all)).toBeNull();
		expect(resolveIntent({ tool: "store_reports", args: { metric: "sales" } }, capabilitySet(["site"]))).toBeNull();
	});

	it("knows the platform's own read chips in every language, and nothing else", () => {
		// Arrange + Act + Assert
		for (const shortcut of Object.values(READ_SHORTCUTS)) {
			for (const text of Object.values(shortcut.text)) expect(intentForPrompt(`  ${text}  `)).toEqual(shortcut.intent);
		}
		expect(intentForPrompt("Show today's sales and confirm the orders")).toBeUndefined();
	});
});

describe("a shortcut answers without a model call [TC-AISEC-088]", () => {
	it("runs the read, answers from its numbers (period, RM, definition) and records no model call", async () => {
		// Arrange
		const storeReports = vi.fn(async () => salesToday);
		const { service, model, recorded } = runHarness({ turns: [{ text: "never" }], shop: { storeReports } });

		// Act
		const run = await service.start(ctx, { prompt: "Show today's sales", context: { module: "dashboard" } }, () => undefined);

		// Assert
		expect(storeReports).toHaveBeenCalledWith(ctx, { metric: "sales", period: "today" });
		expect(model.doGenerateCalls).toHaveLength(0);
		expect(recorded).toEqual([]);
		expect(run.status).toBe("applied");
		expect(run.answer).toContain("Today (2026-10-22): sales RM 1,234.50 from 12 orders, average order RM 102.88.");
		expect(run.answer).toContain("The period before (2026-10-21): RM 980.00 (+26%).");
		expect(run.answer).toMatch(/Malaysia time/);
		expect(run.receipts.map((r) => r.tool)).toEqual(["store.reports"]);
	});

	it("answers in the merchant's language and takes an explicit intent from the client", async () => {
		// Arrange
		const storeTodos = vi.fn(async () => ({ total: 2, items: [{ title: "2 đơn hàng chờ xác nhận", detail: "Lâu nhất 3 giờ", prompt: "x" }, { title: "1 mã giảm giá sắp hết hạn", detail: "", prompt: "y" }] }));
		const { service, model } = runHarness({ turns: [{ text: "never" }], shop: { storeTodos } });

		// Act
		const run = await service.start(ctx, { prompt: "Hôm nay tôi cần làm gì?", intent: { tool: "store_todos" } }, () => undefined);

		// Assert
		expect(model.doGenerateCalls).toHaveLength(0);
		expect(run.answer).toBe("2 việc cần bạn xử lý:\n1. 2 đơn hàng chờ xác nhận — Lâu nhất 3 giờ\n2. 1 mã giảm giá sắp hết hạn\nBạn muốn bắt đầu với việc nào?");
	});

	it("words Malay too", () => {
		// Arrange + Act
		const answer = intentAnswer({ tool: "store_reports", args: { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null } }, salesToday, "ms");

		// Assert
		expect(answer).toContain("Hari ini (2026-10-22): jualan RM 1,234.50 daripada 12 pesanan");
	});
});

describe("a shortcut that can't answer goes to the model [TC-AISEC-089]", () => {
	it("falls back to the model when the read refuses (no orders permission)", async () => {
		// Arrange
		const storeReports = vi.fn(async () => ({ error: { code: "no_orders_permission", message: "Your role can't see sales." } }));
		const { service, model } = runHarness({ turns: [{ text: "Your role can't see sales numbers; ask the owner." }], shop: { storeReports } });

		// Act
		const run = await service.start(ctx, { prompt: "Show today's sales" }, () => undefined);

		// Assert
		expect(model.doGenerateCalls.length).toBeGreaterThanOrEqual(1);
		expect(run.answer).toBe("Your role can't see sales numbers; ask the owner.");
	});

	it("never shortcuts a message that asks for more than one of its chips", async () => {
		// Arrange
		const storeReports = vi.fn(async () => salesToday);
		const { service, model } = runHarness({ turns: [{ text: "ok" }], shop: { storeReports } });

		// Act
		await service.start(ctx, { prompt: "Show today's sales, then draft a discount code" }, () => undefined);

		// Assert
		expect(storeReports).not.toHaveBeenCalled();
		expect(model.doGenerateCalls.length).toBeGreaterThanOrEqual(1);
	});
});

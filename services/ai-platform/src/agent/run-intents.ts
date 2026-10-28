import { z } from "zod";
import type { FlowLanguage } from "./ask/flow-copy";
import { type CapabilitySet, toolAllowed } from "./merchant-capabilities";
import { type StoreReportsInput, StoreReportsInputSchema, type StoreTodosInput, StoreTodosInputSchema } from "./store-report-schemas";

/**
 * Read-only shortcuts (cost): a message that is exactly a known read — a suggestion chip the platform
 * wrote ("Show today's sales"), or a start-run `intent` — runs the read tool directly and answers from a
 * template, with no model call. Only tools that stage nothing qualify; anything that drafts a change
 * still goes through the model. A shortcut whose result the template can't word (an error, an
 * unexpected shape) falls back to the model with the same message.
 */

export const INTENT_TOOLS = ["store_reports", "store_todos"] as const;
export type IntentTool = (typeof INTENT_TOOLS)[number];

/** A start-run intent as the client may send it (validated again per tool below). */
export const RunIntentInputSchema = z.object({
	tool: z.string().min(1).max(60),
	args: z.record(z.string(), z.unknown()).optional(),
});
export type RunIntentInput = z.infer<typeof RunIntentInputSchema>;

export type RunIntent = { tool: "store_reports"; args: StoreReportsInput } | { tool: "store_todos"; args: StoreTodosInput };

/** The metrics a template can answer (others go to the model). */
const TEMPLATED_METRICS = new Set<StoreReportsInput["metric"]>(["sales", "top_products", "orders_by_status"]);

/**
 * An intent the run may execute without the model: a read-only tool this request's capabilities allow,
 * with arguments its schema accepts (missing optional fields are null, the tool's default).
 */
export function resolveIntent(raw: RunIntentInput | undefined, capabilities: CapabilitySet): RunIntent | null {
	if (!raw || !(INTENT_TOOLS as readonly string[]).includes(raw.tool)) return null;
	if (!toolAllowed(raw.tool as IntentTool, capabilities)) return null;
	if (raw.tool === "store_reports") {
		const parsed = StoreReportsInputSchema.safeParse({ period: null, from: null, to: null, compare: null, rankBy: null, limit: null, ...raw.args });
		if (!parsed.success || !TEMPLATED_METRICS.has(parsed.data.metric)) return null;
		return { tool: "store_reports", args: parsed.data };
	}
	const parsed = StoreTodosInputSchema.safeParse({ limit: null, ...raw.args });
	return parsed.success ? { tool: "store_todos", args: parsed.data } : null;
}

type Texts = Record<FlowLanguage, string>;

/** Messages the platform itself offers (suggestion chips) that are exactly one read. */
export const READ_SHORTCUTS = {
	sales_today: {
		intent: { tool: "store_reports", args: { metric: "sales", period: "today" } },
		text: { en: "Show today's sales", ms: "Tunjukkan jualan hari ini", vi: "Xem doanh thu hôm nay" },
	},
	sales_7_days: {
		intent: { tool: "store_reports", args: { metric: "sales", period: "last_7_days" } },
		text: { en: "Show sales for the last 7 days", ms: "Tunjukkan jualan 7 hari lepas", vi: "Xem doanh thu 7 ngày qua" },
	},
	sales_this_month: {
		intent: { tool: "store_reports", args: { metric: "sales", period: "this_month" } },
		text: { en: "Show sales this month", ms: "Tunjukkan jualan bulan ini", vi: "Xem doanh thu tháng này" },
	},
	sales_last_month: {
		intent: { tool: "store_reports", args: { metric: "sales", period: "last_month" } },
		text: { en: "Show sales last month", ms: "Tunjukkan jualan bulan lepas", vi: "Xem doanh thu tháng trước" },
	},
	top_this_month: {
		intent: { tool: "store_reports", args: { metric: "top_products", period: "this_month" } },
		text: { en: "Show my best sellers this month", ms: "Tunjukkan produk terlaris bulan ini", vi: "Xem sản phẩm bán chạy tháng này" },
	},
	orders_by_status: {
		intent: { tool: "store_reports", args: { metric: "orders_by_status", period: "last_7_days" } },
		text: { en: "Show orders by status (last 7 days)", ms: "Tunjukkan pesanan ikut status (7 hari lepas)", vi: "Xem đơn hàng theo trạng thái (7 ngày qua)" },
	},
	todos: {
		intent: { tool: "store_todos", args: {} },
		text: { en: "What needs my attention today?", ms: "Apa yang perlu saya buat hari ini?", vi: "Hôm nay tôi cần làm gì?" },
	},
} as const satisfies Record<string, { intent: RunIntentInput; text: Texts }>;
export type ReadShortcut = keyof typeof READ_SHORTCUTS;

const key = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim().replace(/[.!?。]+$/, "").toLowerCase();
const BY_TEXT = new Map<string, RunIntentInput>(
	Object.values(READ_SHORTCUTS).flatMap((shortcut) => Object.values(shortcut.text).map((text) => [key(text), shortcut.intent as RunIntentInput])),
);

/** The intent of a message that is exactly one of the platform's own read chips (any of its languages). */
export function intentForPrompt(prompt: string): RunIntentInput | undefined {
	return BY_TEXT.get(key(prompt));
}

// ── templated answers ────────────────────────────────────────────────────────

const WORDS: Record<
	FlowLanguage,
	{
		period: Record<string, string>;
		sales: (p: { period: string; range: string; revenue: string; orders: number; aov: string | null }) => string;
		noSales: (period: string, range: string) => string;
		compared: (range: string, revenue: string, change: string | null) => string;
		completed: (revenue: string, orders: number) => string;
		definition: string;
		top: (period: string, range: string) => string;
		noTop: (period: string, range: string) => string;
		sold: (n: number) => string;
		statuses: (period: string, range: string) => string;
		noOrders: (period: string, range: string) => string;
		todos: (n: number) => string;
		allClear: string;
		start: string;
	}
> = {
	en: {
		period: { today: "Today", yesterday: "Yesterday", last_7_days: "The last 7 days", last_30_days: "The last 30 days", this_month: "This month", last_month: "Last month", custom: "This period" },
		sales: ({ period, range, revenue, orders, aov }) => `${period} (${range}): sales ${revenue} from ${orders} order${orders === 1 ? "" : "s"}${aov ? `, average order ${aov}` : ""}.`,
		noSales: (period, range) => `${period} (${range}): no sales yet.`,
		compared: (range, revenue, change) => `The period before (${range}): ${revenue}${change ? ` (${change})` : ""}.`,
		completed: (revenue, orders) => `Completed orders only: ${revenue} (${orders}).`,
		definition: "Sales count the orders the shop accepted and did not undo; days are Malaysia time.",
		top: (period, range) => `Best sellers, ${period.toLowerCase()} (${range}):`,
		noTop: (period, range) => `${period} (${range}): no products sold yet.`,
		sold: (n) => `${n} sold`,
		statuses: (period, range) => `Orders by status, ${period.toLowerCase()} (${range}):`,
		noOrders: (period, range) => `${period} (${range}): no orders.`,
		todos: (n) => `${n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} your attention:`,
		allClear: "Nothing needs your attention right now.",
		start: "Tell me which one to start with.",
	},
	ms: {
		period: { today: "Hari ini", yesterday: "Semalam", last_7_days: "7 hari lepas", last_30_days: "30 hari lepas", this_month: "Bulan ini", last_month: "Bulan lepas", custom: "Tempoh ini" },
		sales: ({ period, range, revenue, orders, aov }) => `${period} (${range}): jualan ${revenue} daripada ${orders} pesanan${aov ? `, purata pesanan ${aov}` : ""}.`,
		noSales: (period, range) => `${period} (${range}): belum ada jualan.`,
		compared: (range, revenue, change) => `Tempoh sebelumnya (${range}): ${revenue}${change ? ` (${change})` : ""}.`,
		completed: (revenue, orders) => `Pesanan selesai sahaja: ${revenue} (${orders}).`,
		definition: "Jualan mengira pesanan yang diterima kedai dan tidak dibatalkan; hari mengikut waktu Malaysia.",
		top: (period, range) => `Produk terlaris, ${period.toLowerCase()} (${range}):`,
		noTop: (period, range) => `${period} (${range}): belum ada produk terjual.`,
		sold: (n) => `${n} terjual`,
		statuses: (period, range) => `Pesanan ikut status, ${period.toLowerCase()} (${range}):`,
		noOrders: (period, range) => `${period} (${range}): tiada pesanan.`,
		todos: (n) => `${n} perkara perlu perhatian anda:`,
		allClear: "Tiada apa yang perlu perhatian anda sekarang.",
		start: "Beritahu saya yang mana hendak dimulakan.",
	},
	vi: {
		period: { today: "Hôm nay", yesterday: "Hôm qua", last_7_days: "7 ngày qua", last_30_days: "30 ngày qua", this_month: "Tháng này", last_month: "Tháng trước", custom: "Khoảng thời gian này" },
		sales: ({ period, range, revenue, orders, aov }) => `${period} (${range}): doanh thu ${revenue} từ ${orders} đơn${aov ? `, trung bình mỗi đơn ${aov}` : ""}.`,
		noSales: (period, range) => `${period} (${range}): chưa có doanh thu.`,
		compared: (range, revenue, change) => `Kỳ trước (${range}): ${revenue}${change ? ` (${change})` : ""}.`,
		completed: (revenue, orders) => `Chỉ tính đơn đã hoàn thành: ${revenue} (${orders}).`,
		definition: "Doanh thu tính các đơn cửa hàng đã nhận và không huỷ; ngày theo giờ Malaysia.",
		top: (period, range) => `Sản phẩm bán chạy, ${period.toLowerCase()} (${range}):`,
		noTop: (period, range) => `${period} (${range}): chưa bán được sản phẩm nào.`,
		sold: (n) => `đã bán ${n}`,
		statuses: (period, range) => `Đơn hàng theo trạng thái, ${period.toLowerCase()} (${range}):`,
		noOrders: (period, range) => `${period} (${range}): không có đơn nào.`,
		todos: (n) => `${n} việc cần bạn xử lý:`,
		allClear: "Hiện không có việc gì cần bạn xử lý.",
		start: "Bạn muốn bắt đầu với việc nào?",
	},
};

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const rm = (value: number) => `RM ${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const range = (period: unknown) => {
	if (!isRecord(period) || typeof period.from !== "string" || typeof period.to !== "string") return null;
	return period.from === period.to ? period.from : `${period.from} – ${period.to}`;
};

function salesAnswer(result: Record<string, unknown>, w: (typeof WORDS)[FlowLanguage], periodKey: string): string | null {
	const current = result.current;
	const span = range(result.period);
	if (!isRecord(current) || !span) return null;
	const revenue = num(current.revenue);
	const orders = num(current.orders);
	if (revenue === null || orders === null) return null;
	const label = w.period[periodKey] ?? w.period.custom ?? "";
	if (orders === 0) return [w.noSales(label, span), w.definition].join(" ");
	const aov = num(current.averageOrderValue);
	const lines = [w.sales({ period: label, range: span, revenue: rm(revenue), orders, aov: aov === null ? null : rm(aov) })];
	const previous = result.previous;
	const before = range(result.comparedWith);
	if (isRecord(previous) && before && num(previous.revenue) !== null) {
		const change = isRecord(result.change) ? num(result.change.revenuePercent) : null;
		lines.push(w.compared(before, rm(num(previous.revenue) as number), change === null ? null : `${change > 0 ? "+" : ""}${change}%`));
	}
	const completed = num(current.completedRevenue);
	const completedOrders = num(current.completedOrders);
	if (completed !== null && completedOrders !== null && completed !== revenue) lines.push(w.completed(rm(completed), completedOrders));
	lines.push(w.definition);
	return lines.join("\n");
}

function topAnswer(result: Record<string, unknown>, w: (typeof WORDS)[FlowLanguage], periodKey: string): string | null {
	const span = range(result.period);
	if (!span || !Array.isArray(result.products)) return null;
	const label = w.period[periodKey] ?? w.period.custom ?? "";
	if (result.products.length === 0) return w.noTop(label, span);
	const rows = result.products.slice(0, 10).flatMap((product, index) => {
		if (!isRecord(product) || typeof product.name !== "string") return [];
		const revenue = num(product.revenue);
		const quantity = num(product.quantity);
		return [`${index + 1}. ${product.name.slice(0, 80)} — ${revenue === null ? "" : rm(revenue)}${quantity === null ? "" : `, ${w.sold(quantity)}`}`];
	});
	return rows.length > 0 ? [w.top(label, span), ...rows].join("\n") : null;
}

function statusAnswer(result: Record<string, unknown>, w: (typeof WORDS)[FlowLanguage], periodKey: string): string | null {
	const span = range(result.period);
	if (!span || !Array.isArray(result.statuses)) return null;
	const label = w.period[periodKey] ?? w.period.custom ?? "";
	const rows = result.statuses.flatMap((row) => (isRecord(row) && typeof row.status === "string" && num(row.orders) !== null ? [`- ${row.status.replace(/_/g, " ")}: ${row.orders}${num(row.total) !== null ? ` (${rm(row.total as number)})` : ""}`] : []));
	if (rows.length === 0) return w.noOrders(label, span);
	return [w.statuses(label, span), ...rows].join("\n");
}

function todosAnswer(result: Record<string, unknown>, w: (typeof WORDS)[FlowLanguage]): string | null {
	if (result.allClear === true) return w.allClear;
	if (!Array.isArray(result.items)) return null;
	const rows = result.items.slice(0, 10).flatMap((item, index) =>
		isRecord(item) && typeof item.title === "string" ? [`${index + 1}. ${item.title}${typeof item.detail === "string" && item.detail ? ` — ${item.detail}` : ""}`] : [],
	);
	if (rows.length === 0) return w.allClear;
	const total = num(result.total) ?? rows.length;
	return [w.todos(total), ...rows, w.start].join("\n");
}

/**
 * The answer to a shortcut, worded from the tool's own numbers (never estimated), or null when the
 * result is an error or not the expected shape (the model answers instead).
 */
export function intentAnswer(intent: RunIntent, result: unknown, language: FlowLanguage): string | null {
	if (!isRecord(result) || "error" in result) return null;
	const w = WORDS[language];
	if (intent.tool === "store_todos") return todosAnswer(result, w);
	const period = intent.args.period ?? "last_7_days";
	switch (intent.args.metric) {
		case "sales":
			return salesAnswer(result, w, period);
		case "top_products":
			return topAnswer(result, w, period);
		case "orders_by_status":
			return statusAnswer(result, w, period);
		default:
			return null;
	}
}

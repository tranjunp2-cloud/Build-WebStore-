import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { canAccessArea } from "@/lib/insights/area-access";
import { discountPerformanceReport } from "@/lib/reports/discount-reports";
import { ordersByStatusReport, salesReport, topProductsReport } from "@/lib/reports/shop-reports";
import { REPORT_PERIODS, ReportPeriodError, resolveReportPeriods, shopDayKey, SHOP_CURRENCY, SHOP_TIME_ZONE } from "@/lib/reports/shop-time";
import { trafficReport } from "@/lib/reports/traffic-reports";
import type { AgentActor } from "../context";

/**
 * Reports for the copilot (`store.reports`, read-only): sales, best sellers, discount-code performance,
 * orders by status and storefront traffic, for a day / week / month in the shop's time (Asia/Kuala_Lumpur),
 * with the previous period for comparison. The numbers come from SQL over the shop's own orders and events
 * (lib/reports); the model states them as they are. Sales, products, discounts and order statuses need
 * the `orders` staff permission, like the Orders and Discounts pages; traffic is open to every member.
 */

const Day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StoreReportsInputSchema = z.object({
	metric: z.enum(["sales", "top_products", "discounts", "traffic", "orders_by_status"]),
	period: z.enum(REPORT_PERIODS).nullish(),
	/** custom period: first shop day */
	from: Day.nullish(),
	/** custom period: last shop day (inclusive) */
	to: Day.nullish(),
	/** also read the previous period of the same length (sales and traffic; default true) */
	compare: z.boolean().nullish(),
	/** best sellers by revenue or units; discount codes by revenue or number of uses */
	rankBy: z.enum(["revenue", "quantity", "count"]).nullish(),
	limit: z.number().int().min(1).max(20).nullish(),
});

const MONEY_METRICS = new Set(["sales", "top_products", "discounts", "orders_by_status"]);

export async function readStoreReports(actor: AgentActor, raw: unknown, now: Date = new Date()) {
	const input = StoreReportsInputSchema.parse(raw ?? {});
	if (MONEY_METRICS.has(input.metric) && !canAccessArea(actor.user, actor.tenantId, "orders")) {
		return { error: { code: "no_orders_permission", message: "Your role in this workspace can't see sales and order numbers. Ask the store owner, or ask about website traffic instead." } };
	}
	let periods;
	try {
		periods = resolveReportPeriods({ period: input.period ?? "last_7_days", from: input.from, to: input.to }, now);
	} catch (error) {
		if (error instanceof ReportPeriodError) return { error: { code: error.code, message: error.message } };
		throw error;
	}
	const cms = await getPayload({ config });
	const tenantId = actor.tenantId;
	const limit = input.limit ?? 5;
	const compare = input.compare ?? true;
	const { current, previous } = periods;
	const head = {
		metric: input.metric,
		shop: { currency: SHOP_CURRENCY, timezone: SHOP_TIME_ZONE, today: shopDayKey(now) },
		period: { key: input.period ?? "last_7_days", from: current.fromKey, to: current.toKey, days: current.days },
		...(compare && (input.metric === "sales" || input.metric === "traffic")
			? { comparedWith: { from: previous.fromKey, to: previous.toKey, days: previous.days } }
			: {}),
	};
	switch (input.metric) {
		case "sales":
			return { ...head, ...(await salesReport(cms, { tenantId, periods, compare })) };
		case "top_products":
			return { ...head, ...(await topProductsReport(cms, { tenantId, range: current, rankBy: input.rankBy === "quantity" ? "quantity" : "revenue", limit })) };
		case "discounts":
			return { ...head, ...(await discountPerformanceReport(cms, { tenantId, range: current, rankBy: input.rankBy === "count" || input.rankBy === "quantity" ? "count" : "revenue", limit, now })) };
		case "orders_by_status":
			return { ...head, ...(await ordersByStatusReport(cms, { tenantId, range: current })) };
		case "traffic":
			return { ...head, ...(await trafficReport(cms, { tenantId, periods, compare, limit })) };
	}
}

import { z } from "zod";

/**
 * Tool input of the report tools (capability `store_reports`, read-only): strict, every field present,
 * `null` = the default. prime-web computes the numbers with SQL over the shop's own orders and events
 * and validates the input again; the model only chooses what to look at.
 */

export const REPORT_PERIODS = ["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"] as const;

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StoreReportsInputSchema = z.object({
	metric: z
		.enum(["sales", "top_products", "discounts", "traffic", "orders_by_status"])
		.describe(
			'"sales" = revenue, number of orders and average order value (compared with the previous period); "top_products" = best sellers; "discounts" = how each discount code performed; "traffic" = storefront visits, sessions, cart and checkout events, top pages and referrers; "orders_by_status" = how many orders are in each status',
		),
	period: z
		.enum(REPORT_PERIODS)
		.nullable()
		.describe('The time range in the shop\'s days (Malaysia time). "last_7_days" and "last_30_days" end today; "this_month" is the 1st until today; null = last_7_days'),
	from: Day.nullable().describe('Only with period "custom": the first day, YYYY-MM-DD'),
	to: Day.nullable().describe('Only with period "custom": the last day, YYYY-MM-DD (included)'),
	compare: z.boolean().nullable().describe("Also read the previous period of the same length (sales and traffic); null = true"),
	rankBy: z
		.enum(["revenue", "quantity", "count"])
		.nullable()
		.describe('top_products: "revenue" or "quantity" (units sold); discounts: "revenue" or "count" (times used); null = revenue'),
	limit: z.number().int().min(1).max(20).nullable().describe("How many products / codes / pages to list; null = 5"),
});
export type StoreReportsInput = z.infer<typeof StoreReportsInputSchema>;

export const StoreTodosInputSchema = z.object({
	limit: z.number().int().min(1).max(20).nullable().describe("How many tasks to list, most urgent first; null = 10"),
});
export type StoreTodosInput = z.infer<typeof StoreTodosInputSchema>;

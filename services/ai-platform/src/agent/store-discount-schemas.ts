import { z } from "zod";

/**
 * Tool input of the discount tools (capability `store_discounts`): strict, null-for-keep — every
 * field is present, `null` leaves it as it is. The limits mirror the Discounts form that prime-web
 * applies the change with; prime-web checks them again against the shop's real data.
 */

export const StoreDiscountsReadInputSchema = z.object({
	id: z.string().regex(/^[1-9]\d{0,9}$/).nullable().describe("One discount in full (limits, dates, usage, why it can't be switched on); null for the list"),
	code: z.string().max(32).nullable().describe("One discount by its exact code, in full; null to skip"),
	query: z.string().max(80).nullable().describe("Words of a code or its description to find; null for none"),
	filter: z
		.enum(["all", "active", "inactive", "scheduled", "expired", "used_up", "expiring_soon", "unused"])
		.describe('"active" = shoppers can use it now; "expiring_soon" = ends within 14 days; "unused" = never used; "all" for the list as it is'),
	limit: z.number().int().min(1).max(30),
});
export type StoreDiscountsReadInput = z.infer<typeof StoreDiscountsReadInputSchema>;

const DiscountIdField = z.string().regex(/^[1-9]\d{0,9}$/).describe("Discount id from store_discounts");
const DateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("A calendar date YYYY-MM-DD in the shop's time (Malaysia, UTC+8); a start date counts from 00:00, an end date through 23:59 of that day");
const SiteIdField = z.string().regex(/^[1-9]\d{0,9}$/).describe("A site id from store_discounts (sites); only when the store has several sites");
const AmountField = z.number().positive().max(1_000_000).describe("percentage: a whole number 1–100; fixed: ringgit (RM, up to 2 decimals), not sen");

export const StoreDiscountsToolInputSchema = z.object({
	why: z.string().min(1).max(300).describe("One line for the merchant: what this changes and why"),
	changes: z
		.array(
			z.discriminatedUnion("op", [
				z.object({
					op: z.literal("create"),
					code: z.string().min(1).max(32).describe("Letters, numbers, - and _ only; saved in capitals. Must not exist yet (read store_discounts first)"),
					type: z.enum(["percentage", "fixed"]),
					amount: AmountField,
					description: z.string().max(500).nullable(),
					usageLimit: z.number().int().min(1).max(10_000_000).nullable().describe("How many times it can be used in all; null = unlimited"),
					startsOn: DateField.nullable().describe("null = from now"),
					endsOn: DateField.nullable().describe("null = no end date"),
					siteId: SiteIdField.nullable().describe("null = every site of the store"),
					status: z.enum(["active", "paused"]).nullable().describe("null = active as soon as it is approved"),
				}),
				z.object({
					op: z.literal("update"),
					discountId: DiscountIdField,
					code: z.string().min(1).max(32).nullable().describe("A new code; null keeps it"),
					type: z.enum(["percentage", "fixed"]).nullable().describe("Change between % and RM only together with amount; null keeps it"),
					amount: AmountField.nullable().describe("New amount in the discount's type (or the new type); null keeps it"),
					description: z.string().max(500).nullable().describe("New description; empty string clears it; null keeps it"),
					usageLimit: z.number().int().min(1).max(10_000_000).nullable().describe("New total number of uses; null keeps it (removeLimit to drop it)"),
					removeLimit: z.boolean().describe("true = no usage limit any more"),
					startsOn: DateField.nullable().describe("New start date; null keeps it"),
					removeStart: z.boolean().describe("true = no start date (valid from now)"),
					endsOn: DateField.nullable().describe("New end date; null keeps it"),
					removeEnd: z.boolean().describe("true = no end date"),
					siteId: SiteIdField.nullable().describe("Limit it to this site; null keeps it"),
					allSites: z.boolean().describe("true = apply to every site of the store"),
				}),
				z.object({ op: z.literal("activate"), discountId: DiscountIdField }),
				z.object({ op: z.literal("pause"), discountId: DiscountIdField }),
				z.object({ op: z.literal("delete"), discountId: DiscountIdField }),
			]),
		)
		.min(1)
		.max(10),
});
export type StoreDiscountsToolInput = z.infer<typeof StoreDiscountsToolInputSchema>;

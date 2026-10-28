import { z } from "zod";

/**
 * Tool input of the order tools (capability `store_orders`): strict, null-for-skip — every field is present,
 * `null` leaves it out. prime-web applies the Orders page's own rules again to the shop's real data, so a card
 * the model drafts wrongly comes back as a refusal it can read, never as a half-done order.
 */

const OrderId = z.string().regex(/^[1-9]\d{0,9}$/).describe("Order id from store_orders (not the order number)");
const DateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("A calendar date YYYY-MM-DD in the shop's time (Malaysia, UTC+8)");

export const StoreOrdersReadInputSchema = z.object({
	view: z
		.enum(["needs_action", "list"])
		.describe('"needs_action" = what waits for the merchant today (orders to confirm, payment proofs to check, confirmed orders not shipped for over 24 h, shipped orders with a delivery problem); "list" = the filtered list'),
	id: OrderId.nullable().describe("One order in full (items, totals, payment, shipping, history, what can be done to it); null for the list"),
	orderNumber: z.string().max(40).nullable().describe("One order by its exact order number, in full; null to skip"),
	query: z.string().max(80).nullable().describe("Words of the order number or the customer's name, email or phone to find; null for none"),
	status: z.enum(["all", "pending", "confirmed", "ready_to_ship", "shipped", "completed", "cancelled", "refunded"]).describe('The Orders page tabs; "all" for every status'),
	paymentStatus: z.enum(["unpaid", "awaiting_payment", "pending_verification", "paid", "failed", "refunded", "cancelled"]).nullable().describe('"pending_verification" = a bank-transfer proof to check; null for any'),
	paymentMethod: z.enum(["cod", "bank_transfer", "card", "fpx", "ewallet"]).nullable().describe("null for any"),
	from: DateField.nullable().describe("Orders placed on or after this day; null for none"),
	to: DateField.nullable().describe("Orders placed on or before this day; null for none"),
	limit: z.number().int().min(1).max(30),
});
export type StoreOrdersReadInput = z.infer<typeof StoreOrdersReadInputSchema>;

export const StoreOrdersToolInputSchema = z.object({
	why: z.string().min(1).max(300).describe("One line for the merchant: what this changes and why"),
	changes: z
		.array(
			z.discriminatedUnion("op", [
				z.object({ op: z.literal("confirm"), orderId: OrderId }),
				z.object({
					op: z.literal("ship"),
					orderId: OrderId,
					courier: z.string().min(1).max(60).describe("The courier the merchant named (e.g. J&T, Pos Laju) — never guess it"),
					trackingNumber: z.string().min(3).max(100).describe("The tracking number the merchant gave — NEVER invent one; ask_user when missing"),
				}),
				z.object({ op: z.literal("complete"), orderId: OrderId }),
				z.object({ op: z.literal("approve_payment"), orderId: OrderId }),
				z.object({
					op: z.literal("reject_payment"),
					orderId: OrderId,
					reason: z.enum(["image_blurry", "wrong_amount", "duplicate_order", "other"]),
					detail: z.string().max(500).nullable().describe('Emailed to the buyer word for word; required (10+ characters) when the reason is "other"; null otherwise'),
				}),
				z.object({ op: z.literal("cancel"), orderId: OrderId, reason: z.string().min(1).max(500).describe("The merchant's reason, in their words, emailed to the buyer word for word in the cancellation email; ask_user when they gave none") }),
				z.object({ op: z.literal("refund"), orderId: OrderId }),
			]),
		)
		.min(1)
		.max(10),
});
export type StoreOrdersToolInput = z.infer<typeof StoreOrdersToolInputSchema>;

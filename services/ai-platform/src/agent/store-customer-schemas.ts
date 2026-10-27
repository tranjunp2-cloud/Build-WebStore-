import { z } from "zod";

/**
 * Tool input of the customer tools (capability `store_customers`): the shop's customers, the contact-form
 * leads and the email templates. Strict, null-for-keep — every field is present, `null` leaves it as it is.
 * prime-web checks the limits again against the shop's real data and the merchant's role.
 */

/**
 * The emails a shop may customise (Settings → Email templates): each goes to one kind of reader — the
 * buyer, or the shop's owner for the last three. Sign-in / password / invitation emails are platform-managed
 * and not listed.
 */
export const EMAIL_TEMPLATE_TYPES = [
	"order-confirmation",
	"order-completed",
	"order-cancelled",
	"order-expired",
	"order-refunded",
	"bank-transfer-instructions",
	"payment-confirmed",
	"payment-rejected",
	"order-waiting",
	"new-order-seller",
	"contact-from-seller",
	"newsletter-seller-digest",
] as const;

const IdField = z.string().regex(/^[1-9]\d{0,9}$/);

export const StoreCustomersReadInputSchema = z.object({
	view: z
		.enum(["customers", "customer", "leads", "lead", "email_templates", "email_template"])
		.describe(
			'"customers": the shop\'s buyers (search, rank, sort) with orders and spend; "customer": one in full; "leads": contact-form messages; "lead": one lead with everything that person sent and our replies; "email_templates": every email the shop sends and whether it is customised; "email_template": one in full (current text, the default, the {variables} it may use)',
		),
	id: IdField.nullable().describe("customer or lead id for the single views; null otherwise"),
	query: z.string().max(80).nullable().describe("customers: name, email or phone; leads: name, email, subject or message words; null for none"),
	rank: z.enum(["any", "none", "bronze", "silver", "gold", "vip"]).describe('customers only: "none" = no rank yet; "any" = all'),
	sort: z
		.enum(["recent_order", "orders", "spend", "name", "newest"])
		.describe("customers only: recent_order = latest order first, orders = most orders, spend = highest lifetime spend, newest = joined last"),
	leadStatus: z.enum(["any", "new", "read", "contacted", "ignored"]).describe('leads only: "contacted" = replied, "ignored" = archived'),
	olderThanDays: z.number().int().min(1).max(3650).nullable().describe("leads only: only leads whose latest message is at least this many days old (e.g. still new after 3 days); null for any age"),
	templateType: z.enum(EMAIL_TEMPLATE_TYPES).nullable().describe("email_template: which one; null for the list"),
	limit: z.number().int().min(1).max(30),
});
export type StoreCustomersReadInput = z.infer<typeof StoreCustomersReadInputSchema>;

const Short = (what: string, max: number) => z.string().max(max).nullable().describe(what);

export const StoreCustomersToolInputSchema = z.object({
	why: z.string().min(1).max(300).describe("One line for the merchant: what this changes and why"),
	changes: z
		.array(
			z.discriminatedUnion("op", [
				z.object({
					op: z.literal("customer_update"),
					customerId: IdField.describe("Customer id from store_customers"),
					name: Short("New display name; null keeps it", 200),
					rank: z.enum(["bronze", "silver", "gold", "vip"]).nullable().describe("New rank; null keeps it"),
					removeRank: z.boolean().describe("true = no rank"),
					notes: Short("Internal note (the merchant's own words, never shown to the customer); '' clears it; null keeps it", 2000),
				}),
				z.object({
					op: z.literal("lead_status"),
					leadId: IdField.describe("Lead id from store_customers (view leads)"),
					status: z.enum(["new", "read", "contacted", "ignored"]).describe('"contacted" = replied, "ignored" = archived. Applies to every message of that person on that site'),
				}),
				z.object({
					op: z.literal("lead_reply"),
					leadId: IdField.describe("The lead to answer (read it first)"),
					subject: z.string().min(1).max(200).describe("Email subject, in the language of the lead's message"),
					body: z
						.string()
						.min(1)
						.max(4000)
						.describe("The full email text, plain paragraphs, in the language of the lead's message. Greeting by name, an answer to what they asked, a sign-off with the shop's name. Never invent prices, offers, stock, dates or promises the merchant did not give"),
				}),
				z.object({
					op: z.literal("template_edit"),
					templateType: z.enum(EMAIL_TEMPLATE_TYPES),
					locale: z.enum(["en", "ms"]).describe("Which language's text this edits"),
					subject: Short("New subject line; '' goes back to the default; null keeps it", 200),
					greeting: Short("New greeting; '' goes back to the default; null keeps it", 500),
					ctaLabel: Short("New button label; '' goes back to the default; null keeps it", 100),
					closing: Short("New closing paragraph; '' goes back to the default; null keeps it", 2000),
					enabled: z.boolean().nullable().describe("false = stop sending this email; true = send it; null keeps it"),
				}),
				z.object({
					op: z.literal("template_reset"),
					templateType: z.enum(EMAIL_TEMPLATE_TYPES),
				}),
			]),
		)
		.min(1)
		.max(10),
});
export type StoreCustomersToolInput = z.infer<typeof StoreCustomersToolInputSchema>;

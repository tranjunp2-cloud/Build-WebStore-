import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { ORDER_STATUS_TRANSITIONS } from "@/collections/Orders";
import type { AgentActor } from "../context";
import type { PreparedSiteChange } from "../site/site-prepare";
import { writeRefusal } from "./store-write-access";
import { assertOrdersAccess, confirmBlock, hasLabel, methodWord, money, moneyRoute, type OrderDoc, orderRow, paymentWord, statusWord, tenantOrder } from "./store-orders";

/**
 * Drafts (never writes) a change to the shop's orders, up to 10 steps in one card: confirm, ship (the shop's
 * own delivery: courier + tracking number the merchant gave), complete, approve / reject a bank-transfer
 * payment proof, cancel, refund. Each step runs on the state the earlier ones leave, with
 * the Orders page's own rules (status transitions, payment state, EasyParcel label guard). Cancel, refund and
 * approving a payment proof move money, stock or goods: one of them per card, the order number typed to
 * approve. Every step but ship also carries `requiresClick` (Auto-approve never applies it): confirm,
 * complete and rejecting a proof email the buyer and can't be taken back. Cancel, refund, approve and reject
 * need a role that may write there (store-write-access.ts; a viewer only looks). The applier
 * (appliers/store-orders.ts) runs the same order services as the dashboard routes, as the approver.
 */

export const MAX_ORDER_STEPS = 10;
const Id = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d{0,9}$/, "an order id (digits) from store_orders"));
export const REJECTION_REASONS = ["image_blurry", "wrong_amount", "duplicate_order", "other"] as const;
const REJECTION_WORDS: Record<(typeof REJECTION_REASONS)[number], string> = { image_blurry: "the image is blurry", wrong_amount: "the amount is wrong", duplicate_order: "it duplicates another order", other: "other reason" };

export const StoreOrderStepSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("confirm"), orderId: Id }),
	z.object({ op: z.literal("ship"), orderId: Id, courier: z.string().trim().min(1).max(60), trackingNumber: z.string().trim().min(3).max(100) }),
	z.object({ op: z.literal("complete"), orderId: Id }),
	z.object({ op: z.literal("approve_payment"), orderId: Id }),
	z.object({ op: z.literal("reject_payment"), orderId: Id, reason: z.enum(REJECTION_REASONS), detail: z.string().trim().max(500).nullish() }),
	z.object({ op: z.literal("cancel"), orderId: Id, reason: z.string().trim().min(1).max(500) }),
	z.object({ op: z.literal("refund"), orderId: Id }),
]);
export type StoreOrderStep = z.infer<typeof StoreOrderStepSchema>;

export const StoreOrdersChangeSchema = z.object({
	why: z.string().trim().min(1).max(300),
	changes: z.array(StoreOrderStepSchema).min(1).max(MAX_ORDER_STEPS),
});

/** What the applier runs: the steps as drafted (order id and number), and the version of every order they touch. */
type WithNumber<S> = S extends { orderId: string } ? Omit<S, "orderId"> & { orderId: number; orderNumber: string } : never;
export type PlannedOrderStep = WithNumber<StoreOrderStep>;
/** `undoable`: every step can be put back (ship); cancel / refund / payment / confirm / complete can not. */
export type StoreOrdersPlan = { steps: PlannedOrderStep[]; base: Record<string, string>; undoable: boolean };

type Refusal = { error: { code: string; message: string } };
const refuse = (code: string, message: string): Refusal => ({ error: { code, message } });

/** Steps that move money / goods or can't be taken back, or email the buyer: Auto-approve never applies a card with one. Ship (undoable, tracking number from the merchant) is the only step left out. */
const CLICK_OPS: ReadonlySet<StoreOrderStep["op"]> = new Set(["confirm", "complete", "approve_payment", "reject_payment", "cancel", "refund"]);
/** Steps that need the merchant to type the order number: one per card. */
const TYPED_OPS: ReadonlySet<StoreOrderStep["op"]> = new Set(["cancel", "refund", "approve_payment"]);
/** Steps a viewer may not run through the copilot (money, payment decisions). */
const MONEY_OPS: ReadonlySet<StoreOrderStep["op"]> = new Set(["cancel", "refund", "approve_payment", "reject_payment"]);

/** One order as the steps leave it. */
type Sim = { doc: OrderDoc; status: string; paymentStatus: string; selfDelivery: boolean; closed: boolean; ops: Set<string> };

/** Where the money goes on a cancel / refund of this order, in the merchant's words. */
export function moneyEffect(doc: OrderDoc, kind: "cancel" | "refund", paymentStatus: string): string {
	const total = money(doc.total, doc.currency);
	const route = moneyRoute(doc);
	const manualRefund = kind === "refund" ? ["bank_transfer", "cod"].includes(String(doc.paymentMethod)) : route === "manual";
	if (kind === "cancel" && paymentStatus !== "paid") return "Nothing was paid, so no money moves.";
	if (manualRefund) return `Nothing moves from here (${methodWord(doc.paymentMethod)}): the order is marked refunded and you pay ${total} back to the buyer yourself.`;
	if (route === "xendit") return `${total} (the full amount) is refunded to the buyer through Xendit.`;
	return `${total} (the full amount) is refunded to the buyer's card through Stripe.`;
}

export async function prepareStoreOrders(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | Refusal> {
	const input = StoreOrdersChangeSchema.parse(raw);
	await assertOrdersAccess(actor);
	const cms = await getPayload({ config });

	if (input.changes.some((step) => MONEY_OPS.has(step.op))) {
		const denied = writeRefusal(actor, "orders");
		if (denied) return denied;
	}
	const typedSteps = input.changes.filter((step) => TYPED_OPS.has(step.op));
	if (typedSteps.length > 1) return refuse("one_money_step", "Cancel, refund or approve the payment of one order per card: they move money, stock or goods, and the merchant confirms each with Yes / No. Stage the others in their own cards.");
	const moneyStep = typedSteps.find((step) => step.op === "cancel" || step.op === "refund");

	const sims = new Map<string, Sim>();
	const load = async (orderId: string): Promise<Sim | Refusal> => {
		const known = sims.get(orderId);
		if (known) return known;
		const doc = await tenantOrder(cms, actor, orderId);
		if (!doc) return refuse("unknown_order", `Order ${orderId} is not in this store (read store_orders for ids).`);
		const sim: Sim = { doc, status: String(doc.status), paymentStatus: String(doc.paymentStatus ?? ""), selfDelivery: Boolean(doc.selfDeliveryCourier), closed: false, ops: new Set() };
		sims.set(orderId, sim);
		return sim;
	};

	const steps: PlannedOrderStep[] = [];
	const diffs: PreparedSiteChange["diffs"] = [];
	const emails = new Set<string>();
	let undoable = true;

	for (const step of input.changes) {
		const sim = await load(step.orderId);
		if ("error" in sim) return sim;
		const { doc } = sim;
		const number = String(doc.orderNumber);
		const entity = { kind: "store_order", id: step.orderId, label: `${number} · ${money(doc.total, doc.currency)} · ${doc.customerName ?? ""}`.trim() };
		const say = (text: string) => refuse("order_step_refused", `${number}: ${text}`);
		if (sim.closed) return say("it is already cancelled or refunded in this card, nothing can follow that.");
		if (sim.ops.has(step.op)) return say(`${step.op} appears twice in this card.`);
		sim.ops.add(step.op);
		const before = statusWord(sim.status);
		const planned = { ...step, orderId: Number(step.orderId), orderNumber: number } as PlannedOrderStep;

		switch (step.op) {
			case "confirm": {
				if (!(ORDER_STATUS_TRANSITIONS[sim.status] ?? []).includes("confirmed") || !["pending", "new"].includes(sim.status)) return say(`it is ${before.toLowerCase()}, only a pending order can be confirmed.`);
				const block = confirmBlock({ ...doc, paymentStatus: sim.paymentStatus });
				if (block) return say(block);
				diffs.push({ entity, field: "Status", before, after: statusWord("confirmed") });
				sim.status = "confirmed";
				emails.add("confirmation");
				undoable = false;
				break;
			}
			case "approve_payment":
			case "reject_payment": {
				if (doc.paymentMethod !== "bank_transfer" || sim.paymentStatus !== "pending_verification" || ["cancelled", "refunded"].includes(sim.status)) return say("no bank-transfer payment proof is waiting to be checked on this order.");
				if (step.op === "reject_payment" && step.reason === "other" && (step.detail ?? "").trim().length < 10) return say("a rejection for another reason needs a detail of at least 10 characters for the buyer.");
				diffs.push({ entity, field: "Payment proof", before: paymentWord(sim.paymentStatus), after: step.op === "approve_payment" ? paymentWord("paid") : `Rejected: ${REJECTION_WORDS[step.reason]}` });
				// the buyer reads this word for word: the card shows all of it
				if (step.op === "reject_payment" && step.detail) diffs.push({ entity, field: "Message to the buyer (emailed as written)", before: null, after: step.detail });
				if (step.op === "approve_payment") {
					if (sim.status === "pending") {
						diffs.push({ entity, field: "Status", before, after: statusWord("confirmed") });
						sim.status = "confirmed";
					}
					sim.paymentStatus = "paid";
					emails.add("payment confirmed");
				} else {
					sim.paymentStatus = "awaiting_payment";
					diffs.push({ entity, field: "Buyer", before: null, after: "Gets an email with a new upload link (valid 24 hours)" });
					emails.add("payment rejected");
				}
				undoable = false;
				break;
			}
			case "ship": {
				if (!["confirmed", "ready_to_ship"].includes(sim.status)) return say(`it is ${before.toLowerCase()}, only a confirmed order can be shipped.`);
				if (hasLabel(doc)) return say("it already has an EasyParcel label, so the courier moves it: ship it from the order page.");
				diffs.push({ entity, field: "Status", before, after: statusWord("shipped") }, { entity, field: "Courier", before: null, after: step.courier }, { entity, field: "Tracking number", before: null, after: step.trackingNumber });
				sim.status = "shipped";
				sim.selfDelivery = true;
				break;
			}
			case "complete": {
				if (sim.status !== "shipped" || !sim.selfDelivery) return say("only an order shipped by the shop's own delivery can be completed by hand; a courier order completes when the courier delivers it.");
				diffs.push({ entity, field: "Status", before, after: statusWord("completed") });
				sim.status = "completed";
				emails.add("completed");
				undoable = false;
				break;
			}
			case "cancel": {
				if (!(ORDER_STATUS_TRANSITIONS[sim.status] ?? []).includes("cancelled")) return say(`a ${before.toLowerCase()} order can't be cancelled (only pending, new or confirmed ones).`);
				if (hasLabel(doc)) return say("it has an EasyParcel label: cancel the shipment on the order page first.");
				const units = orderRow(doc).itemCount;
				diffs.push({ entity, field: "Status", before, after: statusWord("cancelled") }, { entity, field: "Reason (emailed to the buyer as written)", before: null, after: step.reason }, { entity, field: "Money", before: null, after: moneyEffect(doc, "cancel", sim.paymentStatus) }, { entity, field: "Stock", before: null, after: `${units} item${units === 1 ? "" : "s"} go back into stock` });
				sim.status = "cancelled";
				sim.closed = true;
				emails.add("cancelled");
				undoable = false;
				break;
			}
			case "refund": {
				if (!["shipped", "completed"].includes(sim.status)) return say(`it is ${before.toLowerCase()}, only a shipped or completed order can be refunded.`);
				const manual = ["bank_transfer", "cod"].includes(String(doc.paymentMethod));
				if (!manual && moneyRoute(doc) === "stripe" && !doc.stripePaymentIntentId && !doc.stripeSessionId) return say("it has no online payment to refund. Refund the buyer yourself and tell me if the order should be marked another way.");
				const units = orderRow(doc).itemCount;
				diffs.push({ entity, field: "Status", before, after: statusWord("refunded") }, { entity, field: "Refund", before: null, after: money(doc.total, doc.currency) }, { entity, field: "Money", before: null, after: moneyEffect(doc, "refund", sim.paymentStatus) }, { entity, field: "Stock", before: null, after: `${units} item${units === 1 ? "" : "s"} go back into stock` });
				sim.status = "refunded";
				sim.closed = true;
				emails.add("refunded");
				undoable = false;
				break;
			}
		}
		if (step.op === "reject_payment") (planned as { detail?: string | null }).detail = step.detail ?? null;
		steps.push(planned);
	}

	const base: StoreOrdersPlan["base"] = Object.fromEntries([...sims].map(([id, sim]) => [id, String(sim.doc.updatedAt ?? "")]));
	const first = steps[0]!;
	const typedStep = steps.find((step) => TYPED_OPS.has(step.op));
	const single = steps.length === 1;
	const sameOp = steps.every((step) => step.op === first.op);
	const TITLES: Record<StoreOrderStep["op"], string> = { confirm: "Confirm", ship: "Ship", complete: "Complete", approve_payment: "Approve payment of", reject_payment: "Reject payment of", cancel: "Cancel", refund: "Refund" };
	const title = single ? `${TITLES[first.op]} order ${first.orderNumber}` : sameOp ? `${TITLES[first.op]} ${steps.length} orders` : `Change ${new Set(steps.map((s) => s.orderId)).size} order${new Set(steps.map((s) => s.orderId)).size === 1 ? "" : "s"}`;
	const guardrails: PreparedSiteChange["guardrails"] = [{ rule: "same_rules", ok: true, detail: "Same rules as the Orders page: status steps in order, the payment checked, no order with a shipping label cancelled." }];
	if (emails.size > 0) guardrails.push({ rule: "live", ok: true, detail: `The buyer gets an email (${[...emails].join(", ")}).` });
	if (steps.some((step) => step.op === "cancel" || (step.op === "reject_payment" && step.detail))) guardrails.push({ rule: "live", ok: true, detail: "The text under \"emailed as written\" goes to the buyer exactly as shown." });
	if (moneyStep) guardrails.push({ rule: "live", ok: true, detail: `This can't be undone: it moves money and puts the stock back. ${moneyStep.op === "refund" ? "The full amount is refunded." : "Cancelling is final."}` });
	else if (undoable) guardrails.push({ rule: "undo", ok: true, detail: "You can undo it for 7 days while nobody edits these orders." });
	else guardrails.push({ rule: "live", ok: true, detail: "This can't be undone from the chat: the buyer is emailed and the order moves on." });

	return {
		kind: "store.orders_patch",
		title,
		why: input.why,
		risk: typedStep ? "high" : emails.size > 0 || steps.some((s) => s.op === "ship") ? "medium" : "low",
		diffs,
		guardrails,
		// cancel / refund / approve payment: the card asks Yes / No (the order number is echoed back as the confirm)
		...(typedStep ? { confirmText: String(typedStep.orderNumber).slice(0, 200) } : {}),
		// Auto-approve never applies money, buyer-email or irreversible steps
		...(steps.some((step) => CLICK_OPS.has(step.op)) ? { requiresClick: true } : {}),
		plan: { steps, base, undoable } satisfies StoreOrdersPlan,
	};
}

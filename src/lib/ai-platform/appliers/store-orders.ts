import "server-only";

import type { ChangeSet, ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type Payload, type User } from "payload";
import { z } from "zod";
import { tenantIdForQuery } from "@/lib/auth";
import { approvePaymentAs } from "@/lib/orders/approve-payment";
import { type ActionResult, failureOf, succeeded } from "@/lib/orders/action-result";
import { cancelOrderAs } from "@/lib/orders/cancel-order";
import { refundOrderAs } from "@/lib/orders/refund-order";
import { rejectPaymentAs } from "@/lib/orders/reject-payment";
import { selfDeliverOrderAs } from "@/lib/orders/self-deliver-order";
import { updateOrderStatusAs } from "@/lib/orders/update-order-status";
import type { AgentActor } from "../context";
import { assertOrdersAccess, OrdersToolError, queryId, tenantOrder } from "../store/store-orders";
import type { PlannedOrderStep } from "../store/store-orders-prepare";
import { writeRefusal } from "../store/store-write-access";
import { ChangeSetApplyError, staleChange } from "./errors";
import { until } from "./site-edits";

/**
 * Applies a drafted order change (`store.orders_patch`) step by step with the same order services the
 * Orders routes call (lib/orders/*), as the approver: so emails, refunds, stock and discount slots are
 * exactly the dashboard's. Money and emails can't be put back, so a step that fails after others ran closes
 * the change (`final`) and says what was done; the version guard keeps an order that changed after the draft
 * from being touched at all. Only ship steps can be undone (`store.orders_restore`). Cancel, refund and payment
 * proof steps need a role that may write there (a viewer's approval is refused), also here at apply time.
 */

const CHANGED = "These orders changed after the assistant drafted this. Ask again.";
const userOf = (actor: AgentActor) => actor.user as unknown as User;

/** The Orders page works in the user's own tenant: it must be the workspace the change was drafted in. */
function assertTenant(actor: AgentActor) {
	if (String(tenantIdForQuery(actor.user) ?? "") !== String(actor.tenantId)) {
		throw new ChangeSetApplyError("Switch to the workspace this change was drafted in, then approve it again.", 409);
	}
}

async function access(actor: AgentActor) {
	assertTenant(actor);
	try {
		await assertOrdersAccess(actor);
	} catch (error) {
		if (error instanceof OrdersToolError) throw new ChangeSetApplyError(error.message, 403);
		throw error;
	}
}

const Id = z.number().int().positive();
const Plan = z.object({
	steps: z
		.array(
			z.discriminatedUnion("op", [
				z.object({ op: z.literal("confirm"), orderId: Id, orderNumber: z.string() }),
				z.object({ op: z.literal("ship"), orderId: Id, orderNumber: z.string(), courier: z.string().min(1).max(60), trackingNumber: z.string().min(3).max(100) }),
				z.object({ op: z.literal("complete"), orderId: Id, orderNumber: z.string() }),
				z.object({ op: z.literal("approve_payment"), orderId: Id, orderNumber: z.string() }),
				z.object({ op: z.literal("reject_payment"), orderId: Id, orderNumber: z.string(), reason: z.enum(["image_blurry", "wrong_amount", "duplicate_order", "other"]), detail: z.string().max(500).nullish() }),
				z.object({ op: z.literal("cancel"), orderId: Id, orderNumber: z.string(), reason: z.string().min(1).max(500) }),
				z.object({ op: z.literal("refund"), orderId: Id, orderNumber: z.string() }),
			]),
		)
		.min(1)
		.max(10),
	base: z.record(z.string(), z.string()),
	undoable: z.boolean(),
});

const Undo = z.object({
	ops: z.array(
		z.discriminatedUnion("op", [
			z.object({ op: z.literal("ship"), id: Id, orderNumber: z.string(), updatedAt: z.string(), before: z.object({ status: z.string(), trackingNumber: z.string().nullable(), shippingTrackingStatus: z.string().nullable() }) }),
		]),
	),
});
type UndoOp = z.infer<typeof Undo>["ops"][number];

/** One order service's answer: a soft failure becomes an apply error carrying the dashboard's own message. */
function done(result: ActionResult, number: string): void {
	if (succeeded(result)) return;
	const { code, message } = failureOf(result);
	if (result.status === 404 || code === "NOT_FOUND") throw staleChange(CHANGED);
	// the refund was sent to Xendit and its answer is unknown: the order stays refunded, so the card must not be approved again
	if (code === "XENDIT_REFUND_UNKNOWN") throw new ChangeSetApplyError(`${number}: ${message}`, 422, true);
	throw new ChangeSetApplyError(`${number}: ${message}`, result.status === 403 ? 403 : result.status === 409 ? 409 : 422);
}

const stepWords: Record<PlannedOrderStep["op"], string> = { confirm: "confirmed", ship: "shipped", complete: "completed", approve_payment: "payment approved", reject_payment: "payment rejected", cancel: "cancelled", refund: "refunded" };

async function runStep(step: PlannedOrderStep, actor: AgentActor) {
	const user = userOf(actor);
	const id = String(step.orderId);
	switch (step.op) {
		case "confirm":
			return done(await updateOrderStatusAs(user, id, { status: "confirmed" }), step.orderNumber);
		case "complete":
			return done(await updateOrderStatusAs(user, id, { status: "completed" }), step.orderNumber);
		case "ship":
			return done(await selfDeliverOrderAs(user, id, step.courier, step.trackingNumber), step.orderNumber);
		case "approve_payment":
			return done(await approvePaymentAs(user, id), step.orderNumber);
		case "reject_payment":
			return done(await rejectPaymentAs(user, id, { reason: step.reason, ...(step.detail ? { detail: step.detail } : {}) }), step.orderNumber);
		case "cancel":
			return done(await cancelOrderAs(user, id, step.reason), step.orderNumber);
		case "refund":
			return done(await refundOrderAs(user, id, "REQUESTED_BY_CUSTOMER"), step.orderNumber);
	}
}

/** Money steps were drafted with a text to type (refund / cancel / payment approval): a plan without it was not drafted by us. */
const TYPED_CONFIRM_OPS: ReadonlySet<string> = new Set(["cancel", "refund", "approve_payment"]);

export async function applyStoreOrdersPatch(raw: unknown, actor: AgentActor, changeSet: Pick<ChangeSet, "confirmText"> = {}): Promise<ChangeSetResult> {
	const plan = Plan.parse(raw);
	if (plan.steps.some((step) => TYPED_CONFIRM_OPS.has(step.op)) && !changeSet.confirmText?.trim()) {
		throw new ChangeSetApplyError("This change moves money, so it needs its confirmation text typed. Ask the assistant to draft it again.", 422, true);
	}
	await access(actor);
	// cancel / refund / payment proofs: the approver's role must be one that may write there (the draft checked the drafter's)
	if (plan.steps.some((step) => ["cancel", "refund", "approve_payment", "reject_payment"].includes(step.op))) {
		const denied = writeRefusal(actor, "orders");
		if (denied) throw new ChangeSetApplyError(denied.error.message, 403);
	}
	const cms = await getPayload({ config });
	const before = new Map<string, Record<string, any>>();
	for (const [id, at] of Object.entries(plan.base)) {
		const order = await tenantOrder(cms, actor, id);
		// changed or gone since the draft: this card can never apply, it is closed with the reason
		if (!order || String(order.updatedAt ?? "") !== at) throw staleChange(CHANGED);
		before.set(id, order);
	}

	const undo: UndoOp[] = [];
	const finished: string[] = [];
	const ran: number[] = [];
	const ranOps: string[] = [];
	for (const step of plan.steps as PlannedOrderStep[]) {
		const id = String(step.orderId);
		try {
			await runStep(step, actor);
		} catch (error) {
			const reason = error instanceof ChangeSetApplyError ? error.message : "The order change was refused.";
			if (finished.length === 0) throw error instanceof ChangeSetApplyError ? error : new ChangeSetApplyError(reason, 422);
			// earlier steps already moved money, stock or emails: say what was done, and close the card — when only ship
			// steps ran, they keep their undo (the card is recorded as applied with them)
			const partial = undo.length > 0 && ranOps.every((op) => op === "ship") ? ordersResult(ran, undo) : undefined;
			throw new ChangeSetApplyError(`${reason} Done before it: ${finished.join("; ")}. The remaining steps were not run: ask again for them.`, 422, true, { partial });
		}
		ran.push(step.orderId);
		ranOps.push(step.op);
		finished.push(`${step.orderNumber} ${stepWords[step.op]}`);
		// a ship's pre-image is kept even in a card that can't be undone as a whole: it is the undo of a partial run
		if (step.op === "ship") {
			const prior = before.get(id)!;
			const after = await tenantOrder(cms, actor, id);
			if (after) {
				undo.push({ op: "ship", id: step.orderId, orderNumber: step.orderNumber, updatedAt: String(after.updatedAt), before: { status: String(prior.status), trackingNumber: prior.trackingNumber ?? null, shippingTrackingStatus: prior.shippingTrackingStatus ?? null } });
				// the next step of the same order starts from what this one left
				before.set(id, { ...prior, status: after.status });
			}
		}
	}
	return ordersResult(
		plan.steps.map((step) => step.orderId),
		plan.undoable ? undo : [],
	);
}

function ordersResult(ids: readonly number[], undo: readonly UndoOp[]): ChangeSetResult {
	const orderIds = [...new Set(ids)];
	return {
		entities: orderIds.map((id) => ({ kind: "store_order", id: String(id) })),
		// one order opens its own page, several open the list
		links: orderIds.length === 1 ? [{ label: "Open order", href: `/orders/${orderIds[0]}` }] : [{ label: "Open orders", href: "/orders" }],
		...(undo.length > 0 ? { undo: { kind: "store.orders_restore", payload: { ops: [...undo] }, until: until() } } : {}),
	};
}

/** Undo of ship (back to the status it came from, courier and tracking number cleared). */
export async function applyStoreOrdersRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const record = Undo.parse(raw);
	await access(actor);
	const cms = await getPayload({ config });
	const user = userOf(actor);
	// every order is checked before anything is put back: nobody touched it since the change (a courier update or an edit blocks the undo)
	const last = new Map<number, UndoOp>();
	const first = new Map<number, UndoOp>();
	for (const op of record.ops) {
		last.set(op.id, op);
		if (!first.has(op.id)) first.set(op.id, op);
	}
	// an order already back as it was before the change (an undo whose record was lost, a second tab) needs nothing
	const done = new Set<number>();
	for (const [id, op] of last) {
		const order = await tenantOrder(cms, actor, String(id));
		const before = first.get(id)!.before;
		if (order && String(order.status) === before.status && (order.trackingNumber ?? null) === before.trackingNumber && (order.shippingTrackingStatus ?? null) === before.shippingTrackingStatus) {
			done.add(id);
			continue;
		}
		if (!order || String(order.updatedAt ?? "") !== op.updatedAt) throw new ChangeSetApplyError("These orders were edited after this change, so it can't be undone safely.", 409);
		if (order.status !== "shipped") throw new ChangeSetApplyError(`${op.orderNumber} is not shipped any more, so the shipping can't be undone.`, 409);
	}
	// newest first
	for (const op of [...record.ops].reverse()) {
		if (done.has(op.id)) continue;
		const data = { status: op.before.status, selfDeliveryCourier: null, trackingNumber: op.before.trackingNumber, shippingTrackingStatus: op.before.shippingTrackingStatus };
		try {
			await cms.update({ collection: "orders", id: queryId(String(op.id)), data, overrideAccess: false, user } as Parameters<Payload["update"]>[0]);
		} catch {
			throw new ChangeSetApplyError(`${op.orderNumber} could not be put back.`, 422);
		}
	}
	return { entities: [], links: [{ label: "Open orders", href: "/orders" }] };
}

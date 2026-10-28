import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { tenantIdForQuery } from "@/lib/auth";
import { klDateKey } from "@/lib/discounts/date-boundaries";
import { createDiscountAs, type DiscountActor, DiscountServiceError, deleteDiscountAs, updateDiscountAs } from "@/lib/discounts/discount-service";
import type { AgentActor } from "../context";
import { activationProblem, candidateProblem, type DiscountRow, discountRow, discountsRefusal, queryId, tenantDiscounts } from "../store/store-discounts";
import type { DiscountWrite, PlannedDiscountStep } from "../store/store-discounts-prepare";
import { ChangeSetApplyError, PutBackError, putBack, putBackFailed, staleChange } from "./errors";
import { samePlan } from "./same-plan";
import { until } from "./site-edits";

/**
 * Applies a drafted discount change (`store.discounts_patch`) step by step, with the Discounts routes'
 * own write core (lib/discounts/discount-service) and the approver's access, after the dashboard's
 * activation guard once more (time may have passed). What each step changed is kept, so undo
 * (`store.discounts_restore`) puts it back in reverse order — also after a step failed half way.
 */

const CHANGED = "These discounts changed after the assistant drafted this. Ask again.";
const userOf = (actor: AgentActor) => actor.user as unknown as User;

/** The Discounts page writes in the user's own tenant: it must be the workspace the change was drafted in. */
function assertTenant(actor: AgentActor) {
	if (String(tenantIdForQuery(actor.user) ?? "") !== String(actor.tenantId)) {
		throw new ChangeSetApplyError("Switch to the workspace this change was drafted in, then approve it again.", 409);
	}
}

/** The approver's role must have Discounts (the `orders` permission), like the draft needed. */
function assertAccess(actor: AgentActor) {
	const denied = discountsRefusal(actor);
	if (denied) throw new ChangeSetApplyError(denied.error.message, 403);
}

const serviceFor = (actor: AgentActor): DiscountActor => ({ user: userOf(actor), tenantId: actor.tenantId, strictTenant: true });

const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Write = z.object({
	code: z.string().min(1).max(32),
	description: z.string().max(500).nullable(),
	type: z.enum(["percentage", "fixed"]),
	value: z.number().min(0),
	status: z.enum(["active", "inactive"]),
	usageLimit: z.number().int().min(1).nullable(),
	startsAt: DateKey.nullable(),
	expiresAt: DateKey.nullable(),
	site: z.number().int().positive().nullable(),
});
const Plan = z.object({
	steps: z
		.array(
			z.discriminatedUnion("op", [
				z.object({ op: z.literal("create"), data: Write }),
				z.object({ op: z.literal("update"), discountId: z.number().int().positive(), data: Write.partial() }),
				z.object({ op: z.literal("delete"), discountId: z.number().int().positive() }),
			]),
		)
		.min(1)
		.max(10),
	base: z.record(z.string(), z.string()),
});

const Undo = z.object({
	ops: z.array(
		z.discriminatedUnion("op", [
			z.object({ op: z.literal("created"), id: z.number().int(), updatedAt: z.string(), after: Write.optional() }),
			z.object({ op: z.literal("updated"), id: z.number().int(), updatedAt: z.string(), after: Write.optional(), before: Write }),
			z.object({ op: z.literal("deleted"), row: Write.extend({ usageCount: z.number().int().min(0) }) }),
		]),
	),
});
type UndoOp = z.infer<typeof Undo>["ops"][number];

const writeOf = (row: DiscountRow): DiscountWrite => ({
	code: row.code,
	description: row.description,
	type: row.type,
	value: row.value,
	status: row.status,
	usageLimit: row.usageLimit,
	startsAt: row.startsAt ? klDateKey(row.startsAt) : null,
	expiresAt: row.expiresAt ? klDateKey(row.expiresAt) : null,
	site: row.site,
});

/** The row a write leaves, for the checks that follow it in the same change (dates stay the shop's calendar days: klDateKey reads them too). */
const rowAfter = (row: DiscountRow, data: Partial<DiscountWrite>): DiscountRow => ({ ...row, ...data });

/** One write; the service's soft failures and Payload's validation errors become apply errors. */
async function run<T>(write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		if (error instanceof ChangeSetApplyError) throw error;
		if (error instanceof DiscountServiceError) {
			if (error.code === "DUPLICATE_CODE") throw new ChangeSetApplyError("A discount with that code already exists in this store — pick another code.", 409);
			if (error.code === "NOT_FOUND") throw staleChange(CHANGED);
			throw new ChangeSetApplyError(error.message, 422);
		}
		console.error("[store-discounts] write refused:", error instanceof Error ? error.message : error);
		throw new ChangeSetApplyError("The discount change was refused.", 422);
	}
}

/** One changed code opens its own page; several (or only deletions) open the list. */
const discountLinks = (changed: readonly number[]) => {
	const ids = [...new Set(changed)];
	return ids.length === 1 ? [{ label: "Open discount", href: `/discounts/${ids[0]}` }] : [{ label: "Open discounts", href: "/discounts" }];
};

export async function applyStoreDiscountsPatch(raw: unknown, actor: AgentActor, now: Date = new Date()): Promise<ChangeSetResult> {
	const plan = Plan.parse(raw);
	assertTenant(actor);
	assertAccess(actor);
	const cms = await getPayload({ config });
	const byId = new Map((await tenantDiscounts(cms, actor)).rows.map((r) => [r.id, r]));
	// changed or deleted since the draft: this card can never apply, it is closed with the reason
	for (const [id, at] of Object.entries(plan.base)) if (byId.get(Number(id))?.updatedAt !== at) throw staleChange(CHANGED);

	const service = serviceFor(actor);
	const undo: UndoOp[] = [];
	const changed: number[] = [];
	try {
		for (const step of plan.steps as PlannedDiscountStep[]) {
			if (step.op === "create") {
				// time may have passed since the draft: the form's own guard once more
				const blocked = step.data.status === "active" ? activationProblem({ code: step.data.code, expiresAt: step.data.expiresAt, usageLimit: step.data.usageLimit, usageCount: 0 }, now) : null;
				if (blocked) throw new ChangeSetApplyError(blocked.message, 409);
				const doc = await run(() => createDiscountAs(service, step.data));
				undo.push({ op: "created", id: Number(doc.id), updatedAt: String(doc.updatedAt), after: writeOf(discountRow(doc as unknown as Record<string, unknown>)) });
				changed.push(Number(doc.id));
			} else if (step.op === "update") {
				const row = byId.get(step.discountId);
				if (!row) throw staleChange(CHANGED);
				const after = rowAfter(row, step.data);
				const problem = candidateProblem({ code: after.code, description: after.description, type: after.type, value: after.value, usageLimit: after.usageLimit, startsOn: after.startsAt ? klDateKey(after.startsAt) : null, endsOn: after.expiresAt ? klDateKey(after.expiresAt) : null, status: after.status });
				if (problem) throw new ChangeSetApplyError(`${after.code}: ${problem}`, 422);
				const activating = after.status === "active" && (step.data.status === "active" || step.data.expiresAt !== undefined || step.data.usageLimit !== undefined);
				const blocked = activating ? activationProblem(after, now) : null;
				if (blocked) throw new ChangeSetApplyError(blocked.message, 409);
				const doc = await run(() => updateDiscountAs(service, step.discountId, step.data));
				undo.push({ op: "updated", id: row.id, updatedAt: String(doc.updatedAt), after: writeOf(discountRow(doc as unknown as Record<string, unknown>)), before: writeOf(row) });
				byId.set(row.id, { ...after, updatedAt: String(doc.updatedAt) });
				changed.push(row.id);
			} else {
				const row = byId.get(step.discountId);
				if (!row) throw staleChange(CHANGED);
				await run(() => deleteDiscountAs(service, step.discountId));
				undo.push({ op: "deleted", row: { ...writeOf(row), usageCount: row.usageCount } });
				byId.delete(row.id);
			}
		}
	} catch (error) {
		// put back what already ran: a half-applied change is never left behind — and when that fails too, the card
		// closes saying what is still in place
		try {
			await restore(service, undo);
		} catch (failure) {
			throw putBackFailed("Discounts", error, undo.map(describe), failure);
		}
		throw error;
	}
	return {
		entities: [...new Set(changed)].map((id) => ({ kind: "store_discount", id: String(id) })),
		links: discountLinks(changed),
		undo: { kind: "store.discounts_restore", payload: { ops: undo }, until: until() },
	};
}

/** What one step did, in the merchant's words. */
const describe = (op: UndoOp): string => (op.op === "created" ? `created ${op.after?.code ?? `discount #${op.id}`}` : op.op === "updated" ? `changed ${op.before.code}` : `deleted ${op.row.code}`);
const codeOf = (op: UndoOp): string => (op.op === "created" ? (op.after?.code ?? `discount #${op.id}`) : op.op === "updated" ? op.before.code : op.row.code);

/** Newest first: a rename chain, or a code freed by a delete, goes back in the order it came. `skip`: already back. */
async function restore(service: DiscountActor, ops: readonly UndoOp[], skip: ReadonlySet<UndoOp> = new Set()) {
	for (const op of [...ops].reverse()) {
		if (skip.has(op)) continue;
		if (op.op === "created") await putBack(codeOf(op), () => run(() => deleteDiscountAs(service, op.id)));
		else if (op.op === "updated") await putBack(codeOf(op), () => run(() => updateDiscountAs(service, op.id, op.before)));
		else await putBack(codeOf(op), () => run(() => createDiscountAs(service, op.row)));
	}
}

/**
 * Before undo changes anything: nobody edited the discounts since, and a deleted code is still free. Returns the
 * steps already back as they were before the change (an undo whose record was lost, a second tab): those are left
 * alone, so a repeated undo succeeds instead of calling the merchant's codes "edited".
 */
async function verifyUndo(actor: AgentActor, ops: readonly UndoOp[]): Promise<Set<UndoOp>> {
	const cms = await getPayload({ config });
	const rows = (await tenantDiscounts(cms, actor)).rows;
	const current = new Map(rows.map((r) => [r.id, r]));
	const last = new Map<number, Extract<UndoOp, { id: number }>>();
	const first = new Map<number, Extract<UndoOp, { id: number }>>();
	for (const op of ops) {
		if (op.op === "deleted") continue;
		last.set(op.id, op);
		if (!first.has(op.id)) first.set(op.id, op);
	}
	// back as before: a code the change created is gone, a changed one reads as its pre-image, a deleted one is there again
	const back = new Set<UndoOp>();
	const backIds = new Set<number>();
	for (const [id, op] of first) {
		const now = current.get(id);
		if (op.op === "created" ? !now : now !== undefined && op.op === "updated" && samePlan(writeOf(now), op.before)) backIds.add(id);
	}
	for (const op of ops) {
		if (op.op !== "deleted" && backIds.has(op.id)) back.add(op);
		if (op.op === "deleted") {
			const { usageCount: _count, ...write } = op.row;
			if (rows.some((r) => r.code.toUpperCase() === op.row.code.toUpperCase() && samePlan(writeOf(r), write))) back.add(op);
		}
	}
	for (const id of backIds) last.delete(id);
	// Untouched = still stamped by our own write, or reads exactly as we left it (an undo of a later change to the same
	// code writes a new stamp but puts the values back, so undoing newest first keeps working).
	const untouched = (op: Extract<UndoOp, { id: number }>) => {
		const now = current.get(op.id);
		if (!now) return false;
		return now.updatedAt === op.updatedAt || (op.after !== undefined && JSON.stringify(writeOf(now)) === JSON.stringify(op.after));
	};
	for (const op of last.values()) if (!untouched(op)) throw new ChangeSetApplyError("These discounts were edited after this change, so it can't be undone safely.", 409);
	// A code that buyers already used (a redemption counted or an order holding a slot) is not deleted by undo:
	// that would cut the link of those orders to it and kill a code that may be live in a campaign. Pausing it is the way.
	for (const op of ops) {
		if (op.op !== "created" || back.has(op)) continue;
		const row = current.get(op.id);
		if (!row) continue;
		const history = await (async () => {
			try {
				return (await cms.count({ collection: "discount_usage_history", where: { discount: { equals: queryId(op.id) } }, overrideAccess: false, user: userOf(actor) } as Parameters<typeof cms.count>[0])).totalDocs;
			} catch {
				return null;
			}
		})();
		// can't tell whether it was used: stay on the safe side
		if (history === null) throw new ChangeSetApplyError(`Could not check whether ${row.code} was used, so it can't be undone. Pause or delete the code on the Discounts page instead.`, 409);
		if (row.usageCount > 0 || history > 0) {
			const times = Math.max(row.usageCount, history);
			throw new ChangeSetApplyError(`${row.code} was already used (${times} time${times === 1 ? "" : "s"}), so creating it can't be undone. Pause it instead (ask me, or switch it off on the Discounts page).`, 409);
		}
	}
	const freed = new Set(ops.flatMap((op) => (op.op === "created" ? [op.id] : [])));
	const taken = new Set(rows.filter((r) => !freed.has(r.id)).map((r) => r.code.toUpperCase()));
	for (const op of ops) {
		if (op.op === "deleted" && !back.has(op) && taken.has(op.row.code.toUpperCase())) {
			throw new ChangeSetApplyError(`The code ${op.row.code.toUpperCase()} is used by another discount now, so the deleted one can't be brought back.`, 409);
		}
	}
	return back;
}

export async function applyStoreDiscountsRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const record = Undo.parse(raw);
	assertTenant(actor);
	assertAccess(actor);
	const back = await verifyUndo(actor, record.ops);
	try {
		await restore(serviceFor(actor), record.ops, back);
	} catch (error) {
		// the merchant reads which code could not be put back (the rest of this undo is retried by Undo again)
		if (error instanceof PutBackError) throw error.reason instanceof ChangeSetApplyError ? new ChangeSetApplyError(`${error.what}: ${error.reason.message}`, error.reason.status) : error.reason;
		throw error;
	}
	return { entities: [], links: [{ label: "Open discounts", href: "/discounts" }] };
}

import "server-only";

import { type ChangeSetResult, ChangeSetResultSchema } from "@ech/agent-core";
import config from "@payload-config";
import { type SQL, sql } from "drizzle-orm";
import { getPayload } from "payload";
import { type ReportsDb, rowsOf } from "@/lib/reports/report-db";

/**
 * prime-web's own note that an approved change (or its undo) ran here — `ai_change_set_applies`, one row per change
 * set (scripts/db-setup.js). ai-platform records the decision only after prime-web wrote the data; when that record
 * is lost the change is live but the card is still pending. The receipt closes that gap:
 * - `applying` is taken right after the ai-platform claim, before anything is written; a second apply of the same
 *   change finds it and stops (an attempt that died mid-way is taken over after `STALE_APPLYING_MS`);
 * - `applied` / `reverted` + the result are written as soon as the write succeeded, before ai-platform is told: a
 *   retried Approve / Undo re-sends that result instead of writing again (no second email, refund, post);
 * - `recorded_at` is set once ai-platform has it; the cron (/api/cron/ai-receipts) re-sends the rest.
 * Every read and write names the change set; the decide flow also names the workspace.
 */

export type ReceiptState = "applying" | "applied" | "reverted";

export interface ApplyReceipt {
	changeSetId: string;
	tenantId: string;
	userId: string | null;
	state: ReceiptState;
	result: ChangeSetResult | null;
	note: string | null;
	requestId: string | null;
	recordedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** An `applying` receipt older than this belongs to an attempt that died (same hold as the ai-platform claim). */
export const STALE_APPLYING_MS = 6 * 60 * 1000;
/** The sweep leaves fresh receipts to the request that wrote them (it is still retrying its record). */
export const SWEEP_MIN_AGE_MS = 60 * 1000;
/** Undo windows are 7 days: an older receipt is never re-sent. */
export const SWEEP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SWEEP_LIMIT = 50;

/** Payload's own drizzle connection (raw SQL: the table is not a collection). */
async function db(): Promise<ReportsDb> {
	return (await getPayload({ config })) as unknown as ReportsDb;
}

const tenantParam = (tenantId: string | number): number => {
	const id = Number(tenantId);
	if (!Number.isSafeInteger(id) || id <= 0) throw new Error("An apply receipt needs a valid workspace id.");
	return id;
};

const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value ?? ""));

function receiptOf(row: Record<string, unknown>): ApplyReceipt {
	const parsed = row.result == null ? null : ChangeSetResultSchema.safeParse(typeof row.result === "string" ? JSON.parse(row.result) : row.result);
	return {
		changeSetId: String(row.change_set_id),
		tenantId: String(row.tenant_id),
		userId: row.user_id == null ? null : String(row.user_id),
		state: row.state as ReceiptState,
		result: parsed?.success ? parsed.data : null,
		note: row.note == null ? null : String(row.note),
		requestId: row.request_id == null ? null : String(row.request_id),
		recordedAt: row.recorded_at == null ? null : iso(row.recorded_at),
		createdAt: iso(row.created_at),
		updatedAt: iso(row.updated_at),
	};
}

const COLUMNS = sql`change_set_id, tenant_id, user_id, state, result, note, request_id, recorded_at, created_at, updated_at`;

async function rows(query: SQL): Promise<ApplyReceipt[]> {
	return (await rowsOf<Record<string, unknown>>(await db(), query)).map(receiptOf);
}

export async function readReceipt(changeSetId: string, tenantId?: string | number): Promise<ApplyReceipt | null> {
	const scope = tenantId === undefined ? sql`` : sql` AND tenant_id = ${tenantParam(tenantId)}`;
	const [receipt] = await rows(sql`SELECT ${COLUMNS} FROM ai_change_set_applies WHERE change_set_id = ${changeSetId}${scope}`);
	return receipt ?? null;
}

export type BeginApply =
	/**
	 * this request applies the change: a new receipt, or (`takeover`) one left by an attempt that died — that one may
	 * have written before it died, so a version guard refusal is not proof the change never ran
	 */
	| { kind: "started"; takeover: boolean }
	/** it ran already: re-send this result, write nothing */
	| { kind: "applied"; receipt: ApplyReceipt }
	/** another request is applying it right now, or it was undone already */
	| { kind: "busy"; state: ReceiptState };

/** Takes the receipt before an approved change is applied (after the ai-platform claim). */
export async function beginApply(input: { changeSetId: string; tenantId: string; userId: string | number | null; requestId: string }): Promise<BeginApply> {
	const tenant = tenantParam(input.tenantId);
	const userId = input.userId == null ? null : String(input.userId);
	const inserted = await rows(sql`INSERT INTO ai_change_set_applies (change_set_id, tenant_id, user_id, state, request_id)
		VALUES (${input.changeSetId}, ${tenant}, ${userId}, 'applying', ${input.requestId})
		ON CONFLICT (change_set_id) DO NOTHING
		RETURNING ${COLUMNS}`);
	if (inserted.length > 0) return { kind: "started", takeover: false };
	const existing = await readReceipt(input.changeSetId, tenant);
	// a receipt of another workspace under this id: never touched from here
	if (!existing) return { kind: "busy", state: "applying" };
	if (existing.state === "applied") return { kind: "applied", receipt: existing };
	if (existing.state === "reverted") return { kind: "busy", state: "reverted" };
	// `applying` and old: the attempt that took it died before it finished; this one takes over
	const staleBefore = new Date(Date.now() - STALE_APPLYING_MS).toISOString();
	const taken = await rows(sql`UPDATE ai_change_set_applies SET request_id = ${input.requestId}, user_id = ${userId}, updated_at = now()
		WHERE change_set_id = ${input.changeSetId} AND tenant_id = ${tenant} AND state = 'applying' AND updated_at < ${staleBefore}::timestamptz
		RETURNING ${COLUMNS}`);
	return taken.length > 0 ? { kind: "started", takeover: true } : { kind: "busy", state: "applying" };
}

/** The apply failed and nothing stays written: the receipt goes, so Approve can be tried again. */
export async function abandonApply(changeSetId: string, requestId: string): Promise<void> {
	await (await db()).db.drizzle.execute(sql`DELETE FROM ai_change_set_applies WHERE change_set_id = ${changeSetId} AND state = 'applying' AND request_id = ${requestId}`);
}

/** The change is live: its result is kept before ai-platform is told. */
export async function markApplied(changeSetId: string, requestId: string, result: ChangeSetResult, note: string | undefined): Promise<void> {
	const written = await rows(sql`UPDATE ai_change_set_applies SET state = 'applied', result = ${JSON.stringify(result)}::jsonb, note = ${note ?? null}, recorded_at = NULL, updated_at = now()
		WHERE change_set_id = ${changeSetId} AND state = 'applying' AND request_id = ${requestId}
		RETURNING ${COLUMNS}`);
	if (written.length === 0) throw new Error(`apply receipt ${changeSetId} was not held by this request`);
}

/** The undo ran: kept (as `reverted`, with the undo's result) before ai-platform is told. */
export async function markReverted(input: { changeSetId: string; tenantId: string; userId: string | number | null; requestId: string; result: ChangeSetResult }): Promise<void> {
	const tenant = tenantParam(input.tenantId);
	const userId = input.userId == null ? null : String(input.userId);
	await (await db()).db.drizzle.execute(sql`INSERT INTO ai_change_set_applies (change_set_id, tenant_id, user_id, state, result, request_id)
		VALUES (${input.changeSetId}, ${tenant}, ${userId}, 'reverted', ${JSON.stringify(input.result)}::jsonb, ${input.requestId})
		ON CONFLICT (change_set_id) DO UPDATE SET state = 'reverted', result = EXCLUDED.result, user_id = EXCLUDED.user_id,
			request_id = EXCLUDED.request_id, recorded_at = NULL, updated_at = now()
		WHERE ai_change_set_applies.tenant_id = EXCLUDED.tenant_id`);
}

/** ai-platform has it now (`state` as recorded); the sweep leaves the receipt alone. */
export async function markRecorded(changeSetId: string, state: Exclude<ReceiptState, "applying">): Promise<void> {
	await (await db()).db.drizzle.execute(sql`UPDATE ai_change_set_applies SET recorded_at = now(), updated_at = now() WHERE change_set_id = ${changeSetId} AND state = ${state}`);
}

/**
 * The site editor put an undone change back (reconcile → reinstate): it is applied again, so a receipt that says
 * `reverted` must not answer the next Undo with "already undone".
 */
export async function markReinstated(changeSetId: string): Promise<void> {
	await (await db()).db.drizzle.execute(sql`UPDATE ai_change_set_applies SET state = 'applied', recorded_at = now(), updated_at = now() WHERE change_set_id = ${changeSetId} AND state = 'reverted'`);
}

/** Receipts whose record ai-platform never got, oldest attempt first (a failure moves one to the back). */
export async function unrecordedReceipts(limit: number = SWEEP_LIMIT, now: Date = new Date()): Promise<ApplyReceipt[]> {
	const youngest = new Date(now.getTime() - SWEEP_MIN_AGE_MS).toISOString();
	const oldest = new Date(now.getTime() - SWEEP_MAX_AGE_MS).toISOString();
	return rows(sql`SELECT ${COLUMNS} FROM ai_change_set_applies
		WHERE recorded_at IS NULL AND state IN ('applied', 'reverted') AND updated_at < ${youngest}::timestamptz AND created_at > ${oldest}::timestamptz
		ORDER BY updated_at ASC LIMIT ${Math.max(1, Math.min(limit, SWEEP_LIMIT))}`);
}

/** A sweep attempt that did not get through: try again on a later run, after the others. */
export async function deferReceipt(changeSetId: string): Promise<void> {
	await (await db()).db.drizzle.execute(sql`UPDATE ai_change_set_applies SET updated_at = now() WHERE change_set_id = ${changeSetId} AND recorded_at IS NULL`);
}

import {
	AgentRunSchema,
	type AgentRun,
	type AgentThread,
	type ChangeSet,
	ChangeSetSchema,
	type WorkState,
} from "@ech/agent-core";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, notExists, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AiRequestContext } from "../auth/context-token";
import { DB, type Database } from "../database/database.module";
import { aiAttachments, aiChangeSets, aiDecisions, aiRuns, aiRunStarts, aiThreads, aiWorkState } from "../database/schema";
import { requesterOf, withoutCallerView } from "./change-set-access";
import { failedStaleRun, IN_FLIGHT_RUN_STATUSES, QUEUED_RUN_STATUS, STALE_RUN_BATCH, WORKING_RUN_STATUSES } from "./stale-run";
import type {
	AgentStore,
	AttachmentRecord,
	ChangeSetGuard,
	ChangeSetListQuery,
	DeleteThreadOutcome,
	NewAttachment,
	OpenQuestion,
	PurgeCounts,
	QueueCheck,
	ReservedStart,
	RunSlots,
	RunStartCounts,
	RunStartRecord,
	RunStartWindows,
	RunWithState,
	StoredChangeSet,
	StoredDecision,
	ThreadOwner,
	ThreadListQuery,
	ThreadRunRecord,
	ThreadStats,
	WaitingReview,
	WorkStatePatch,
} from "./agent-store";

type AttachmentRow = Omit<typeof aiAttachments.$inferSelect, "content">;

const ATTACHMENT_COLUMNS = {
	id: aiAttachments.id,
	organizationId: aiAttachments.organizationId,
	userId: aiAttachments.userId,
	threadId: aiAttachments.threadId,
	kind: aiAttachments.kind,
	origin: aiAttachments.origin,
	ref: aiAttachments.ref,
	name: aiAttachments.name,
	mime: aiAttachments.mime,
	size: aiAttachments.size,
	textContent: aiAttachments.textContent,
	credit: aiAttachments.credit,
	createdAt: aiAttachments.createdAt,
};

function toAttachment(row: AttachmentRow): AttachmentRecord {
	return {
		...row,
		kind: row.kind === "document" ? "document" : "image",
		origin: (["upload", "media", "product", "stock"] as const).find((o) => o === row.origin) ?? "upload",
	};
}

type ThreadRow = typeof aiThreads.$inferSelect;

function toThread(row: ThreadRow): AgentThread {
	return {
		id: row.id,
		title: row.title,
		preview: row.preview ?? undefined,
		runCount: row.runCount,
		...(row.entityKind && row.entityId
			? { entity: { kind: row.entityKind, id: row.entityId, ...(row.entityLabel ? { label: row.entityLabel } : {}) } }
			: {}),
		...(row.taskKey ? { taskKey: row.taskKey } : {}),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toWorkState(row: typeof aiWorkState.$inferSelect): WorkState {
	return {
		key: row.key,
		...(row.snoozedUntil ? { snoozedUntil: row.snoozedUntil.toISOString() } : {}),
		...(row.dismissedFp ? { dismissedFingerprint: row.dismissedFp } : {}),
		...(row.lastRaisedAt ? { lastRaisedAt: row.lastRaisedAt.toISOString() } : {}),
		updatedAt: row.updatedAt.toISOString(),
	};
}

/** A pending draft still inside its approval window at `now` (expired ones are flipped lazily, on read/decide). */
function unexpired(now: Date) {
	return sql`(${aiChangeSets.changeSet} ->> 'expiresAt')::timestamptz > ${now.toISOString()}::timestamptz`;
}

/** A stored change set with its asker filled in from its run's user (drafts staged before `requestedBy`). */
function toChangeSet(raw: unknown, runUserId: string | null): ChangeSet {
	const changeSet = ChangeSetSchema.parse(raw);
	const requestedBy = requesterOf(changeSet, runUserId);
	return requestedBy ? { ...changeSet, requestedBy } : changeSet;
}

/** The change set's run (same org): who asked for it. */
const runOfChangeSet = and(eq(aiRuns.id, aiChangeSets.runId), eq(aiRuns.organizationId, aiChangeSets.organizationId));

/** A run of this shop, or one without a tenant (shops sharing an organization never see each other's). */
function ofTenant(tenantId: string): SQL {
	return or(isNull(aiRuns.tenantId), eq(aiRuns.tenantId, tenantId)) as SQL;
}

/** The owner's threads still inside retention. */
function liveThreadOf(owner: ThreadOwner, activeSince: Date) {
	return and(eq(aiThreads.organizationId, owner.organizationId), eq(aiThreads.userId, owner.userId), gte(aiThreads.updatedAt, activeSince));
}

function ownedThread(owner: ThreadOwner, id: string) {
	return and(
		eq(aiThreads.id, id),
		eq(aiThreads.organizationId, owner.organizationId),
		eq(aiThreads.userId, owner.userId),
	);
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Rows a retention pass deletes per transaction (each id is one bind parameter; Postgres allows 65 535). */
export const RETENTION_BATCH = 500;

/** `$1, $2, …` for an `IN (…)` list. */
function idList(ids: readonly string[]): SQL {
	return sql.join(
		ids.map((id) => sql`${id}`),
		sql`, `,
	);
}

/** Starts and queue checks of one org run one at a time (transaction-scoped advisory lock). */
async function lockRunStarts(tx: Tx, organizationId: string): Promise<void> {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ai_run_start:${organizationId}`}))`);
}

/**
 * The org's working requests (run rows planning / running / applying not left by a killed process, plus
 * starts reserved to run whose row is not written yet) and its queue (FIFO by start time: queued starts whose
 * row is not written yet, and queued runs still checking in).
 */
async function readSlots(tx: Tx, organizationId: string, windows: RunStartWindows): Promise<RunSlots> {
	const at = (date: Date) => sql`${date.toISOString()}::timestamptz`;
	const working = await tx.execute<{
		run_id: string;
		user_id: string;
		thread_id: string | null;
		title: string | null;
		prompt: string | null;
		user_name: string | null;
		started_at: string | Date;
		pending: boolean;
		tenant_id: string | null;
	}>(sql`SELECT r.id AS run_id, r.user_id, r.thread_id, t.title, r.run ->> 'prompt' AS prompt, s.user_name,
			COALESCE((r.run ->> 'startedAt')::timestamptz, r.created_at) AS started_at, false AS pending, r.tenant_id
		FROM ai_runs r
		LEFT JOIN ai_threads t ON t.id = r.thread_id AND t.organization_id = r.organization_id
		LEFT JOIN ai_run_starts s ON s.run_id = r.id
		WHERE r.organization_id = ${organizationId}
			AND r.status IN ('planning', 'running', 'applying')
			AND r.updated_at >= ${at(windows.runningSince)}
		UNION ALL
		SELECT s.run_id, s.user_id, s.thread_id, NULL, NULL, s.user_name, s.created_at, true, NULL
		FROM ai_run_starts s
		WHERE s.organization_id = ${organizationId}
			AND NOT s.queued
			AND s.created_at >= ${at(windows.pendingSince)}
			AND NOT EXISTS (SELECT 1 FROM ai_runs r WHERE r.id = s.run_id)
		ORDER BY started_at, run_id`);
	const queue = await tx.execute<{ run_id: string; user_id: string; created_at: string | Date }>(sql`SELECT s.run_id, s.user_id, s.created_at
		FROM ai_run_starts s
		LEFT JOIN ai_runs r ON r.id = s.run_id
		WHERE s.organization_id = ${organizationId}
			AND s.queued
			AND s.created_at >= ${at(windows.runningSince)}
			AND (
				(r.id IS NULL AND s.created_at >= ${at(windows.queueAliveSince)})
				OR (r.status = ${QUEUED_RUN_STATUS} AND r.updated_at >= ${at(windows.queueAliveSince)})
			)
		ORDER BY s.created_at, s.run_id`);
	return {
		working: working.rows.map((row) => ({
			runId: row.run_id,
			userId: row.user_id,
			threadId: row.thread_id,
			threadTitle: row.title,
			prompt: row.prompt,
			userName: row.user_name,
			startedAt: new Date(row.started_at),
			pending: Boolean(row.pending),
			tenantId: row.tenant_id ?? null,
		})),
		queue: queue.rows.map((row) => ({ runId: row.run_id, userId: row.user_id, queuedAt: new Date(row.created_at) })),
	};
}

@Injectable()
export class DrizzleAgentStore implements AgentStore {
	constructor(@Inject(DB) private readonly db: Database) {}

	async createRun(ctx: AiRequestContext, run: AgentRun, userMessage?: string): Promise<void> {
		await this.db.insert(aiRuns).values({
			id: run.id,
			organizationId: ctx.organizationId,
			tenantId: ctx.tenantId ?? null,
			userId: ctx.userId,
			surface: run.role === "customer" ? "shopper" : "merchant",
			domain: run.domain,
			status: run.status,
			run,
			threadId: run.threadId ?? null,
			userMessage: userMessage ?? null,
		});
	}

	async saveRun(organizationId: string, run: AgentRun): Promise<void> {
		await this.db
			.update(aiRuns)
			.set({ status: run.status, run, updatedAt: new Date() })
			.where(and(eq(aiRuns.id, run.id), eq(aiRuns.organizationId, organizationId)));
	}

	async saveRunIfStatus(organizationId: string, run: AgentRun, from: readonly AgentRun["status"][]): Promise<boolean> {
		if (from.length === 0) return false;
		const rows = await this.db
			.update(aiRuns)
			.set({ status: run.status, run, updatedAt: new Date() })
			.where(and(eq(aiRuns.id, run.id), eq(aiRuns.organizationId, organizationId), inArray(aiRuns.status, [...from])))
			.returning({ id: aiRuns.id });
		return rows.length > 0;
	}

	async settleRunStatus(
		organizationId: string,
		runId: string,
		status: AgentRun["status"],
		finishedAt: string,
		from: readonly AgentRun["status"][],
	): Promise<boolean> {
		if (from.length === 0) return false;
		const rows = await this.db
			.update(aiRuns)
			.set({
				status,
				// only the status and the end time: the rest stays as the run's driver last wrote it
				run: sql`jsonb_set(jsonb_set(${aiRuns.run}, '{status}', to_jsonb(${status}::text)), '{finishedAt}', to_jsonb(${finishedAt}::text))`,
				updatedAt: new Date(),
			})
			.where(and(eq(aiRuns.id, runId), eq(aiRuns.organizationId, organizationId), inArray(aiRuns.status, [...from])))
			.returning({ id: aiRuns.id });
		return rows.length > 0;
	}

	async claimAwaitingInput(organizationId: string, runId: string, userId: string, now: Date): Promise<RunWithState | null> {
		const newer = alias(aiRuns, "newer_run");
		const [row] = await this.db
			.update(aiRuns)
			.set({ status: "running", run: sql`jsonb_set(${aiRuns.run}, '{status}', '"running"')`, updatedAt: now })
			.where(
				and(
					eq(aiRuns.id, runId),
					eq(aiRuns.organizationId, organizationId),
					eq(aiRuns.userId, userId),
					eq(aiRuns.status, "awaiting_input"),
					// a question left open when the merchant sent another message in the chat is no longer answered
					or(
						isNull(aiRuns.threadId),
						notExists(
							this.db
								.select({ one: sql`1` })
								.from(newer)
								.where(and(eq(newer.threadId, aiRuns.threadId), gt(newer.createdAt, aiRuns.createdAt))),
						),
					),
				),
			)
			.returning({ run: aiRuns.run, state: aiRuns.state, userMessage: aiRuns.userMessage });
		return row ? { run: AgentRunSchema.parse(row.run), state: row.state, userMessage: row.userMessage } : null;
	}

	async getRun(organizationId: string, id: string, userId?: string, tenantId?: string): Promise<AgentRun | null> {
		const conditions = [eq(aiRuns.id, id), eq(aiRuns.organizationId, organizationId)];
		if (userId) conditions.push(eq(aiRuns.userId, userId));
		if (tenantId) conditions.push(ofTenant(tenantId));
		const [row] = await this.db
			.select({ run: aiRuns.run })
			.from(aiRuns)
			.where(and(...conditions))
			.limit(1);
		return row ? AgentRunSchema.parse(row.run) : null;
	}

	async getRunStatus(organizationId: string, id: string): Promise<AgentRun["status"] | null> {
		const [row] = await this.db
			.select({ status: aiRuns.status })
			.from(aiRuns)
			.where(and(eq(aiRuns.id, id), eq(aiRuns.organizationId, organizationId)))
			.limit(1);
		return (row?.status as AgentRun["status"] | undefined) ?? null;
	}

	async listRuns(organizationId: string, limit: number, userId?: string): Promise<AgentRun[]> {
		const conditions = [eq(aiRuns.organizationId, organizationId)];
		if (userId) conditions.push(eq(aiRuns.userId, userId));
		const rows = await this.db
			.select({ run: aiRuns.run })
			.from(aiRuns)
			.where(and(...conditions))
			.orderBy(desc(aiRuns.createdAt))
			.limit(limit);
		return rows.map((row) => AgentRunSchema.parse(row.run));
	}

	async reserveRunStart(
		ctx: AiRequestContext,
		runId: string,
		windows: RunStartWindows,
		admit: (counts: RunStartCounts) => { queued: boolean },
		record: RunStartRecord = {},
	): Promise<ReservedStart> {
		const org = ctx.organizationId;
		const user = ctx.userId;
		const starts = (...where: SQL[]) => sql`(SELECT count(*) FROM ${aiRunStarts} WHERE ${and(eq(aiRunStarts.organizationId, org), ...where)})`;
		const runs = (...where: SQL[]) => sql`(SELECT count(*) FROM ${aiRuns} WHERE ${and(eq(aiRuns.organizationId, org), ...where)})`;
		return this.db.transaction(async (tx) => {
			// one start (or queue check) at a time per org: the counts below and the insert are a single step
			await lockRunStarts(tx, org);
			// the same prompt sent twice (a retried request): the run it already made, nothing reserved again
			if (record.clientRequestId) {
				const [earlier] = await tx
					.select({ runId: aiRunStarts.runId })
					.from(aiRunStarts)
					.where(
						and(
							eq(aiRunStarts.organizationId, org),
							eq(aiRunStarts.userId, user),
							eq(aiRunStarts.clientRequestId, record.clientRequestId),
							gte(aiRunStarts.createdAt, record.replaySince ?? windows.daySince),
						),
					)
					.limit(1);
				if (earlier) return { runId: earlier.runId, queued: false, replay: true };
			}
			const thread = record.threadId;
			// starts survive a chat delete; runs still count (rows from before ai_run_starts, any start that skipped it)
			const result = await tx.execute<{ org_day: number; user_minute: number; thread_active: number }>(sql`SELECT
				GREATEST(${starts(gte(aiRunStarts.createdAt, windows.daySince))}, ${runs(gte(aiRuns.createdAt, windows.daySince))})::int AS org_day,
				GREATEST(
					${starts(eq(aiRunStarts.userId, user), gte(aiRunStarts.createdAt, windows.minuteSince))},
					${runs(eq(aiRuns.userId, user), gte(aiRuns.createdAt, windows.minuteSince))}
				)::int AS user_minute,
				${
					thread
						? sql`(${runs(
								eq(aiRuns.threadId, thread),
								or(
									and(inArray(aiRuns.status, [...WORKING_RUN_STATUSES]), gte(aiRuns.updatedAt, windows.runningSince)),
									and(eq(aiRuns.status, QUEUED_RUN_STATUS), gte(aiRuns.updatedAt, windows.queueAliveSince)),
								) as SQL,
							)} + ${starts(
								eq(aiRunStarts.threadId, thread),
								gte(aiRunStarts.createdAt, windows.pendingSince),
								notExists(tx.select({ one: sql`1` }).from(aiRuns).where(eq(aiRuns.id, aiRunStarts.runId))),
							)})::int`
						: sql`0`
				} AS thread_active`);
			const row = result.rows[0];
			const { queued } = admit({
				orgDay: Number(row?.org_day ?? 0),
				userMinute: Number(row?.user_minute ?? 0),
				threadActive: Number(row?.thread_active ?? 0),
				slots: await readSlots(tx, org, windows),
			});
			await tx.insert(aiRunStarts).values({
				runId,
				organizationId: org,
				userId: user,
				createdAt: windows.now,
				queued,
				threadId: thread ?? null,
				clientRequestId: record.clientRequestId ?? null,
				userName: record.userName ?? null,
			});
			return { runId, queued, replay: false };
		});
	}

	async checkQueuedRun(organizationId: string, runId: string, windows: RunStartWindows, admit: (slots: RunSlots) => boolean): Promise<QueueCheck> {
		return this.db.transaction(async (tx) => {
			await lockRunStarts(tx, organizationId);
			const ownRow = and(eq(aiRuns.id, runId), eq(aiRuns.organizationId, organizationId));
			// still queued: its place stays alive (a queued row not checked in for a while was left by a killed process)
			const alive = await tx
				.update(aiRuns)
				.set({ updatedAt: windows.now })
				.where(and(ownRow, eq(aiRuns.status, QUEUED_RUN_STATUS)))
				.returning({ id: aiRuns.id });
			if (alive.length === 0) {
				const [row] = await tx.select({ status: aiRuns.status }).from(aiRuns).where(ownRow).limit(1);
				return { status: (row?.status as AgentRun["status"] | undefined) ?? null, admitted: false, slots: { working: [], queue: [] } };
			}
			const slots = await readSlots(tx, organizationId, windows);
			if (!admit(slots)) return { status: QUEUED_RUN_STATUS, admitted: false, slots };
			const startedAt = windows.now.toISOString();
			await tx
				.update(aiRuns)
				.set({
					status: "planning",
					run: sql`jsonb_set(jsonb_set(${aiRuns.run}, '{status}', '"planning"'), '{startedAt}', to_jsonb(${startedAt}::text))`,
					updatedAt: windows.now,
				})
				.where(and(ownRow, eq(aiRuns.status, QUEUED_RUN_STATUS)));
			return { status: QUEUED_RUN_STATUS, admitted: true, slots };
		});
	}

	async pruneRunStarts(before: Date): Promise<number> {
		const rows = await this.db.delete(aiRunStarts).where(lt(aiRunStarts.createdAt, before)).returning({ runId: aiRunStarts.runId });
		return rows.length;
	}

	async insertChangeSet(organizationId: string, changeSet: ChangeSet): Promise<void> {
		await this.db.insert(aiChangeSets).values({
			id: changeSet.id,
			runId: changeSet.runId,
			organizationId,
			status: changeSet.status,
			actionKind: changeSet.action?.kind ?? null,
			changeSet: withoutCallerView(changeSet),
		});
	}

	async getChangeSet(organizationId: string, id: string): Promise<StoredChangeSet | null> {
		const [row] = await this.db
			.select({ changeSet: aiChangeSets.changeSet, claimedAt: aiChangeSets.claimedAt, runUserId: aiRuns.userId, tenantId: aiRuns.tenantId })
			.from(aiChangeSets)
			.leftJoin(aiRuns, runOfChangeSet)
			.where(and(eq(aiChangeSets.id, id), eq(aiChangeSets.organizationId, organizationId)))
			.limit(1);
		return row ? { changeSet: toChangeSet(row.changeSet, row.runUserId), claimedAt: row.claimedAt, tenantId: row.tenantId ?? null } : null;
	}

	async listChangeSets(organizationId: string, query: ChangeSetListQuery) {
		const conditions = [eq(aiChangeSets.organizationId, organizationId)];
		if (query.status) conditions.push(eq(aiChangeSets.status, query.status));
		if (query.requestedBy) conditions.push(eq(aiRuns.userId, query.requestedBy));
		if (query.tenantId) conditions.push(ofTenant(query.tenantId));
		const rows = await this.db
			.select({ changeSet: aiChangeSets.changeSet, runUserId: aiRuns.userId })
			.from(aiChangeSets)
			.leftJoin(aiRuns, runOfChangeSet)
			.where(and(...conditions))
			.orderBy(desc(aiChangeSets.createdAt))
			.limit(query.limit);
		return rows.map((row) => toChangeSet(row.changeSet, row.runUserId));
	}

	async listRunChangeSets(organizationId: string, runId: string): Promise<ChangeSet[]> {
		const rows = await this.db
			.select({ changeSet: aiChangeSets.changeSet, runUserId: aiRuns.userId })
			.from(aiChangeSets)
			.leftJoin(aiRuns, runOfChangeSet)
			.where(and(eq(aiChangeSets.organizationId, organizationId), eq(aiChangeSets.runId, runId)));
		return rows.map((row) => toChangeSet(row.changeSet, row.runUserId));
	}

	async claimChangeSet(organizationId: string, id: string, staleAfterMs: number): Promise<ChangeSet | null> {
		const now = new Date();
		const rows = await this.db
			.update(aiChangeSets)
			.set({ claimedAt: now, updatedAt: now })
			.where(
				and(
					eq(aiChangeSets.id, id),
					eq(aiChangeSets.organizationId, organizationId),
					eq(aiChangeSets.status, "pending"),
					or(isNull(aiChangeSets.claimedAt), lt(aiChangeSets.claimedAt, new Date(now.getTime() - staleAfterMs))),
				),
			)
			.returning({ changeSet: aiChangeSets.changeSet });
		const row = rows[0];
		return row ? ChangeSetSchema.parse(row.changeSet) : null;
	}

	async releaseChangeSet(organizationId: string, id: string): Promise<void> {
		await this.db
			.update(aiChangeSets)
			.set({ claimedAt: null, updatedAt: new Date() })
			.where(and(eq(aiChangeSets.id, id), eq(aiChangeSets.organizationId, organizationId)));
	}

	async updateChangeSet(organizationId: string, changeSet: ChangeSet, expected?: ChangeSetGuard): Promise<boolean> {
		const guard = expected
			? [
					eq(aiChangeSets.status, expected.status),
					...(expected.unclaimedSince ? [or(isNull(aiChangeSets.claimedAt), lt(aiChangeSets.claimedAt, expected.unclaimedSince))] : []),
				]
			: [];
		const rows = await this.db
			.update(aiChangeSets)
			.set({ status: changeSet.status, changeSet: withoutCallerView(changeSet), updatedAt: new Date() })
			.where(and(eq(aiChangeSets.id, changeSet.id), eq(aiChangeSets.organizationId, organizationId), ...guard))
			.returning({ id: aiChangeSets.id });
		return rows.length > 0;
	}

	async createThread(ctx: AiRequestContext, thread: AgentThread): Promise<void> {
		await this.db.insert(aiThreads).values({
			id: thread.id,
			organizationId: ctx.organizationId,
			tenantId: ctx.tenantId ?? null,
			userId: ctx.userId,
			title: thread.title,
			preview: thread.preview ?? null,
			runCount: thread.runCount,
			entityKind: thread.entity?.kind ?? null,
			entityId: thread.entity?.id ?? null,
			entityLabel: thread.entity?.label ?? null,
			taskKey: thread.taskKey ?? null,
			// a task's chat keeps the item's title: never retitled from drafts
			titleSource: thread.taskKey ? "task" : "auto",
			createdAt: new Date(thread.createdAt),
			updatedAt: new Date(thread.updatedAt),
		});
	}

	async getThread(owner: ThreadOwner, id: string, activeSince: Date): Promise<AgentThread | null> {
		const [row] = await this.db
			.select()
			.from(aiThreads)
			.where(and(ownedThread(owner, id), gte(aiThreads.updatedAt, activeSince)))
			.limit(1);
		return row ? toThread(row) : null;
	}

	async listThreads(owner: ThreadOwner, query: ThreadListQuery): Promise<AgentThread[]> {
		const rows = await this.db
			.select()
			.from(aiThreads)
			.where(
				and(
					eq(aiThreads.organizationId, owner.organizationId),
					eq(aiThreads.userId, owner.userId),
					gte(aiThreads.updatedAt, query.activeSince),
					...(query.entity ? [eq(aiThreads.entityKind, query.entity.kind), eq(aiThreads.entityId, query.entity.id)] : []),
					...(query.taskKey ? [eq(aiThreads.taskKey, query.taskKey)] : []),
					...(query.tasksOnly ? [isNotNull(aiThreads.taskKey)] : []),
				),
			)
			.orderBy(desc(aiThreads.updatedAt))
			.limit(query.limit);
		return rows.map(toThread);
	}

	async renameThread(owner: ThreadOwner, id: string, title: string, activeSince: Date): Promise<AgentThread | null> {
		// Renaming is not conversation activity: updated_at (retention clock) is left alone.
		const [row] = await this.db
			.update(aiThreads)
			.set({ title, titleSource: "user" })
			.where(and(ownedThread(owner, id), gte(aiThreads.updatedAt, activeSince)))
			.returning();
		return row ? toThread(row) : null;
	}

	async retitleThread(organizationId: string, id: string, title: string): Promise<boolean> {
		const rows = await this.db
			.update(aiThreads)
			.set({ title })
			.where(
				and(
					eq(aiThreads.id, id),
					eq(aiThreads.organizationId, organizationId),
					eq(aiThreads.titleSource, "auto"),
					sql`${aiThreads.title} <> ${title}`,
				),
			)
			.returning({ id: aiThreads.id });
		return rows.length > 0;
	}

	async touchThread(organizationId: string, id: string, update: { preview: string; at: Date }): Promise<void> {
		await this.db
			.update(aiThreads)
			.set({ runCount: sql`${aiThreads.runCount} + 1`, preview: update.preview, updatedAt: update.at })
			.where(and(eq(aiThreads.id, id), eq(aiThreads.organizationId, organizationId)));
	}

	async listThreadRuns(organizationId: string, threadId: string): Promise<ThreadRunRecord[]> {
		const rows = await this.db
			.select({ run: aiRuns.run, userMessage: aiRuns.userMessage })
			.from(aiRuns)
			.where(and(eq(aiRuns.organizationId, organizationId), eq(aiRuns.threadId, threadId)))
			.orderBy(asc(aiRuns.createdAt), asc(aiRuns.id));
		return rows.map((row) => ({ run: AgentRunSchema.parse(row.run), userMessage: row.userMessage }));
	}

	async listThreadChangeSets(organizationId: string, threadId: string): Promise<StoredChangeSet[]> {
		const rows = await this.db
			.select({ changeSet: aiChangeSets.changeSet, claimedAt: aiChangeSets.claimedAt, runUserId: aiRuns.userId, tenantId: aiRuns.tenantId })
			.from(aiChangeSets)
			.innerJoin(aiRuns, eq(aiRuns.id, aiChangeSets.runId))
			.where(and(eq(aiChangeSets.organizationId, organizationId), eq(aiRuns.threadId, threadId)))
			.orderBy(asc(aiChangeSets.createdAt));
		return rows.map((row) => ({ changeSet: toChangeSet(row.changeSet, row.runUserId), claimedAt: row.claimedAt, tenantId: row.tenantId ?? null }));
	}

	async deleteThread(owner: ThreadOwner, id: string, claimedSince: Date): Promise<DeleteThreadOutcome> {
		return this.db.transaction(async (tx) => {
			const [thread] = await tx.select({ id: aiThreads.id }).from(aiThreads).where(ownedThread(owner, id)).for("update");
			if (!thread) return "not_found";
			const runIds = (
				await tx
					.select({ id: aiRuns.id })
					.from(aiRuns)
					.where(and(eq(aiRuns.organizationId, owner.organizationId), eq(aiRuns.threadId, id)))
					// a run still staging a draft waits here, then finds its row gone (insert refused by the foreign key)
					.for("update")
			).map((row) => row.id);
			if (runIds.length > 0) {
				// Row locks make a concurrent claim wait for this decision instead of racing it.
				const sets = await tx
					.select({ status: aiChangeSets.status, claimedAt: aiChangeSets.claimedAt })
					.from(aiChangeSets)
					.where(inArray(aiChangeSets.runId, runIds))
					.for("update");
				if (sets.some((cs) => cs.status === "pending" && cs.claimedAt && cs.claimedAt >= claimedSince)) {
					return "claimed";
				}
				await tx.delete(aiChangeSets).where(inArray(aiChangeSets.runId, runIds));
				await tx.delete(aiRuns).where(inArray(aiRuns.id, runIds));
			}
			await tx
				.delete(aiAttachments)
				.where(and(eq(aiAttachments.organizationId, owner.organizationId), eq(aiAttachments.threadId, id)));
			await tx.delete(aiThreads).where(eq(aiThreads.id, id));
			return "deleted";
		});
	}

	async purgeThreadsInactiveSince(before: Date): Promise<PurgeCounts> {
		const counts: PurgeCounts = { threads: 0, runs: 0, changeSets: 0 };
		const add = (batch: PurgeCounts) => {
			counts.threads += batch.threads;
			counts.runs += batch.runs;
			counts.changeSets += batch.changeSets;
		};
		// RETENTION_BATCH ids per transaction (bounded bind parameters and lock time), until a short batch:
		// idle threads with their runs' change sets and runs, then runs orphaned by a thread deleted mid-start
		for (let found = RETENTION_BATCH; found === RETENTION_BATCH; ) {
			found = await this.db.transaction(async (tx) => {
				const picked = await tx.execute<{ id: string }>(
					sql`SELECT id FROM ai_threads WHERE updated_at < ${before.toISOString()}::timestamptz ORDER BY updated_at LIMIT ${RETENTION_BATCH} FOR UPDATE`,
				);
				const ids = picked.rows.map((row) => row.id);
				if (ids.length === 0) return 0;
				const list = idList(ids);
				const changeSets = await tx.execute(sql`DELETE FROM ai_change_sets WHERE run_id IN (SELECT id FROM ai_runs WHERE thread_id IN (${list}))`);
				const runs = await tx.execute(sql`DELETE FROM ai_runs WHERE thread_id IN (${list})`);
				const threads = await tx.execute(sql`DELETE FROM ai_threads WHERE id IN (${list})`);
				add({ threads: threads.rowCount ?? 0, runs: runs.rowCount ?? 0, changeSets: changeSets.rowCount ?? 0 });
				return ids.length;
			});
		}
		for (let found = RETENTION_BATCH; found === RETENTION_BATCH; ) {
			found = await this.db.transaction(async (tx) => {
				const picked = await tx.execute<{ id: string }>(
					sql`SELECT r.id FROM ai_runs r WHERE r.thread_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_threads t WHERE t.id = r.thread_id) LIMIT ${RETENTION_BATCH} FOR UPDATE OF r`,
				);
				const ids = picked.rows.map((row) => row.id);
				if (ids.length === 0) return 0;
				const list = idList(ids);
				const changeSets = await tx.execute(sql`DELETE FROM ai_change_sets WHERE run_id IN (${list})`);
				const runs = await tx.execute(sql`DELETE FROM ai_runs WHERE id IN (${list})`);
				add({ threads: 0, runs: runs.rowCount ?? 0, changeSets: changeSets.rowCount ?? 0 });
				return ids.length;
			});
		}
		return counts;
	}

	async failStaleRuns(staleBefore: Date, error: string, now: Date = new Date()): Promise<number> {
		// two passes, each on its own partial index: runs a process was driving, and runs left waiting in the queue
		let closed = 0;
		for (const statuses of [[...IN_FLIGHT_RUN_STATUSES], [QUEUED_RUN_STATUS]]) {
			closed += await this.failStale(and(inArray(aiRuns.status, statuses), lt(aiRuns.updatedAt, staleBefore)) as SQL, error, now);
		}
		return closed;
	}

	private async failStale(stale: SQL, error: string, now: Date): Promise<number> {
		const rows = await this.db.select({ id: aiRuns.id, run: aiRuns.run }).from(aiRuns).where(stale).orderBy(asc(aiRuns.updatedAt)).limit(STALE_RUN_BATCH);
		let closed = 0;
		for (const row of rows) {
			const parsed = AgentRunSchema.safeParse(row.run);
			// the guard repeats the staleness test: a live process that saved the run since keeps it
			const updated = await this.db
				.update(aiRuns)
				.set({ status: "failed", ...(parsed.success ? { run: failedStaleRun(parsed.data, error, now) } : {}), state: null, updatedAt: now })
				.where(and(eq(aiRuns.id, row.id), stale))
				.returning({ id: aiRuns.id });
			closed += updated.length;
		}
		return closed;
	}

	async threadStats(organizationId: string, threadIds: readonly string[], now: Date = new Date()): Promise<Map<string, ThreadStats>> {
		const stats = new Map<string, ThreadStats>();
		if (threadIds.length === 0) return stats;
		const [latest, sets] = await Promise.all([
			this.db
				.selectDistinctOn([aiRuns.threadId], {
					threadId: aiRuns.threadId,
					domain: aiRuns.domain,
					status: aiRuns.status,
					module: sql<string | null>`${aiRuns.run} -> 'context' ->> 'module'`,
				})
				.from(aiRuns)
				.where(and(eq(aiRuns.organizationId, organizationId), inArray(aiRuns.threadId, [...threadIds])))
				.orderBy(aiRuns.threadId, desc(aiRuns.createdAt)),
			this.db
				.select({
					threadId: aiRuns.threadId,
					pending: sql<number>`count(*) filter (where ${aiChangeSets.status} = 'pending' and ${unexpired(now)})`.mapWith(Number),
					applied: sql<number>`count(*) filter (where ${aiChangeSets.status} = 'applied')`.mapWith(Number),
				})
				.from(aiChangeSets)
				.innerJoin(aiRuns, eq(aiRuns.id, aiChangeSets.runId))
				.where(and(eq(aiChangeSets.organizationId, organizationId), inArray(aiRuns.threadId, [...threadIds])))
				.groupBy(aiRuns.threadId),
		]);
		for (const row of latest) {
			if (!row.threadId) continue;
			stats.set(row.threadId, {
				domain: row.domain,
				...(row.module ? { module: row.module } : {}),
				pending: 0,
				applied: 0,
				latestRun: row.status as AgentRun["status"],
			});
		}
		for (const row of sets) {
			if (!row.threadId) continue;
			const entry = stats.get(row.threadId) ?? { pending: 0, applied: 0 };
			entry.pending = row.pending;
			entry.applied = row.applied;
			stats.set(row.threadId, entry);
		}
		return stats;
	}

	async listWaitingReviews(owner: ThreadOwner, activeSince: Date, now: Date): Promise<WaitingReview[]> {
		// stagedAt sits in the JSON (same instant the row was written); mapped back to a Date like the column
		const since = sql<Date | null>`min((${aiChangeSets.changeSet} ->> 'stagedAt')::timestamptz)`.mapWith(aiChangeSets.createdAt);
		const rows = await this.db
			.select({
				threadId: aiThreads.id,
				title: aiThreads.title,
				taskKey: aiThreads.taskKey,
				count: count(),
				since,
				handOnly: sql<boolean>`coalesce(bool_or((${aiChangeSets.changeSet} ->> 'confirmText') is not null or (${aiChangeSets.changeSet} ->> 'requiresClick') = 'true'), false)`,
				// the oldest waiting draft says what approving does
				changeTitle: sql<string | null>`(array_agg(${aiChangeSets.changeSet} ->> 'title' order by ${aiChangeSets.createdAt}))[1]`,
				actionKind: sql<string | null>`(array_agg(${aiChangeSets.actionKind} order by ${aiChangeSets.createdAt}))[1]`,
			})
			.from(aiChangeSets)
			.innerJoin(aiRuns, eq(aiRuns.id, aiChangeSets.runId))
			.innerJoin(aiThreads, eq(aiThreads.id, aiRuns.threadId))
			.where(
				and(
					eq(aiChangeSets.organizationId, owner.organizationId),
					eq(aiChangeSets.status, "pending"),
					unexpired(now),
					liveThreadOf(owner, activeSince),
				),
			)
			.groupBy(aiThreads.id, aiThreads.title, aiThreads.taskKey)
			.orderBy(since);
		return rows.flatMap((row) =>
			row.since
				? [
						{
							threadId: row.threadId,
							title: row.title,
							...(row.taskKey ? { taskKey: row.taskKey } : {}),
							count: row.count,
							since: row.since,
							handOnly: row.handOnly === true,
							...(row.changeTitle && row.actionKind ? { change: { title: row.changeTitle, actionKind: row.actionKind } } : {}),
						},
					]
				: [],
		);
	}

	async listOpenQuestions(owner: ThreadOwner, activeSince: Date): Promise<OpenQuestion[]> {
		const newer = alias(aiRuns, "newer_run");
		const rows = await this.db
			.select({
				runId: aiRuns.id,
				threadId: aiThreads.id,
				title: aiThreads.title,
				taskKey: aiThreads.taskKey,
				question: sql<string | null>`${aiRuns.run} -> 'ask' -> 'question' ->> 'title'`,
				since: aiRuns.updatedAt,
			})
			.from(aiRuns)
			.innerJoin(aiThreads, eq(aiThreads.id, aiRuns.threadId))
			.where(
				and(
					eq(aiRuns.organizationId, owner.organizationId),
					eq(aiRuns.userId, owner.userId),
					eq(aiRuns.status, "awaiting_input"),
					liveThreadOf(owner, activeSince),
					// a question left unanswered when the merchant sent another message is not waiting on them
					notExists(
						this.db
							.select({ one: sql`1` })
							.from(newer)
							.where(and(eq(newer.threadId, aiRuns.threadId), gt(newer.createdAt, aiRuns.createdAt))),
					),
				),
			)
			.orderBy(asc(aiRuns.updatedAt));
		return rows.flatMap((row) =>
			row.question
				? [{ runId: row.runId, threadId: row.threadId, title: row.title, ...(row.taskKey ? { taskKey: row.taskKey } : {}), question: row.question, since: row.since }]
				: [],
		);
	}

	async listWorkStates(owner: ThreadOwner): Promise<WorkState[]> {
		const rows = await this.db
			.select()
			.from(aiWorkState)
			.where(and(eq(aiWorkState.organizationId, owner.organizationId), eq(aiWorkState.userId, owner.userId)));
		return rows.map(toWorkState);
	}

	async putWorkState(owner: ThreadOwner, key: string, patch: WorkStatePatch, now: Date): Promise<WorkState> {
		const set: Partial<typeof aiWorkState.$inferInsert> = { updatedAt: now };
		if (patch.snoozedUntil !== undefined) set.snoozedUntil = patch.snoozedUntil;
		if (patch.dismissedFingerprint !== undefined) set.dismissedFp = patch.dismissedFingerprint;
		if (patch.lastRaisedAt !== undefined) set.lastRaisedAt = patch.lastRaisedAt;
		const [row] = await this.db
			.insert(aiWorkState)
			.values({
				organizationId: owner.organizationId,
				userId: owner.userId,
				key,
				snoozedUntil: patch.snoozedUntil ?? null,
				dismissedFp: patch.dismissedFingerprint ?? null,
				lastRaisedAt: patch.lastRaisedAt ?? null,
				updatedAt: now,
			})
			.onConflictDoUpdate({ target: [aiWorkState.organizationId, aiWorkState.userId, aiWorkState.key], set })
			.returning();
		if (!row) throw new Error("ai_work_state upsert returned no row");
		return toWorkState(row);
	}

	async saveRunState(organizationId: string, runId: string, state: unknown, onlyWhile?: AgentRun["status"]): Promise<void> {
		await this.db
			.update(aiRuns)
			.set({ state: state ?? null, updatedAt: new Date() })
			.where(and(eq(aiRuns.id, runId), eq(aiRuns.organizationId, organizationId), ...(onlyWhile ? [eq(aiRuns.status, onlyWhile)] : [])));
	}

	async getRunWithState(organizationId: string, runId: string, userId: string): Promise<RunWithState | null> {
		const [row] = await this.db
			.select({ run: aiRuns.run, state: aiRuns.state, userMessage: aiRuns.userMessage })
			.from(aiRuns)
			.where(and(eq(aiRuns.id, runId), eq(aiRuns.organizationId, organizationId), eq(aiRuns.userId, userId)))
			.limit(1);
		return row ? { run: AgentRunSchema.parse(row.run), state: row.state, userMessage: row.userMessage } : null;
	}

	async insertAttachment(ctx: AiRequestContext, attachment: NewAttachment): Promise<void> {
		await this.db.insert(aiAttachments).values({
			...attachment,
			organizationId: ctx.organizationId,
			userId: ctx.userId,
		});
	}

	async getAttachments(owner: ThreadOwner, ids: readonly string[]): Promise<AttachmentRecord[]> {
		if (ids.length === 0) return [];
		const rows = await this.db
			.select(ATTACHMENT_COLUMNS)
			.from(aiAttachments)
			.where(
				and(
					eq(aiAttachments.organizationId, owner.organizationId),
					eq(aiAttachments.userId, owner.userId),
					inArray(aiAttachments.id, [...ids]),
				),
			);
		const byId = new Map(rows.map((row) => [row.id, toAttachment(row)]));
		return ids.flatMap((id) => {
			const found = byId.get(id);
			return found ? [found] : [];
		});
	}

	async getAttachmentContent(
		organizationId: string,
		id: string,
	): Promise<{ record: AttachmentRecord; content: Buffer } | null> {
		const [row] = await this.db
			.select({ ...ATTACHMENT_COLUMNS, content: aiAttachments.content })
			.from(aiAttachments)
			.where(and(eq(aiAttachments.organizationId, organizationId), eq(aiAttachments.id, id)))
			.limit(1);
		if (!row) return null;
		const { content, ...rest } = row;
		return { record: toAttachment(rest), content };
	}

	async assignAttachments(owner: ThreadOwner, ids: readonly string[], threadId: string): Promise<void> {
		if (ids.length === 0) return;
		await this.db
			.update(aiAttachments)
			.set({ threadId })
			.where(
				and(
					eq(aiAttachments.organizationId, owner.organizationId),
					eq(aiAttachments.userId, owner.userId),
					inArray(aiAttachments.id, [...ids]),
					isNull(aiAttachments.threadId),
				),
			);
	}

	async purgeAttachments(before: Date, unsentBefore: Date): Promise<number> {
		const rows = await this.db
			.delete(aiAttachments)
			.where(
				or(
					lt(aiAttachments.createdAt, before),
					and(isNull(aiAttachments.threadId), lt(aiAttachments.createdAt, unsentBefore)),
					and(
						isNotNull(aiAttachments.threadId),
						notExists(this.db.select({ one: sql`1` }).from(aiThreads).where(eq(aiThreads.id, aiAttachments.threadId))),
					),
				),
			)
			.returning({ id: aiAttachments.id });
		return rows.length;
	}

	async getDecision(organizationId: string, fingerprint: string, freshSince: Date): Promise<StoredDecision | null> {
		const [row] = await this.db
			.select()
			.from(aiDecisions)
			.where(
				and(
					eq(aiDecisions.organizationId, organizationId),
					eq(aiDecisions.fingerprint, fingerprint),
					gte(aiDecisions.createdAt, freshSince),
				),
			)
			.limit(1);
		if (!row) return null;
		return {
			stage: row.stage,
			provider: row.provider,
			model: row.model,
			choice: row.choice,
			confidence: row.confidence,
			probabilities: (row.probabilities ?? {}) as Record<string, number>,
			createdAt: row.createdAt,
		};
	}

	async putDecision(organizationId: string, fingerprint: string, decision: StoredDecision): Promise<void> {
		const values = { ...decision, organizationId, fingerprint };
		await this.db
			.insert(aiDecisions)
			.values(values)
			.onConflictDoUpdate({ target: [aiDecisions.organizationId, aiDecisions.fingerprint], set: decision });
	}

	async pruneDecisions(before: Date): Promise<number> {
		const result = await this.db.delete(aiDecisions).where(lt(aiDecisions.createdAt, before));
		return result.rowCount ?? 0;
	}
}

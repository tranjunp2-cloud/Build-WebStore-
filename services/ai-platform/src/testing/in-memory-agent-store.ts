import type { AgentRun, AgentThread, ChangeSet, WorkState } from "@ech/agent-core";
import type { AiRequestContext } from "../auth/context-token";
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
	StoredChangeSet,
	StoredDecision,
	ThreadListQuery,
	ThreadOwner,
	ThreadRunRecord,
	ThreadStats,
	WaitingReview,
	WorkStatePatch,
} from "../agent/agent-store";
import { requesterOf, withoutCallerView } from "../agent/change-set-access";
import { failedStaleRun, IN_FLIGHT_RUN_STATUSES, QUEUED_RUN_STATUS, STALE_RUN_BATCH, WORKING_RUN_STATUSES } from "../agent/stale-run";

type RunRow = {
	orgId: string;
	/** ai_runs.tenant_id: the shop the run was asked in */
	tenantId?: string | null;
	userId: string;
	createdAt: Date;
	/** last write of the run row (Drizzle's ai_runs.updated_at) */
	updatedAt: Date;
	run: AgentRun;
	userMessage: string | null;
	state?: unknown;
};
type ThreadRow = { orgId: string; userId: string; thread: AgentThread; titleSource?: "auto" | "user" | "task" };

/** A run without a tenant, or no tenant asked for, matches (as the Drizzle store's `ofTenant`). */
const sameTenant = (rowTenant: string | null | undefined, tenantId: string | undefined) => !tenantId || !rowTenant || rowTenant === tenantId;
const unexpired = (changeSet: ChangeSet, now: Date) => changeSet.status === "pending" && Date.parse(changeSet.expiresAt) > now.getTime();
/** the oldest waiting draft: what approving does (as the Drizzle store reads it from the rows) */
const oldestChange = (waiting: ChangeSet[]) => {
	const first = [...waiting].sort((a, b) => Date.parse(a.stagedAt) - Date.parse(b.stagedAt))[0];
	return first?.action?.kind ? { change: { title: first.title, actionKind: first.action.kind } } : undefined;
};

/** Test double with the same org/user-scoping semantics as DrizzleAgentStore. */
export class InMemoryAgentStore implements AgentStore {
	readonly runs = new Map<string, RunRow>();
	readonly changeSets = new Map<string, { orgId: string; claimedAt: Date | null; changeSet: ChangeSet }>();
	readonly threads = new Map<string, ThreadRow>();
	readonly attachments = new Map<string, { record: AttachmentRecord; content: Buffer }>();
	readonly decisions = new Map<string, StoredDecision>();
	readonly workStates = new Map<string, { orgId: string; userId: string; state: WorkState }>();
	/** ai_run_starts: kept when runs and chats are deleted */
	readonly runStarts: {
		runId: string;
		orgId: string;
		userId: string;
		createdAt: Date;
		queued?: boolean;
		threadId?: string;
		clientRequestId?: string;
		userName?: string;
	}[] = [];

	async createRun(ctx: AiRequestContext, run: AgentRun, userMessage?: string) {
		this.runs.set(run.id, {
			orgId: ctx.organizationId,
			tenantId: ctx.tenantId ?? null,
			userId: ctx.userId,
			createdAt: new Date(),
			updatedAt: new Date(),
			run,
			userMessage: userMessage ?? null,
		});
	}
	async saveRun(organizationId: string, run: AgentRun) {
		const row = this.runs.get(run.id);
		if (row && row.orgId === organizationId) {
			row.run = run;
			row.updatedAt = new Date();
		}
	}
	async getRun(organizationId: string, id: string, userId?: string, tenantId?: string) {
		const row = this.runs.get(id);
		return row && row.orgId === organizationId && (!userId || row.userId === userId) && sameTenant(row.tenantId, tenantId) ? row.run : null;
	}
	/** No await between the check and the write: a compare-and-set like the Drizzle store's guarded update. */
	async saveRunIfStatus(organizationId: string, run: AgentRun, from: readonly AgentRun["status"][]) {
		const row = this.runs.get(run.id);
		if (!row || row.orgId !== organizationId || !from.includes(row.run.status)) return false;
		row.run = run;
		row.updatedAt = new Date();
		return true;
	}
	async settleRunStatus(organizationId: string, runId: string, status: AgentRun["status"], finishedAt: string, from: readonly AgentRun["status"][]) {
		const row = this.runs.get(runId);
		if (!row || row.orgId !== organizationId || !from.includes(row.run.status)) return false;
		row.run = { ...row.run, status, finishedAt };
		row.updatedAt = new Date();
		return true;
	}
	/** Synchronous check-and-set: two answers in parallel, one claim (like the Drizzle store's conditional update). */
	async claimAwaitingInput(organizationId: string, runId: string, userId: string, now: Date) {
		const row = this.runs.get(runId);
		if (!row || row.orgId !== organizationId || row.userId !== userId || row.run.status !== "awaiting_input") return null;
		const threadId = row.run.threadId;
		// a newer run in the chat: the question was left open
		if (threadId && [...this.runs.values()].some((r) => r.orgId === organizationId && r.run.threadId === threadId && r.createdAt > row.createdAt)) return null;
		row.run = { ...row.run, status: "running" };
		row.updatedAt = now;
		return { run: row.run, state: row.state ?? null, userMessage: row.userMessage };
	}
	async getRunStatus(organizationId: string, id: string) {
		const row = this.runs.get(id);
		return row && row.orgId === organizationId ? row.run.status : null;
	}
	async listRuns(organizationId: string, limit: number, userId?: string) {
		return [...this.runs.values()]
			.filter((r) => r.orgId === organizationId && (!userId || r.userId === userId))
			.slice(0, limit)
			.map((r) => r.run);
	}
	/** No await between the counts and the push: atomic like the Drizzle store's per-org lock. */
	async reserveRunStart(
		ctx: AiRequestContext,
		runId: string,
		windows: RunStartWindows,
		admit: (counts: RunStartCounts) => { queued: boolean },
		record: RunStartRecord = {},
	): Promise<ReservedStart> {
		const starts = this.runStarts.filter((s) => s.orgId === ctx.organizationId);
		if (record.clientRequestId) {
			const since = record.replaySince ?? windows.daySince;
			const earlier = starts.find((s) => s.userId === ctx.userId && s.clientRequestId === record.clientRequestId && s.createdAt >= since);
			if (earlier) return { runId: earlier.runId, queued: false, replay: true };
		}
		const runs = [...this.runs.values()].filter((r) => r.orgId === ctx.organizationId);
		const since = (rows: { createdAt: Date }[], at: Date) => rows.filter((r) => r.createdAt >= at).length;
		const mine = <T extends { userId: string }>(rows: T[]) => rows.filter((r) => r.userId === ctx.userId);
		const thread = record.threadId;
		const threadActive = thread
			? runs.filter(
					(r) =>
						r.run.threadId === thread &&
						(((WORKING_RUN_STATUSES as readonly string[]).includes(r.run.status) && r.updatedAt >= windows.runningSince) ||
							(r.run.status === QUEUED_RUN_STATUS && r.updatedAt >= windows.queueAliveSince)),
				).length + starts.filter((s) => s.threadId === thread && s.createdAt >= windows.pendingSince && !this.runs.has(s.runId)).length
			: 0;
		const { queued } = admit({
			orgDay: Math.max(since(starts, windows.daySince), since(runs, windows.daySince)),
			userMinute: Math.max(since(mine(starts), windows.minuteSince), since(mine(runs), windows.minuteSince)),
			threadActive,
			slots: this.slots(ctx.organizationId, windows),
		});
		this.runStarts.push({
			runId,
			orgId: ctx.organizationId,
			userId: ctx.userId,
			createdAt: windows.now,
			queued,
			...(thread ? { threadId: thread } : {}),
			...(record.clientRequestId ? { clientRequestId: record.clientRequestId } : {}),
			...(record.userName ? { userName: record.userName } : {}),
		});
		return { runId, queued, replay: false };
	}
	async checkQueuedRun(organizationId: string, runId: string, windows: RunStartWindows, admit: (slots: RunSlots) => boolean): Promise<QueueCheck> {
		const row = this.runs.get(runId);
		if (!row || row.orgId !== organizationId) return { status: null, admitted: false, slots: { working: [], queue: [] } };
		if (row.run.status !== QUEUED_RUN_STATUS) return { status: row.run.status, admitted: false, slots: { working: [], queue: [] } };
		row.updatedAt = windows.now;
		const slots = this.slots(organizationId, windows);
		if (!admit(slots)) return { status: QUEUED_RUN_STATUS, admitted: false, slots };
		row.run = { ...row.run, status: "planning", startedAt: windows.now.toISOString() };
		return { status: QUEUED_RUN_STATUS, admitted: true, slots };
	}
	/** Working runs + reserved starts without a row, and the FIFO queue (as the Drizzle store reads them). */
	private slots(organizationId: string, windows: RunStartWindows): RunSlots {
		const starts = this.runStarts.filter((s) => s.orgId === organizationId);
		const startOf = new Map(starts.map((s) => [s.runId, s]));
		const working = [
			...[...this.runs.entries()]
				.filter(([, r]) => r.orgId === organizationId && (WORKING_RUN_STATUSES as readonly string[]).includes(r.run.status) && r.updatedAt >= windows.runningSince)
				.map(([id, r]) => ({
					runId: id,
					userId: r.userId,
					tenantId: r.tenantId ?? null,
					threadId: r.run.threadId ?? null,
					threadTitle: (r.run.threadId ? this.threads.get(r.run.threadId)?.thread.title : undefined) ?? null,
					prompt: r.run.prompt,
					userName: startOf.get(id)?.userName ?? null,
					startedAt: new Date(r.run.startedAt),
					pending: false,
				})),
			...starts
				.filter((s) => !s.queued && s.createdAt >= windows.pendingSince && !this.runs.has(s.runId))
				.map((s) => ({ runId: s.runId, userId: s.userId, threadId: s.threadId ?? null, threadTitle: null, prompt: null, userName: s.userName ?? null, startedAt: s.createdAt, pending: true })),
		].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
		const queue = starts
			.filter((s) => {
				if (!s.queued || s.createdAt < windows.runningSince) return false;
				const run = this.runs.get(s.runId);
				return run ? run.run.status === QUEUED_RUN_STATUS && run.updatedAt >= windows.queueAliveSince : s.createdAt >= windows.queueAliveSince;
			})
			// stable: starts in the same millisecond keep the order they were reserved in (Postgres has µs)
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.map((s) => ({ runId: s.runId, userId: s.userId, queuedAt: s.createdAt }));
		return { working, queue };
	}
	async pruneRunStarts(before: Date) {
		const kept = this.runStarts.filter((s) => s.createdAt >= before);
		const pruned = this.runStarts.length - kept.length;
		this.runStarts.splice(0, this.runStarts.length, ...kept);
		return pruned;
	}
	/** The run's user (same org), as the Drizzle store joins it. */
	private runUserOf(organizationId: string, runId: string): string | null {
		const run = this.runs.get(runId);
		return run && run.orgId === organizationId ? run.userId : null;
	}
	/** The run's tenant (same org), as the Drizzle store joins it. */
	private runTenantOf(organizationId: string, runId: string): string | null {
		const run = this.runs.get(runId);
		return run && run.orgId === organizationId ? (run.tenantId ?? null) : null;
	}
	/** `requestedBy` filled from the run's user, like DrizzleAgentStore's reads. */
	private withRequester(organizationId: string, changeSet: ChangeSet): ChangeSet {
		const requestedBy = requesterOf(changeSet, this.runUserOf(organizationId, changeSet.runId));
		return requestedBy ? { ...changeSet, requestedBy } : changeSet;
	}
	async insertChangeSet(organizationId: string, changeSet: ChangeSet) {
		this.changeSets.set(changeSet.id, { orgId: organizationId, claimedAt: null, changeSet: withoutCallerView(changeSet) });
	}
	async getChangeSet(organizationId: string, id: string): Promise<StoredChangeSet | null> {
		const row = this.changeSets.get(id);
		return row && row.orgId === organizationId
			? { changeSet: this.withRequester(organizationId, row.changeSet), claimedAt: row.claimedAt, tenantId: this.runTenantOf(organizationId, row.changeSet.runId) }
			: null;
	}
	async listChangeSets(organizationId: string, query: ChangeSetListQuery) {
		return [...this.changeSets.values()]
			.filter((r) => r.orgId === organizationId && (!query.status || r.changeSet.status === query.status))
			.filter((r) => !query.requestedBy || this.runUserOf(organizationId, r.changeSet.runId) === query.requestedBy)
			.filter((r) => sameTenant(this.runTenantOf(organizationId, r.changeSet.runId), query.tenantId))
			.slice(0, query.limit)
			.map((r) => this.withRequester(organizationId, r.changeSet));
	}
	async listRunChangeSets(organizationId: string, runId: string) {
		return [...this.changeSets.values()]
			.filter((r) => r.orgId === organizationId && r.changeSet.runId === runId)
			.map((r) => this.withRequester(organizationId, r.changeSet));
	}
	async claimChangeSet(organizationId: string, id: string, staleAfterMs: number) {
		const row = this.changeSets.get(id);
		if (!row || row.orgId !== organizationId || row.changeSet.status !== "pending") return null;
		if (row.claimedAt && Date.now() - row.claimedAt.getTime() < staleAfterMs) return null;
		row.claimedAt = new Date();
		return row.changeSet;
	}
	async releaseChangeSet(organizationId: string, id: string) {
		const row = this.changeSets.get(id);
		if (row && row.orgId === organizationId) row.claimedAt = null;
	}
	async updateChangeSet(organizationId: string, changeSet: ChangeSet, expected?: ChangeSetGuard) {
		const row = this.changeSets.get(changeSet.id);
		if (!row || row.orgId !== organizationId) return false;
		if (expected && row.changeSet.status !== expected.status) return false;
		if (expected?.unclaimedSince && row.claimedAt && row.claimedAt >= expected.unclaimedSince) return false;
		row.changeSet = withoutCallerView(changeSet);
		return true;
	}

	private owned(owner: ThreadOwner, id: string, activeSince?: Date): ThreadRow | null {
		const row = this.threads.get(id);
		if (!row || row.orgId !== owner.organizationId || row.userId !== owner.userId) return null;
		if (activeSince && new Date(row.thread.updatedAt) < activeSince) return null;
		return row;
	}
	private threadRunIds(organizationId: string, threadId: string): string[] {
		return [...this.runs.entries()]
			.filter(([, r]) => r.orgId === organizationId && r.run.threadId === threadId)
			.map(([id]) => id);
	}
	private dropRuns(runIds: string[]): { runs: number; changeSets: number } {
		const ids = new Set(runIds);
		let changeSets = 0;
		for (const [id, row] of this.changeSets) {
			if (ids.has(row.changeSet.runId)) {
				this.changeSets.delete(id);
				changeSets += 1;
			}
		}
		for (const id of ids) this.runs.delete(id);
		return { runs: ids.size, changeSets };
	}

	async createThread(ctx: AiRequestContext, thread: AgentThread) {
		this.threads.set(thread.id, { orgId: ctx.organizationId, userId: ctx.userId, thread, ...(thread.taskKey ? { titleSource: "task" as const } : {}) });
	}
	async getThread(owner: ThreadOwner, id: string, activeSince: Date) {
		return this.owned(owner, id, activeSince)?.thread ?? null;
	}
	async listThreads(owner: ThreadOwner, query: ThreadListQuery) {
		return [...this.threads.values()]
			.filter((r) => r.orgId === owner.organizationId && r.userId === owner.userId)
			.filter((r) => !query.entity || (r.thread.entity?.kind === query.entity.kind && r.thread.entity.id === query.entity.id))
			.filter((r) => (!query.taskKey || r.thread.taskKey === query.taskKey) && (!query.tasksOnly || r.thread.taskKey !== undefined))
			.filter((r) => new Date(r.thread.updatedAt) >= query.activeSince)
			.map((r) => r.thread)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
			.slice(0, query.limit);
	}
	async renameThread(owner: ThreadOwner, id: string, title: string, activeSince: Date) {
		const row = this.owned(owner, id, activeSince);
		if (!row) return null;
		row.thread = { ...row.thread, title };
		row.titleSource = "user";
		return row.thread;
	}
	async retitleThread(organizationId: string, id: string, title: string) {
		const row = this.threads.get(id);
		if (!row || row.orgId !== organizationId || (row.titleSource ?? "auto") !== "auto" || row.thread.title === title) return false;
		row.thread = { ...row.thread, title };
		return true;
	}
	async touchThread(organizationId: string, id: string, update: { preview: string; at: Date }) {
		const row = this.threads.get(id);
		if (!row || row.orgId !== organizationId) return;
		row.thread = {
			...row.thread,
			runCount: row.thread.runCount + 1,
			preview: update.preview,
			updatedAt: update.at.toISOString(),
		};
	}
	async listThreadRuns(organizationId: string, threadId: string): Promise<ThreadRunRecord[]> {
		return [...this.runs.values()]
			.filter((r) => r.orgId === organizationId && r.run.threadId === threadId)
			.map((r) => ({ run: r.run, userMessage: r.userMessage }));
	}
	async listThreadChangeSets(organizationId: string, threadId: string): Promise<StoredChangeSet[]> {
		const runIds = new Set(this.threadRunIds(organizationId, threadId));
		return [...this.changeSets.values()]
			.filter((r) => r.orgId === organizationId && runIds.has(r.changeSet.runId))
			.map((r) => ({ changeSet: this.withRequester(organizationId, r.changeSet), claimedAt: r.claimedAt, tenantId: this.runTenantOf(organizationId, r.changeSet.runId) }));
	}
	async deleteThread(owner: ThreadOwner, id: string, claimedSince: Date): Promise<DeleteThreadOutcome> {
		if (!this.owned(owner, id)) return "not_found";
		const sets = await this.listThreadChangeSets(owner.organizationId, id);
		if (sets.some((s) => s.changeSet.status === "pending" && s.claimedAt && s.claimedAt >= claimedSince)) {
			return "claimed";
		}
		this.dropRuns(this.threadRunIds(owner.organizationId, id));
		for (const [key, row] of this.attachments) if (row.record.threadId === id) this.attachments.delete(key);
		this.threads.delete(id);
		return "deleted";
	}
	async purgeThreadsInactiveSince(before: Date): Promise<PurgeCounts> {
		const expired = [...this.threads.entries()].filter(([, r]) => new Date(r.thread.updatedAt) < before);
		for (const [id] of expired) this.threads.delete(id);
		const runIds = [...this.runs.entries()]
			.filter(([, r]) => r.run.threadId !== undefined && !this.threads.has(r.run.threadId))
			.map(([id]) => id);
		return { threads: expired.length, ...this.dropRuns(runIds) };
	}
	async failStaleRuns(staleBefore: Date, error: string, now: Date = new Date()) {
		const stale = [...this.runs.values()]
			.filter((r) => ([...IN_FLIGHT_RUN_STATUSES, QUEUED_RUN_STATUS] as readonly string[]).includes(r.run.status) && r.updatedAt < staleBefore)
			.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
			.slice(0, STALE_RUN_BATCH);
		for (const row of stale) {
			row.run = failedStaleRun(row.run, error, now);
			row.state = null;
			row.updatedAt = now;
		}
		return stale.length;
	}
	async threadStats(organizationId: string, threadIds: readonly string[], now: Date = new Date()) {
		const stats = new Map<string, ThreadStats>();
		for (const threadId of threadIds) {
			const runs = [...this.runs.values()].filter((r) => r.orgId === organizationId && r.run.threadId === threadId);
			if (runs.length === 0) continue;
			const sets = await this.listThreadChangeSets(organizationId, threadId);
			stats.set(threadId, {
				domain: runs[runs.length - 1]?.run.domain,
				module: runs[runs.length - 1]?.run.context?.module,
				pending: sets.filter((s) => unexpired(s.changeSet, now)).length,
				applied: sets.filter((s) => s.changeSet.status === "applied").length,
				latestRun: runs[runs.length - 1]?.run.status,
			});
		}
		return stats;
	}
	private liveThreads(owner: ThreadOwner, activeSince: Date): [string, ThreadRow][] {
		return [...this.threads.entries()].filter(([id]) => this.owned(owner, id, activeSince));
	}
	async listWaitingReviews(owner: ThreadOwner, activeSince: Date, now: Date): Promise<WaitingReview[]> {
		const reviews: WaitingReview[] = [];
		for (const [id, row] of this.liveThreads(owner, activeSince)) {
			const waiting = (await this.listThreadChangeSets(owner.organizationId, id)).map((s) => s.changeSet).filter((cs) => unexpired(cs, now));
			if (waiting.length === 0) continue;
			reviews.push({
				threadId: id,
				title: row.thread.title,
				...(row.thread.taskKey ? { taskKey: row.thread.taskKey } : {}),
				count: waiting.length,
				since: new Date(Math.min(...waiting.map((cs) => Date.parse(cs.stagedAt)))),
				handOnly: waiting.some((cs) => cs.confirmText !== undefined || cs.requiresClick === true),
				...(oldestChange(waiting) ?? {}),
			});
		}
		return reviews.sort((a, b) => a.since.getTime() - b.since.getTime());
	}
	async listOpenQuestions(owner: ThreadOwner, activeSince: Date): Promise<OpenQuestion[]> {
		const questions: OpenQuestion[] = [];
		for (const [id, row] of this.liveThreads(owner, activeSince)) {
			const runs = [...this.runs.values()].filter((r) => r.orgId === owner.organizationId && r.run.threadId === id);
			const latest = runs[runs.length - 1];
			if (!latest || latest.userId !== owner.userId || latest.run.status !== "awaiting_input" || !latest.run.ask) continue;
			questions.push({
				threadId: id,
				runId: latest.run.id,
				title: row.thread.title,
				...(row.thread.taskKey ? { taskKey: row.thread.taskKey } : {}),
				question: latest.run.ask.question.title,
				since: latest.updatedAt,
			});
		}
		return questions.sort((a, b) => a.since.getTime() - b.since.getTime());
	}
	async listWorkStates(owner: ThreadOwner): Promise<WorkState[]> {
		return [...this.workStates.values()].filter((r) => r.orgId === owner.organizationId && r.userId === owner.userId).map((r) => r.state);
	}
	async putWorkState(owner: ThreadOwner, key: string, patch: WorkStatePatch, now: Date): Promise<WorkState> {
		const id = `${owner.organizationId}\u0000${owner.userId}\u0000${key}`;
		const prev = this.workStates.get(id)?.state;
		const pick = <T>(next: T | null | undefined, kept: T | undefined) => (next === undefined ? kept : (next ?? undefined));
		const snoozedUntil = pick(patch.snoozedUntil === null ? null : patch.snoozedUntil?.toISOString(), prev?.snoozedUntil);
		const dismissedFingerprint = pick(patch.dismissedFingerprint, prev?.dismissedFingerprint);
		const lastRaisedAt = pick(patch.lastRaisedAt?.toISOString(), prev?.lastRaisedAt);
		const state: WorkState = {
			key,
			...(snoozedUntil ? { snoozedUntil } : {}),
			...(dismissedFingerprint ? { dismissedFingerprint } : {}),
			...(lastRaisedAt ? { lastRaisedAt } : {}),
			updatedAt: now.toISOString(),
		};
		this.workStates.set(id, { orgId: owner.organizationId, userId: owner.userId, state });
		return state;
	}
	async saveRunState(organizationId: string, runId: string, state: unknown, onlyWhile?: AgentRun["status"]) {
		const row = this.runs.get(runId);
		if (row && row.orgId === organizationId && (!onlyWhile || row.run.status === onlyWhile)) row.state = state ?? null;
	}
	async getRunWithState(organizationId: string, runId: string, userId: string) {
		const row = this.runs.get(runId);
		if (!row || row.orgId !== organizationId || row.userId !== userId) return null;
		return { run: row.run, state: row.state ?? null, userMessage: row.userMessage };
	}
	async insertAttachment(ctx: AiRequestContext, attachment: NewAttachment) {
		const { content, ...rest } = attachment;
		this.attachments.set(attachment.id, {
			record: { ...rest, organizationId: ctx.organizationId, userId: ctx.userId, threadId: null, createdAt: new Date() },
			content,
		});
	}
	async getAttachments(owner: ThreadOwner, ids: readonly string[]) {
		return ids.flatMap((id) => {
			const row = this.attachments.get(id);
			return row && row.record.organizationId === owner.organizationId && row.record.userId === owner.userId
				? [row.record]
				: [];
		});
	}
	async getAttachmentContent(organizationId: string, id: string) {
		const row = this.attachments.get(id);
		return row && row.record.organizationId === organizationId ? row : null;
	}
	async assignAttachments(owner: ThreadOwner, ids: readonly string[], threadId: string) {
		for (const record of await this.getAttachments(owner, ids)) {
			if (record.threadId === null) record.threadId = threadId;
		}
	}
	async purgeAttachments(before: Date, unsentBefore: Date) {
		let removed = 0;
		for (const [id, row] of this.attachments) {
			const { createdAt, threadId } = row.record;
			if (createdAt < before || (threadId === null && createdAt < unsentBefore) || (threadId && !this.threads.has(threadId))) {
				this.attachments.delete(id);
				removed += 1;
			}
		}
		return removed;
	}
	async getDecision(organizationId: string, fingerprint: string, freshSince: Date) {
		const hit = this.decisions.get(`${organizationId}:${fingerprint}`);
		return hit && hit.createdAt >= freshSince ? hit : null;
	}
	async putDecision(organizationId: string, fingerprint: string, decision: StoredDecision) {
		this.decisions.set(`${organizationId}:${fingerprint}`, decision);
	}
	async pruneDecisions(before: Date) {
		let pruned = 0;
		for (const [key, decision] of this.decisions) {
			if (decision.createdAt < before) {
				this.decisions.delete(key);
				pruned += 1;
			}
		}
		return pruned;
	}
}

import type { AgentRun, AgentThread, ChangeSet, ChangeSetStatus, WorkState } from "@ech/agent-core";
import type { AiRequestContext } from "../auth/context-token";

export const AGENT_STORE = Symbol("AI_PLATFORM_AGENT_STORE");

export interface StoredChangeSet {
	/** `requestedBy` is filled from the run's user when the draft predates it */
	changeSet: ChangeSet;
	claimedAt: Date | null;
	/** the shop its run was asked in (ai_runs.tenant_id; null: unknown, e.g. a context without a tenant) */
	tenantId: string | null;
}

/** The state a status write expects to find (compare-and-set). */
export interface ChangeSetGuard {
	status: ChangeSetStatus;
	/** refuse while a claim made at/after this time holds the change (an apply is running) */
	unclaimedSince?: Date;
}

export interface ChangeSetListQuery {
	status?: ChangeSetStatus;
	limit: number;
	/** only the drafts asked by this user (their run's user); omitted: the whole organization */
	requestedBy?: string;
	/** only drafts of this shop (or of a run without a tenant): shops sharing one organization never see each other's */
	tenantId?: string;
}

/** Threads are private: every thread query is scoped to the org *and* the user. */
export interface ThreadOwner {
	organizationId: string;
	userId: string;
}

export interface ThreadListQuery {
	limit: number;
	activeSince: Date;
	entity?: { kind: string; id: string };
	/** only the chats of this to-do item */
	taskKey?: string;
	/** only chats tied to a to-do item (any) */
	tasksOnly?: boolean;
}

/** A run of a thread plus the exact user turn it sent to the model. */
export interface ThreadRunRecord {
	run: AgentRun;
	userMessage: string | null;
}

export interface PurgeCounts {
	threads: number;
	runs: number;
	changeSets: number;
}

export type DeleteThreadOutcome = "deleted" | "not_found" | "claimed";

/** A file the merchant gave the assistant (bytes stored separately). */
export interface AttachmentRecord {
	id: string;
	organizationId: string;
	userId: string;
	threadId: string | null;
	kind: "image" | "document";
	origin: "upload" | "media" | "product" | "stock";
	/** source id for picked media (media id, asset id, pixabay id) */
	ref: string | null;
	name: string;
	mime: string;
	size: number;
	/** text read out of a document — what the model sees */
	textContent: string | null;
	credit: string | null;
	createdAt: Date;
}

export type NewAttachment = Omit<AttachmentRecord, "organizationId" | "userId" | "threadId" | "createdAt"> & {
	content: Buffer;
};

/** A decision-model answer cached by question fingerprint. */
export interface StoredDecision {
	stage: string;
	provider: string;
	model: string;
	choice: string | null;
	confidence: number;
	probabilities: Record<string, number>;
	createdAt: Date;
}

/** Per-thread list meta: what it is about and where its drafts stand. */
export interface ThreadStats {
	domain?: string;
	/** page the latest run was asked from (its context module, e.g. "store") */
	module?: string;
	/** drafts still waiting for approval (expired ones not counted, even before they are flipped) */
	pending: number;
	applied: number;
	/** status of the thread's latest run */
	latestRun?: AgentRun["status"];
}

/** One of the owner's live chats with unexpired drafts waiting for approval. */
export interface WaitingReview {
	threadId: string;
	title: string;
	taskKey?: string;
	count: number;
	/** when the oldest waiting draft was staged */
	since: Date;
	/** a waiting draft needs a hand approval (confirmText / requiresClick) */
	handOnly: boolean;
	/** the oldest waiting draft's title and action kind: what approving does */
	change?: { title: string; actionKind: string };
}

/** The latest run of one of the owner's live chats, paused on a question. */
export interface OpenQuestion {
	threadId: string;
	runId: string;
	title: string;
	taskKey?: string;
	/** the open question's title */
	question: string;
	/** when the run paused */
	since: Date;
}

/** A change to a work state: undefined leaves a field, null clears it. */
export interface WorkStatePatch {
	snoozedUntil?: Date | null;
	dismissedFingerprint?: string | null;
	lastRaisedAt?: Date;
}

/** The moments the run-start quota counts from (see `reserveRunStart`). */
export interface RunStartWindows {
	daySince: Date;
	minuteSince: Date;
	/** a planning / running run last written before this was left by a killed process */
	runningSince: Date;
	/** a start reserved after this whose run row does not exist yet is still starting */
	pendingSince: Date;
	/** a queued run (or queued start without its row yet) not checked in since this was left by a killed process */
	queueAliveSince: Date;
	now: Date;
}

/** A request working in the shop: a run row planning / running / applying, or a start reserved for one. */
export interface WorkingRun {
	runId: string;
	userId: string;
	threadId: string | null;
	/** the chat's title (null: no row yet, or the chat is gone) */
	threadTitle: string | null;
	prompt: string | null;
	/** who asked, as their token named them at the start (null: unknown) */
	userName: string | null;
	startedAt: Date;
	/** reserved, its run row not written yet: it takes a slot but is not listed */
	pending: boolean;
	/** the shop it was asked in (null / absent: unknown); the queue only lists the waiting person's own shop */
	tenantId?: string | null;
}

/** A start waiting for a slot, oldest first. */
export interface QueuedStart {
	runId: string;
	userId: string;
	queuedAt: Date;
}

/** The org's working requests and its queue, as one locked read sees them. */
export interface RunSlots {
	working: WorkingRun[];
	queue: QueuedStart[];
}

/** What the quota sees at the moment a run starts. */
export interface RunStartCounts {
	/** runs the org started since `daySince` */
	orgDay: number;
	/** runs the user started since `minuteSince` */
	userMinute: number;
	/** runs of the chat being continued still working or queued (one active run per chat); 0 for a new chat */
	threadActive: number;
	slots: RunSlots;
}

/** Recorded with the start (and used to find a repeated one). */
export interface RunStartRecord {
	threadId?: string;
	/** a start of the same user with this id since `replaySince` is returned instead of a new one */
	clientRequestId?: string;
	replaySince?: Date;
	userName?: string;
}

/** The start as reserved: the run id, whether it waits for a slot, or the earlier start it repeats. */
export interface ReservedStart {
	runId: string;
	queued: boolean;
	/** the same client request id was started before: `runId` is that run, nothing was reserved */
	replay: boolean;
}

/** One check of a queued run, under the org lock. */
export interface QueueCheck {
	/** the run's status before the check (null: the run is gone); `planning` once admitted */
	status: AgentRun["status"] | null;
	admitted: boolean;
	/** empty when the run was no longer queued */
	slots: RunSlots;
}

/** A paused run with its private state (model messages so far, question flow). */
export interface RunWithState {
	run: AgentRun;
	state: unknown;
	userMessage: string | null;
}

/**
 * Persistence port for runs, change sets and threads. Every method is organization
 * scoped — callers pass the org from the verified context, never from input.
 */
export interface AgentStore {
	createRun(ctx: AiRequestContext, run: AgentRun, userMessage?: string): Promise<void>;
	saveRun(organizationId: string, run: AgentRun): Promise<void>;
	/**
	 * `userId` restricts to that user's runs (prompts are private); omit only for internal settlement.
	 * `tenantId` hides a run asked in another shop of the organization (a run without a tenant stays visible).
	 */
	getRun(organizationId: string, id: string, userId?: string, tenantId?: string): Promise<AgentRun | null>;
	/**
	 * Writes the run only while its row is in one of `from` (compare-and-set); false when nothing was written
	 * (it moved on meanwhile: finished, answered, stopped elsewhere).
	 */
	saveRunIfStatus(organizationId: string, run: AgentRun, from: readonly AgentRun["status"][]): Promise<boolean>;
	/**
	 * Settles a run's status (and `finishedAt`) in place, only while its row is in one of `from`; the rest of the
	 * stored run (steps, answer) is kept as its driver last wrote it. False when nothing was written.
	 */
	settleRunStatus(
		organizationId: string,
		runId: string,
		status: AgentRun["status"],
		finishedAt: string,
		from: readonly AgentRun["status"][],
	): Promise<boolean>;
	/**
	 * The caller's run paused on a question, claimed for one answer: `awaiting_input` → `running` in one
	 * conditional write, so a second answer (double click, two tabs, a retry) finds nothing. Refused (null) when
	 * it is not the caller's, not waiting, or a newer run was started in its chat (the question was left open).
	 */
	claimAwaitingInput(organizationId: string, runId: string, userId: string, now: Date): Promise<RunWithState | null>;
	/** Just the status column — cheap enough to poll while a run is working (cross-instance Stop). */
	getRunStatus(organizationId: string, id: string): Promise<AgentRun["status"] | null>;
	listRuns(organizationId: string, limit: number, userId?: string): Promise<AgentRun[]>;
	/**
	 * Run-start quota in one step, serialised per org so parallel starts cannot all pass: counts
	 * starts (ai_run_starts, kept when a chat is deleted) and runs, calls `admit`, then records the
	 * start under `runId` (queued or not, as `admit` decided). `admit` throws to refuse; nothing is recorded
	 * then. A repeated `record.clientRequestId` returns the earlier start (`replay`) before any check.
	 */
	reserveRunStart(
		ctx: AiRequestContext,
		runId: string,
		windows: RunStartWindows,
		admit: (counts: RunStartCounts) => { queued: boolean },
		record?: RunStartRecord,
	): Promise<ReservedStart>;
	/**
	 * A queued run's check, serialised with starts per org: refreshes its place (queue heartbeat), reads the
	 * org's slots and, when `admit` says so, moves it to `planning` (its `startedAt` = now). A run that is no
	 * longer queued (stopped, gone) is left alone.
	 */
	checkQueuedRun(organizationId: string, runId: string, windows: RunStartWindows, admit: (slots: RunSlots) => boolean): Promise<QueueCheck>;
	/** Retention: drops run starts older than `before` (only the quota windows read them). */
	pruneRunStarts(before: Date): Promise<number>;

	insertChangeSet(organizationId: string, changeSet: ChangeSet): Promise<void>;
	getChangeSet(organizationId: string, id: string): Promise<StoredChangeSet | null>;
	/** Newest first; `requestedBy` filled from the run (see StoredChangeSet). */
	listChangeSets(organizationId: string, query: ChangeSetListQuery): Promise<ChangeSet[]>;
	listRunChangeSets(organizationId: string, runId: string): Promise<ChangeSet[]>;
	/** Atomically marks a pending change set as being applied; null when it can't be claimed. */
	claimChangeSet(organizationId: string, id: string, staleAfterMs: number): Promise<ChangeSet | null>;
	releaseChangeSet(organizationId: string, id: string): Promise<void>;
	/**
	 * Writes the change set (per-caller fields `access` / `mine` are dropped); with `expected`, only while its status is `expected.status` and (with
	 * `unclaimedSince`) no claim was made at/after that time. False when nothing was written.
	 */
	updateChangeSet(organizationId: string, changeSet: ChangeSet, expected?: ChangeSetGuard): Promise<boolean>;

	createThread(ctx: AiRequestContext, thread: AgentThread): Promise<void>;
	/** null when missing, someone else's, or last active before `activeSince` (expired). */
	getThread(owner: ThreadOwner, id: string, activeSince: Date): Promise<AgentThread | null>;
	/** The owner's live threads, newest activity first; `entity`: only the chats started on that record. */
	listThreads(owner: ThreadOwner, query: ThreadListQuery): Promise<AgentThread[]>;
	renameThread(owner: ThreadOwner, id: string, title: string, activeSince: Date): Promise<AgentThread | null>;
	/** Replaces an automatic title (never one the merchant chose); true when it changed. */
	retitleThread(organizationId: string, id: string, title: string): Promise<boolean>;
	/** A run started in the thread: run_count + 1, preview + updated_at (last activity) refreshed. */
	touchThread(organizationId: string, id: string, update: { preview: string; at: Date }): Promise<void>;
	/** Runs of the thread, oldest first. */
	listThreadRuns(organizationId: string, threadId: string): Promise<ThreadRunRecord[]>;
	listThreadChangeSets(organizationId: string, threadId: string): Promise<StoredChangeSet[]>;
	/**
	 * Deletes the thread with its runs and their change sets in one transaction;
	 * refuses ("claimed") while a pending change set was claimed at/after `claimedSince`.
	 */
	deleteThread(owner: ThreadOwner, id: string, claimedSince: Date): Promise<DeleteThreadOutcome>;
	/**
	 * Retention: deletes every thread last active before `before` (any org) with its
	 * runs + change sets, plus runs orphaned by a thread deleted mid-start. Ledger rows stay.
	 */
	purgeThreadsInactiveSince(before: Date): Promise<PurgeCounts>;
	/** Per-thread meta; drafts past their expiry at `now` are not pending. */
	threadStats(organizationId: string, threadIds: readonly string[], now?: Date): Promise<Map<string, ThreadStats>>;
	/** The owner's live chats with drafts waiting at `now`, oldest wait first. */
	listWaitingReviews(owner: ThreadOwner, activeSince: Date, now: Date): Promise<WaitingReview[]>;
	/** The owner's live chats whose latest run waits on an answer, oldest first. */
	listOpenQuestions(owner: ThreadOwner, activeSince: Date): Promise<OpenQuestion[]>;
	listWorkStates(owner: ThreadOwner): Promise<WorkState[]>;
	/** Upserts the owner's state for `key` (updated_at = `now`) and returns it. */
	putWorkState(owner: ThreadOwner, key: string, patch: WorkStatePatch, now: Date): Promise<WorkState>;
	/**
	 * Runs a process was driving (`planning` / `running`, or waiting `queued`, in the database) that were last written
	 * before `staleBefore`: the platform killed that process (e.g. Vercel maxDuration), so nobody
	 * will finish them. Marks them failed with `error` and drops their paused state; returns how
	 * many it closed. A run saved by a live process in the meantime is left alone.
	 */
	failStaleRuns(staleBefore: Date, error: string, now?: Date): Promise<number>;

	/** Paused-run state; null clears it once the run moves on. `onlyWhile`: written only while the run has that status. */
	saveRunState(organizationId: string, runId: string, state: unknown, onlyWhile?: AgentRun["status"]): Promise<void>;
	/** The caller's own run with its state. */
	getRunWithState(organizationId: string, runId: string, userId: string): Promise<RunWithState | null>;

	insertAttachment(ctx: AiRequestContext, attachment: NewAttachment): Promise<void>;
	/** The owner's attachments among `ids` (others' ids are silently skipped). */
	getAttachments(owner: ThreadOwner, ids: readonly string[]): Promise<AttachmentRecord[]>;
	/** Bytes of an attachment, scoped to the org (approvers may differ from the uploader). */
	getAttachmentContent(organizationId: string, id: string): Promise<{ record: AttachmentRecord; content: Buffer } | null>;
	/** Files sent with a run belong to its thread from then on (deleted with it). */
	assignAttachments(owner: ThreadOwner, ids: readonly string[], threadId: string): Promise<void>;
	/** Unsent files older than `unsentBefore` and any file older than `before`. */
	purgeAttachments(before: Date, unsentBefore: Date): Promise<number>;

	getDecision(organizationId: string, fingerprint: string, freshSince: Date): Promise<StoredDecision | null>;
	putDecision(organizationId: string, fingerprint: string, decision: StoredDecision): Promise<void>;
	/** Retention: drops cached decisions made before `before` (reads ignore them after the cache TTL). */
	pruneDecisions(before: Date): Promise<number>;
}

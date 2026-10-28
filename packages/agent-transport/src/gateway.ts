import type {
	AgentAttachment,
	AgentEvent,
	AgentRun,
	AgentThread,
	AgentThreadDetail,
	AutonomyLevel,
	AnswerInput,
	AttachmentOrigin,
	AutonomyPolicy,
	ChangeSet,
	ChangeSetStatus,
	ReconcileResult,
	Conversation,
	ConversationMessage,
	Insight,
	InsightKind,
	QuestionOption,
	RenameThreadInput,
	StartRunInput,
	WorkList,
	WorkState,
	WorkStateInput,
} from "@ech/agent-core";

/**
 * AgentGateway — the single port the UI talks to.
 *
 * Implementations: FixtureGateway (today), HttpGateway + stream channel
 * (real backend later). Swap happens once at the provider — UI never changes.
 */

export interface InsightQuery {
	kind?: InsightKind;
	limit?: number;
}

export interface ChangeSetQuery {
	status?: ChangeSetStatus;
	limit?: number;
}

export interface ConversationQuery {
	status?: Conversation["status"];
	limit?: number;
}

export interface ThreadFilter {
	entity?: { kind: string; id: string };
	/** a to-do item's key ("shop:orders_to_confirm") */
	task?: string;
}

export type ChangeSetDecision = "approve" | "reject";

export interface SendReplyInput {
	conversationId: string;
	body: string;
	/** send the agent's draft as-is, or a human-edited body */
	fromDraftId?: string;
}

export interface MediaQuery {
	/** media library, an existing product's photos, or stock photos */
	source: Exclude<AttachmentOrigin, "upload">;
	query?: string;
	limit?: number;
}

export interface UploadOptions {
	/** 0..1 as bytes leave the browser */
	onProgress?: (fraction: number) => void;
	signal?: AbortSignal;
}

/**
 * A run's own event stream stopped (dropped connection, proxy cut, function
 * limit) while the run was still working: no final status arrived on it.
 */
export interface RunStreamLost {
	runId: string;
	/** "ended": the response closed early; "error": reading it failed */
	reason: "ended" | "error";
	/** the server's `run.error` line or the read error, when there was one */
	error?: string;
}

export interface AgentGateway {
	// reads
	listInsights(query?: InsightQuery): Promise<Insight[]>;
	listRuns(limit?: number): Promise<AgentRun[]>;
	getRun(id: string): Promise<AgentRun | null>;
	listChangeSets(query?: ChangeSetQuery): Promise<ChangeSet[]>;
	listConversations(query?: ConversationQuery): Promise<Conversation[]>;
	getAutonomyPolicy(): Promise<AutonomyPolicy>;

	// chat threads — private to the signed-in user, newest activity first
	/**
	 * `entity`: only the chats started on that record (a product, a blog post);
	 * `task`: only the chats handling that to-do item (its `taskKey`)
	 */
	listThreads(limit?: number, filter?: ThreadFilter): Promise<AgentThread[]>;
	/** null when the thread is gone (deleted, expired, or not this user's) */
	getThread(id: string): Promise<AgentThreadDetail | null>;

	// writes — every write returns the updated aggregate
	startRun(input: StartRunInput): Promise<AgentRun>;
	/** `confirm`: echoes `changeSet.confirmText` once the approver said Yes to a change that needs a hand approval */
	decideChangeSet(id: string, decision: ChangeSetDecision, actor: string, note?: string, options?: { confirm?: string }): Promise<ChangeSet>;
	/** Puts the record back as it was before an applied change (when the change kept undo data). */
	undoChangeSet?(id: string): Promise<ChangeSet>;
	/**
	 * The site editor moved a change back or forth with its own Undo / Redo (or just opened): the server compares the
	 * page with what the change left and updates the change's status (applied ⇄ reverted). Writes nothing else.
	 */
	reconcileChangeSet?(id: string): Promise<ReconcileResult>;
	sendReply(input: SendReplyInput): Promise<ConversationMessage>;
	setDomainAutonomy(domain: string, level: AutonomyLevel): Promise<AutonomyPolicy>;
	renameThread(id: string, input: RenameThreadInput): Promise<AgentThread>;
	deleteThread(id: string): Promise<void>;

	// clarifying questions — answering resumes the paused run (events stream as with startRun)
	answerRun(runId: string, input: AnswerInput): Promise<AgentRun>;
	/** Stops a run that is still working (or waiting on a question); it ends as `cancelled`. */
	cancelRun?(runId: string): Promise<AgentRun>;
	/** search all options of an open question (e.g. every family of the shop) */
	searchQuestionOptions(runId: string, questionId: string, query: string): Promise<QuestionOption[]>;

	// attachments — uploads (images, PDF/CSV/XLSX ≤10 MB) and picks from the shop's media
	uploadAttachment(file: File, options?: UploadOptions): Promise<AgentAttachment>;
	listMedia(query: MediaQuery): Promise<AgentAttachment[]>;
	/** turns a listed media item into an attachment of the next message */
	pickMedia(item: AgentAttachment): Promise<AgentAttachment>;

	// the merchant's work queue — shop to-dos + drafts / questions waiting on them (optional: hosts without it show none)
	/** ranked, dismissed items removed, the user's choices attached */
	listWork?(): Promise<WorkList>;
	/** "Later" (snooze), "Don't remind me" (dismiss until the fingerprint changes), or "raised now" for one item */
	setWorkState?(key: string, input: WorkStateInput): Promise<WorkState>;

	// live events — run steps, staged sets, inbound messages
	subscribe(listener: (event: AgentEvent) => void): () => void;
	/**
	 * A run's stream ended before the run finished (optional: gateways without
	 * per-run streams never lose one). The run may still be working: read its
	 * status (`getRun`) until it ends.
	 */
	onRunStreamLost?(listener: (lost: RunStreamLost) => void): () => void;

	close(): void;
}

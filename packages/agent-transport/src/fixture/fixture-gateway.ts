import {
	type AgentAttachment,
	type AgentEvent,
	type AgentRun,
	type AgentThread,
	type AgentThreadDetail,
	type AnswerInput,
	type AutonomyLevel,
	type AutonomyPolicy,
	type ChangeSet,
	type ChangeSetStatus,
	type Conversation,
	type ConversationMessage,
	createRun,
	type Insight,
	type QuestionOption,
	type RenameThreadInput,
	RenameThreadInputSchema,
	reduceRunEvent,
	type RunEvent,
	type StartRunInput,
	type WorkList,
	type WorkState,
	type WorkStateInput,
} from "@ech/agent-core";
import type {
	AgentGateway,
	ChangeSetDecision,
	ChangeSetQuery,
	ConversationQuery,
	InsightQuery,
	MediaQuery,
	SendReplyInput,
	ThreadFilter,
} from "../gateway";
import { AgentGatewayError } from "../sse";
import { FIXTURE_AUTONOMY, FIXTURE_CHANGE_SETS, FIXTURE_CONVERSATIONS, FIXTURE_INSIGHTS, FIXTURE_RUNS } from "./data";

/**
 * FixtureGateway — full AgentGateway over in-memory fixtures.
 *
 * Today this powers the portal while the backend doesn't exist. It also
 * simulates a live run: startRun() emits a scripted step/receipt/stage
 * sequence so the UI exercises the exact same event path as WS.
 */

export interface FixtureGatewayOptions {
	/** simulated network latency per request */
	latencyMs?: number;
	/** delay between scripted run events */
	eventDelayMs?: number;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function threadTitle(prompt: string): string {
	const oneLine = prompt.replace(/\s+/g, " ").trim();
	return oneLine.length > 60 ? `${oneLine.slice(0, 59).trimEnd()}…` : oneLine;
}

export class FixtureGateway implements AgentGateway {
	private readonly latencyMs: number;
	private readonly eventDelayMs: number;
	private readonly listeners = new Set<(event: AgentEvent) => void>();
	private changeSets: ChangeSet[] = clone(FIXTURE_CHANGE_SETS);
	private conversations: Conversation[] = clone(FIXTURE_CONVERSATIONS);
	private runs: AgentRun[] = clone(FIXTURE_RUNS);
	private policy: AutonomyPolicy = clone(FIXTURE_AUTONOMY);
	/** in-memory chat threads, most recent activity first (lost on reload) */
	private threads: AgentThread[] = [];
	private timers = new Set<ReturnType<typeof setTimeout>>();
	/** the merchant's choices on work items (the fixture has no shop items) */
	private workStates = new Map<string, WorkState>();

	constructor(options: FixtureGatewayOptions = {}) {
		this.latencyMs = options.latencyMs ?? 120;
		this.eventDelayMs = options.eventDelayMs ?? 350;
	}

	private delay<T>(value: () => T): Promise<T> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.timers.delete(timer);
				resolve(value());
			}, this.latencyMs);
			this.timers.add(timer);
		});
	}

	private emit(event: AgentEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	private later(fn: () => void): void {
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			fn();
		}, this.eventDelayMs);
		this.timers.add(timer);
	}

	listInsights(query: InsightQuery = {}): Promise<Insight[]> {
		return this.delay(() => {
			let rows = clone(FIXTURE_INSIGHTS);
			if (query.kind) rows = rows.filter((i) => i.kind === query.kind);
			return rows.slice(0, query.limit ?? rows.length);
		});
	}

	listRuns(limit = 20): Promise<AgentRun[]> {
		return this.delay(() => clone(this.runs.slice(0, limit)));
	}

	getRun(id: string): Promise<AgentRun | null> {
		return this.delay(() => clone(this.runs.find((r) => r.id === id) ?? null));
	}

	listChangeSets(query: ChangeSetQuery = {}): Promise<ChangeSet[]> {
		return this.delay(() => {
			let rows = clone(this.changeSets);
			if (query.status) rows = rows.filter((c) => c.status === query.status);
			return rows.slice(0, query.limit ?? rows.length);
		});
	}

	listConversations(query: ConversationQuery = {}): Promise<Conversation[]> {
		return this.delay(() => {
			let rows = clone(this.conversations);
			if (query.status) rows = rows.filter((c) => c.status === query.status);
			return rows.slice(0, query.limit ?? rows.length);
		});
	}

	getAutonomyPolicy(): Promise<AutonomyPolicy> {
		return this.delay(() => clone(this.policy));
	}

	listThreads(limit = 20, filter?: ThreadFilter): Promise<AgentThread[]> {
		const entity = filter?.entity;
		const task = filter?.task;
		const threads = this.threads.filter(
			(t) => (!entity || (t.entity?.kind === entity.kind && t.entity.id === entity.id)) && (!task || t.taskKey === task),
		);
		return this.delay(() => clone(threads.slice(0, limit)));
	}

	getThread(id: string): Promise<AgentThreadDetail | null> {
		return this.delay(() => {
			const thread = this.threads.find((t) => t.id === id);
			if (!thread) return null;
			// runs are stored newest first; a thread reads oldest first
			const runs = this.runs.filter((r) => r.threadId === id).reverse();
			const runIds = new Set(runs.map((r) => r.id));
			const changeSets = this.changeSets.filter((c) => runIds.has(c.runId));
			return clone({ thread, runs, changeSets });
		});
	}

	/** Joins the given thread or opens a new one titled after the prompt. */
	private touchThread(input: StartRunInput): AgentThread {
		const now = new Date().toISOString();
		const existing = input.threadId ? this.threads.find((t) => t.id === input.threadId) : undefined;
		// same refusal as the platform — the chat session retries in a new thread
		if (input.threadId && !existing) throw new AgentGatewayError("This chat no longer exists.", 404);
		const base: AgentThread = existing ?? {
			id: `thr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
			// a chat started from a to-do item is that task's chat, titled after it
			title: input.task?.title ?? threadTitle(input.prompt),
			...(input.task ? { taskKey: input.task.key } : {}),
			runCount: 0,
			createdAt: now,
			updatedAt: now,
		};
		const thread: AgentThread = {
			...base,
			preview: input.prompt.trim().slice(0, 160),
			runCount: base.runCount + 1,
			updatedAt: now,
		};
		this.threads = [thread, ...this.threads.filter((t) => t.id !== thread.id)];
		return thread;
	}

	/**
	 * Simulated run: emits a scripted ground→read→draft→stage sequence so the
	 * dock exercises the live event stream exactly like a real backend.
	 */
	startRun(input: StartRunInput): Promise<AgentRun> {
		let thread: AgentThread;
		try {
			thread = this.touchThread(input);
		} catch (error) {
			return Promise.reject(error);
		}
		const run: AgentRun = { ...createRun(input), threadId: thread.id };
		this.runs.unshift(run);
		const runId = run.id;

		const script: RunEvent[] = [
			{
				type: "run.step",
				runId,
				step: { id: "s1", label: "Ground context", detail: "resolve pinned records + filters", status: "running" },
			},
			{
				type: "run.step",
				runId,
				step: { id: "s1", label: "Ground context", detail: "resolve pinned records + filters", status: "done" },
			},
			{
				type: "run.receipt",
				runId,
				receipt: {
					id: "rc_sim_1",
					tool: "context.resolve",
					summary: "pinned context resolved",
					durationMs: 96,
					status: "ok",
					entityIds: input.context?.entity ? [input.context.entity.id] : [],
				},
			},
			{
				type: "run.step",
				runId,
				step: { id: "s2", label: "Read records", detail: "query domain services", status: "running" },
			},
			{
				type: "run.step",
				runId,
				step: { id: "s2", label: "Read records", detail: "query domain services", status: "done" },
			},
			{
				type: "run.step",
				runId,
				step: { id: "s3", label: "Draft proposal", detail: "assemble diffs + evidence", status: "running" },
			},
			{
				type: "run.step",
				runId,
				step: { id: "s3", label: "Draft proposal", detail: "assemble diffs + evidence", status: "done" },
			},
			{
				type: "run.status",
				runId,
				status: "awaiting_approval",
				answer:
					"Analysis complete — I read the pinned records, found the issues and staged a change set. Review the diff below; nothing applies until you approve.",
			},
			{
				type: "changeset.staged",
				runId,
				changeSet: {
					id: `chg_sim_${Date.now().toString(36)}`,
					runId,
					domain: input.domain ?? "products",
					title: "Staged from prompt",
					summary: input.prompt,
					risk: "low",
					blastRadius: { kind: "record", count: 1, label: "1 record" },
					diffs: [
						{
							entity: input.context?.entity ?? { kind: "record", id: "rec_demo" },
							field: "demo_field",
							before: "current value",
							after: "agent-proposed value",
							provenance: "generated",
						},
					],
					guardrails: [
						{ rule: "items_cap", ok: true, detail: "items 1 ≤ 50" },
						{ rule: "protected_fields", ok: true, detail: "protected fields untouched" },
					],
					status: "pending",
					stagedBy: "agent",
					stagedAt: new Date().toISOString(),
					expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
				},
			},
		];

		for (const event of script) {
			this.later(() => {
				// store first so a reload mid-script (getThread) sees the same state
				this.runs = this.runs.map((r) => (r.id === runId ? reduceRunEvent(r, event) : r));
				if (event.type === "changeset.staged") {
					this.changeSets.unshift(event.changeSet);
				}
				this.emit(event);
			});
		}

		return this.delay(() => clone(run));
	}

	decideChangeSet(id: string, decision: ChangeSetDecision, actor: string, note?: string): Promise<ChangeSet> {
		return this.delay(() => {
			const cs = this.changeSets.find((c) => c.id === id);
			if (!cs) throw new Error(`change set ${id} not found`);
			const status: ChangeSetStatus = decision === "approve" ? "applied" : "rejected";
			const updated: ChangeSet = { ...cs, status, decidedBy: actor, decidedAt: new Date().toISOString(), note };
			this.changeSets = this.changeSets.map((c) => (c.id === id ? updated : c));
			this.emit({ type: "changeset.decided", changeSet: clone(updated) });
			return clone(updated);
		});
	}

	sendReply(input: SendReplyInput): Promise<ConversationMessage> {
		return this.delay(() => {
			const message: ConversationMessage = {
				id: `msg_${Date.now().toString(36)}`,
				author: "human",
				body: input.body,
				draft: false,
				sources: [],
				createdAt: new Date().toISOString(),
			};
			this.conversations = this.conversations.map((c) =>
				c.id === input.conversationId
					? { ...c, messages: [...c.messages, message], lastMessageAt: message.createdAt }
					: c,
			);
			this.emit({ type: "conversation.message", conversationId: input.conversationId, message });
			return clone(message);
		});
	}

	setDomainAutonomy(domain: string, level: AutonomyLevel): Promise<AutonomyPolicy> {
		return this.delay(() => {
			this.policy = {
				...this.policy,
				domains: { ...this.policy.domains, [domain]: { ...this.policy.domains[domain], level } },
			};
			return clone(this.policy);
		});
	}

	renameThread(id: string, input: RenameThreadInput): Promise<AgentThread> {
		return this.delay(() => {
			const { title } = RenameThreadInputSchema.parse(input);
			const thread = this.threads.find((t) => t.id === id);
			if (!thread) throw new Error(`thread ${id} not found`);
			const renamed = { ...thread, title };
			this.threads = this.threads.map((t) => (t.id === id ? renamed : t));
			return clone(renamed);
		});
	}

	deleteThread(id: string): Promise<void> {
		return this.delay(() => {
			const runIds = new Set(this.runs.filter((r) => r.threadId === id).map((r) => r.id));
			this.threads = this.threads.filter((t) => t.id !== id);
			this.runs = this.runs.filter((r) => !runIds.has(r.id));
			this.changeSets = this.changeSets.filter((c) => !runIds.has(c.runId));
		});
	}

	/** Fixture runs never ask; answering resumes nothing and returns the run as stored. */
	answerRun(runId: string, _input: AnswerInput): Promise<AgentRun> {
		return this.delay(() => {
			const run = this.runs.find((r) => r.id === runId);
			if (!run) throw new AgentGatewayError("This run no longer exists.", 404);
			return clone(run);
		});
	}

	searchQuestionOptions(_runId: string, _questionId: string, _query: string): Promise<QuestionOption[]> {
		return this.delay(() => []);
	}

	uploadAttachment(file: File): Promise<AgentAttachment> {
		return this.delay(() => ({
			id: `att_${Date.now().toString(36)}`,
			kind: file.type.startsWith("image/") ? "image" : "document",
			origin: "upload",
			name: file.name,
			mime: file.type || "application/octet-stream",
			size: file.size,
		}));
	}

	listMedia(_query: MediaQuery): Promise<AgentAttachment[]> {
		return this.delay(() => []);
	}

	pickMedia(item: AgentAttachment): Promise<AgentAttachment> {
		return this.delay(() => clone(item));
	}

	listWork(): Promise<WorkList> {
		return this.delay(() => ({ items: [], states: clone([...this.workStates.values()]), checkedAt: new Date().toISOString() }));
	}

	setWorkState(key: string, input: WorkStateInput): Promise<WorkState> {
		return this.delay(() => {
			const prev = this.workStates.get(key);
			const pick = (next: string | null | undefined, old: string | undefined) => (next === undefined ? old : (next ?? undefined));
			const state: WorkState = {
				key,
				snoozedUntil: pick(input.snoozedUntil, prev?.snoozedUntil),
				dismissedFingerprint: pick(input.dismissedFingerprint, prev?.dismissedFingerprint),
				lastRaisedAt: input.lastRaisedAt ?? prev?.lastRaisedAt,
				updatedAt: new Date().toISOString(),
			};
			this.workStates.set(key, state);
			return clone(state);
		});
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	close(): void {
		for (const timer of this.timers) clearTimeout(timer);
		this.timers.clear();
		this.listeners.clear();
	}
}

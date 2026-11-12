import { type AiWork, AgentDomainSchema, type WorkState, type WorkStateInput } from "@ech/agent-core";
import { Inject, Injectable } from "@nestjs/common";
import type { AiRequestContext } from "../auth/context-token";
import { AgentError } from "./agent-errors";
import { AGENT_STORE, type AgentStore, type ThreadOwner, type ThreadStats, type WorkStatePatch } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { callerView } from "./change-set-access";
import { threadStatus } from "./thread-status";

/** Task chats returned with the work (newest first). */
const TASK_LIMIT = 100;
export const WORK_KEY_MAX = 120;

function owner(ctx: AiRequestContext): ThreadOwner {
	return { organizationId: ctx.organizationId, userId: ctx.userId };
}

/** What the chat is about, as the thread list names it (latest run's domain + page module). */
function about(meta: ThreadStats | undefined): { domain?: string; module?: string } {
	if (!meta) return {};
	const domain = AgentDomainSchema.safeParse(meta.domain);
	return { ...(domain.success ? { domain: domain.data } : {}), ...(meta.module ? { module: meta.module.slice(0, 40) } : {}) };
}

function instant(value: string, field: string): Date {
	const at = new Date(value);
	if (Number.isNaN(at.getTime())) throw new AgentError(`${field} must be a date-time.`, 400);
	return at;
}

/**
 * The assistant's part of the merchant's work queue, per user: chats with drafts
 * waiting for approval, runs paused on a question, the chats tied to to-do items,
 * and the merchant's choices about items (Later, Don't remind me). Plain data from
 * a few indexed queries — no model call, no wording (the host words it).
 */
@Injectable()
export class AgentWorkService {
	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		private readonly threads: AgentThreadService,
	) {}

	async work(ctx: AiRequestContext, now: Date = new Date()): Promise<AiWork> {
		const own = owner(ctx);
		const activeSince = this.threads.activeSince(now);
		// a viewer's drafts wait for an owner or admin: nothing for the viewer to do, so no "approve" item in their queue
		const decidesOwn = callerView(ctx, ctx.userId).access.canDecide;
		const [reviews, questions, tasks, states] = await Promise.all([
			decidesOwn ? this.store.listWaitingReviews(own, activeSince, now) : Promise.resolve([]),
			this.store.listOpenQuestions(own, activeSince),
			this.store.listThreads(own, { limit: TASK_LIMIT, activeSince, tasksOnly: true }),
			this.store.listWorkStates(own),
		]);
		const ids = new Set([...reviews, ...questions].map((item) => item.threadId));
		for (const task of tasks) ids.add(task.id);
		const stats = await this.store.threadStats(ctx.organizationId, [...ids], now);
		return {
			reviews: reviews.map((review) => ({
				threadId: review.threadId,
				title: review.title,
				count: review.count,
				since: review.since.toISOString(),
				...about(stats.get(review.threadId)),
				...(review.taskKey ? { taskKey: review.taskKey } : {}),
				...(review.handOnly ? { handOnly: true } : {}),
				...(review.change ? { change: { title: review.change.title.slice(0, 200), actionKind: review.change.actionKind.slice(0, 60) } } : {}),
			})),
			questions: questions.map((question) => ({
				threadId: question.threadId,
				runId: question.runId,
				title: question.title,
				question: question.question.slice(0, 300),
				since: question.since.toISOString(),
				...about(stats.get(question.threadId)),
				...(question.taskKey ? { taskKey: question.taskKey } : {}),
			})),
			tasks: tasks.flatMap((thread) => {
				if (!thread.taskKey) return [];
				const meta = stats.get(thread.id);
				return [{ taskKey: thread.taskKey, threadId: thread.id, status: threadStatus(meta?.pending ?? 0, meta?.latestRun), updatedAt: thread.updatedAt }];
			}),
			states,
		};
	}

	/** Upserts the user's choice about an item; null clears a field, an absent field is left as it is. */
	async setState(ctx: AiRequestContext, key: string, input: WorkStateInput, now: Date = new Date()): Promise<WorkState> {
		if (key.length < 1 || key.length > WORK_KEY_MAX) throw new AgentError(`Work item key must be 1–${WORK_KEY_MAX} characters.`, 400);
		const patch: WorkStatePatch = {};
		if (input.snoozedUntil !== undefined) patch.snoozedUntil = input.snoozedUntil === null ? null : instant(input.snoozedUntil, "snoozedUntil");
		if (input.dismissedFingerprint !== undefined) patch.dismissedFingerprint = input.dismissedFingerprint || null;
		if (input.lastRaisedAt !== undefined) patch.lastRaisedAt = instant(input.lastRaisedAt, "lastRaisedAt");
		return this.store.putWorkState(owner(ctx), key, patch, now);
	}
}

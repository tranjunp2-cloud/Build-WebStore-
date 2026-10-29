import type { AgentRun, RunQueue } from "@ech/agent-core";
import type { AiRequestContext } from "../auth/context-token";
import type { Env } from "../config/env";
import type { RunSlots } from "./agent-store";
import type { FlowLanguage } from "./ask/flow-copy";
import { seesTeamDrafts } from "./change-set-access";
import { threadTitle } from "./thread-memory";

/**
 * The copilot queue: at most AI_MAX_RUNNING_RUNS_PER_ORG requests work at once per shop workspace and
 * AI_MAX_RUNNING_RUNS_PER_USER per person; a start beyond either waits (FIFO by start time) on its open
 * stream instead of being refused, and starts as soon as a slot is free. Every check runs under the same
 * per-org lock as the starts (see AgentStore.reserveRunStart / checkQueuedRun).
 */

/** Longest a whole copilot request may take: under Vercel's 300 s maxDuration, with room to save. */
export const REQUEST_LIMIT_MS = 290_000;
/** A start sent again with the same client request id within this window attaches to the first run. */
export const CLIENT_REQUEST_REPLAY_MS = 10 * 60_000;

export interface QueueCaps {
	/** per shop workspace; 0 = no cap */
	org: number;
	/** per person; 0 = no cap */
	user: number;
}

export interface QueuePlace {
	/** a slot is free for it now */
	admitted: boolean;
	/** 1 = next */
	position: number;
	/** requests waiting before it */
	ahead: number;
}

export function queueCaps(env: Pick<Env, "AI_MAX_RUNNING_RUNS_PER_ORG" | "AI_MAX_RUNNING_RUNS_PER_USER">): QueueCaps {
	return { org: env.AI_MAX_RUNNING_RUNS_PER_ORG, user: env.AI_MAX_RUNNING_RUNS_PER_USER };
}

/**
 * The queue wait: AI_QUEUE_MAX_WAIT_MS, cut so the wait plus the run's own budget (which starts when it
 * leaves the queue) stays inside one request (290 s): with the defaults (200 s budget), 90 s.
 */
export function maxQueueWaitMs(env: Pick<Env, "AI_QUEUE_MAX_WAIT_MS" | "AI_RUN_BUDGET_MS">): number {
	return Math.max(0, Math.min(env.AI_QUEUE_MAX_WAIT_MS, REQUEST_LIMIT_MS - env.AI_RUN_BUDGET_MS));
}

/** A queued run (or queued start without its row yet) silent this long was left by a killed process. */
export function queueAliveMs(env: Pick<Env, "AI_QUEUE_POLL_MS">): number {
	return Math.max(4 * env.AI_QUEUE_POLL_MS, 15_000);
}

/**
 * Where `candidate` stands: the queue in order (the candidate at the end when it is a new start), each
 * earlier waiter that fits now taking a slot first. A waiter fits when the shop has a free slot and its
 * person is under their own cap, so one person's full hands never hold up the others.
 */
export function placeInQueue(slots: RunSlots, candidate: { runId: string; userId: string }, caps: QueueCaps): QueuePlace {
	const queue = slots.queue.some((waiter) => waiter.runId === candidate.runId) ? slots.queue : [...slots.queue, candidate];
	let free = caps.org > 0 ? caps.org - slots.working.length : Number.POSITIVE_INFINITY;
	const perUser = new Map<string, number>();
	for (const run of slots.working) perUser.set(run.userId, (perUser.get(run.userId) ?? 0) + 1);
	for (const [index, waiter] of queue.entries()) {
		const fits = free > 0 && (caps.user <= 0 || (perUser.get(waiter.userId) ?? 0) < caps.user);
		if (waiter.runId === candidate.runId) return { admitted: fits, position: index + 1, ahead: index };
		if (fits) {
			free -= 1;
			perUser.set(waiter.userId, (perUser.get(waiter.userId) ?? 0) + 1);
		}
	}
	return { admitted: true, position: 1, ahead: 0 };
}

/**
 * The `run.queued` frame's body for `ctx`: its place and what is working. Chats are private, so a member sees
 * only their own requests; owners and admins see everyone's (with who asked) and may stop any of them, within
 * their own shop (shops sharing one organization share its slots, never their requests).
 */
export function queueView(ctx: Pick<AiRequestContext, "userId" | "role" | "name" | "tenantId">, slots: RunSlots, place: QueuePlace): RunQueue {
	const team = seesTeamDrafts(ctx);
	const sameShop = (tenantId: string | null | undefined) => !ctx.tenantId || !tenantId || tenantId === ctx.tenantId;
	const running = slots.working
		.filter((run) => !run.pending && (run.userId === ctx.userId || (team && sameShop(run.tenantId))))
		.slice(0, 20)
		.map((run) => {
			const mine = run.userId === ctx.userId;
			return {
				runId: run.runId,
				...(run.threadId ? { threadId: run.threadId } : {}),
				title: (run.threadTitle ?? (run.prompt ? threadTitle(run.prompt) : "")).slice(0, 120),
				requestedBy: { name: (mine ? (ctx.name ?? run.userName) : run.userName)?.slice(0, 80) ?? null },
				startedAt: run.startedAt.toISOString(),
				mine,
				canStop: true,
			};
		});
	return { position: place.position, ahead: place.ahead, running };
}

/** A teammate's run as an owner / admin who stopped it receives it back: its title, never the private chat. */
export function stoppedTeammateRun(run: AgentRun): AgentRun {
	return {
		id: run.id,
		role: run.role,
		domain: run.domain,
		prompt: threadTitle(run.prompt),
		status: run.status,
		steps: [],
		receipts: [],
		changeSetIds: [],
		...(run.threadId ? { threadId: run.threadId } : {}),
		...(run.error ? { error: run.error } : {}),
		startedAt: run.startedAt,
		...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
	};
}

/** 409 before anything is reserved: one active run per chat. */
export const THREAD_BUSY = "This chat is still working on your last message.";

const QUEUE_LINES: Record<FlowLanguage, { busy: string; stoppedBy: string; teammate: string }> = {
	en: {
		busy: "The AI is busy with other requests in your shop right now. Try again in a minute.",
		stoppedBy: "Stopped by {name} to run another request.",
		teammate: "a teammate",
	},
	ms: {
		busy: "AI sedang sibuk dengan permintaan lain di kedai anda sekarang. Cuba lagi dalam seminit.",
		stoppedBy: "Dihentikan oleh {name} untuk menjalankan permintaan lain.",
		teammate: "rakan sepasukan",
	},
	vi: {
		busy: "AI đang bận với các yêu cầu khác trong cửa hàng của bạn. Hãy thử lại sau một phút.",
		stoppedBy: "{name} đã dừng yêu cầu này để chạy một yêu cầu khác.",
		teammate: "Một đồng đội",
	},
};

/** The queued run waited as long as it may: it fails with this line. */
export function queueBusyLine(language: FlowLanguage = "en"): string {
	return QUEUE_LINES[language].busy;
}

/** The line an owner / admin's Stop leaves on a teammate's run, in the language the teammate wrote in. */
export function stoppedByLine(name: string | undefined, language: FlowLanguage = "en"): string {
	const lines = QUEUE_LINES[language];
	return lines.stoppedBy.replace("{name}", name?.trim() || lines.teammate);
}

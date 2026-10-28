import type { RunEvent, StartRunInput } from "./events";
import type { AgentRun, PlanStep, RunStatus } from "./schemas";
import { AgentRunSchema } from "./schemas";

/**
 * Pure run state machine. The same reducer drives live runs from a stream of
 * RunEvents (WS/SSE) and replays recorded runs — identical code path.
 */

const TERMINAL: ReadonlySet<RunStatus> = new Set(["applied", "rejected", "failed", "cancelled"]);

export function isTerminalStatus(status: RunStatus): boolean {
	return TERMINAL.has(status);
}

let counter = 0;

function nextId(prefix: string): string {
	counter += 1;
	return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createRun(input: StartRunInput, now: string = new Date().toISOString()): AgentRun {
	return AgentRunSchema.parse({
		id: nextId("run"),
		role: input.role ?? "merchant",
		domain: input.domain ?? "products",
		prompt: input.prompt,
		context: input.context,
		status: "planning",
		steps: [],
		receipts: [],
		changeSetIds: [],
		startedAt: now,
	});
}

/** Apply a stream event to a run; returns a new object (immutable update). */
export function reduceRunEvent(run: AgentRun, event: RunEvent): AgentRun {
	if (!("runId" in event) || event.runId !== run.id) return run;
	switch (event.type) {
		case "run.step": {
			const steps = upsertStep(run.steps, event.step);
			const status: RunStatus = run.status === "planning" ? "running" : run.status;
			return { ...run, steps, status };
		}
		case "run.receipt":
			return { ...run, receipts: [...run.receipts, event.receipt] };
		case "run.queued":
			return { ...run, status: "queued", queue: { position: event.position, ahead: event.ahead, running: event.running } };
		case "run.status": {
			// a later frame for a finished run (its suggestions) keeps the time it finished
			const finishedAt = isTerminalStatus(event.status) ? (run.finishedAt ?? new Date().toISOString()) : run.finishedAt;
			// out of the queue (started, stopped or given up): its place is no longer news
			const { queue, ...rest } = run;
			return {
				...rest,
				...(event.status === "queued" && queue ? { queue } : {}),
				status: event.status,
				// a finished or failed run has no open question
				ask: event.status === "awaiting_input" ? run.ask : undefined,
				answer: event.answer ?? run.answer,
				error: event.error ?? run.error,
				suggestions: event.suggestions ?? run.suggestions,
				finishedAt,
			};
		}
		case "run.ask":
			return {
				...run,
				intro: introAfterAsk(run, event.ask !== null),
				ask: event.ask ?? undefined,
				answers: event.answers,
				status: event.ask ? "awaiting_input" : run.status === "awaiting_input" ? "running" : run.status,
			};
		case "changeset.staged":
			return {
				...run,
				changeSetIds: run.changeSetIds.includes(event.changeSet.id)
					? run.changeSetIds
					: [...run.changeSetIds, event.changeSet.id],
				// a run still writing its reply stays live; its final status follows
				status: run.status === "planning" || run.status === "running" ? run.status : "awaiting_approval",
			};
		default:
			return run;
	}
}

/** First pause on a question: freeze what came before it. Back to work: note when. */
function introAfterAsk(run: AgentRun, asking: boolean): AgentRun["intro"] {
	const now = Date.now();
	if (asking) {
		if (run.intro) return run.intro;
		const started = Date.parse(run.startedAt);
		return {
			...(run.answer ? { answer: run.answer } : {}),
			steps: run.steps.length,
			receipts: run.receipts.length,
			thoughtMs: Number.isFinite(started) ? Math.max(0, now - started) : 0,
		};
	}
	return run.intro && !run.intro.resumedAt ? { ...run.intro, resumedAt: new Date(now).toISOString() } : run.intro;
}

function upsertStep(steps: PlanStep[], step: PlanStep): PlanStep[] {
	const index = steps.findIndex((s) => s.id === step.id);
	if (index < 0) return [...steps, step];
	const next = steps.slice();
	next[index] = step;
	return next;
}

/** Reduce a whole event stream into a run (replay / fixture hydration). */
export function replayRun(run: AgentRun, events: RunEvent[]): AgentRun {
	return events.reduce(reduceRunEvent, run);
}

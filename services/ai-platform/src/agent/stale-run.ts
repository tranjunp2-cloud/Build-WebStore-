import { type AgentRun, reduceRunEvent } from "@ech/agent-core";

/** Statuses a run keeps in the database while a process is driving it (it is only saved when it pauses or ends). */
export const IN_FLIGHT_RUN_STATUSES = ["planning", "running"] as const satisfies ReadonlyArray<AgentRun["status"]>;

/** A run taking one of the shop's AI slots (the per-org / per-user working caps count these). */
export const WORKING_RUN_STATUSES = ["planning", "running", "applying"] as const satisfies ReadonlyArray<AgentRun["status"]>;

/** Waiting for a slot: a live process re-checks it every AI_QUEUE_POLL_MS (and refreshes its row). */
export const QUEUED_RUN_STATUS = "queued" as const satisfies AgentRun["status"];

/** One active run per chat: a new message waits until the chat's run is none of these. */
export const ACTIVE_THREAD_RUN_STATUSES = [...WORKING_RUN_STATUSES, QUEUED_RUN_STATUS] as const;

/** Runs closed per sweep, so one pass stays short even after a long outage. */
export const STALE_RUN_BATCH = 200;

/** Shown to the merchant on a run the platform stopped before it could answer. */
export const STALE_RUN_ERROR = "This request was interrupted before it finished. Please try again.";

/** The run as a sweep leaves it: failed with `error`, its open steps failed, finished now. */
export function failedStaleRun(run: AgentRun, error: string, now: Date): AgentRun {
	const closed: AgentRun = { ...run, steps: run.steps.map((step) => (step.status === "running" ? { ...step, status: "failed" as const } : step)) };
	const failed = reduceRunEvent(closed, { type: "run.status", runId: run.id, status: "failed", error });
	return { ...failed, finishedAt: now.toISOString() };
}

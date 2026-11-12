import type { AgentRun, ThreadStatus } from "@ech/agent-core";

/** A process is driving the run (applying included: an approved draft is being written), or it waits for a slot. */
const WORKING: readonly AgentRun["status"][] = ["queued", "planning", "running", "applying"];

/**
 * A chat as a job, from its waiting drafts and its latest run: waits on the
 * merchant (unexpired drafts, or a question), the assistant is working, the
 * last request failed with nothing left to approve, or done.
 */
export function threadStatus(pending: number, latestRun: AgentRun["status"] | undefined): ThreadStatus {
	if (pending > 0 || latestRun === "awaiting_input") return "needs_you";
	if (latestRun && WORKING.includes(latestRun)) return "working";
	if (latestRun === "failed") return "failed";
	return "done";
}

import type { ChangeSet } from "@ech/agent-core";

/** Pending change sets past their expiry read as expired (same view ChangeSetDecisionService gives). */
export function currentState(changeSet: ChangeSet, now: Date): ChangeSet {
	return changeSet.status === "pending" && new Date(changeSet.expiresAt).getTime() <= now.getTime()
		? { ...changeSet, status: "expired" }
		: changeSet;
}

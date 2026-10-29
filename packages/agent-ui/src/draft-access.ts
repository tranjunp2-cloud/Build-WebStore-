import type { ChangeSet } from "@ech/agent-core";
import type { DraftLabels } from "./draft-card";
import { fill } from "./fill";

/**
 * What the signed-in teammate may do with a draft, as the platform computed it for them (`access`, `mine`):
 * the UI holds no role logic. A draft without `access` (an older platform, fixtures) keeps the old behaviour.
 */
export const canDecideDraft = (changeSet: ChangeSet): boolean => changeSet.access?.canDecide !== false;

/** A teammate's draft (owners and admins see them next to their own). */
export const isTeammateDraft = (changeSet: ChangeSet): boolean => changeSet.mine === false;

type AccessLabels = Pick<DraftLabels, "askedBy" | "askedByTeammate" | "needsOwnerOrAdmin" | "notYours">;

/** "Asked by Aisyah" on a teammate's draft; nothing on the caller's own. */
export function askedByLine(changeSet: ChangeSet, labels: AccessLabels): string | undefined {
	if (!isTeammateDraft(changeSet)) return undefined;
	const name = changeSet.requestedBy?.name?.trim();
	return name ? fill(labels.askedBy, { name }) : labels.askedByTeammate;
}

/** The one sentence shown instead of Approve / Discard / Undo when the caller may not decide; nothing when they may. */
export function decideBlockedLine(changeSet: ChangeSet, labels: AccessLabels): string | undefined {
	if (canDecideDraft(changeSet)) return undefined;
	return changeSet.access?.reason === "needs_owner_or_admin" ? labels.needsOwnerOrAdmin : labels.notYours;
}

import type { ChangeSet, ChangeSetAccess, ChangeSetRequester } from "@ech/agent-core";
import type { AiRequestContext } from "../auth/context-token";
import { AgentError } from "./agent-errors";

/**
 * Who sees and decides an AI draft inside one shop workspace (three rules, nothing else):
 *   1. A chat is private to the person who asked (threads / runs are scoped to the user elsewhere).
 *   2. A teammate's drafts are visible only to the shop's owners and admins; everyone else sees only their own.
 *   3. Approve / reject / undo: the person who asked, or an owner / admin. A viewer never decides, not even
 *      their own drafts (they wait for an owner or admin). prime-web still checks the change's own permissions
 *      (e.g. refunds need Orders write access) when it applies it.
 * The role comes from the signed context token (the workspace membership); a token without one is treated as a
 * plain member: own drafts only.
 */
const TEAM_ROLES: ReadonlySet<string> = new Set(["owner", "admin"]);
const NEVER_DECIDES: ReadonlySet<string> = new Set(["viewer"]);

export const ACCESS_REASON = { needsOwnerOrAdmin: "needs_owner_or_admin", notYours: "not_yours" } as const;

/** The plain sentence a refusal answers with (the UI shows its own translation of the reason code). */
export const ACCESS_TEXT: Record<string, string> = {
	[ACCESS_REASON.needsOwnerOrAdmin]: "An owner or admin needs to approve this.",
	[ACCESS_REASON.notYours]: "Only the person who asked, or an owner or admin, can decide this.",
};

/** Owners and admins see (and may decide) every draft of the workspace. */
export function seesTeamDrafts(ctx: Pick<AiRequestContext, "role">): boolean {
	return TEAM_ROLES.has(ctx.role ?? "");
}

export interface CallerView {
	/** the caller asked for it */
	mine: boolean;
	/** rule 2: the caller may see it at all */
	visible: boolean;
	/** rule 3 */
	access: ChangeSetAccess;
}

/** What `ctx` may do with a draft asked by `requesterId` (null: unknown asker, e.g. its run was deleted). */
export function callerView(ctx: Pick<AiRequestContext, "role" | "userId">, requesterId: string | null | undefined): CallerView {
	const mine = Boolean(requesterId) && requesterId === ctx.userId;
	const team = seesTeamDrafts(ctx);
	const visible = mine || team;
	if (NEVER_DECIDES.has(ctx.role ?? "")) return { mine, visible, access: { canDecide: false, reason: ACCESS_REASON.needsOwnerOrAdmin } };
	if (mine || team) return { mine, visible, access: { canDecide: true } };
	return { mine, visible, access: { canDecide: false, reason: ACCESS_REASON.notYours } };
}

/** 404 for a draft the caller may not see (same answer as a missing one: nothing leaks about teammates' drafts). */
export function assertVisible(ctx: Pick<AiRequestContext, "role" | "userId">, requesterId: string | null | undefined): CallerView {
	const view = callerView(ctx, requesterId);
	if (!view.visible) throw new AgentError("Change set not found.", 404);
	return view;
}

/** 404 when not visible, 403 with the plain sentence when visible but not the caller's to decide. */
export function assertCanDecide(ctx: Pick<AiRequestContext, "role" | "userId">, requesterId: string | null | undefined): void {
	const { access } = assertVisible(ctx, requesterId);
	if (!access.canDecide) throw new AgentError(ACCESS_TEXT[access.reason ?? ACCESS_REASON.notYours] ?? "", 403);
}

/** The asker stored on a draft: `requestedBy` written at staging, else the run's user (older drafts, name unknown). */
export function requesterOf(changeSet: ChangeSet, runUserId?: string | null): ChangeSetRequester | undefined {
	const id = runUserId ?? changeSet.requestedBy?.id;
	if (!id) return undefined;
	const name = changeSet.requestedBy?.id === id ? (changeSet.requestedBy.name ?? null) : null;
	return { id, name };
}

/** The draft as `ctx` receives it: who asked, whether it is theirs, and what they may do with it. */
export function forCaller(ctx: Pick<AiRequestContext, "role" | "userId">, changeSet: ChangeSet, runUserId?: string | null): ChangeSet {
	const requestedBy = requesterOf(changeSet, runUserId);
	const { mine, access } = callerView(ctx, requestedBy?.id);
	return { ...withoutCallerView(changeSet), ...(requestedBy ? { requestedBy } : {}), mine, access };
}

/** Per-caller fields are never stored: drop them before a write. */
export function withoutCallerView(changeSet: ChangeSet): ChangeSet {
	const { access: _access, mine: _mine, ...stored } = changeSet;
	return stored;
}

/** Stamps the asker on a draft being staged (from the signed context, never from the model). */
export function stampRequester(changeSet: ChangeSet, ctx: Pick<AiRequestContext, "userId" | "name">): ChangeSet {
	return { ...changeSet, requestedBy: { id: ctx.userId, name: ctx.name ?? null } };
}

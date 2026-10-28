import "server-only";

import { AiClientError, type AiTaskId, type AiTaskInput } from "@ech/ai-contracts";
import type { User } from "payload";
import type { PlatformUser } from "@/types/user";
import { AgentAccessError, resolveActorForUser } from "./context";
import { requestIdOf } from "./request-id";
import { getAiTaskClient } from "./task-client";

/**
 * Runs a platform task on behalf of the signed-in user of this request
 * (workspace from header/cookie, verified membership). Routes keep their own
 * response shapes; map failures with `describeAiTaskFailure`.
 */
export async function runAiTaskForUser<T extends AiTaskId>(
	user: User | PlatformUser,
	req: Request,
	taskId: T,
	input: AiTaskInput<T>,
	options: { tenantId?: string | null; signal?: AbortSignal } = {},
) {
	const actor = await resolveActorForUser(user as PlatformUser, req, { tenantId: options.tenantId });
	return getAiTaskClient(actor, { requestId: requestIdOf(req) }).runTask(taskId, input, { signal: options.signal });
}

/** HTTP status + user-safe message for a failed task call. */
export function describeAiTaskFailure(error: unknown): { status: number; message: string } {
	if (error instanceof AgentAccessError) return { status: error.status, message: error.message };
	if (error instanceof AiClientError) {
		// Quota and deadline messages are written for users; outages and validation detail are not.
		if (error.status === 429 || error.status === 504) return { status: error.status, message: error.message };
		// Provider billing is an ops problem: users get the generic outage, ops see it in the logs/ledger.
		if (error.status === 402) return { status: 502, message: "The AI service is unavailable right now. Try again later." };
		if (error.status === 400) return { status: 400, message: "This request is too large or not valid for the AI assistant." };
		return { status: 502, message: "The AI service could not complete this request. Try again." };
	}
	return { status: 502, message: "The AI service is unavailable right now. Try again." };
}

export type SiteBillingTenant = { ok: true; tenantId: string; site: { id: string | number; seo?: unknown } } | { ok: false; status: 403 | 404; error: string };

/**
 * The workspace an AI call about a site must run (and bill) in: the site's own tenant, after the same
 * access check the editor routes use (readable by the user AND an active membership of that tenant —
 * platform staff outside the workspace are refused). Without it a one-shot route bills whichever
 * workspace the cookie happens to name.
 */
export async function resolveSiteBillingTenant(user: User | PlatformUser, siteId: string | number): Promise<SiteBillingTenant> {
	const { resolveSiteForUser } = await import("@/lib/sites/site-access");
	const access = await resolveSiteForUser(user, siteId);
	if (access.ok) return { ok: true, tenantId: access.tenantId, site: access.site };
	return { ok: false, status: access.status, error: access.status === 404 ? "Site not found." : "You do not have access to this site." };
}

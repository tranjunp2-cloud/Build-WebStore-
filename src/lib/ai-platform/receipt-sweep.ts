import "server-only";

import { randomUUID } from "node:crypto";
import { ChangeSetSchema } from "@ech/agent-core";
import config from "@payload-config";
import { getPayload } from "payload";
import type { PlatformUser } from "@/types/user";
import { type ApplyReceipt, markRecorded, deferReceipt, unrecordedReceipts, SWEEP_LIMIT } from "./apply-receipts";
import { AgentAccessError, actorForUserInTenant, signAgentContextToken } from "./context";
import { withRequestId } from "./request-id";
import { AiPlatformError, aiPlatformJson } from "./upstream";

/**
 * The cron half of the apply receipts (apply-receipts.ts): a change prime-web applied or undid, whose record
 * ai-platform never got (every retry of the request failed, or the function was stopped), is recorded now — as the
 * user who approved it, in its workspace. Nothing is applied here: only the stored result is sent.
 * - card still `pending` + receipt `applied` → decision approve with the stored result;
 * - card `applied` + receipt `reverted` → revert with the stored result;
 * - card already as the receipt says → only marked done;
 * - anything else (card rejected / expired while the data is live, the user left the workspace, the card is gone)
 *   can't be fixed from here: logged for on-call (Sentry picks up console errors) and marked done.
 * A transient failure leaves the receipt for a later run. At most `SWEEP_LIMIT` receipts and `budgetMs` per run.
 */

export interface SweepResult {
	checked: number;
	recorded: number;
	alreadyRecorded: number;
	gaveUp: number;
	deferred: number;
}

type Outcome = "recorded" | "alreadyRecorded" | "gaveUp" | "deferred";

async function actorFor(receipt: ApplyReceipt) {
	if (!receipt.userId) throw new AgentAccessError("The receipt names no user.", 403);
	const payload = await getPayload({ config });
	const user = await payload.findByID({ collection: "users", id: receipt.userId, depth: 1, overrideAccess: true }).catch(() => null);
	if (!user) throw new AgentAccessError("The user who approved this change no longer exists.", 403);
	return actorForUserInTenant(user as unknown as PlatformUser, receipt.tenantId);
}

async function settle(receipt: ApplyReceipt): Promise<Outcome> {
	const id = receipt.changeSetId;
	const state = receipt.state === "reverted" ? "reverted" : "applied";
	const giveUp = async (why: string): Promise<Outcome> => {
		console.error(`[ai-receipts] change set ${id} is ${state} in prime-web but can't be recorded on the AI platform (tenant ${receipt.tenantId}): ${why}`);
		await markRecorded(id, state);
		return "gaveUp";
	};
	if (!receipt.result) return giveUp("the receipt has no result");
	let token: string;
	try {
		token = await signAgentContextToken(await actorFor(receipt));
	} catch (error) {
		if (error instanceof AgentAccessError) return giveUp(error.message);
		throw error;
	}
	try {
		const stored = ChangeSetSchema.parse(await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token }));
		if (stored.status === state) {
			await markRecorded(id, state);
			return "alreadyRecorded";
		}
		if (state === "applied" && stored.status === "pending") {
			await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/decision`, token, body: JSON.stringify({ decision: "approve", note: receipt.note ?? undefined, result: receipt.result }) });
		} else if (state === "reverted" && stored.status === "applied") {
			await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/revert`, token, body: JSON.stringify({ result: receipt.result }) });
		} else {
			return giveUp(`the card is ${stored.status}`);
		}
	} catch (error) {
		if (error instanceof AiPlatformError && error.status === 404) return giveUp("the change set is gone (chat deleted?)");
		// the platform's real answer (403 after the approver became a viewer, 422): retrying for 7 days changes nothing
		if (error instanceof AiPlatformError && isPermanentRefusal(error.status)) return giveUp(`the AI platform refused (${error.status}): ${error.message}`);
		throw error;
	}
	await markRecorded(id, state);
	return "recorded";
}

/** A 4xx other than a timeout (408) or a rate limit (429) won't change on a later run. */
const isPermanentRefusal = (status: number): boolean => status >= 400 && status < 500 && status !== 408 && status !== 429;

export async function sweepUnrecordedReceipts(options: { now?: Date; budgetMs?: number; limit?: number } = {}): Promise<SweepResult> {
	const started = Date.now();
	const budget = options.budgetMs ?? 90_000;
	const receipts = await unrecordedReceipts(options.limit ?? SWEEP_LIMIT, options.now ?? new Date());
	const totals: SweepResult = { checked: 0, recorded: 0, alreadyRecorded: 0, gaveUp: 0, deferred: 0 };
	for (const receipt of receipts) {
		if (Date.now() - started > budget) break;
		totals.checked += 1;
		const outcome = await withRequestId(randomUUID(), () => settle(receipt)).catch(async (error: unknown) => {
			console.warn(`[ai-receipts] change set ${receipt.changeSetId} not recorded yet, next run tries again:`, error instanceof Error ? error.message : error);
			await deferReceipt(receipt.changeSetId).catch(() => undefined);
			return "deferred" as const;
		});
		totals[outcome] += 1;
	}
	return totals;
}

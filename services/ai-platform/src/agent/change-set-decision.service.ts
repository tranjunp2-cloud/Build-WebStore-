import type { ChangeSet, ChangeSetResult, RunStatus } from "@ech/agent-core";
import { Inject, Injectable } from "@nestjs/common";
import type { AiRequestContext } from "../auth/context-token";
import { AgentError } from "./agent-errors";
import { AGENT_STORE, type AgentStore, type StoredChangeSet } from "./agent-store";
import { assertCanDecide, assertVisible } from "./change-set-access";

/** Changes guarded by the record's version: `{ id, base }` payloads — one record, one version. */
const GUARDED: Record<string, string> = {
	"blog.update": "blog_post",
	"blog.set_status": "blog_post",
	"product.update": "product",
	"product.set_status": "product",
	// Payload products (capability shop_products): `base` is the product's updatedAt
	"shop_product.update": "shop_product",
	"shop_product.set_status": "shop_product",
};

/** "blog_post:9" for a version-guarded change, otherwise undefined. */
export function guardedRecord(changeSet: ChangeSet): string | undefined {
	const kind = changeSet.action?.kind ? GUARDED[changeSet.action.kind] : undefined;
	const id = (changeSet.action?.payload as { id?: unknown } | undefined)?.id;
	return kind && (typeof id === "string" || typeof id === "number") ? `${kind}:${id}` : undefined;
}

/**
 * A claim older than this is considered abandoned (apply crashed mid-way). Above the prime-web
 * apply route's 300 s limit: a slow apply that is still running is never claimed twice.
 */
export const CLAIM_STALE_AFTER_MS = 6 * 60 * 1000;

/** Claims made at/after this are still held by an apply in progress. */
function freshClaimsSince(now: number = Date.now()): Date {
	return new Date(now - CLAIM_STALE_AFTER_MS);
}

function isFreshClaim(claimedAt: Date | null): boolean {
	return claimedAt !== null && claimedAt >= freshClaimsSince();
}

const BEING_APPLIED = "This change is being applied right now.";

export interface DecisionInput {
	decision: "approve" | "reject";
	note?: string;
	result?: ChangeSetResult;
}

/**
 * Approval lifecycle. The domain owner (prime-web BFF) claims a change set,
 * applies it with the user's own permissions, then reports `approve` with the
 * result. ai-platform never writes business data itself.
 *
 * Who may (change-set-access.ts): a draft is seen by the person who asked and by the workspace's owners / admins
 * (anyone else: 404); claim / release / decide / revert / reinstate by the person who asked or an owner / admin,
 * never by a viewer (403 with a plain sentence).
 */
@Injectable()
export class ChangeSetDecisionService {
	constructor(@Inject(AGENT_STORE) private readonly store: AgentStore) {}

	async get(ctx: AiRequestContext, id: string): Promise<ChangeSet> {
		const stored = await this.store.getChangeSet(ctx.organizationId, id);
		if (!stored) throw new AgentError("Change set not found.", 404);
		assertVisible(ctx, stored.changeSet.requestedBy?.id);
		return this.expireIfDue(ctx, stored);
	}

	async claim(ctx: AiRequestContext, id: string): Promise<ChangeSet> {
		const current = await this.get(ctx, id);
		assertCanDecide(ctx, current.requestedBy?.id);
		if (current.status !== "pending") throw new AgentError(`This change was already ${current.status}.`, 409);
		const claimed = await this.store.claimChangeSet(ctx.organizationId, id, CLAIM_STALE_AFTER_MS);
		if (!claimed) throw new AgentError("This change is already being applied.", 409);
		return current.requestedBy ? { ...claimed, requestedBy: current.requestedBy } : claimed;
	}

	async release(ctx: AiRequestContext, id: string): Promise<void> {
		const stored = await this.store.getChangeSet(ctx.organizationId, id);
		if (!stored) return;
		// only who could claim it may let it go (a teammate cannot free a claim to apply it twice)
		assertCanDecide(ctx, stored.changeSet.requestedBy?.id);
		await this.store.releaseChangeSet(ctx.organizationId, id);
	}

	async decide(ctx: AiRequestContext, id: string, input: DecisionInput): Promise<ChangeSet> {
		const stored = await this.store.getChangeSet(ctx.organizationId, id);
		if (!stored) throw new AgentError("Change set not found.", 404);
		assertCanDecide(ctx, stored.changeSet.requestedBy?.id);
		const current = await this.expireIfDue(ctx, stored);
		if (current.status !== "pending") throw new AgentError(`This change was already ${current.status}.`, 409);
		if (input.decision === "approve" && !stored.claimedAt) {
			throw new AgentError("Approve requires the change set to be claimed and applied first.", 409);
		}
		// the applier releases its claim before it rejects; anyone else waits for the apply to end
		if (input.decision === "reject" && isFreshClaim(stored.claimedAt)) throw new AgentError(BEING_APPLIED, 409);
		const decided: ChangeSet = {
			...current,
			status: input.decision === "approve" ? "applied" : "rejected",
			decidedBy: ctx.email ?? ctx.userId,
			decidedAt: new Date().toISOString(),
			note: input.note,
			result: input.decision === "approve" ? input.result : undefined,
		};
		const written = await this.store.updateChangeSet(ctx.organizationId, decided, {
			status: "pending",
			...(input.decision === "reject" ? { unclaimedSince: freshClaimsSince() } : {}),
		});
		if (!written) throw await this.conflict(ctx, id);
		await this.settleRun(ctx, decided.runId);
		if (decided.status === "applied") await this.supersedeStale(ctx, decided);
		return decided;
	}

	/**
	 * An applied change moved its record to a new version: every other change
	 * still pending for that record was drafted from a version that no longer
	 * exists (its version guard would refuse it). They become `superseded`
	 * instead of waiting in the review list only to fail on approve.
	 */
	private async supersedeStale(ctx: AiRequestContext, applied: ChangeSet): Promise<void> {
		const key = guardedRecord(applied);
		if (!key) return;
		const pending = await this.store.listChangeSets(ctx.organizationId, { status: "pending", limit: 200 });
		const stale = pending.filter((cs) => cs.id !== applied.id && guardedRecord(cs) === key);
		const runs = new Set<string>();
		for (const cs of stale) {
			const superseded = await this.store.updateChangeSet(
				ctx.organizationId,
				{ ...cs, status: "superseded", decidedAt: new Date().toISOString(), note: `Replaced by ${applied.id}, which changed this record first.` },
				{ status: "pending" },
			);
			if (superseded) runs.add(cs.runId);
		}
		for (const runId of runs) await this.settleRun(ctx, runId);
	}

	/**
	 * The domain owner undid an applied change (from the pre-image it saved).
	 * Only an applied change with undo data can be reverted, once.
	 */
	async revert(ctx: AiRequestContext, id: string, result: ChangeSetResult | undefined, options: { keepUndo?: boolean } = {}): Promise<ChangeSet> {
		const current = await this.get(ctx, id);
		assertCanDecide(ctx, current.requestedBy?.id);
		if (current.status !== "applied" || !current.result?.undo) throw new AgentError("This change can't be undone.", 409);
		const reverted: ChangeSet = {
			...current,
			status: "reverted",
			result: {
				...current.result,
				// the site editor's own Undo/Redo takes a change back and forth: it keeps the pre-image so Redo can reinstate it
				undo: options.keepUndo ? current.result.undo : undefined,
				revertedAt: new Date().toISOString(),
				revertedBy: ctx.email ?? ctx.userId,
				// links to the record as undo left it
				...(result && result.links.length > 0 ? { links: result.links } : {}),
			},
		};
		if (!(await this.store.updateChangeSet(ctx.organizationId, reverted, { status: "applied" }))) {
			throw new AgentError("This change can't be undone.", 409);
		}
		return reverted;
	}

	/**
	 * The editor's Redo put an undone change back (the domain owner saw the page as the change left it): applied
	 * again, with the undo data it kept. Only a reverted change that still has undo data inside its window.
	 */
	async reinstate(ctx: AiRequestContext, id: string): Promise<ChangeSet> {
		const current = await this.get(ctx, id);
		assertCanDecide(ctx, current.requestedBy?.id);
		const undo = current.result?.undo;
		if (current.status !== "reverted" || !undo || Date.parse(undo.until) <= Date.now()) throw new AgentError("This change can't be put back.", 409);
		const { revertedAt: _at, revertedBy: _by, ...rest } = current.result!;
		const applied: ChangeSet = { ...current, status: "applied", result: rest };
		if (!(await this.store.updateChangeSet(ctx.organizationId, applied, { status: "reverted" }))) {
			throw new AgentError("This change can't be put back.", 409);
		}
		return applied;
	}

	/**
	 * A pending change past its expiry becomes `expired` — unless an apply holds it (a slow
	 * apply that started in time still lands). Lost a race: the change as it is now.
	 */
	private async expireIfDue(ctx: AiRequestContext, stored: StoredChangeSet): Promise<ChangeSet> {
		const { changeSet } = stored;
		if (changeSet.status !== "pending" || new Date(changeSet.expiresAt).getTime() > Date.now()) return changeSet;
		if (isFreshClaim(stored.claimedAt)) return changeSet;
		const expired: ChangeSet = { ...changeSet, status: "expired" };
		if (await this.store.updateChangeSet(ctx.organizationId, expired, { status: "pending", unclaimedSince: freshClaimsSince() })) return expired;
		return (await this.store.getChangeSet(ctx.organizationId, changeSet.id))?.changeSet ?? expired;
	}

	/** A guarded write found the change moved on: say what it is now. */
	private async conflict(ctx: AiRequestContext, id: string): Promise<AgentError> {
		const now = await this.store.getChangeSet(ctx.organizationId, id);
		if (now && now.changeSet.status !== "pending") return new AgentError(`This change was already ${now.changeSet.status}.`, 409);
		return new AgentError(now && isFreshClaim(now.claimedAt) ? BEING_APPLIED : "This change was just changed by someone else. Try again.", 409);
	}

	/** Once nothing in the run is pending, the run settles to applied/rejected. */
	private async settleRun(ctx: AiRequestContext, runId: string): Promise<void> {
		const run = await this.store.getRun(ctx.organizationId, runId);
		if (!run) return;
		const sets = await this.store.listRunChangeSets(ctx.organizationId, runId);
		if (sets.some((cs) => cs.status === "pending")) return;
		const status: RunStatus = sets.some((cs) => cs.status === "applied") ? "applied" : "rejected";
		await this.store.saveRun(ctx.organizationId, { ...run, status, finishedAt: new Date().toISOString() });
	}
}

import { groundedDiffs } from "./provenance";
import type { AutonomyPolicy, ChangeSet, FieldDiff, GuardrailResult, ToolReceipt } from "./schemas";
import { ChangeSetSchema } from "./schemas";

/**
 * ChangeSet guardrails. A change set is the only path to a write; it carries
 * diffs, blast radius, risk and expiry so a human can decide from the card.
 */

export interface ChangeSetDraft {
	runId: string;
	domain: ChangeSet["domain"];
	title: string;
	summary: string;
	risk: ChangeSet["risk"];
	blastRadius: ChangeSet["blastRadius"];
	diffs: FieldDiff[];
	stagedBy: string;
	ttlMs?: number;
}

let counter = 0;

export function buildChangeSet(draft: ChangeSetDraft, now: Date = new Date()): ChangeSet {
	counter += 1;
	const ttl = draft.ttlMs ?? 24 * 60 * 60 * 1000;
	return ChangeSetSchema.parse({
		id: `chg_${now.getTime().toString(36)}${counter.toString(36)}`,
		runId: draft.runId,
		domain: draft.domain,
		title: draft.title,
		summary: draft.summary,
		risk: draft.risk,
		blastRadius: draft.blastRadius,
		diffs: draft.diffs,
		guardrails: [],
		status: "pending",
		stagedBy: draft.stagedBy,
		stagedAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + ttl).toISOString(),
	});
}

export interface GuardrailConfig {
	/** Max entities a single change set may touch. */
	maxItems: number;
	/** Fields an agent can never write, e.g. price_floor, jan, legal_text. */
	protectedFields: string[];
}

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
	maxItems: 50,
	protectedFields: ["price_floor", "jan", "legal_text", "payout_account"],
};

/**
 * Evaluate guardrails for a change set against the run's receipts.
 * Returns one result per rule; a change set with a failed rule must not apply.
 */
export function evaluateGuardrails(
	changeSet: ChangeSet,
	receipts: ToolReceipt[],
	config: GuardrailConfig = DEFAULT_GUARDRAILS,
): GuardrailResult[] {
	const results: GuardrailResult[] = [];

	const itemCount = changeSet.blastRadius.count;
	results.push({
		rule: "items_cap",
		ok: itemCount <= config.maxItems,
		detail: `items ${itemCount} ≤ ${config.maxItems}`,
	});

	const protectedSet = new Set(config.protectedFields);
	const touched = changeSet.diffs.filter((d) => protectedSet.has(d.field)).map((d) => d.field);
	results.push({
		rule: "protected_fields",
		ok: touched.length === 0,
		detail: touched.length === 0 ? "protected fields untouched" : `touches ${touched.join(", ")}`,
	});

	const { ungrounded } = groundedDiffs(changeSet.diffs, receipts);
	results.push({
		rule: "provenance",
		ok: ungrounded.length === 0,
		detail:
			ungrounded.length === 0
				? "all entities grounded in tool output"
				: `${ungrounded.length} diff(s) reference unobserved entities`,
	});

	return results;
}

export function allGuardrailsPass(results: GuardrailResult[]): boolean {
	return results.every((r) => r.ok);
}

/** Merge autonomy protected fields with guardrail config. */
export function guardrailsFromPolicy(policy: AutonomyPolicy, maxItems = DEFAULT_GUARDRAILS.maxItems): GuardrailConfig {
	return { maxItems, protectedFields: policy.protectedFields };
}

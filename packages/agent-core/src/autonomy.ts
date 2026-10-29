import type { AutonomyLevel, AutonomyPolicy, ChangeSet, RiskTier } from "./schemas";
import { AutonomyLevelSchema } from "./schemas";

/**
 * Autonomy ladder: observe → recommend → stage → auto.
 * Trust is earned per domain; caps and protected fields always apply, and
 * every auto-apply still writes an audit entry (the caller's concern).
 */

export const AUTONOMY_ORDER: readonly AutonomyLevel[] = ["observe", "recommend", "stage", "auto"];

/** Risk tiers that must never auto-apply, regardless of domain level. */
const NEVER_AUTO: ReadonlySet<RiskTier> = new Set(["high", "critical"]);

export const DEFAULT_AUTONOMY: AutonomyPolicy = {
	domains: {
		products: { level: "stage" },
		listings: { level: "stage" },
		inventory: { level: "recommend" },
		orders: { level: "recommend" },
		pricing: { level: "observe" },
		integrations: { level: "recommend" },
		support: { level: "auto", cap: "faq_and_status_intents" },
		campaigns: { level: "stage" },
		crm: { level: "stage" },
		cms: { level: "stage" },
		webbuilder: { level: "stage" },
	},
	protectedFields: ["price_floor", "jan", "legal_text", "payout_account"],
	autoSendMaxConfidence: 0.8,
};

export type AutonomyDecision = "auto" | "stage" | "recommend" | "observe";

export function levelFor(policy: AutonomyPolicy, domain: string): AutonomyLevel {
	const entry = policy.domains[domain];
	return entry ? entry.level : "observe";
}

/**
 * The strongest action the policy allows for a (domain, risk) pair.
 * High/critical risk can never auto-apply even when the domain is "auto".
 */
export function decideAction(policy: AutonomyPolicy, domain: string, risk: RiskTier): AutonomyDecision {
	const level = levelFor(policy, domain);
	if (level === "auto" && NEVER_AUTO.has(risk)) return "stage";
	return level;
}

/** Human-readable explanation for why a write stopped at its gate. */
export function explainDecision(decision: AutonomyDecision, risk: RiskTier): string {
	switch (decision) {
		case "auto":
			return "Within autonomy level and caps — may apply automatically with audit entry.";
		case "stage":
			return NEVER_AUTO.has(risk)
				? `${risk} risk never auto-applies — staged for human approval.`
				: "Staged for human approval.";
		case "recommend":
			return "Domain is recommend-only — agent may propose but not stage.";
		default:
			return "Domain is observe-only — agent may report but not act.";
	}
}

export function assertLevel(level: string): AutonomyLevel {
	return AutonomyLevelSchema.parse(level);
}

/** Whether a pending change set is still actionable. */
export function isActionable(changeSet: ChangeSet, now: Date = new Date()): boolean {
	return changeSet.status === "pending" && new Date(changeSet.expiresAt).getTime() > now.getTime();
}

/** Ms until expiry; negative when already expired. */
export function expiresInMs(changeSet: ChangeSet, now: Date = new Date()): number {
	return new Date(changeSet.expiresAt).getTime() - now.getTime();
}

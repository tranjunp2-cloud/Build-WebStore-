import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { PLAN_CODES, type PlanCode } from "@/collections/PlanSubscriptions";
import { AI_BUDGET_FEATURE, AI_PICTURES_FEATURE } from "./ai-config-schema";
import { getActivePlanSubscription } from "@/lib/subscriptions/plan-subscription";

/** What a shop may spend on AI over a rolling 24 h; null = unlimited. Sent to ai-platform as the `lim` token claim. */
export interface AiLimits {
	plan: string;
	/** AI battery: USD for chat + writing tools */
	aiBudgetUsd: number | null;
	/** AI pictures */
	picturesPerDay: number | null;
}

/** Used when a plan has no feature row (never unlimited by accident). Same numbers the db-setup seed inserts. */
export const DEFAULT_AI_LIMITS: Readonly<Record<PlanCode, { aiBudgetUsd: number; picturesPerDay: number }>> = {
	FREEMIUM: { aiBudgetUsd: 0.05, picturesPerDay: 1 },
	STARTER_TM_USER: { aiBudgetUsd: 0.15, picturesPerDay: 3 },
	STARTER_NON_TM_USER: { aiBudgetUsd: 0.15, picturesPerDay: 3 },
	STANDARD_TM_USER: { aiBudgetUsd: 0.4, picturesPerDay: 8 },
	STANDARD_NON_TM_USER: { aiBudgetUsd: 0.4, picturesPerDay: 8 },
	PROFESSIONAL_TM_USER: { aiBudgetUsd: 0.9, picturesPerDay: 20 },
	PROFESSIONAL_NON_TM_USER: { aiBudgetUsd: 0.9, picturesPerDay: 20 },
};

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; limits: AiLimits }>();

export function clearAiLimitsCache(): void {
	cache.clear();
}

const isPlanCode = (value: unknown): value is PlanCode => PLAN_CODES.some((plan) => plan.value === value);

/**
 * One feature value → a limit. undefined = row missing or unreadable (caller uses the default);
 * null = unlimited. YES counts as unlimited, as it does for the numeric staff_limit / template_limit features.
 */
export function parseLimit(raw: unknown, integer: boolean): number | null | undefined {
	if (typeof raw !== "string") return undefined;
	const text = raw.trim();
	if (!text) return undefined;
	const upper = text.toUpperCase();
	if (upper === "UNLIMITED" || upper === "YES") return null;
	const value = Number(text);
	if (!Number.isFinite(value) || value < 0) return undefined;
	return integer ? Math.floor(value) : value;
}

/**
 * The tenant's AI limits from its plan's `plan-features` rows. No subscription, an expired or cancelled one →
 * FREEMIUM. A missing row → that plan's default. Cached 60 s per tenant. Throws on a DB failure (not cached).
 */
export async function aiLimitsForTenant(tenantId: string | number): Promise<AiLimits> {
	const key = String(tenantId);
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.limits;

	const payload = await getPayload({ config });
	const subscription = await getActivePlanSubscription(payload, tenantId);
	const plan: PlanCode = isPlanCode(subscription?.plan) ? subscription.plan : "FREEMIUM";
	// both features in one query
	const rows = await payload.find({
		collection: "plan-features",
		overrideAccess: true,
		where: { and: [{ planCode: { equals: plan } }, { featureCode: { in: [AI_BUDGET_FEATURE, AI_PICTURES_FEATURE] } }] },
		limit: 2,
		pagination: false,
		depth: 0,
	});
	const valueOf = (code: string) => rows.docs.find((row) => row.featureCode === code)?.value;
	const budget = parseLimit(valueOf(AI_BUDGET_FEATURE), false);
	const pictures = parseLimit(valueOf(AI_PICTURES_FEATURE), true);
	const defaults = DEFAULT_AI_LIMITS[plan];
	const limits: AiLimits = {
		plan,
		aiBudgetUsd: budget === undefined ? defaults.aiBudgetUsd : budget,
		picturesPerDay: pictures === undefined ? defaults.picturesPerDay : pictures,
	};

	if (cache.size >= CACHE_MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, { at: Date.now(), limits });
	return limits;
}

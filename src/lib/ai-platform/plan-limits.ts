import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { PLAN_CODES, type PlanCode } from "@/collections/PlanSubscriptions";
import { AI_PLAN_LIMIT_FEATURES } from "./ai-config-schema";
import { type AiLimits, resolveAiLimits, toShopOverride } from "./limit-resolution";
import { getActivePlanSubscription } from "@/lib/subscriptions/plan-subscription";

export { DEFAULT_AI_LIMITS, parseLimit, type AiLimits } from "./limit-resolution";

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; limits: AiLimits }>();

export function clearAiLimitsCache(): void {
	cache.clear();
}

const isPlanCode = (value: unknown): value is PlanCode => PLAN_CODES.some((plan) => plan.value === value);

/** Drops one tenant's cached limits (after its override is saved or removed); this instance only, others expire within 60 s. */
export function clearAiLimitsCacheFor(tenantId: string | number): void {
	cache.delete(String(tenantId));
}

/**
 * The tenant's AI limits: its plan's `plan-features` rows, then its active (non-expired) `ai-shop-limits` override.
 * No subscription, an expired or cancelled one → FREEMIUM. A missing row → that plan's default (budgets) or
 * unlimited / on (the monthly budget, the website-setup budget, ai_enabled). Cached 60 s per tenant.
 * Throws on a DB failure (not cached).
 */
export async function aiLimitsForTenant(tenantId: string | number): Promise<AiLimits> {
	const key = String(tenantId);
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.limits;

	const payload = await getPayload({ config });
	const subscription = await getActivePlanSubscription(payload, tenantId);
	const plan: PlanCode = isPlanCode(subscription?.plan) ? subscription.plan : "FREEMIUM";
	const [rows, overrides] = await Promise.all([
		payload.find({
			collection: "plan-features",
			overrideAccess: true,
			where: { and: [{ planCode: { equals: plan } }, { featureCode: { in: [...AI_PLAN_LIMIT_FEATURES] } }] },
			limit: AI_PLAN_LIMIT_FEATURES.length,
			pagination: false,
			depth: 0,
		}),
		payload.find({
			collection: "ai-shop-limits",
			overrideAccess: true,
			where: { tenant: { equals: tenantId } },
			limit: 1,
			pagination: false,
			depth: 0,
		}),
	]);
	const values = Object.fromEntries(rows.docs.map((row) => [row.featureCode, row.value]));
	const stored = overrides.docs[0];
	const limits = resolveAiLimits({ plan, values, override: stored ? toShopOverride(stored as unknown as Record<string, unknown>) : null });

	if (cache.size >= CACHE_MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, { at: Date.now(), limits });
	return limits;
}

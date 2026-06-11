import type { BasePayload } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'

const POSITIVE_VALUES = new Set(['YES', 'UNLIMITED'])

/** Valid SSO subscription_code base values (case-insensitive). */
export const VALID_BASE_CODES = new Set(['freemium', 'starter', 'standard', 'professional'])

// ── Pure Helpers ──────────────────────────────────────────────────────────────

/** Maps SSO subscription_code + subscription_type → PW2 PlanCode enum.
 *  Mirrors PW1 helpers.php getPlanCode().
 *  Examples: ('professional', 1) → 'PROFESSIONAL_TM_USER', ('freemium') → 'FREEMIUM' */
export function getPlanCode(code: string, type?: number | null): PlanCode {
  const c = code.toLowerCase().trim()
  if (!VALID_BASE_CODES.has(c)) throw new Error(`Unknown subscription base code: ${code}`)
  if (c === 'freemium') return 'FREEMIUM'
  const suffix = type === 1 ? '_TM_USER' : '_NON_TM_USER'
  return (c.toUpperCase() + suffix) as PlanCode
}

/** Maps 7-code PlanCode → 4-tier Tenants.plan value used by ai/generate-site. */
export function mapPlanCodeToTier(planCode: PlanCode): 'free' | 'starter' | 'pro' | 'business' {
  if (planCode === 'FREEMIUM') return 'free'
  if (planCode.startsWith('STARTER_')) return 'starter'
  if (planCode.startsWith('STANDARD_')) return 'pro'
  return 'business' // PROFESSIONAL_*
}

/** Normalizes MySQL datetime ('2026-06-01 00:00:00') or ISO string to 'YYYY-MM-DD'. */
export function dateOnly(d: string): string {
  return d.replace(' ', 'T').split('T')[0]
}

/** Checks if a PlanSubscription record is currently active.
 *  Mirrors PW1 PlanSubscription::isActive():
 *  active = not (ended|canceled status) AND endsAt > now AND not canceledImmediately. */
export function isSubscriptionActive(sub: {
  endsAt: string | Date
  canceledAt?: string | Date | null
  canceledImmediately?: boolean | null
  status: string
}): boolean {
  if (sub.canceledAt && sub.canceledImmediately) return false
  if (sub.status === 'ended' || sub.status === 'canceled') return false
  return new Date(sub.endsAt) > new Date()
}

// ── Async DB Helpers ──────────────────────────────────────────────────────────

/** Returns the active 'main' PlanSubscription for a tenant, or null if expired/absent. */
export async function getActivePlanSubscription(
  payload: BasePayload,
  tenantId: string | number,
) {
  const result = await payload.find({
    collection: 'plan-subscriptions',
    where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
    sort: '-createdAt',
    limit: 1,
  })
  const sub = result.docs[0]
  if (!sub) return null
  return isSubscriptionActive(sub as unknown as Parameters<typeof isSubscriptionActive>[0]) ? sub : null
}

/** Increments usage for a feature — creates record if absent. Mirrors PW1 SubscriptionUsageManager::record(). */
export async function recordUsage(
  payload: BasePayload,
  subscriptionId: string | number,
  featureCode: string,
  amount = 1,
): Promise<void> {
  const existing = await payload.find({
    collection: 'plan-subscription-usages',
    where: {
      and: [
        { subscription: { equals: subscriptionId } },
        { featureCode: { equals: featureCode } },
      ],
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const current = existing.docs[0]
    await payload.update({
      collection: 'plan-subscription-usages',
      id: current.id,
      data: { used: ((current.used as number) ?? 0) + amount },
    })
  } else {
    await payload.create({
      collection: 'plan-subscription-usages',
      data: { subscription: subscriptionId, featureCode, used: amount },
    })
  }
}

/** Decrements usage, floor at 0. Mirrors PW1 SubscriptionUsageManager::reduce(). */
export async function reduceUsage(
  payload: BasePayload,
  subscriptionId: string | number,
  featureCode: string,
  amount = 1,
): Promise<void> {
  const existing = await payload.find({
    collection: 'plan-subscription-usages',
    where: {
      and: [
        { subscription: { equals: subscriptionId } },
        { featureCode: { equals: featureCode } },
      ],
    },
    limit: 1,
  })
  if (!existing.docs.length) return

  const current = existing.docs[0]
  const newUsed = Math.max(0, ((current.used as number) ?? 0) - amount)
  await payload.update({
    collection: 'plan-subscription-usages',
    id: current.id,
    data: { used: newUsed },
  })
}

/** Returns consumed count for a feature, 0 if no record. Mirrors PW1 SubscriptionAbility::consumed(). */
export async function getConsumed(
  payload: BasePayload,
  subscriptionId: string | number,
  featureCode: string,
): Promise<number> {
  const result = await payload.find({
    collection: 'plan-subscription-usages',
    where: {
      and: [
        { subscription: { equals: subscriptionId } },
        { featureCode: { equals: featureCode } },
      ],
    },
    limit: 1,
  })
  return ((result.docs[0]?.used as number) ?? 0)
}

/** Clears all usage records for a subscription (called before plan change). */
export async function clearUsage(
  payload: BasePayload,
  subscriptionId: string | number,
): Promise<void> {
  const existing = await payload.find({
    collection: 'plan-subscription-usages',
    where: { subscription: { equals: subscriptionId } },
    pagination: false,
  })
  await Promise.all(
    existing.docs.map((doc) =>
      payload
        .delete({ collection: 'plan-subscription-usages', id: doc.id })
        .catch((err: unknown) =>
          console.warn('[clearUsage] delete skipped (concurrent upsert?):', (err as Error).message),
        ),
    ),
  )
}

/** Recounts actual staff (non-owner) and upserts staff_limit usage.
 *  Called after clearUsage() on upgrade/downgrade to avoid stuck-at-0 issue.
 *  Uses JS filter (not DB) to avoid Payload array sub-field query over-match pitfall. */
export async function recountStaffUsage(
  payload: BasePayload,
  subscriptionId: string | number,
  tenantId: string | number,
): Promise<void> {
  const staffResult = await payload.find({
    collection: 'users',
    where: { 'tenants.tenant': { equals: tenantId } },
    pagination: false,
  })
  // Filter to non-owner members of this tenant only
  const actualCount = staffResult.docs.filter((u: any) =>
    u.tenants?.some(
      (t: any) =>
        String(t.tenant?.id ?? t.tenant) === String(tenantId) && t.role !== 'owner',
    ),
  ).length
  if (actualCount > 0) {
    await recordUsage(payload, subscriptionId, 'staff_limit', actualCount)
  }
}

/** Upserts the 'main' PlanSubscription for a tenant.
 *  On update: clears usage + recounts staff, syncs Tenants.plan tier.
 *  Note: these 3 steps are not wrapped in a DB transaction — partial failure (e.g. clearUsage
 *  succeeds but recountStaffUsage fails) leaves usage at 0 until next plan event. Acceptable
 *  tradeoff for now; revisit if Payload exposes cross-collection transaction API. */
export async function upsertPlanSubscription(
  payload: BasePayload,
  tenantId: string | number,
  opts: {
    subscriptionCode: string
    subscriptionType?: number | null
    startDate?: string | null
    endDate?: string | null
  },
): Promise<void> {
  const { subscriptionCode, subscriptionType, startDate, endDate } = opts

  const planCode = getPlanCode(subscriptionCode, subscriptionType)
  const startsAt = startDate ? new Date(`${dateOnly(startDate)}T00:00:00Z`).toISOString() : undefined
  const endsAt = endDate ? new Date(`${dateOnly(endDate)}T23:59:59Z`).toISOString() : undefined

  const updateData = {
    plan: planCode,
    status: 'active' as const,
    ...(startsAt && { startsAt }),
    ...(endsAt && { endsAt }),
    canceledAt: null,
    canceledImmediately: false,
    packCode: subscriptionCode.toUpperCase(),
  }

  const subs = await payload.find({
    collection: 'plan-subscriptions',
    where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
    limit: 1,
  })

  if (subs.docs.length > 0) {
    const subId = Number(subs.docs[0].id)
    await payload.update({ collection: 'plan-subscriptions', id: subId, data: updateData })
    await clearUsage(payload, subId)
    await recountStaffUsage(payload, subId, tenantId)
  } else {
    await payload.create({
      collection: 'plan-subscriptions',
      data: {
        tenant: tenantId,
        name: 'main',
        ...updateData,
        // startsAt/endsAt are required — provide fallbacks if SSO omits dates
        startsAt: startsAt ?? new Date().toISOString(),
        endsAt: endsAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
  }

  // Sync Tenants.plan 4-tier field (used by ai/generate-site to gate AI generation for free users)
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { plan: mapPlanCodeToTier(planCode) },
  })
}

// ── Feature Gating ────────────────────────────────────────────────────────────

/** Returns raw feature value for a plan from plan_features table, or null if not found. */
export async function getFeatureValue(
  payload: BasePayload,
  planCode: PlanCode,
  featureCode: string,
): Promise<string | null> {
  const result = await payload.find({
    collection: 'plan-features',
    where: {
      and: [{ planCode: { equals: planCode } }, { featureCode: { equals: featureCode } }],
    },
    limit: 1,
  })
  return ((result.docs[0]?.value as string) ?? null)
}

/** Returns true if plan can use a feature: YES/UNLIMITED or numeric > 0.
 *  Mirrors PW1 SubscriptionAbility::can($feature). */
export async function canUse(
  payload: BasePayload,
  planCode: PlanCode,
  featureCode: string,
): Promise<boolean> {
  const value = await getFeatureValue(payload, planCode, featureCode)
  if (value === null) return false
  if (POSITIVE_VALUES.has(String(value).toUpperCase())) return true
  const num = Number(value)
  return !isNaN(num) && num > 0
}

/** Returns true if usage for a numeric feature has not reached the plan limit.
 *  For YES/UNLIMITED features, always returns true.
 *  For numeric limits, compares consumed count against the plan value.
 *  Distinct from canUse() which only checks that the limit is non-zero. */
export async function canUseWithinLimit(
  payload: BasePayload,
  subscriptionId: string | number,
  planCode: PlanCode,
  featureCode: string,
): Promise<boolean> {
  const value = await getFeatureValue(payload, planCode, featureCode)
  if (value === null) return false
  if (POSITIVE_VALUES.has(String(value).toUpperCase())) return true
  const limit = Number(value)
  if (isNaN(limit) || limit <= 0) return false
  const consumed = await getConsumed(payload, subscriptionId, featureCode)
  return consumed < limit
}

/** Returns whitelist settings JSON for a feature (e.g. template names, payment codes), or null.
 *  Mirrors PW1 SubscriptionAbility::settings($feature). */
export async function getFeatureSettings(
  payload: BasePayload,
  planCode: PlanCode,
  featureCode: string,
): Promise<Record<string, unknown> | null> {
  const result = await payload.find({
    collection: 'plan-features',
    where: {
      and: [{ planCode: { equals: planCode } }, { featureCode: { equals: featureCode } }],
    },
    limit: 1,
  })
  return ((result.docs[0]?.settings as Record<string, unknown> | null) ?? null)
}

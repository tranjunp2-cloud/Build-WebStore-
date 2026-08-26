import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { FeatureCode } from '@/collections/PlanFeatures'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { getCurrentUser } from '@/lib/auth'
import {
  getActivePlanSubscription,
  canUse,
} from '@/lib/subscriptions/plan-subscription'

type RouteHandler = (req: NextRequest, ctx?: any) => Promise<NextResponse>

/** Resolves the owner tenantId from the current session (cookie-based). */
async function getOwnerTenantId(): Promise<number | string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const tenants = (user as any).tenants as Array<{ tenant: unknown }> | undefined
  // Align with handlers: both guard and handler use tenants[0] as the active workspace.
  const entry = tenants?.[0]
  if (!entry) return null
  const ref = entry.tenant
  return typeof ref === 'object' && ref !== null
    ? (ref as { id: number | string }).id
    : ((ref as number | string) ?? null)
}

/**
 * HOF: wraps a route handler with plan subscription + feature check.
 * Returns 401 if unauthenticated, 403 if subscription expired or feature disabled.
 *
 * Usage:
 *   export const POST = withFeatureGuard('website_builder')(withAuth(handler))
 *   export const PATCH = withFeatureGuard('content_management')(withAuth<Ctx>(handler))
 */
export function withFeatureGuard(featureCode: FeatureCode) {
  return (handler: RouteHandler): RouteHandler =>
    async (req, ctx) => {
      const tenantId = await getOwnerTenantId()
      if (!tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
          { status: 401 },
        )
      }

      const payload = await getPayload({ config })
      const sub = await getActivePlanSubscription(payload, tenantId)
      if (!sub) {
        return NextResponse.json(
          { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } },
          { status: 403 },
        )
      }

      const allowed = await canUse(payload, sub.plan as PlanCode, featureCode)
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'FEATURE_LOCKED', message: 'This feature is not available on your current plan' } },
          { status: 403 },
        )
      }

      return handler(req, ctx)
    }
}

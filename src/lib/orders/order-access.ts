import config from '@payload-config'
import { getPayload } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { canUse, getActivePlanSubscription } from '@/lib/subscriptions/plan-subscription'
import { tenantRefId } from '@/lib/sites/site-access'

// Same rule as `requirePermission` (permission-guard.ts) on the Orders pages: legacy full roles, or a custom role holding 'orders'.
const FULL_ACCESS_ROLES = new Set(['owner', 'admin', 'editor', 'viewer'])

/** Whether the user's active membership of this workspace may work on its orders (the Orders pages' own permission). */
export function canManageOrders(user: unknown, tenantId: string): boolean {
    const memberships = (user as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string; permissions?: string[] }> }).tenants ?? []
    const membership = memberships.find((m) => tenantRefId(m.tenant) === String(tenantId) && m.status === 'active')
    if (!membership) return false
    const role = membership.role ?? 'viewer'
    if (FULL_ACCESS_ROLES.has(role)) return true
    return role === 'custom' && Array.isArray(membership.permissions) && membership.permissions.includes('orders')
}

/** Whether the workspace's plan includes order management (the routes' `withFeatureGuard('order_management')`). */
export async function orderManagementAllowed(tenantId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const payload = await getPayload({ config })
    const subscription = await getActivePlanSubscription(payload, tenantId)
    if (!subscription) return { ok: false, message: 'The subscription of this workspace has expired or was not found, so orders can not be changed.' }
    if (!(await canUse(payload, subscription.plan as PlanCode, 'order_management'))) {
        return { ok: false, message: 'Order management is not part of this workspace\'s current plan.' }
    }
    return { ok: true }
}

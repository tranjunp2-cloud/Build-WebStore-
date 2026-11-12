/**
 * Whether a store may serve its public website and take orders (#2179 item 6).
 *
 * PW2 keeps two states apart: a ban sets `tenants.status = 'suspended'` (SSO ban-user, undone by unban-user), while
 * expiry lives on the main plan subscription (`endsAt`, moved by SSO renew). A store is unavailable in either case, so
 * renewing reopens it without any tenant write. No main subscription → available (same rule as session-check).
 */
import type { BasePayload } from 'payload'
import { isSubscriptionActive } from '@/lib/subscriptions/plan-subscription'

/** The fields of the latest `main` plan subscription that decide whether it is still active. */
export type MainSubscriptionState = {
    status: string
    endsAt: string | Date
    canceledAt?: string | Date | null
    canceledImmediately?: boolean | null
}

export const MAIN_SUBSCRIPTION_SELECT = { status: true, endsAt: true, canceledAt: true, canceledImmediately: true } as const

export function isStoreUnavailable(tenantStatus: unknown, subscription: MainSubscriptionState | null | undefined): boolean {
    if (tenantStatus === 'suspended') return true
    return !!subscription && !isSubscriptionActive(subscription)
}

/** Latest `main` subscription of a tenant (one statement, uncached), or null. */
export async function findMainSubscriptionState(payload: BasePayload, tenantId: string | number): Promise<MainSubscriptionState | null> {
    const result = await payload.find({
        collection: 'plan-subscriptions',
        where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
        sort: '-createdAt',
        limit: 1,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: MAIN_SUBSCRIPTION_SELECT,
    })
    return (result.docs[0] as unknown as MainSubscriptionState | undefined) ?? null
}

/** Uncached check for request handlers that already hold the tenant row (checkout, public APIs). */
export async function isTenantUnavailable(payload: BasePayload, tenant: { id: string | number; status?: unknown }): Promise<boolean> {
    if (tenant.status === 'suspended') return true
    return isStoreUnavailable(tenant.status, await findMainSubscriptionState(payload, tenant.id))
}

/** Same check for a site row the route already loaded: reuses a populated `tenant` (with status) instead of re-reading it. */
export async function isSiteDocTenantUnavailable(payload: BasePayload, site: object): Promise<boolean> {
    const ref = (site as { tenant?: unknown }).tenant
    if (ref && typeof ref === 'object' && 'status' in ref) {
        const tenant = ref as { id: string | number; status?: unknown }
        return isTenantUnavailable(payload, tenant)
    }
    const tenantId = ref && typeof ref === 'object' ? (ref as { id?: string | number }).id : ref as string | number | undefined
    return tenantId == null ? false : isTenantIdUnavailable(payload, tenantId)
}

/** Same check keyed by tenant id (public APIs that only receive `tenant`). Unknown tenant → false: the route answers it. */
export async function isTenantIdUnavailable(payload: BasePayload, tenantId: string | number): Promise<boolean> {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true, disableErrors: true, select: { status: true } })
    if (!tenant) return false
    return isTenantUnavailable(payload, { id: tenantId, status: (tenant as { status?: unknown }).status })
}

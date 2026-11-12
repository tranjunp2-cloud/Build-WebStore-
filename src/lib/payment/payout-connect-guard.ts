import { NextResponse } from 'next/server'
import { IMPERSONATION_FORBIDDEN, isMerchantAccessSession } from '@/lib/support/merchant-access-session'

type Membership = { tenant?: unknown; role?: unknown; status?: unknown } | null

/** True for an ACTIVE owner / admin member of the tenant (the only people who may attach a payout destination). */
export function isActiveTenantOwnerOrAdmin(rawUser: unknown, tenantId: unknown): boolean {
    const memberships = ((rawUser as { tenants?: Membership[] } | null)?.tenants ?? []) as Membership[]
    return memberships.some((m) => {
        if (!m) return false
        const t = m.tenant
        const id = t && typeof t === 'object' ? (t as { id?: unknown }).id : t
        return String(id) === String(tenantId)
            && (m.role === 'owner' || m.role === 'admin')
            && (m.status ?? 'active') === 'active'
    })
}

/**
 * Guard for the Stripe / Xendit connect endpoints: refused (403) inside a merchant-access session and for any
 * member who is not an active owner / admin. Returns null when the caller may continue.
 */
export function guardPayoutConnect(
    req: Pick<Request, 'headers'>,
    user: unknown,
    tenantId: unknown,
): NextResponse | null {
    if (isMerchantAccessSession(req)) {
        return NextResponse.json(
            { success: false, error: { code: IMPERSONATION_FORBIDDEN, message: IMPERSONATION_FORBIDDEN } },
            { status: 403 },
        )
    }
    if (!isActiveTenantOwnerOrAdmin(user, tenantId)) {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Only an owner or admin can connect payments' } },
            { status: 403 },
        )
    }
    return null
}

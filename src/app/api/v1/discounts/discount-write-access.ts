import { NextResponse } from 'next/server'
import { extractTenantId } from '@/lib/auth'
import { canAccessArea } from '@/lib/insights/area-access'

const forbidden = (message: string) => NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 })

const refId = (ref: unknown): string | null => {
    const value = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return value == null ? null : String(value)
}

/**
 * Who may create, change or delete a discount code from the dashboard (POST / PUT / DELETE /api/v1/discounts):
 * the same workspace for all three — the dashboard's (`extractTenantId`, the first membership, as the dashboard
 * pages and the copilot's `assertTenant` use) — and that membership must be ACTIVE (`canAccessArea` only counts
 * active ones), hold the Orders permission (Discounts' sidebar permission) and not be a viewer (viewers read only).
 * A platform super-admin keeps Payload's own access rules (the collection lets them edit any workspace's code).
 *
 * Returns the 403 answer, or null when the write may go ahead.
 */
export function discountWriteRefusal(user: unknown): NextResponse | null {
    if ((user as { roles?: string[] } | null)?.roles?.includes('super-admin')) return null
    const tenantId = extractTenantId(user)
    if (!tenantId) return forbidden('No tenant associated with this user')
    if (!canAccessArea(user, tenantId, 'orders')) return forbidden('Your role cannot manage discounts')
    const memberships = (user as { tenants?: Array<{ tenant?: unknown; role?: string; status?: string }> }).tenants ?? []
    const membership = memberships.find((m) => refId(m.tenant) === tenantId && m.status === 'active')
    // like area-access, a membership without a role reads as a viewer
    if ((membership?.role ?? 'viewer') === 'viewer') return forbidden('Viewers cannot change discounts')
    return null
}

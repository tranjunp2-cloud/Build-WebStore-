/**
 * Customer write + order-stat core, shared by the Customers dashboard (server actions) and the copilot's
 * applier. The caller names the workspace (`tenantId`) and, when there is one, the user; every call is checked
 * against that workspace here, so the same code is safe whichever door it comes through.
 */
import config from '@payload-config'
import { getPayload, type User } from 'payload'
import { assertFreshVersion } from '@/lib/save-version/save-version'

export type CustomerActor = { tenantId: string; user?: User | null }
export type CustomerRank = 'bronze' | 'silver' | 'gold' | 'vip'

export const VALID_RANKS: ReadonlySet<string> = new Set(['bronze', 'silver', 'gold', 'vip'])

/** What the Customers page may change. `addresses` is passed through as the page sends it. */
export type CustomerUpdate = {
    name?: string
    rank?: CustomerRank | null
    notes?: string | null
    addresses?: unknown[]
}

/** Throws `Unauthorized` unless the customer belongs to the workspace (the dashboard's own IDOR guard). */
export function assertCustomerTenant(doc: Record<string, unknown>, tenantId: string): void {
    const docTenantId =
        typeof doc.tenant === 'object' && doc.tenant !== null
            ? String((doc.tenant as Record<string, unknown>).id)
            : String(doc.tenant)
    if (docTenantId !== String(tenantId)) throw new Error('Unauthorized')
}

/**
 * The customers page's edit: tenant checked, rank validated, only the given fields written. Returns the saved doc.
 * `expectedUpdatedAt`: the version the page loaded; a customer changed since throws VersionConflictError and nothing is
 * written (read-then-write in this request: a save landing between the check and the update still wins).
 */
export async function updateCustomerAs(actor: CustomerActor, id: number, data: CustomerUpdate, expectedUpdatedAt?: string | null): Promise<Record<string, unknown>> {
    const payload = await getPayload({ config })

    const existing = await payload.findByID({ collection: 'customers', id, depth: 0 })
    assertCustomerTenant(existing as Record<string, unknown>, actor.tenantId)
    assertFreshVersion(expectedUpdatedAt, existing.updatedAt)

    if (data.rank !== undefined && data.rank !== null && !VALID_RANKS.has(data.rank)) {
        throw new Error('Invalid rank value')
    }

    const updated = await payload.update({
        collection: 'customers',
        id,
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.rank !== undefined && { rank: data.rank }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.addresses !== undefined && { addresses: data.addresses as never }),
        },
        depth: 0,
        ...(actor.user ? { user: actor.user } : {}),
    })
    return updated as unknown as Record<string, unknown>
}

/** 2-decimal rounding (prime-web-api parity); 0 when no orders. */
export function rate(numerator: number, count: number): number {
    if (count <= 0) return 0
    return Math.round((numerator / count) * 10000) / 100
}

// One implementation of the order stats (3-column select, TC-PERF-060), shared by the Customers screen and the copilot.
export { fetchCustomerOrderStats, type OrderStats } from '@/lib/customers/customer-order-stats'

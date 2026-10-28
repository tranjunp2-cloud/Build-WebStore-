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

type Cms = Awaited<ReturnType<typeof getPayload>>

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

export type OrderStats = { count: number; total: number; completed: number; cancelled: number }

/** 2-decimal rounding (prime-web-api parity); 0 when no orders. */
export function rate(numerator: number, count: number): number {
    if (count <= 0) return 0
    return Math.round((numerator / count) * 10000) / 100
}

/** Orders per customer for one workspace: count, spend (MYR as stored), completed and cancelled. */
export async function fetchCustomerOrderStats(
    payload: Cms,
    customerIds: number[],
    tenantId: string,
    orderLimit?: number,
): Promise<Map<number, OrderStats>> {
    const map = new Map<number, OrderStats>()
    if (customerIds.length === 0) return map

    // Single-customer detail: 5 000 cap (handles high-volume buyers).
    // List page (25–100 customers): 200×N cap, max 10 000 (fast, accurate for typical stores).
    // Export (up to 1 000 customers): caller passes explicit limit — default to 200×N, max 100 000.
    const defaultLimit = customerIds.length === 1
        ? 5_000
        : Math.min(customerIds.length * 200, 10_000)

    const res = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { customer: { in: customerIds } },
                { tenant: { equals: tenantId } },
            ],
        },
        limit: orderLimit ?? defaultLimit,
        depth: 0,
        overrideAccess: true,
    })

    if (res.totalDocs > res.docs.length) {
        console.warn(
            `[fetchOrderStats] truncated: ${res.docs.length}/${res.totalDocs} orders for ${customerIds.length} customers (limit=${customerIds.length === 1 ? 5_000 : Math.min(customerIds.length * 200, 10_000)})`,
        )
    }

    for (const doc of res.docs) {
        const raw = doc.customer as number | { id: number } | null
        const custId = typeof raw === 'object' && raw !== null ? raw.id : (raw as number)
        if (!custId) continue

        const s = map.get(custId) ?? { count: 0, total: 0, completed: 0, cancelled: 0 }
        s.count++
        s.total += (doc.total as number) ?? 0
        if (doc.status === 'completed') s.completed++
        if (doc.status === 'cancelled') s.cancelled++
        map.set(custId, s)
    }

    return map
}

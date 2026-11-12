import type { getPayload } from 'payload'
import { countsTowardSpending, isFailedOrder } from './customer-spend-rules'

type Cms = Pick<Awaited<ReturnType<typeof getPayload>>, 'find'>

export type OrderStats = { count: number; total: number; completed: number; failed: number }

/** Orders per customer for one workspace: count, spend (MYR as stored), completed and failed (cancelled + payment_failed). Spend follows customer-spend-rules. */
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

    const limit = orderLimit ?? defaultLimit
    // Only the columns used below, one statement (no COUNT): this read whole orders — items array, address
    // groups, payment JSON — up to 10 000 of them for one page of customers (TC-PERF-060).
    const res = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { customer: { in: customerIds } },
                { tenant: { equals: tenantId } },
            ],
        },
        limit,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: { customer: true, total: true, status: true, paymentStatus: true },
    })

    if (res.docs.length >= limit) {
        console.warn(
            `[fetchOrderStats] possibly truncated: read the cap of ${limit} orders for ${customerIds.length} customers`,
        )
    }

    for (const doc of res.docs) {
        const raw = doc.customer as number | { id: number } | null
        const custId = typeof raw === 'object' && raw !== null ? raw.id : (raw as number)
        if (!custId) continue

        const s = map.get(custId) ?? { count: 0, total: 0, completed: 0, failed: 0 }
        s.count++
        if (countsTowardSpending(doc)) s.total += (doc.total as number) ?? 0
        if (doc.status === 'completed') s.completed++
        if (isFailedOrder(doc)) s.failed++
        map.set(custId, s)
    }

    return map
}

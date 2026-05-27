'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { Where } from 'payload'
import { mapCustomer, toCsv } from './_lib/shop-customer-record'
import type { ShopCustomerFilters, UpdateCustomerData } from './_lib/shop-customer-record'

async function requireTenantId(): Promise<string> {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) throw new Error('Unauthorized')
    return tenantId
}

function assertTenantOwnership(doc: Record<string, unknown>, tenantId: string): void {
    const docTenantId =
        typeof doc.tenant === 'object' && doc.tenant !== null
            ? String((doc.tenant as Record<string, unknown>).id)
            : String(doc.tenant)
    if (docTenantId !== tenantId) throw new Error('Unauthorized')
}

function buildCustomerWhere(tenantId: string, filters: ShopCustomerFilters): Where {
    const conditions: Where[] = [{ tenant: { equals: tenantId } }]

    if (filters.search?.trim()) {
        const q = filters.search.trim()
        conditions.push({
            or: [{ email: { like: q } }, { name: { like: q } }, { phone: { like: q } }],
        })
    }

    if (filters.rank && filters.rank !== 'all') {
        if (filters.rank === 'none') {
            conditions.push({ rank: { equals: null } })
        } else {
            conditions.push({ rank: { equals: filters.rank } })
        }
    }

    if (filters.dateFrom) conditions.push({ createdAt: { greater_than_equal: filters.dateFrom } })
    if (filters.dateTo) conditions.push({ createdAt: { less_than_equal: filters.dateTo } })

    return { and: conditions }
}

type OrderStats = { count: number; total: number; completed: number; cancelled: number }

// 2-decimal rounding (prime-web-api parity); 0 when no orders
function rate(numerator: number, count: number): number {
    if (count <= 0) return 0
    return Math.round((numerator / count) * 10000) / 100
}

async function fetchOrderStats(
    payload: Awaited<ReturnType<typeof getPayload>>,
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

export async function getShopCustomersAction(filters: ShopCustomerFilters = {}) {
    const tenantId = await requireTenantId()
    const { page = 1, limit = 25 } = filters
    const safePage = Math.max(1, page)
    const safeLimit = Math.min(100, Math.max(1, limit))

    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
        collection: 'customers',
        where: buildCustomerWhere(tenantId, filters),
        sort: '-createdAt',
        page: safePage,
        limit: safeLimit,
        depth: 0,
    })

    const ids = res.docs.map(d => d.id as number)
    const statsMap = await fetchOrderStats(payload, ids, tenantId)

    const data = res.docs.map(doc => {
        const s = statsMap.get(doc.id as number)
        const completedRate = rate(s?.completed ?? 0, s?.count ?? 0)
        const failedRate = rate(s?.cancelled ?? 0, s?.count ?? 0)
        return mapCustomer(doc as Record<string, unknown>, s?.count ?? 0, s?.total ?? 0, completedRate, failedRate)
    })

    return JSON.parse(
        JSON.stringify({ data, meta: { page: safePage, limit: safeLimit, total: res.totalDocs } }),
    )
}

export async function getShopCustomerDetailAction(id: number) {
    const tenantId = await requireTenantId()
    const payload = await getPayload({ config: configPromise })

    const doc = await payload.findByID({ collection: 'customers', id, depth: 0 })
    assertTenantOwnership(doc as Record<string, unknown>, tenantId)

    const statsMap = await fetchOrderStats(payload, [id], tenantId)
    const s = statsMap.get(id)
    const completedRate = rate(s?.completed ?? 0, s?.count ?? 0)
    const failedRate = rate(s?.cancelled ?? 0, s?.count ?? 0)

    const mapped = mapCustomer(doc as Record<string, unknown>, s?.count ?? 0, s?.total ?? 0, completedRate, failedRate)

    return JSON.parse(JSON.stringify(mapped))
}

const VALID_RANKS = new Set(['bronze', 'silver', 'gold', 'vip'])

export async function updateShopCustomerAction(id: number, data: UpdateCustomerData) {
    const tenantId = await requireTenantId()
    const payload = await getPayload({ config: configPromise })

    const existing = await payload.findByID({ collection: 'customers', id, depth: 0 })
    assertTenantOwnership(existing as Record<string, unknown>, tenantId)

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
            ...(data.addresses !== undefined && { addresses: data.addresses }),
        },
        depth: 0,
    })

    return JSON.parse(JSON.stringify(mapCustomer(updated as Record<string, unknown>)))
}

export async function exportShopCustomersCsvAction(
    filters: Omit<ShopCustomerFilters, 'page' | 'limit'> = {},
) {
    const tenantId = await requireTenantId()
    const payload = await getPayload({ config: configPromise })

    const res = await payload.find({
        collection: 'customers',
        where: buildCustomerWhere(tenantId, filters),
        sort: '-createdAt',
        limit: 1000,
        depth: 0,
        overrideAccess: true, // tenant isolation applied via buildCustomerWhere
    })

    const ids = res.docs.map(d => d.id as number)
    // Export: use a higher order cap (1 000 orders/customer avg) so large tenants
    // get accurate orderCount and lifetime totals in the CSV.
    const statsMap = await fetchOrderStats(payload, ids, tenantId, Math.min(ids.length * 1_000, 100_000))

    // JSON round-trip ensures Payload date fields (Date objects) become ISO strings
    // before toCsv processes them — same pattern used by all other actions.
    const rawRecords = res.docs.map(doc => {
        const s = statsMap.get(doc.id as number)
        const completedRate = rate(s?.completed ?? 0, s?.count ?? 0)
        const failedRate = rate(s?.cancelled ?? 0, s?.count ?? 0)
        return mapCustomer(doc as Record<string, unknown>, s?.count ?? 0, s?.total ?? 0, completedRate, failedRate)
    })
    const records = JSON.parse(JSON.stringify(rawRecords)) as typeof rawRecords

    return {
        csv: toCsv(records),
        truncated: res.totalDocs > res.docs.length,
        total: res.totalDocs,
    }
}

export async function getCustomerOrdersAction(customerId: number, page = 1) {
    const tenantId = await requireTenantId()
    const payload = await getPayload({ config: configPromise })
    const safePage = Math.max(1, page)

    const customer = await payload.findByID({ collection: 'customers', id: customerId, depth: 0 })
    assertTenantOwnership(customer as Record<string, unknown>, tenantId)

    const res = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { customer: { equals: customerId } },
                { tenant: { equals: tenantId } },
            ],
        },
        sort: '-createdAt',
        page: safePage,
        limit: 25,
        depth: 0,
    })

    return JSON.parse(
        JSON.stringify({
            orders: res.docs.map(doc => ({
                id: doc.id as number,
                orderNumber: doc.orderNumber as string,
                status: doc.status as string,
                total: doc.total as number,
                currency: (doc.currency as string) || 'MYR',
                paymentStatus: doc.paymentStatus as string,
                createdAt: doc.createdAt as string,
            })),
            total: res.totalDocs,
            totalPages: res.totalPages,
            page: safePage,
        }),
    )
}

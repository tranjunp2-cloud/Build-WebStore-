'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { Where } from 'payload'
import { sql } from 'drizzle-orm'
import { mapCustomer, toCsv } from './_lib/shop-customer-record'
import type { ShopCustomerFilters, SortKey, UpdateCustomerData } from './_lib/shop-customer-record'
import { isVersionConflict, withVersionGuard } from '@/lib/save-version/save-version'
import { assertCustomerTenant, fetchCustomerOrderStats as fetchOrderStats, rate, updateCustomerAs } from '@/lib/customers/customer-service'

async function requireTenantId(): Promise<string> {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) throw new Error('Unauthorized')
    return tenantId
}

const assertTenantOwnership = assertCustomerTenant

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

// Payload ORM sort prefix uses collection field names (same as DB column names for these 4)
const SORT_COLUMN: Record<Exclude<SortKey, 'orderCount' | 'latestOrderAt'>, string> = {
    email: 'email',
    name: 'name',
    phone: 'phone',
    rank: 'rank',
}

// Exhaustive map → safe to pass to sql.raw
const SQL_DIR = (d: 'asc' | 'desc'): string => (d === 'asc' ? 'ASC' : 'DESC')

const VALID_SORT_KEYS: ReadonlySet<SortKey> = new Set(['email', 'name', 'rank', 'phone', 'orderCount', 'latestOrderAt'])

function resolveSort(filters: ShopCustomerFilters): { key: SortKey; dir: 'asc' | 'desc' } {
    // Runtime guard — Server Actions accept arbitrary POST bodies; TypeScript types don't validate at runtime
    const key = filters.sortBy && VALID_SORT_KEYS.has(filters.sortBy) ? filters.sortBy : 'latestOrderAt'
    const dir = filters.sortDir === 'asc' ? 'asc' : 'desc'
    return { key, dir }
}

// SQL WHERE fragments mirroring buildCustomerWhere for the orderCount path
// tenantId must be an integer string (Payload serial PK, e.g. "1", "42"); UUIDs would throw
function buildCustomerSqlConditions(tenantId: string, filters: ShopCustomerFilters) {
    const tid = parseInt(tenantId, 10)
    if (isNaN(tid)) throw new Error(`Invalid tenantId: ${tenantId}`)
    const parts = [sql`c.tenant_id = ${tid}`]

    if (filters.search?.trim()) {
        const q = `%${filters.search.trim()}%`
        parts.push(sql`(c.email ILIKE ${q} OR c.name ILIKE ${q} OR c.phone ILIKE ${q})`)
    }

    if (filters.rank && filters.rank !== 'all') {
        if (filters.rank === 'none') {
            parts.push(sql`c.rank IS NULL`)
        } else {
            parts.push(sql`c.rank = ${filters.rank}`)
        }
    }

    if (filters.dateFrom) parts.push(sql`c.created_at >= ${filters.dateFrom}`)
    if (filters.dateTo) parts.push(sql`c.created_at <= ${filters.dateTo}`)

    return sql.join(parts, sql` AND `)
}

function rowToCustomerDoc(row: Record<string, unknown>): Record<string, unknown> {
    return {
        id: Number(row.id),
        email: row.email,
        name: row.name,
        phone: row.phone,
        rank: row.rank,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        latestOrderAt: row.latest_order_at,
        firstOrderAt: row.first_order_at,
        addresses: [], // list view doesn't display addresses; detail view uses getShopCustomerDetailAction
    }
}

export async function getShopCustomersAction(filters: ShopCustomerFilters = {}) {
    const tenantId = await requireTenantId()
    const { page = 1, limit = 25 } = filters
    const safePage = Math.max(1, page)
    const safeLimit = Math.min(100, Math.max(1, limit))
    const { key, dir } = resolveSort(filters)

    const payload = await getPayload({ config: configPromise })

    if (key === 'orderCount') {
        // SQL path: LEFT JOIN orders to sort by computed aggregate
        const conds = buildCustomerSqlConditions(tenantId, filters)
        const offset = (safePage - 1) * safeLimit

        const [dataResult, totalResult] = (await Promise.all([
            payload.db.drizzle.execute(sql`
                SELECT c.*,
                    COUNT(o.id)::int AS order_count,
                    COALESCE(SUM(o.total), 0)::numeric AS lifetime,
                    COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int AS completed_count,
                    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END)::int AS cancelled_count
                FROM customers c
                LEFT JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
                WHERE ${conds}
                GROUP BY c.id
                ORDER BY COUNT(o.id) ${sql.raw(SQL_DIR(dir))}, c.id DESC
                LIMIT ${safeLimit} OFFSET ${offset}
            `),
            payload.db.drizzle.execute(sql`
                SELECT COUNT(DISTINCT c.id)::int AS total
                FROM customers c
                WHERE ${conds}
            `),
        ])) as unknown as [{ rows: Array<Record<string, unknown>> }, { rows: Array<{ total: number }> }]

        const data = dataResult.rows.map(row => {
            const doc = rowToCustomerDoc(row)
            const orderCount = (row.order_count as number) ?? 0
            const lifetime = Number(row.lifetime ?? 0)
            const completedCount = (row.completed_count as number) ?? 0
            const cancelledCount = (row.cancelled_count as number) ?? 0
            return mapCustomer(doc, orderCount, lifetime, rate(completedCount, orderCount), rate(cancelledCount, orderCount))
        })

        const total = totalResult.rows[0]?.total ?? 0
        return JSON.parse(JSON.stringify({ data, meta: { page: safePage, limit: safeLimit, total } }))
    }

    if (key === 'latestOrderAt') {
        // Payload ORM cannot express NULLS LAST — both ASC and DESC default to NULLS FIRST on nullable columns.
        // Use SQL to force NULLS LAST so customers with no orders always sort to the bottom.
        const conds = buildCustomerSqlConditions(tenantId, filters)
        const offset = (safePage - 1) * safeLimit
        const latestOrderDir = sql.raw(`${SQL_DIR(dir)} NULLS LAST`)

        const [dataResult, totalResult] = (await Promise.all([
            payload.db.drizzle.execute(sql`
                SELECT c.* FROM customers c
                WHERE ${conds}
                ORDER BY c.latest_order_at ${latestOrderDir}, c.id DESC
                LIMIT ${safeLimit} OFFSET ${offset}
            `),
            payload.db.drizzle.execute(sql`
                SELECT COUNT(*)::int AS total FROM customers c WHERE ${conds}
            `),
        ])) as unknown as [{ rows: Array<Record<string, unknown>> }, { rows: Array<{ total: number }> }]

        const ids = dataResult.rows.map(row => Number(row.id))
        const statsMap = await fetchOrderStats(payload, ids, tenantId)

        const data = dataResult.rows.map(row => {
            const doc = rowToCustomerDoc(row)
            const s = statsMap.get(Number(row.id))
            return mapCustomer(doc, s?.count ?? 0, s?.total ?? 0, rate(s?.completed ?? 0, s?.count ?? 0), rate(s?.cancelled ?? 0, s?.count ?? 0))
        })

        const total = totalResult.rows[0]?.total ?? 0
        return JSON.parse(JSON.stringify({ data, meta: { page: safePage, limit: safeLimit, total } }))
    }

    // Native Payload path: sort on real DB column via Payload ORM
    const sortPrefix = dir === 'desc' ? '-' : ''
    const res = await payload.find({
        collection: 'customers',
        where: buildCustomerWhere(tenantId, filters),
        sort: `${sortPrefix}${SORT_COLUMN[key]}`,
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

/** `expectedUpdatedAt`: the version the page loaded. Stale → `{ ok: false, code: 'VERSION_CONFLICT', current }`, nothing written. */
export async function updateShopCustomerAction(id: number, data: UpdateCustomerData, expectedUpdatedAt?: string | null) {
    const tenantId = await requireTenantId()
    // the write core is shared with the dashboard assistant (lib/customers/customer-service)
    const result = await withVersionGuard(() => updateCustomerAs({ tenantId }, id, data, expectedUpdatedAt))
    return JSON.parse(JSON.stringify(isVersionConflict(result) ? result : mapCustomer(result)))
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

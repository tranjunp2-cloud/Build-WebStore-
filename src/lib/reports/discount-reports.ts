/**
 * Discount-code performance for a period: per code the orders that used it (sales orders only, see
 * `shop-reports.ts` for the definition), their totals, the discount given and the code's state today,
 * against the orders without a code; plus the active codes nobody used. Tenant-scoped SQL.
 */
import { sql } from 'drizzle-orm'
import { computeEffectiveDiscountStatus } from '@/lib/discounts/effective-status'
import { type ReportRange, SHOP_CURRENCY } from './shop-time'
import { type ReportsDb, num, rm, rowsOf, salesStatusList, tenantParam } from './report-db'
import { querySales, rangeBounds } from './shop-reports'

export async function discountPerformanceReport(
    db: ReportsDb,
    input: { tenantId: string | number; range: ReportRange; rankBy: 'revenue' | 'count'; limit: number; now: Date },
) {
    const tenantId = tenantParam(input.tenantId)
    const { from, to } = rangeBounds(input.range)
    const order = input.rankBy === 'count' ? sql`uses DESC, revenue DESC` : sql`revenue DESC, uses DESC`
    const [used, withCodeRows, totals, codes] = await Promise.all([
        rowsOf<Record<string, unknown>>(
            db,
            sql`SELECT UPPER(discount_code) AS code, COUNT(*) AS uses, COALESCE(SUM(discount_amount), 0) AS discount_sen, COALESCE(SUM(total), 0) AS revenue
                FROM orders
                WHERE tenant_id = ${tenantId} AND status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') = 'MYR'
                  AND created_at >= ${from} AND created_at < ${to} AND COALESCE(discount_code, '') <> ''
                GROUP BY UPPER(discount_code)
                ORDER BY ${order}, code
                LIMIT ${input.limit}`,
        ),
        rowsOf<Record<string, unknown>>(
            db,
            sql`SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
                FROM orders
                WHERE tenant_id = ${tenantId} AND status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') = 'MYR'
                  AND created_at >= ${from} AND created_at < ${to} AND COALESCE(discount_code, '') <> ''`,
        ),
        querySales(db, tenantId, input.range),
        rowsOf<Record<string, unknown>>(
            db,
            sql`SELECT code, status, usage_limit, usage_count, starts_at, expires_at FROM discounts WHERE tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 500`,
        ),
    ])
    const byCode = new Map(codes.map((row) => [String(row.code).toUpperCase(), row]))
    const usedCodes = new Set<string>()
    const withCode = num(withCodeRows[0]?.orders)
    const withCodeRevenue = num(withCodeRows[0]?.revenue)
    const withoutCode = Math.max(0, totals.totals.orders - withCode)
    const items = used.map((row) => {
        const code = String(row.code)
        usedCodes.add(code)
        const live = byCode.get(code)
        const uses = num(row.uses)
        const status = live
            ? computeEffectiveDiscountStatus(
                  {
                      status: live.status === 'active' ? 'active' : 'inactive',
                      usageLimit: live.usage_limit == null ? null : num(live.usage_limit),
                      usageCount: num(live.usage_count),
                      startsAt: live.starts_at ? new Date(String(live.starts_at)).toISOString() : null,
                      expiresAt: live.expires_at ? new Date(String(live.expires_at)).toISOString() : null,
                  },
                  input.now,
              )
            : 'deleted'
        return {
            code,
            uses,
            revenue: rm(row.revenue),
            averageOrderValue: uses > 0 ? rm(num(row.revenue) / uses) : null,
            discountGiven: rm(num(row.discount_sen) / 100),
            status,
        }
    })
    const unusedActive = [...byCode.values()]
        .filter((row) => row.status === 'active' && !usedCodes.has(String(row.code).toUpperCase()))
        .slice(0, 10)
        .map((row) => String(row.code))
    return {
        currency: SHOP_CURRENCY,
        rankedBy: input.rankBy,
        note: 'Per code: orders that used it (sales orders only), the order totals, and the discount given. Compare averageOrderValue with ordersWithoutCode.averageOrderValue.',
        ordersWithCode: {
            orders: withCode,
            share: totals.totals.orders > 0 ? Math.round((withCode / totals.totals.orders) * 1000) / 10 : null,
            averageOrderValue: withCode > 0 ? rm(withCodeRevenue / withCode) : null,
        },
        ordersWithoutCode: {
            orders: withoutCode,
            averageOrderValue: withoutCode > 0 ? rm((totals.totals.revenue - withCodeRevenue) / withoutCode) : null,
        },
        allOrders: { orders: totals.totals.orders, revenue: totals.totals.revenue, averageOrderValue: totals.totals.averageOrderValue },
        totalDiscountGiven: totals.totals.discountGiven,
        codes: items,
        ...(unusedActive.length > 0 ? { activeCodesNotUsedInPeriod: unusedActive } : {}),
    }
}

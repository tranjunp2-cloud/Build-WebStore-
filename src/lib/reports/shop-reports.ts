/**
 * Sales reports for the shop: revenue / order count / average order value (with a comparison to the
 * previous period), best-selling products, discount-code performance and orders by status.
 *
 * Definitions (they are returned with every report, the copilot repeats them):
 *  - Sales = orders accepted by the shop and not undone (`SALES_STATUSES`). `pending`, `cancelled`,
 *    `payment_failed` and `refunded` are not sales.
 *  - Money is MYR in ringgit (orders.total). Orders in another currency are counted separately and left out.
 *  - Days are shop days (Asia/Kuala_Lumpur), see `shop-time.ts`.
 *  - `completedRevenue` is the stricter figure (completed orders only), the same kind of number as the dashboard's
 *    At-a-glance revenue card. The card cuts days in UTC and reports in Malaysia time, so for the same dates the two
 *    can differ by the orders placed between 00:00 and 08:00 KL: reports never promise they match the card.
 * Every query is scoped by tenant. Callers decide who may see the numbers (`orders` permission).
 */
import { sql } from 'drizzle-orm'
import { type ReportPeriods, type ReportRange, dayKeysOf, SHOP_CURRENCY, SHOP_TIME_ZONE } from './shop-time'
import { type ReportsDb, num, percentChange, rm, rowsOf, salesStatusList, tenantParam } from './report-db'

export const SALES_DEFINITION =
    'Sales = orders the shop accepted and did not undo (new, paid, confirmed, processing, ready to ship, shipped, completed); pending, cancelled, failed-payment and refunded orders are not counted. Money is MYR (RM), days are Malaysia time. completedRevenue counts completed orders only. The dashboard revenue card also counts completed orders but cuts its days in UTC (not Malaysia time), so it can differ from these numbers by the orders placed between 00:00 and 08:00 Malaysia time; do not tell the merchant the two must match.'

const MAX_DAILY_ROWS = 62

export interface SalesTotals {
    from: string
    to: string
    revenue: number
    orders: number
    averageOrderValue: number | null
    completedRevenue: number
    completedOrders: number
    /** discounts given on those orders, RM */
    discountGiven: number
    /** sales orders in another currency (left out of the money above) */
    otherCurrencyOrders: number
}
export interface SalesDay { date: string; revenue: number; orders: number }

export const rangeBounds = (range: ReportRange) => ({ from: range.start.toISOString(), to: range.end.toISOString() })

export async function querySales(db: ReportsDb, tenantId: number, range: ReportRange): Promise<{ totals: SalesTotals; daily: SalesDay[] }> {
    const { from, to } = rangeBounds(range)
    const rows = await rowsOf<Record<string, unknown>>(
        db,
        sql`SELECT TO_CHAR(created_at AT TIME ZONE ${SHOP_TIME_ZONE}, 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') = 'MYR') AS orders,
              COALESCE(SUM(total) FILTER (WHERE status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') = 'MYR'), 0) AS revenue,
              COUNT(*) FILTER (WHERE status = 'completed' AND COALESCE(currency, 'MYR') = 'MYR') AS completed_orders,
              COALESCE(SUM(total) FILTER (WHERE status = 'completed' AND COALESCE(currency, 'MYR') = 'MYR'), 0) AS completed_revenue,
              COALESCE(SUM(discount_amount) FILTER (WHERE status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') = 'MYR'), 0) AS discount_sen,
              COUNT(*) FILTER (WHERE status IN (${salesStatusList()}) AND COALESCE(currency, 'MYR') <> 'MYR') AS other_currency
            FROM orders
            WHERE tenant_id = ${tenantId} AND created_at >= ${from} AND created_at < ${to}
            GROUP BY 1`,
    )
    let revenue = 0, orders = 0, completedRevenue = 0, completedOrders = 0, discountSen = 0, other = 0
    const byDay = new Map<string, SalesDay>()
    for (const row of rows) {
        revenue += num(row.revenue)
        orders += num(row.orders)
        completedRevenue += num(row.completed_revenue)
        completedOrders += num(row.completed_orders)
        discountSen += num(row.discount_sen)
        other += num(row.other_currency)
        byDay.set(String(row.day), { date: String(row.day), revenue: rm(row.revenue), orders: num(row.orders) })
    }
    const daily = range.days <= MAX_DAILY_ROWS ? dayKeysOf(range).map((date) => byDay.get(date) ?? { date, revenue: 0, orders: 0 }) : []
    return {
        totals: {
            from: range.fromKey,
            to: range.toKey,
            revenue: rm(revenue),
            orders,
            averageOrderValue: orders > 0 ? rm(revenue / orders) : null,
            completedRevenue: rm(completedRevenue),
            completedOrders,
            discountGiven: rm(discountSen / 100),
            otherCurrencyOrders: other,
        },
        daily,
    }
}

export async function salesReport(db: ReportsDb, input: { tenantId: string | number; periods: ReportPeriods; compare: boolean }) {
    const tenantId = tenantParam(input.tenantId)
    const [current, previous] = await Promise.all([
        querySales(db, tenantId, input.periods.current),
        input.compare ? querySales(db, tenantId, input.periods.previous) : Promise.resolve(null),
    ])
    return {
        currency: SHOP_CURRENCY,
        definition: SALES_DEFINITION,
        current: current.totals,
        daily: current.daily,
        ...(previous
            ? {
                  previous: previous.totals,
                  change: {
                      revenuePercent: percentChange(current.totals.revenue, previous.totals.revenue),
                      ordersPercent: percentChange(current.totals.orders, previous.totals.orders),
                      averageOrderValuePercent: percentChange(current.totals.averageOrderValue ?? 0, previous.totals.averageOrderValue ?? 0),
                      revenueDifference: rm(current.totals.revenue - previous.totals.revenue),
                      note: 'A percent of null means the previous period had none to compare with.',
                  },
              }
            : {}),
    }
}

export async function topProductsReport(
    db: ReportsDb,
    input: { tenantId: string | number; range: ReportRange; rankBy: 'revenue' | 'quantity'; limit: number },
) {
    const tenantId = tenantParam(input.tenantId)
    const { from, to } = rangeBounds(input.range)
    const order = input.rankBy === 'quantity' ? sql`quantity DESC, revenue DESC` : sql`revenue DESC, quantity DESC`
    const rows = await rowsOf<Record<string, unknown>>(
        db,
        sql`SELECT i.product_id, MAX(i.product_name) AS name, SUM(i.quantity) AS quantity,
              SUM(i.quantity * i.unit_price) AS revenue, COUNT(DISTINCT o.id) AS orders
            FROM orders_items i
            JOIN orders o ON o.id = i._parent_id
            WHERE o.tenant_id = ${tenantId} AND o.status IN (${salesStatusList()}) AND COALESCE(o.currency, 'MYR') = 'MYR'
              AND o.created_at >= ${from} AND o.created_at < ${to}
            GROUP BY i.product_id, CASE WHEN i.product_id IS NULL THEN i.product_name END
            ORDER BY ${order}, name
            LIMIT ${input.limit}`,
    )
    return {
        currency: SHOP_CURRENCY,
        rankedBy: input.rankBy,
        note: 'Product revenue is unit price x quantity from the orders in the period (before order-level discounts and shipping), variants of a product added together.',
        products: rows.map((row) => ({
            ...(row.product_id != null ? { productId: String(row.product_id) } : {}),
            name: String(row.name ?? ''),
            quantity: num(row.quantity),
            revenue: rm(row.revenue),
            orders: num(row.orders),
        })),
    }
}

export async function ordersByStatusReport(db: ReportsDb, input: { tenantId: string | number; range: ReportRange }) {
    const tenantId = tenantParam(input.tenantId)
    const { from, to } = rangeBounds(input.range)
    const rows = await rowsOf<Record<string, unknown>>(
        db,
        sql`SELECT status, COUNT(*) AS orders,
              COALESCE(SUM(total) FILTER (WHERE COALESCE(currency, 'MYR') = 'MYR'), 0) AS total
            FROM orders
            WHERE tenant_id = ${tenantId} AND created_at >= ${from} AND created_at < ${to}
            GROUP BY status ORDER BY COUNT(*) DESC`,
    )
    return {
        currency: SHOP_CURRENCY,
        note: 'All orders placed in the period by their status right now (money = MYR order totals, whatever the status).',
        orders: rows.reduce((sum, row) => sum + num(row.orders), 0),
        statuses: rows.map((row) => ({ status: String(row.status), orders: num(row.orders), total: rm(row.total) })),
    }
}

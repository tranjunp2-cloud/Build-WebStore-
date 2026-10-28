/**
 * Storefront traffic for a period, counted in SQL (no document cap, unlike the dashboard's chart
 * aggregation which reads at most 5000 events): page views, sessions, the cart / checkout funnel,
 * top pages and top referrers, with the previous period for comparison.
 *
 * Source: the `analytics` events the published storefront sends. They are visitor-side beacons, so
 * they can run below the real order count (blockers, no JavaScript); sales numbers come from orders.
 */
import { sql } from 'drizzle-orm'
import { type ReportPeriods, type ReportRange, SHOP_TIME_ZONE } from './shop-time'
import { type ReportsDb, num, percentChange, rowsOf, tenantParam } from './report-db'

export interface TrafficTotals {
    from: string
    to: string
    pageViews: number
    /** distinct session ids that viewed a page */
    sessions: number
    productClicks: number
    addToCart: number
    checkoutStarted: number
    purchaseEvents: number
}

async function queryTotals(db: ReportsDb, tenantId: number, range: ReportRange): Promise<TrafficTotals> {
    const rows = await rowsOf<Record<string, unknown>>(
        db,
        sql`SELECT event, COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions
            FROM analytics
            WHERE tenant_id = ${tenantId} AND created_at >= ${range.start.toISOString()} AND created_at < ${range.end.toISOString()}
              AND event <> 'local_business_data_saved'
            GROUP BY event`,
    )
    const of = (event: string) => rows.find((row) => row.event === event)
    return {
        from: range.fromKey,
        to: range.toKey,
        pageViews: num(of('pageview')?.events),
        sessions: num(of('pageview')?.sessions),
        productClicks: num(of('click')?.events),
        addToCart: num(of('add_to_cart')?.events),
        checkoutStarted: num(of('checkout')?.events),
        purchaseEvents: num(of('purchase')?.events),
    }
}

export async function trafficReport(db: ReportsDb, input: { tenantId: string | number; periods: ReportPeriods; compare: boolean; limit: number }) {
    const tenantId = tenantParam(input.tenantId)
    const { current } = input.periods
    const window = sql`tenant_id = ${tenantId} AND created_at >= ${current.start.toISOString()} AND created_at < ${current.end.toISOString()}`
    const [totals, previous, pages, referrers] = await Promise.all([
        queryTotals(db, tenantId, current),
        input.compare ? queryTotals(db, tenantId, input.periods.previous) : Promise.resolve(null),
        rowsOf<Record<string, unknown>>(
            db,
            sql`SELECT path, COUNT(*) AS views FROM (
                  SELECT COALESCE(NULLIF(regexp_replace(regexp_replace(split_part(split_part(page_url, '?', 1), '#', 1), '^https?://[^/]+', ''), '(.)/$', '\\1'), ''), '/') AS path
                  FROM analytics WHERE ${window} AND event = 'pageview'
                ) pages GROUP BY path ORDER BY views DESC, path LIMIT ${input.limit}`,
        ),
        rowsOf<Record<string, unknown>>(
            db,
            sql`SELECT domain, COUNT(*) AS visits FROM (
                  SELECT substring(referrer from '^https?://(?:www\\.)?([^/:?#]+)') AS domain
                  FROM analytics WHERE ${window} AND event = 'pageview' AND referrer IS NOT NULL
                ) refs WHERE domain IS NOT NULL AND domain NOT ILIKE '%localhost%' GROUP BY domain ORDER BY visits DESC, domain LIMIT ${input.limit}`,
        ),
    ])
    return {
        timezone: SHOP_TIME_ZONE,
        note: 'Storefront events (page views, clicks, add to cart, checkout). Sessions = distinct visitor sessions that viewed a page. These are browser beacons and can be lower than real orders; use the sales report for orders and revenue.',
        current: totals,
        ...(previous
            ? {
                  previous,
                  change: {
                      pageViewsPercent: percentChange(totals.pageViews, previous.pageViews),
                      sessionsPercent: percentChange(totals.sessions, previous.sessions),
                      addToCartPercent: percentChange(totals.addToCart, previous.addToCart),
                      note: 'A percent of null means the previous period had none to compare with.',
                  },
              }
            : {}),
        topPages: pages.map((row) => ({ path: String(row.path), views: num(row.views) })),
        topReferrers: referrers.map((row) => ({ domain: String(row.domain), visits: num(row.visits) })),
    }
}

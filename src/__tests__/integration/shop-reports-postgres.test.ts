// @vitest-environment node
/**
 * TC-AICP-187 — the report SQL against a real PostgreSQL connection: sales (revenue, orders, AOV,
 * previous-period change, KL day boundaries, tenant scope, MYR only), best sellers, discount-code
 * performance, orders by status and traffic (no 5000-event cap). Runs on session-local TEMP tables that
 * mirror production (helpers/ops-temp-schema.ts), so it never touches application data. Skipped without DATABASE_URI.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createOpsTempSchema } from '../helpers/ops-temp-schema'
import { discountPerformanceReport } from '@/lib/reports/discount-reports'
import { ordersByStatusReport, salesReport, topProductsReport } from '@/lib/reports/shop-reports'
import { resolveReportPeriods } from '@/lib/reports/shop-time'
import { trafficReport } from '@/lib/reports/traffic-reports'

const connectionString = process.env.DATABASE_URI
const T = 7
const OTHER = 8
// 2026-10-22 12:00 in Kuala Lumpur
const NOW = new Date('2026-10-22T04:00:00Z')

describe.skipIf(!connectionString)('[TC-AICP-187] shop reports on PostgreSQL', () => {
    let pool: Pool
    let db: { db: { drizzle: ReturnType<typeof drizzle> } }
    const periods = resolveReportPeriods({ period: 'last_7_days' }, NOW)

    beforeAll(async () => {
        pool = new Pool({ connectionString, ssl: false, max: 1 })
        db = { db: { drizzle: drizzle(pool) } }
        await createOpsTempSchema(pool)
    }, 15_000)
    afterAll(async () => {
        await pool?.end()
    })

    beforeEach(async () => {
        await pool.query('TRUNCATE orders, orders_items, discounts, analytics RESTART IDENTITY')
        // current period = KL 2026-10-16 .. 2026-10-22 (UTC 10-15T16:00 .. 10-22T16:00), previous = 10-09 .. 10-15
        await pool.query(`
            INSERT INTO orders (tenant_id, status, currency, total, discount_code, discount_amount, created_at) VALUES
              (${T}, 'completed', 'MYR', 100.00, 'RAYA10', 1000, '2026-10-20T10:00:00Z'),
              (${T}, 'shipped',   'MYR',  50.50, NULL,      NULL, '2026-10-22T01:00:00Z'),
              (${T}, 'paid',      NULL,   49.50, 'raya10',   500, '2026-10-15T17:00:00Z'),
              (${T}, 'pending',   'MYR', 999.00, NULL,      NULL, '2026-10-21T01:00:00Z'),
              (${T}, 'cancelled', 'MYR', 888.00, NULL,      NULL, '2026-10-21T02:00:00Z'),
              (${T}, 'completed', 'USD',  77.00, NULL,      NULL, '2026-10-21T03:00:00Z'),
              (${T}, 'refunded',  'MYR',  66.00, NULL,      NULL, '2026-10-21T04:00:00Z'),
              (${T}, 'completed', 'MYR',  11.00, NULL,      NULL, '2026-10-22T16:00:00Z'),
              (${T}, 'completed', 'MYR', 200.00, NULL,      NULL, '2026-10-10T05:00:00Z'),
              (${T}, 'confirmed', 'MYR', 100.00, NULL,      NULL, '2026-10-15T15:59:59Z'),
              (${OTHER}, 'completed', 'MYR', 5000.00, 'RAYA10', 100, '2026-10-20T10:00:00Z');
            INSERT INTO orders_items (_parent_id, product_id, product_name, quantity, unit_price) VALUES
              (1, 11, 'Batik Scarf', 2, 30), (1, 12, 'Mug', 1, 40),
              (2, 11, 'Batik Scarf', 1, 30), (2, NULL, 'Custom Item', 1, 20.50),
              (3, 12, 'Mug', 1, 49.50),
              (4, 13, 'Pending Thing', 100, 9.99), (11, 11, 'Batik Scarf', 50, 100);
            INSERT INTO discounts (tenant_id, code, status, usage_limit, usage_count, expires_at) VALUES
              (${T}, 'RAYA10', 'active', 100, 2, '2026-12-31T15:59:59Z'),
              (${T}, 'UNUSED5', 'active', NULL, 0, NULL),
              (${T}, 'OFF1', 'inactive', NULL, 0, NULL),
              (${OTHER}, 'THEIRS', 'active', NULL, 0, NULL);
            INSERT INTO analytics (tenant_id, event, page_url, referrer, session_id, created_at) VALUES
              (${T}, 'pageview', 'https://shop.example/', 'https://www.google.com/search?q=x', 's1', '2026-10-20T01:00:00Z'),
              (${T}, 'pageview', '/', 'https://www.google.com/', 's1', '2026-10-20T01:05:00Z'),
              (${T}, 'pageview', 'https://shop.example/products/mug?utm=x', 'https://facebook.com/', 's2', '2026-10-21T01:00:00Z'),
              (${T}, 'pageview', '/products/mug/', NULL, 's3', '2026-10-21T02:00:00Z'),
              (${T}, 'pageview', '/about#team', 'localhost:3000', 's3', '2026-10-21T03:00:00Z'),
              (${T}, 'click', '/products/mug', NULL, 's2', '2026-10-21T01:01:00Z'),
              (${T}, 'add_to_cart', '/products/mug', NULL, 's2', '2026-10-21T01:02:00Z'),
              (${T}, 'add_to_cart', '/products/mug', NULL, 's3', '2026-10-21T02:02:00Z'),
              (${T}, 'checkout', '/checkout', NULL, 's2', '2026-10-21T01:03:00Z'),
              (${T}, 'purchase', '/thanks', NULL, 's2', '2026-10-21T01:04:00Z'),
              (${T}, 'local_business_data_saved', '/editor', NULL, 's9', '2026-10-21T01:04:00Z'),
              (${T}, 'pageview', '/', NULL, 's0', '2026-10-12T01:00:00Z'),
              (${T}, 'pageview', '/', NULL, 's0', '2026-10-12T02:00:00Z'),
              (${OTHER}, 'pageview', '/', NULL, 'x', '2026-10-21T01:00:00Z');
        `)
    })

    it('sums sales in KL days, MYR only, scoped to the tenant, and compares with the previous period', async () => {
        const report = await salesReport(db, { tenantId: T, periods, compare: true })

        // paid order at 2026-10-15T17:00Z is KL 10-16 (in); pending / cancelled / refunded / USD / next-day orders are out
        expect(report.current).toMatchObject({ from: '2026-10-16', to: '2026-10-22', revenue: 200, orders: 3, averageOrderValue: 66.67, completedRevenue: 100, completedOrders: 1, discountGiven: 15, otherCurrencyOrders: 1 })
        expect(report.previous).toMatchObject({ from: '2026-10-09', to: '2026-10-15', revenue: 300, orders: 2, averageOrderValue: 150 })
        expect(report.change).toMatchObject({ revenuePercent: -33.3, ordersPercent: 50, averageOrderValuePercent: -55.6, revenueDifference: -100 })
        expect(report.daily).toHaveLength(7)
        expect(report.daily.find((d) => d.date === '2026-10-16')).toEqual({ date: '2026-10-16', revenue: 49.5, orders: 1 })
        expect(report.daily.find((d) => d.date === '2026-10-20')).toEqual({ date: '2026-10-20', revenue: 100, orders: 1 })
        expect(report.daily.find((d) => d.date === '2026-10-22')).toEqual({ date: '2026-10-22', revenue: 50.5, orders: 1 })
        expect(report.definition).toContain('pending, cancelled, failed-payment and refunded orders are not counted')
    })

    it('reports zero for an empty shop (nothing to compare with = null) and a drop to zero as -100%', async () => {
        const none = await salesReport(db, { tenantId: 99, periods, compare: true })
        const first = await salesReport(db, { tenantId: T, periods: resolveReportPeriods({ period: 'yesterday' }, NOW), compare: true })

        expect(none.current).toMatchObject({ revenue: 0, orders: 0, averageOrderValue: null })
        expect(none.change?.revenuePercent).toBeNull()
        // yesterday (10-21) had only unaccepted / foreign-currency orders; the day before had one sale
        expect(first.current).toMatchObject({ orders: 0, revenue: 0, averageOrderValue: null, otherCurrencyOrders: 1 })
        expect(first.previous).toMatchObject({ from: '2026-10-20', orders: 1, revenue: 100 })
        expect(first.change).toMatchObject({ revenuePercent: -100, averageOrderValuePercent: -100 })
        expect(await salesReport(db, { tenantId: T, periods, compare: false })).not.toHaveProperty('previous')
    })

    it('ranks best sellers by revenue or units, from sales orders of this tenant only', async () => {
        const byRevenue = await topProductsReport(db, { tenantId: T, range: periods.current, rankBy: 'revenue', limit: 5 })
        const byUnits = await topProductsReport(db, { tenantId: T, range: periods.current, rankBy: 'quantity', limit: 2 })

        expect(byRevenue.products).toEqual([
            { productId: '11', name: 'Batik Scarf', quantity: 3, revenue: 90, orders: 2 },
            { productId: '12', name: 'Mug', quantity: 2, revenue: 89.5, orders: 2 },
            { name: 'Custom Item', quantity: 1, revenue: 20.5, orders: 1 },
        ])
        expect(byUnits.products.map((p) => p.name)).toEqual(['Batik Scarf', 'Mug'])
    })

    it('measures each discount code: uses, revenue, discount given, status, and codes nobody used', async () => {
        const report = await discountPerformanceReport(db, { tenantId: T, range: periods.current, rankBy: 'revenue', limit: 5, now: NOW })

        expect(report.codes).toEqual([{ code: 'RAYA10', uses: 2, revenue: 149.5, averageOrderValue: 74.75, discountGiven: 15, status: 'active' }])
        expect(report.ordersWithCode).toEqual({ orders: 2, share: 66.7, averageOrderValue: 74.75 })
        expect(report.ordersWithoutCode).toEqual({ orders: 1, averageOrderValue: 50.5 })
        expect(report.totalDiscountGiven).toBe(15)
        expect(report.activeCodesNotUsedInPeriod).toEqual(['UNUSED5'])
    })

    it('counts orders by status for the period, with MYR totals', async () => {
        const report = await ordersByStatusReport(db, { tenantId: T, range: periods.current })

        expect(report.orders).toBe(7)
        expect(report.statuses.find((s) => s.status === 'completed')).toEqual({ status: 'completed', orders: 2, total: 100 })
        expect(report.statuses.find((s) => s.status === 'pending')).toEqual({ status: 'pending', orders: 1, total: 999 })
    })

    it('counts traffic in SQL: views, sessions, funnel events, normalized top pages and referrers, previous period', async () => {
        const report = await trafficReport(db, { tenantId: T, periods, compare: true, limit: 5 })

        expect(report.current).toMatchObject({ pageViews: 5, sessions: 3, productClicks: 1, addToCart: 2, checkoutStarted: 1, purchaseEvents: 1 })
        expect(report.previous).toMatchObject({ pageViews: 2, sessions: 1 })
        expect(report.change).toMatchObject({ pageViewsPercent: 150, sessionsPercent: 200 })
        expect(report.topPages).toEqual([
            { path: '/', views: 2 },
            { path: '/products/mug', views: 2 },
            { path: '/about', views: 1 },
        ])
        expect(report.topReferrers).toEqual([
            { domain: 'google.com', visits: 2 },
            { domain: 'facebook.com', visits: 1 },
        ])
    })

    it('is not capped at 5000 events', async () => {
        await pool.query(`
            INSERT INTO analytics (tenant_id, event, page_url, session_id, created_at)
            SELECT ${T}, 'pageview', '/bulk', 'b' || (g % 50), '2026-10-21T05:00:00Z' FROM generate_series(1, 6000) g`)

        const report = await trafficReport(db, { tenantId: T, periods, compare: false, limit: 3 })

        expect(report.current.pageViews).toBe(6005)
        expect(report.topPages[0]).toEqual({ path: '/bulk', views: 6000 })
    })
})

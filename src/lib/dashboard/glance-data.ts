/**
 * At-a-glance metrics for the revamp dashboard.
 * All date boundaries and daily series use the shared UTC dashboard contract.
 * Server-side source for pageview/click/checkout counts, revenue, and daily series.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { tenantIdForQuery } from '@/lib/auth'
import type { DashboardPeriodKey, GlanceData } from './dashboard-types'
import { dashboardDayKey, getDashboardPeriodRange } from './dashboard-period'
import { DASHBOARD_TIME_ZONE } from './timezone'
import { canReadPendingOrders } from './pending-orders-data'

interface MetricRow {
    date_str: string
    count: string | number
}

const finiteNumber = (value: number): number => Number.isFinite(value) ? value : 0

const pctChange = (curr: number, prev: number) => {
    const change = prev === 0
        ? (curr === 0 ? 0 : 100)
        : ((curr - prev) / prev) * 100
    return finiteNumber(change)
}

const isMetricRow = (row: unknown): row is MetricRow => {
    if (!row || typeof row !== 'object') return false
    const candidate = row as { date_str?: unknown; count?: unknown }
    return typeof candidate.date_str === 'string'
        && (typeof candidate.count === 'string' || typeof candidate.count === 'number')
}

const metricRows = (result: unknown): MetricRow[] => {
    const rows = (result as { rows?: unknown[] } | null)?.rows
    return Array.isArray(rows) ? rows.filter(isMetricRow) : []
}

const metricValue = (value: string | number): number => {
    return finiteNumber(Number(value))
}

/** Empty-state glance payload (zeroed) — used when there is no tenant/usable site. */
export function emptyGlanceData(): GlanceData {
    const zero = { value: 0, delta: 0 }
    return {
        rangeLabel: '',
        stats: {
            views: { ...zero },
            leads: { ...zero },
            engage: { ...zero },
            revenue: { ...zero, currency: true },
        },
        sparks: { views: [], leads: [], engage: [], revenue: [] },
    }
}

export async function getGlanceData(period: DashboardPeriodKey, { user }: { user: unknown }): Promise<GlanceData> {
    const tenantId = tenantIdForQuery(user)
    if (!tenantId) return emptyGlanceData()

    const {
        rangeLabel,
        currentStart,
        currentEnd,
        previousStart,
        dayKeys,
    } = getDashboardPeriodRange(period)

    const payload = await getPayload({ config })

    const countWhere = (event: { equals?: string; in?: string[] }, from: string, to: string) => ({
        tenant: { equals: tenantId },
        createdAt: { greater_than_equal: from, less_than: to },
        event,
    })

    const currentStartISO = currentStart.toISOString()
    const currentEndISO = currentEnd.toISOString()
    const previousStartISO = previousStart.toISOString()
    const currentStartKey = dashboardDayKey(currentStart)

    const revenueSeriesPromise = () => canReadPendingOrders(user)
        ? payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status = 'completed' AND COALESCE(currency, 'MYR') = 'MYR' AND created_at >= ${previousStartISO} AND created_at < ${currentEndISO} GROUP BY 1`)
        : Promise.resolve({ rows: [] })

    const [
        viewsRes, prevViewsRes, leadsRes, prevLeadsRes, engageRes, prevEngageRes,
        viewsSeriesRes, leadsSeriesRes, engageSeriesRes, revenueSeriesRes,
    ] = await Promise.all([
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'pageview' }, currentStartISO, currentEndISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'pageview' }, previousStartISO, currentStartISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'click' }, currentStartISO, currentEndISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'click' }, previousStartISO, currentStartISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ in: ['add_to_cart', 'checkout'] }, currentStartISO, currentEndISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ in: ['add_to_cart', 'checkout'] }, previousStartISO, currentStartISO) }),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${currentStartISO} AND created_at < ${currentEndISO} GROUP BY 1`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'click' AND created_at >= ${currentStartISO} AND created_at < ${currentEndISO} GROUP BY 1`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event IN ('add_to_cart', 'checkout') AND created_at >= ${currentStartISO} AND created_at < ${currentEndISO} GROUP BY 1`),
        revenueSeriesPromise(),
    ])

    const views = viewsRes.totalDocs
    const leads = leadsRes.totalDocs
    const engage = engageRes.totalDocs
    const revenueRows = metricRows(revenueSeriesRes)
    const revenue = finiteNumber(revenueRows
        .filter(row => row.date_str >= currentStartKey)
        .reduce((total, row) => total + metricValue(row.count), 0))
    const prevRevenue = finiteNumber(revenueRows
        .filter(row => row.date_str < currentStartKey)
        .reduce((total, row) => total + metricValue(row.count), 0))

    const seriesValues = (result: unknown): number[] => {
        const map = new Map<string, number>()
        metricRows(result).forEach(row => map.set(row.date_str, metricValue(row.count)))
        return dayKeys.map(dayKey => map.get(dayKey) ?? 0)
    }

    return {
        rangeLabel,
        stats: {
            views: { value: views, delta: pctChange(views, prevViewsRes.totalDocs) },
            leads: { value: leads, delta: pctChange(leads, prevLeadsRes.totalDocs) },
            engage: { value: engage, delta: pctChange(engage, prevEngageRes.totalDocs) },
            revenue: { value: revenue, delta: pctChange(revenue, prevRevenue), currency: true },
        },
        sparks: {
            views: seriesValues(viewsSeriesRes),
            leads: seriesValues(leadsSeriesRes),
            engage: seriesValues(engageSeriesRes),
            revenue: seriesValues(revenueSeriesRes),
        },
    }
}

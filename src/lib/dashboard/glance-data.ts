/**
 * At-a-glance metrics for the revamp dashboard.
 * All date boundaries and daily series use the shared UTC dashboard contract.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getCurrentTenantId } from '@/lib/auth'
import type { DashboardPeriodKey, GlanceData } from './dashboard-types'
import { dashboardDayKey, getDashboardPeriodRange } from './dashboard-period'
import { DASHBOARD_TIME_ZONE } from './timezone'

interface MetricRow {
    date_str: string
    count: string | number
}

const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100
    return ((curr - prev) / prev) * 100
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
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : 0
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

export async function getGlanceData(period: DashboardPeriodKey): Promise<GlanceData> {
    const tenantId = await getCurrentTenantId()
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
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status = 'completed' AND COALESCE(currency, 'MYR') = 'MYR' AND created_at >= ${previousStartISO} AND created_at < ${currentEndISO} GROUP BY 1`),
    ])

    const views = viewsRes.totalDocs
    const leads = leadsRes.totalDocs
    const engage = engageRes.totalDocs
    const revenueRows = metricRows(revenueSeriesRes)
    const revenue = revenueRows
        .filter(row => row.date_str >= currentStartKey)
        .reduce((total, row) => total + metricValue(row.count), 0)
    const prevRevenue = revenueRows
        .filter(row => row.date_str < currentStartKey)
        .reduce((total, row) => total + metricValue(row.count), 0)

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

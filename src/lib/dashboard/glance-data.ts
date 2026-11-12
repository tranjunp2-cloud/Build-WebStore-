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

type AnalyticsMetric = 'views' | 'leads' | 'engage'
interface AnalyticsDayRow { dateStr: string; isCurrent: boolean; views: number; leads: number; engage: number }

/** Rows of the one analytics aggregate: (day, current-window flag) → the three event counts. */
const analyticsDayRows = (result: unknown): AnalyticsDayRow[] => {
    const rows = (result as { rows?: unknown[] } | null)?.rows
    if (!Array.isArray(rows)) return []
    return rows.flatMap((raw) => {
        const row = raw as { date_str?: unknown; is_current?: unknown; views?: unknown; leads?: unknown; engage?: unknown } | null
        if (!row || typeof row.date_str !== 'string') return []
        const num = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? metricValue(value) : 0)
        return [{
            dateStr: row.date_str,
            isCurrent: row.is_current === true || row.is_current === 't' || row.is_current === 'true',
            views: num(row.views),
            leads: num(row.leads),
            engage: num(row.engage),
        }]
    })
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

    const currentStartISO = currentStart.toISOString()
    const currentEndISO = currentEnd.toISOString()
    const previousStartISO = previousStart.toISOString()
    const currentStartKey = dashboardDayKey(currentStart)

    const revenueSeriesPromise = () => canReadPendingOrders(user)
        ? payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status = 'completed' AND COALESCE(currency, 'MYR') = 'MYR' AND created_at >= ${previousStartISO} AND created_at < ${currentEndISO} GROUP BY 1`)
        : Promise.resolve({ rows: [] })

    // Views / leads / engagement: totals for both windows and the current window's daily series in ONE statement
    // over [previousStart, currentEnd), one row per (day, window). This was 6 COUNTs + 3 daily GROUP BYs over the
    // same rows, 9 pool connections at once per dashboard view (TC-PERF-057).
    const [analyticsRes, revenueSeriesRes] = await Promise.all([
        // grouped on date_trunc (cheap per row), formatted once per day; served by analytics_tenant_created_idx
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(day, 'YYYY-MM-DD') as date_str, is_current, COUNT(*) FILTER (WHERE event = 'pageview') as views, COUNT(*) FILTER (WHERE event = 'click') as leads, COUNT(*) FILTER (WHERE event IN ('add_to_cart', 'checkout')) as engage FROM (SELECT date_trunc('day', created_at AT TIME ZONE ${DASHBOARD_TIME_ZONE}) as day, (created_at >= ${currentStartISO}) as is_current, event FROM analytics WHERE tenant_id = ${tenantId} AND event IN ('pageview', 'click', 'add_to_cart', 'checkout') AND created_at >= ${previousStartISO} AND created_at < ${currentEndISO}) events GROUP BY day, is_current`),
        revenueSeriesPromise(),
    ])

    const analyticsRows = analyticsDayRows(analyticsRes)
    const totalOf = (metric: AnalyticsMetric, current: boolean) => finiteNumber(analyticsRows
        .filter(row => row.isCurrent === current)
        .reduce((total, row) => total + row[metric], 0))
    const views = totalOf('views', true)
    const leads = totalOf('leads', true)
    const engage = totalOf('engage', true)
    const analyticsSeries = (metric: AnalyticsMetric): number[] => {
        const map = new Map<string, number>()
        analyticsRows.filter(row => row.isCurrent).forEach(row => map.set(row.dateStr, (map.get(row.dateStr) ?? 0) + row[metric]))
        return dayKeys.map(dayKey => map.get(dayKey) ?? 0)
    }
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
            views: { value: views, delta: pctChange(views, totalOf('views', false)) },
            leads: { value: leads, delta: pctChange(leads, totalOf('leads', false)) },
            engage: { value: engage, delta: pctChange(engage, totalOf('engage', false)) },
            revenue: { value: revenue, delta: pctChange(revenue, prevRevenue), currency: true },
        },
        sparks: {
            views: analyticsSeries('views'),
            leads: analyticsSeries('leads'),
            engage: analyticsSeries('engage'),
            revenue: seriesValues(revenueSeriesRes),
        },
    }
}

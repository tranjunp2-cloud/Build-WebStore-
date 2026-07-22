/**
 * At-a-glance metrics for the revamp dashboard.
 * Server-side source for pageview/click/checkout counts, revenue, and daily series.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { startOfDay, subDays, eachDayOfInterval, format } from 'date-fns'
import { sql } from 'drizzle-orm'
import { getCurrentTenantId } from '@/lib/auth'
import type { DashboardPeriodKey, GlanceData } from './dashboard-types'

interface MetricRow {
    date_str: string
    count: string | number
}

interface OrderTotal {
    total?: number | null
}

const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100
    return ((curr - prev) / prev) * 100
}

/** Build just the date-range string (client handles the "Daily ·" / "Hourly ·" prefix via i18n). */
const periodMeta = (period: DashboardPeriodKey, now: Date): { rangeLabel: string } => {
    if (period === 'today') return { rangeLabel: format(now, 'd MMM yyyy') }
    const days = period === '30d' ? 30 : 7
    const start = subDays(startOfDay(now), days - 1)
    const sameMonthYear = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear()
    const startLabel = sameMonthYear ? format(start, 'd') : format(start, 'd MMM')
    return { rangeLabel: `${startLabel} – ${format(now, 'd MMM yyyy')}` }
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

    const now = new Date()
    const { rangeLabel } = periodMeta(period, now)
    const daysDiff = period === 'today' ? 1 : period === '30d' ? 30 : 7
    const startDate = period === 'today' ? startOfDay(now) : subDays(startOfDay(now), daysDiff)
    const prevStartDate = subDays(startDate, daysDiff)

    const payload = await getPayload({ config })

    const countWhere = (event: { equals?: string; in?: string[] }, from: string, to?: string) => ({
        tenant: { equals: tenantId },
        createdAt: to
            ? { greater_than_equal: from, less_than: to }
            : { greater_than_equal: from },
        event,
    })

    const startISO = startDate.toISOString()
    const prevISO = prevStartDate.toISOString()

    const [
        viewsRes, prevViewsRes, leadsRes, prevLeadsRes, engageRes, prevEngageRes,
        ordersRes, prevOrdersRes,
        viewsSeriesRes, leadsSeriesRes, engageSeriesRes, revenueSeriesRes,
    ] = await Promise.all([
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'pageview' }, startISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'pageview' }, prevISO, startISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'click' }, startISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ equals: 'click' }, prevISO, startISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ in: ['add_to_cart', 'checkout'] }, startISO) }),
        payload.count({ collection: 'analytics', where: countWhere({ in: ['add_to_cart', 'checkout'] }, prevISO, startISO) }),
        payload.find({ collection: 'orders', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startISO }, status: { in: ['paid', 'completed'] } }, limit: 2000 }),
        payload.find({ collection: 'orders', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevISO, less_than: startISO }, status: { in: ['paid', 'completed'] } }, limit: 2000 }),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${startISO} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'click' AND created_at >= ${startISO} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event IN ('add_to_cart', 'checkout') AND created_at >= ${startISO} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status IN ('paid', 'completed') AND created_at >= ${startISO} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
    ])

    const views = viewsRes.totalDocs
    const leads = leadsRes.totalDocs
    const engage = engageRes.totalDocs
    let revenue = 0
    ordersRes.docs.forEach((d: unknown) => { const o = d as OrderTotal; if (o.total) revenue += o.total })
    let prevRevenue = 0
    prevOrdersRes.docs.forEach((d: unknown) => { const o = d as OrderTotal; if (o.total) prevRevenue += o.total })

    const days = eachDayOfInterval({ start: startDate, end: now })
    const seriesValues = (res: { rows?: MetricRow[] }): number[] => {
        const map = new Map<string, number>()
        res.rows?.forEach(r => map.set(r.date_str, Number(r.count || 0)))
        return days.map(d => map.get(format(d, 'yyyy-MM-dd')) || 0)
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
            views: seriesValues(viewsSeriesRes as unknown as { rows?: MetricRow[] }),
            leads: seriesValues(leadsSeriesRes as unknown as { rows?: MetricRow[] }),
            engage: seriesValues(engageSeriesRes as unknown as { rows?: MetricRow[] }),
            revenue: seriesValues(revenueSeriesRes as unknown as { rows?: MetricRow[] }),
        },
    }
}

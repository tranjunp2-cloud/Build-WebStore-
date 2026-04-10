import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { startOfDay, subDays, eachDayOfInterval, format } from 'date-fns'
import { sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { cacheGet, cacheSet } from '@/lib/cache'

interface MetricRow { date_str: string; count: string | number }
interface OrderTotal { total?: number | null }

function getChange(curr: number, prev: number) {
    if (prev === 0) return curr === 0 ? 0 : 100
    return ((curr - prev) / prev) * 100
}

/**
 * GET /api/dashboard/summary?period=7d
 * Returns dashboard metrics, series, pending orders, and SEO score.
 * Used for client-side refresh without full page reload.
 */
export const GET = withAuth(async (user, request) => {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    const tenants = (user as any).tenants
    if (!tenants?.length) {
        return NextResponse.json({ success: false, error: 'No tenant' }, { status: 403 })
    }
    const tenantId = typeof tenants[0].tenant === 'string' ? tenants[0].tenant : tenants[0].tenant?.id
    if (!tenantId) return NextResponse.json({ success: false, error: 'No tenant' }, { status: 403 })

    // Check cache
    const cacheKey = `dashboard:${tenantId}:${period}`
    const cached = cacheGet<any>(cacheKey)
    if (cached) {
        return NextResponse.json({ success: true, data: cached }, {
            headers: { 'Cache-Control': 'private, max-age=60' }
        })
    }

    const payload = await getPayload({ config })

    const now = new Date()
    let startDate = subDays(startOfDay(now), 7)
    let daysDiff = 7
    if (period === 'today') { startDate = startOfDay(now); daysDiff = 1 }
    if (period === '30d') { startDate = subDays(startOfDay(now), 30); daysDiff = 30 }
    const prevStartDate = subDays(startDate, daysDiff)

    let views = 0, prevViews = 0, leads = 0, engagement = 0, revenue = 0
    let viewsChange = 0, leadsChange = 0, engagementChange = 0, revenueChange = 0

    const [
        viewsRes, prevViewsRes, leadsRes, prevLeadsRes, engagementRes, prevEngagementRes,
        ordersRes, prevOrdersRes, pendingOrdersRes,
        viewsSeriesRes, leadsSeriesRes, engagementSeriesRes, revenueSeriesRes
    ] = await Promise.all([
        payload.db.drizzle.execute(sql`SELECT COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${startDate.toISOString()}`),
        payload.db.drizzle.execute(sql`SELECT COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${prevStartDate.toISOString()} AND created_at < ${startDate.toISOString()}`),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { equals: 'click' } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, event: { equals: 'click' } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { in: ['add_to_cart', 'checkout'] } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, event: { in: ['add_to_cart', 'checkout'] } } }),
        payload.find({ collection: 'orders', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, status: { in: ['paid', 'completed'] } }, limit: 2000 }),
        payload.find({ collection: 'orders', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, status: { in: ['paid', 'completed'] } }, limit: 2000 }),
        payload.find({ collection: 'orders', where: { tenant: { equals: tenantId }, status: { equals: 'pending' } }, sort: '-createdAt', limit: 5 }),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'click' AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event IN ('add_to_cart', 'checkout') AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
        payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status IN ('paid', 'completed') AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`)
    ])

    views = Number(viewsRes.rows[0]?.count || 0)
    prevViews = Number(prevViewsRes.rows[0]?.count || 0)
    viewsChange = getChange(views, prevViews)
    leads = leadsRes.totalDocs
    leadsChange = getChange(leads, prevLeadsRes.totalDocs)
    engagement = engagementRes.totalDocs
    engagementChange = getChange(engagement, prevEngagementRes.totalDocs)

    ordersRes.docs.forEach((d: any) => { if (d.total) revenue += d.total })
    let prevRevenue = 0
    prevOrdersRes.docs.forEach((d: any) => { if (d.total) prevRevenue += d.total })
    revenueChange = getChange(revenue, prevRevenue)

    // Process timeseries
    const days = eachDayOfInterval({ start: startDate, end: now })
    const processSeries = (res: any) => {
        const dataMap = new Map<string, number>()
        if (res.rows) res.rows.forEach((r: MetricRow) => dataMap.set(r.date_str, Number(r.count || 0)))
        return days.map(d => ({ date: format(d, 'yyyy-MM-dd'), value: dataMap.get(format(d, 'yyyy-MM-dd')) || 0 }))
    }

    const result = {
        metrics: {
            views, leads, engagement, revenue,
            viewsChange, leadsChange, engagementChange, revenueChange,
            pendingOrdersCount: pendingOrdersRes.totalDocs,
        },
        pendingOrders: pendingOrdersRes.docs,
        series: {
            views: processSeries(viewsSeriesRes),
            leads: processSeries(leadsSeriesRes),
            engagement: processSeries(engagementSeriesRes),
            revenue: processSeries(revenueSeriesRes),
        },
    }

    cacheSet(cacheKey, result)

    return NextResponse.json({ success: true, data: result }, {
        headers: { 'Cache-Control': 'private, max-age=60' }
    })
})

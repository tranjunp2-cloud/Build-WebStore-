import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { cacheGet, cacheSet } from '@/lib/cache'
import {
    getViewerDateTimeParts,
    normalizeViewerTimeZone,
    shiftViewerDateKey,
    toViewerDateKey,
    viewerDateKeyToUtc,
} from '@/lib/viewer-timezone'

/**
 * GET /api/analytics/summary?period=7d
 * Returns chart data, top pages/products/blogs/referrers.
 * Used for client-side refresh without full page reload.
 */
export const GET = withAuth(async (user, request) => {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const viewerTimeZone = normalizeViewerTimeZone(
        request.headers.get('x-viewer-time-zone'),
    )

    const tenants = (user as any).tenants
    if (!tenants?.length) {
        return NextResponse.json({ success: false, error: 'No tenant' }, { status: 403 })
    }
    const tenantId = typeof tenants[0].tenant === 'string' ? tenants[0].tenant : tenants[0].tenant?.id
    if (!tenantId) return NextResponse.json({ success: false, error: 'No tenant' }, { status: 403 })

    // Check cache
    const cacheKey = `analytics:${tenantId}:${period}:${viewerTimeZone}`
    const cached = cacheGet<any>(cacheKey)
    if (cached) {
        return NextResponse.json({ success: true, data: cached }, {
            headers: { 'Cache-Control': 'private, max-age=60' }
        })
    }

    const payload = await getPayload({ config })
    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7
    const now = new Date()
    const todayKey = toViewerDateKey(getViewerDateTimeParts(now, viewerTimeZone))
    const sinceKey = shiftViewerDateKey(todayKey, -(days - 1)) ?? todayKey
    const endKey = shiftViewerDateKey(todayKey, 1) ?? todayKey
    const prevSinceKey = shiftViewerDateKey(sinceKey, -days) ?? sinceKey
    const since = viewerDateKeyToUtc(sinceKey, viewerTimeZone)
    const end = viewerDateKeyToUtc(endKey, viewerTimeZone)
    const prevSince = viewerDateKeyToUtc(prevSinceKey, viewerTimeZone)

    if (!since || !end || !prevSince) {
        return NextResponse.json(
            { success: false, error: 'Unable to calculate analytics date range' },
            { status: 500 },
        )
    }

    const currentCreatedAt = {
        greater_than_equal: since.toISOString(),
        less_than: end.toISOString(),
    }
    const previousCreatedAt = {
        greater_than_equal: prevSince.toISOString(),
        less_than: since.toISOString(),
    }

    const clickEvents = ['click', 'add_to_cart', 'checkout']
    // Internal feature-adoption events (not real page views or storefront clicks) —
    // excluded from both buckets so they don't pollute traffic metrics/Top Pages.
    const internalEvents = ['local_business_data_saved']
    const notViewsOrInternal = [...clickEvents, ...internalEvents]

    const [currentViewsRes, prevViewsRes, currentClicksRes, prevClicksRes] = await Promise.all([
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: currentCreatedAt, event: { not_in: notViewsOrInternal } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: previousCreatedAt, event: { not_in: notViewsOrInternal } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: currentCreatedAt, event: { in: clickEvents } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: previousCreatedAt, event: { in: clickEvents } } }),
    ])

    const metrics = {
        views: currentViewsRes.totalDocs,
        clicks: currentClicksRes.totalDocs,
        prevViews: prevViewsRes.totalDocs,
        prevClicks: prevClicksRes.totalDocs,
    }

    if (metrics.views === 0 && metrics.clicks === 0) {
        return NextResponse.json({ success: true, data: { chart: [], topPages: [], topProducts: [], topBlogs: [], topReferrers: [], metrics, empty: true } }, {
            headers: { 'Cache-Control': 'private, max-age=60' }
        })
    }

    const { docs: currentDocs } = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId }, createdAt: currentCreatedAt, event: { not_in: internalEvents } },
        limit: 5000,
        sort: '-createdAt',
    })

    const dailyCounts: Record<string, { views: number; clicks: number }> = {}
    const pageViews: Record<string, number> = {}
    const productClicks: Record<string, number> = {}
    const blogViews: Record<string, number> = {}
    const referrers: Record<string, number> = {}

    for (const doc of currentDocs) {
        const date = toViewerDateKey(
            getViewerDateTimeParts(new Date(doc.createdAt), viewerTimeZone),
        )
        if (!dailyCounts[date]) dailyCounts[date] = { views: 0, clicks: 0 }

        const isClick = doc.event === 'click' || doc.event === 'add_to_cart' || doc.event === 'checkout' || doc.event === 'purchase'
        if (isClick) dailyCounts[date].clicks += 1
        else dailyCounts[date].views += 1

        const url = doc.pageUrl || '/'
        pageViews[url] = (pageViews[url] || 0) + 1
        if (url.startsWith('/blog/')) blogViews[url] = (blogViews[url] || 0) + 1
        if (url.startsWith('/product/') || isClick) productClicks[url] = (productClicks[url] || 0) + 1

        if (doc.referrer) {
            try {
                const refUrl = new URL(doc.referrer)
                if (refUrl.hostname && !refUrl.hostname.includes('localhost')) {
                    const domain = refUrl.hostname.replace(/^www\./, '')
                    referrers[domain] = (referrers[domain] || 0) + 1
                }
            } catch {
                if (doc.referrer.length < 100 && !doc.referrer.startsWith('/')) {
                    referrers[doc.referrer] = (referrers[doc.referrer] || 0) + 1
                }
            }
        }
    }

    const chartData = []
    for (let i = days - 1; i >= 0; i--) {
        const key = shiftViewerDateKey(todayKey, -i) ?? todayKey
        const [, month, day] = key.split('-')
        chartData.push({
            date: `${Number(day)}/${Number(month)}`,
            views: dailyCounts[key]?.views || 0,
            clicks: dailyCounts[key]?.clicks || 0,
        })
    }

    const mapTop = (data: Record<string, number>) =>
        Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 10)
            .map(([url, value]) => ({ id: url, name: url === '/' ? 'Home' : url.split('/').filter(Boolean).pop() || url, url, value }))

    const result = {
        chart: chartData,
        topPages: mapTop(pageViews),
        topProducts: mapTop(productClicks),
        topBlogs: mapTop(blogViews),
        topReferrers: mapTop(referrers),
        metrics,
    }

    cacheSet(cacheKey, result)

    return NextResponse.json({ success: true, data: result }, {
        headers: { 'Cache-Control': 'private, max-age=60' }
    })
})

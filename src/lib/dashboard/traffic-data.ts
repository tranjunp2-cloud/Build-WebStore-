/**
 * Traffic & performance data for the revamp dashboard.
 * Extracted from AnalyticsView — same 5000-doc aggregation for daily series + top lists.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { subDays, startOfDay, format } from 'date-fns'
import { getCurrentTenantId } from '@/lib/auth'
import type { DashboardPeriodKey, TopPerfRow, TrafficData } from './dashboard-types'

const periodLabel = (period: DashboardPeriodKey): string =>
    period === 'today' ? 'today' : period === '30d' ? 'last 30 days' : 'last 7 days'

/** Rank a url→count map into the top rows with share% of the tab total. */
function toRows(map: Record<string, number>): TopPerfRow[] {
    const entries = Object.entries(map)
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    return entries
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([url, value]) => ({
            name: url === '/' ? 'Home' : url.split('/').filter(Boolean).pop() || url,
            path: url,
            views: value,
            share: Math.round((value / total) * 1000) / 10,
        }))
}

const emptyTraffic = (period: DashboardPeriodKey): TrafficData => ({
    total: 0,
    period: periodLabel(period),
    isHourly: period === 'today',
    days: [],
    top: { pages: [], blogs: [], referrers: [] },
    hasData: false,
})

export async function getTrafficData(period: DashboardPeriodKey): Promise<TrafficData> {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) return emptyTraffic(period)

    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7
    const since = period === 'today' ? startOfDay(new Date()) : subDays(startOfDay(new Date()), days)
    const payload = await getPayload({ config })

    const [viewsRes, clicksRes] = await Promise.all([
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() }, event: { equals: 'pageview' } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() }, event: { equals: 'click' } } }),
    ])

    if (viewsRes.totalDocs === 0 && clicksRes.totalDocs === 0) return emptyTraffic(period)

    // Capped at 5000 docs for chart/list aggregation (summary totals above are authoritative).
    const { docs } = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() } },
        limit: 5000,
        sort: '-createdAt',
    })

    const isHourly = period === 'today'
    const dailyViews: Record<string, number> = {}
    const hourlyViews: number[] = Array(24).fill(0)
    const pageViews: Record<string, number> = {}
    const blogViews: Record<string, number> = {}
    const referrers: Record<string, number> = {}
    const internalHost = process.env.NEXT_PUBLIC_SERVER_URL || ''

    for (const doc of docs) {
        const created = new Date(doc.createdAt)
        const dateKey = created.toISOString().split('T')[0]
        const url = doc.pageUrl || '/'

        if (doc.event === 'pageview') {
            dailyViews[dateKey] = (dailyViews[dateKey] || 0) + 1
            if (isHourly) hourlyViews[created.getHours()] += 1
            pageViews[url] = (pageViews[url] || 0) + 1
            if (url.startsWith('/blog/')) blogViews[url] = (blogViews[url] || 0) + 1
        }

        if (doc.referrer) {
            try {
                const refUrl = new URL(doc.referrer)
                if (refUrl.hostname && !refUrl.hostname.includes('localhost') && (!internalHost || !refUrl.hostname.includes(internalHost))) {
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

    // Chart series — hourly (today) or daily ISO, oldest→newest
    const todayISO = format(new Date(), 'yyyy-MM-dd')
    const series = isHourly
        ? hourlyViews.map((views, hour) => ({ date: todayISO, hour, views }))
        : Array.from({ length: days }, (_, idx) => {
              const d = subDays(new Date(), days - 1 - idx)
              const key = format(d, 'yyyy-MM-dd')
              return { date: key, views: dailyViews[key] || 0 }
          })

    return {
        total: viewsRes.totalDocs,
        period: periodLabel(period),
        isHourly,
        days: series,
        top: {
            pages: toRows(pageViews),
            blogs: toRows(blogViews),
            referrers: toRows(referrers),
        },
        hasData: true,
    }
}

/**
 * Traffic & performance data for the revamp dashboard.
 * Extracted from AnalyticsView — same 5000-doc aggregation for daily series + top lists.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { DashboardPeriodKey, TopPerfRow, TrafficData } from './dashboard-types'
import {
    getViewerDateTimeParts,
    getViewerDayRange,
    normalizeViewerTimeZone,
    shiftViewerDateKey,
    toViewerDateKey,
    viewerDateKeyToUtc,
} from '@/lib/viewer-timezone'

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
    isHourly: period === 'today',
    days: [],
    top: { pages: [], blogs: [], referrers: [] },
    hasData: false,
})

export async function getTrafficData(
    period: DashboardPeriodKey,
    requestedTimeZone: string,
): Promise<TrafficData> {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) return emptyTraffic(period)

    const timeZone = normalizeViewerTimeZone(requestedTimeZone)
    const now = new Date()
    const isHourly = period === 'today'
    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7
    const viewerDay = getViewerDayRange(now, timeZone)
    const sinceKey = shiftViewerDateKey(viewerDay.dayKey, -(days - 1)) ?? viewerDay.dayKey
    const since = viewerDateKeyToUtc(sinceKey, timeZone) ?? viewerDay.start
    const createdAt = {
        greater_than_equal: since.toISOString(),
        less_than: viewerDay.end.toISOString(),
    }
    const payload = await getPayload({ config })

    const [viewsRes, clicksRes] = await Promise.all([
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt, event: { equals: 'pageview' } } }),
        payload.count({ collection: 'analytics', where: { tenant: { equals: tenantId }, createdAt, event: { equals: 'click' } } }),
    ])

    if (viewsRes.totalDocs === 0 && clicksRes.totalDocs === 0) return emptyTraffic(period)

    // Capped at 5000 docs for chart/list aggregation (summary totals above are authoritative).
    // Internal feature-adoption events (e.g. local_business_data_saved, fired from
    // the editor) are excluded — they aren't real visitor traffic and would leak
    // into Top Referrers (the only aggregation below not already event-gated) or
    // crowd out real pageviews within the 5000-doc cap.
    const internalEvents = ['local_business_data_saved']
    const { docs } = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId }, createdAt, event: { not_in: internalEvents } },
        limit: 5000,
        sort: '-createdAt',
    })

    const dailyViews: Record<string, number> = {}
    const hourlyViews: number[] = Array(24).fill(0)
    const pageViews: Record<string, number> = {}
    const blogViews: Record<string, number> = {}
    const referrers: Record<string, number> = {}
    const internalHost = process.env.NEXT_PUBLIC_SERVER_URL || ''

    for (const doc of docs) {
        // Defense-in-depth: the query above already excludes internal events, but
        // never let one reach the referrer aggregation (the one block below not
        // already gated by event type) even if the query filter is ever weakened.
        if (internalEvents.includes(doc.event)) continue

        const created = new Date(doc.createdAt)
        const dateKey = toViewerDateKey(getViewerDateTimeParts(created, timeZone))
        const url = doc.pageUrl || '/'

        if (doc.event === 'pageview') {
            dailyViews[dateKey] = (dailyViews[dateKey] || 0) + 1
            if (isHourly) {
                const viewerHour = getViewerDateTimeParts(created, timeZone).hour
                hourlyViews[viewerHour] += 1
            }
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
    const series = isHourly
        ? hourlyViews.map((views, hour) => ({ date: viewerDay.dayKey, hour, views }))
        : Array.from({ length: days }, (_, idx) => {
              const key = shiftViewerDateKey(viewerDay.dayKey, -(days - 1 - idx))
                  ?? viewerDay.dayKey
              return { date: key, views: dailyViews[key] || 0 }
          })

    return {
        total: viewsRes.totalDocs,
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

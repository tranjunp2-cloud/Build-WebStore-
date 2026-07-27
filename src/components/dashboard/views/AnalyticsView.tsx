import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { AnalyticsChart, ChartData } from '@/components/dashboard/AnalyticsChart'
import { TopPerformingList, PerformingItem } from '@/components/dashboard/TopPerformingList'
import { AnalyticsEmptyState } from '@/components/dashboard/AnalyticsEmptyState'
import { subDays, startOfDay } from 'date-fns'
export const dynamic = 'force-dynamic'

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function AnalyticsView({ searchParams }: Props) {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) return null

    const resolvedParams = await searchParams
    const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : '7d'
    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7
    
    // Current period — match the dashboard date range pattern
    const since = period === 'today' ? startOfDay(new Date()) : subDays(startOfDay(new Date()), days)

    // Previous period (for comparison)
    const prevSince = subDays(since, days)

    const payload = await getPayload({ config })

    // Match Overview's "leads" metric — only 'click' events
    const clickEvents = ['click']

    // Views (Traffic) = total pageview count per PRD: "Lượt views (Traffic)"
    // Tenant isolation via tenantId from getCurrentTenantId() (JWT auth).
    const [currentViewsRes, prevViewsRes, currentClicksRes, prevClicksRes] = await Promise.all([
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() }, event: { equals: 'pageview' } }
        }),
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevSince.toISOString(), less_than: since.toISOString() }, event: { equals: 'pageview' } }
        }),
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() }, event: { in: clickEvents } }
        }),
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevSince.toISOString(), less_than: since.toISOString() }, event: { in: clickEvents } }
        }),
    ])

    const currentMetrics = { views: currentViewsRes.totalDocs, clicks: currentClicksRes.totalDocs }
    const prevMetrics = { views: prevViewsRes.totalDocs, clicks: prevClicksRes.totalDocs }

    // If completely empty in current
    if (currentMetrics.views === 0 && currentMetrics.clicks === 0) {
        return (
            <div className="space-y-6">
                <AnalyticsEmptyState />
            </div>
        )
    }

    // NOTE: Capped at 5000 docs for chart/list aggregation. Summary totals above use
    // SQL COUNT (no limit) and are accurate. For high-traffic tenants, chart bars may
    // under-count vs summary — acceptable: chart is illustrative, summary is authoritative.
    const { docs: currentDocs } = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() } },
        limit: 5000,
        sort: '-createdAt',
    })

    // Aggregation: raw event counts per PRD ("Lượt views", "Lượt mở trang nhiều nhất")
    const dailyViews: Record<string, number> = {}
    const dailyClicks: Record<string, number> = {}
    const pageViews: Record<string, number> = {}
    const productClicks: Record<string, number> = {}
    const blogViews: Record<string, number> = {}
    const referrers: Record<string, number> = {}

    for (const doc of currentDocs) {
        const date = new Date(doc.createdAt).toISOString().split('T')[0]
        const url = doc.pageUrl || '/'

        if (doc.event === 'pageview') {
            dailyViews[date] = (dailyViews[date] || 0) + 1
            pageViews[url] = (pageViews[url] || 0) + 1

            if (url.startsWith('/blog/')) {
                blogViews[url] = (blogViews[url] || 0) + 1
            }
        } else if (doc.event === 'click') {
            dailyClicks[date] = (dailyClicks[date] || 0) + 1
        }

        if (url.startsWith('/product/') || doc.event === 'click') {
            productClicks[url] = (productClicks[url] || 0) + 1
        }

        // Referrers
        if (doc.referrer) {
            try {
                const refUrl = new URL(doc.referrer)
                if (refUrl.hostname && !refUrl.hostname.includes('localhost') && !refUrl.hostname.includes(process.env.NEXT_PUBLIC_SERVER_URL || '')) {
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

    // Fill daily chart data
    const chartData: ChartData[] = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        const displayDate = `${d.getDate()}/${d.getMonth() + 1}`

        chartData.push({
            date: displayDate,
            views: dailyViews[key] || 0,
            clicks: dailyClicks[key] || 0
        })
    }

    const mapToPerformingItem = (data: Record<string, number>): PerformingItem[] => {
        return Object.entries(data)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([url, value]) => ({
                id: url,
                name: url === '/' ? 'Home' : url.split('/').filter(Boolean).pop() || url,
                url: url,
                value
            }))
    }

    const topPages = mapToPerformingItem(pageViews)
    const topProducts = mapToPerformingItem(productClicks)
    const topBlogs = mapToPerformingItem(blogViews)
    const topReferrers = mapToPerformingItem(referrers)

    return (
        <div className="space-y-6">
            <AnalyticsChart data={chartData} />

            <TopPerformingList 
                pages={topPages}
                // TODO: Re-enable when F10 Commerce is ready
                // products={topProducts}
                blogs={topBlogs}
                referrers={topReferrers}
            />
        </div>
    )
}

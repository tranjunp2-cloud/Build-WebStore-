import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { AnalyticsHeader } from '@/components/dashboard/AnalyticsHeader'
import { AnalyticsChart, ChartData } from '@/components/dashboard/AnalyticsChart'
import { TopPerformingList, PerformingItem } from '@/components/dashboard/TopPerformingList'
import { AnalyticsSummaryCards } from '@/components/dashboard/AnalyticsSummaryCards'
import { AnalyticsEmptyState } from '@/components/dashboard/AnalyticsEmptyState'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'

export const dynamic = 'force-dynamic'

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AnalyticsDashboardPage({ searchParams }: Props) {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) return null

    const resolvedParams = await searchParams
    const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : '7d'
    const days = period === 'today' ? 1 : period === '30d' ? 30 : 7
    
    // Current period
    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    // Previous period (for comparison)
    const prevSince = new Date(since)
    prevSince.setDate(prevSince.getDate() - days)

    const payload = await getPayload({ config })

    const clickEvents = ['click', 'add_to_cart', 'checkout']

    // Use count() for accurate summary metrics (no limit issue)
    const [currentViewsRes, prevViewsRes, currentClicksRes, prevClicksRes] = await Promise.all([
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() }, event: { not_in: clickEvents } }
        }),
        payload.count({
            collection: 'analytics',
            where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevSince.toISOString(), less_than: since.toISOString() }, event: { not_in: clickEvents } }
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
                <AnalyticsHeader />
                <AnalyticsEmptyState />
            </div>
        )
    }

    // Fetch current period docs for chart/list aggregation (capped at 5000, most recent first)
    const { docs: currentDocs } = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: since.toISOString() } },
        limit: 5000,
        sort: '-createdAt',
    })

    // Aggregation for lists and charts (only for current period)
    const dailyCounts: Record<string, { views: number, clicks: number }> = {}
    const pageViews: Record<string, number> = {}
    const productClicks: Record<string, number> = {}
    const blogViews: Record<string, number> = {}
    const referrers: Record<string, number> = {}

    for (const doc of currentDocs) {
        const date = new Date(doc.createdAt).toISOString().split('T')[0]
        if (!dailyCounts[date]) dailyCounts[date] = { views: 0, clicks: 0 }

        const isClick = doc.event === 'click' || doc.event === 'add_to_cart' || doc.event === 'checkout' || doc.event === 'purchase'
        if (isClick) {
            dailyCounts[date].clicks += 1
        } else {
            dailyCounts[date].views += 1
        }

        // Top Pages
        const url = doc.pageUrl || '/'
        pageViews[url] = (pageViews[url] || 0) + 1

        // Top Blogs
        if (url.startsWith('/blog/')) {
            blogViews[url] = (blogViews[url] || 0) + 1
        }

        // Top Products
        if (url.startsWith('/product/') || isClick) {
            productClicks[url] = (productClicks[url] || 0) + 1
        }

        // Top Referrers
        if (doc.referrer) {
            try {
                const refUrl = new URL(doc.referrer)
                // Filter out internal traffic or empty domains
                if (refUrl.hostname && !refUrl.hostname.includes('localhost') && !refUrl.hostname.includes(process.env.NEXT_PUBLIC_SERVER_URL || '')) {
                    const domain = refUrl.hostname.replace(/^www\./, '')
                    referrers[domain] = (referrers[domain] || 0) + 1
                }
            } catch {
                // Not a valid URL, could be a UTM source string
                if (doc.referrer.length < 100 && !doc.referrer.startsWith('/')) {
                    referrers[doc.referrer] = (referrers[doc.referrer] || 0) + 1
                }
            }
        }
    }

    // Fill daily views
    const chartData: ChartData[] = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        chartData.push({
            date: key,
            views: dailyCounts[key]?.views || 0,
            clicks: dailyCounts[key]?.clicks || 0
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
        <Suspense fallback={<DashboardSkeleton />}>
            <div className="space-y-6">
                <AnalyticsHeader />

                <AnalyticsSummaryCards 
                    currentViews={currentMetrics.views}
                    prevViews={prevMetrics.views}
                    currentClicks={currentMetrics.clicks}
                    prevClicks={prevMetrics.clicks}
                />

                <AnalyticsChart data={chartData} />

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="lg:col-span-3">
                        <TopPerformingList 
                            pages={topPages}
                            products={topProducts}
                            blogs={topBlogs}
                            referrers={topReferrers}
                        />
                    </div>
                </div>
            </div>
        </Suspense>
    )
}

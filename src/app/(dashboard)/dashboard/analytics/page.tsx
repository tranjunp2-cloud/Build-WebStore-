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

    // Fetch both current and previous period, optimizing limit
    const { docs: allDocs } = await payload.find({
        collection: 'analytics',
        where: {
            tenant: { equals: tenantId },
            createdAt: { greater_than_equal: prevSince.toISOString() }
        },
        limit: 10000
    })

    // Split into current and previous
    const sinceTime = since.getTime()
    const currentDocs = allDocs.filter(d => new Date(d.createdAt).getTime() >= sinceTime)
    const prevDocs = allDocs.filter(d => new Date(d.createdAt).getTime() < sinceTime)

    // If completely empty in current
    if (currentDocs.length === 0) {
        return (
            <div className="space-y-6">
                <AnalyticsHeader />
                <AnalyticsEmptyState />
            </div>
        )
    }

    // Helper function to process docs into metrics
    const processMetrics = (docs: any[]) => {
        let views = 0
        let clicks = 0
        for (const doc of docs) {
            const isClick = doc.event === 'click' || doc.event === 'add_to_cart' || doc.event === 'checkout'
            if (isClick) clicks++
            else views++
        }
        return { views, clicks }
    }

    const currentMetrics = processMetrics(currentDocs)
    const prevMetrics = processMetrics(prevDocs)

    // Aggregation for lists and charts (only for current period)
    const dailyCounts: Record<string, { views: number, clicks: number }> = {}
    const pageViews: Record<string, number> = {}
    const productClicks: Record<string, number> = {}
    const blogViews: Record<string, number> = {}

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
                        />
                    </div>
                </div>
            </div>
        </Suspense>
    )
}

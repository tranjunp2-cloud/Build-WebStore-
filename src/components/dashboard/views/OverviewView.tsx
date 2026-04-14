import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { startOfDay, subDays, eachDayOfInterval, format } from 'date-fns'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

// Force dynamic — requires auth context + getPayload() at runtime
export const dynamic = 'force-dynamic'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { DashboardStats, TimeSeriesPoint } from '@/components/dashboard/DashboardStats'
import { DashboardActionList } from '@/components/dashboard/DashboardActionList'
import { SEOHealthWidget } from '@/components/dashboard/SEOHealthWidget'
import { calculateTechnicalSeoScore } from '@/lib/seo/technical-score'
import { calculateContentQualityScore } from '@/lib/seo/content-score'
import type { MissingSeoItem } from './SEOView'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardGenerationFailed } from '@/components/dashboard/DashboardGenerationFailed'
import { PendingOrder } from '@/components/dashboard/DashboardActionList'

interface MetricRow {
    date_str: string
    count: string | number
}

interface ProductWithSEO {
    id: string | number
    name?: string
    shortDescription?: string
    seo?: { title?: string, description?: string }
    images?: Array<{ alt?: string }>
}

interface PageWithSEO {
    id: string | number
    title?: string
    seo?: { title?: string, description?: string }
    layout?: Array<{ headline?: string; sectionLabel?: string }>
}

interface BlogWithSEO {
    seo?: { metaTitle?: string, metaDescription?: string }
}

interface OrderTotal {
    total?: number | null
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function OverviewView({ searchParams }: Props) {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })
    
    // Using Next.js 15 asynchronous searchParams
    const resolvedParams = await searchParams
    const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : '7d'

    // Check site existence and generation status
    if (tenantId) {
        const allSites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 5, // 1 site/tenant expected, extra for safety
        })

        const usable = allSites.docs.filter((s) => {
            const gs = (s as Record<string, unknown>).generationStatus
            return !gs || gs === 'none' || gs === 'completed'
        })

        if (usable.length === 0) {
            const hasFailed = allSites.docs.some(
                (s) => (s as Record<string, unknown>).generationStatus === 'failed',
            )

            return (
                <div className="space-y-8">
                    {hasFailed ? <DashboardGenerationFailed /> : <DashboardEmptyState />}
                </div>
            )
        }
    } else {
        return (
            <div className="space-y-8">
                <DashboardEmptyState />
            </div>
        )
    }

    const now = new Date()
    let startDate = subDays(startOfDay(now), 7)
    let daysDiff = 7
    if (period === 'today') {
        startDate = startOfDay(now)
        daysDiff = 1
    }
    if (period === '30d') {
        startDate = subDays(startOfDay(now), 30)
        daysDiff = 30
    }

    const prevStartDate = subDays(startDate, daysDiff)

    let views = 0
    let prevViews = 0
    let leads = 0
    let engagement = 0
    let revenue = 0
    let pendingOrdersCount = 0
    let pendingOrders: PendingOrder[] = []
    let dashboardPreferences: string[] | undefined = undefined

    // Series arrays
    let viewsSeries: TimeSeriesPoint[] = []
    let leadsSeries: TimeSeriesPoint[] = []
    let engagementSeries: TimeSeriesPoint[] = []
    let revenueSeries: TimeSeriesPoint[] = []
    
    // Change
    let viewsChange = 0
    let leadsChange = 0
    let engagementChange = 0
    let revenueChange = 0

    let seoScore = 100
    let siteId: string | number | null = null
    const missingSeoItems: MissingSeoItem[] = []
    const seoIssueCounts = { missingTitle: 0, missingPageTitle: 0, missingBlogTitle: 0, missingDesc: 0, missingAlt: 0 }


    if (tenantId) {
        const tenantResult = await payload.findByID({ collection: 'tenants', id: tenantId })
        dashboardPreferences = (tenantResult as { settings?: { dashboardPreferences?: string[] } })?.settings?.dashboardPreferences

        const [
            viewsRes, prevViewsRes, leadsRes, prevLeadsRes, engagementRes, prevEngagementRes, 
            ordersRes, prevOrdersRes, pendingOrdersRes,
            viewsSeriesRes, leadsSeriesRes, engagementSeriesRes, revenueSeriesRes
        ] = await Promise.all([
            // Raw SQL: Payload API doesn't support COUNT(DISTINCT). Tenant isolation is manual
            // via tenant_id filter — safe because tenantId is from getCurrentTenantId() (JWT auth).
            payload.db.drizzle.execute(sql`SELECT COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${startDate.toISOString()}`),
            payload.db.drizzle.execute(sql`SELECT COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${prevStartDate.toISOString()} AND created_at < ${startDate.toISOString()}`),
            payload.count({ 
                collection: 'analytics', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { equals: 'click' } }
            }),
            payload.count({ 
                collection: 'analytics', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, event: { equals: 'click' } }
            }),
            payload.count({ 
                collection: 'analytics', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { in: ['add_to_cart', 'checkout'] } }
            }),
            payload.count({ 
                collection: 'analytics', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, event: { in: ['add_to_cart', 'checkout'] } }
            }),
            payload.find({ 
                collection: 'orders', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, status: { in: ['paid', 'completed'] } }, 
                limit: 2000 
            }),
            payload.find({ 
                collection: 'orders', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, status: { in: ['paid', 'completed'] } }, 
                limit: 2000 
            }),
            payload.find({ 
                collection: 'orders', 
                where: { tenant: { equals: tenantId }, status: { equals: 'pending' } }, 
                sort: '-createdAt', 
                limit: 5 
            }),
            payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(DISTINCT session_id) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'pageview' AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
            payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event = 'click' AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
            payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, COUNT(*) as count FROM analytics WHERE tenant_id = ${tenantId} AND event IN ('add_to_cart', 'checkout') AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`),
            payload.db.drizzle.execute(sql`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date_str, SUM(total) as count FROM orders WHERE tenant_id = ${tenantId} AND status IN ('paid', 'completed') AND created_at >= ${startDate.toISOString()} GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')`)
        ])

        const getChange = (curr: number, prev: number) => {
            if (prev === 0) return curr === 0 ? 0 : 100
            return ((curr - prev) / prev) * 100
        }

        views = Number(viewsRes.rows[0]?.count || 0)
        prevViews = Number(prevViewsRes.rows[0]?.count || 0)
        viewsChange = getChange(views, prevViews)

        leads = leadsRes.totalDocs
        let prevLeads = prevLeadsRes.totalDocs
        leadsChange = getChange(leads, prevLeads)

        engagement = engagementRes.totalDocs
        let prevEngagement = prevEngagementRes.totalDocs
        engagementChange = getChange(engagement, prevEngagement)

        ordersRes.docs.forEach((doc: unknown) => { const d = doc as OrderTotal; if (d.total) revenue += d.total })
        let prevRevenue = 0
        prevOrdersRes.docs.forEach((doc: unknown) => { const d = doc as OrderTotal; if (d.total) prevRevenue += d.total })
        revenueChange = getChange(revenue, prevRevenue)

        pendingOrdersCount = pendingOrdersRes.totalDocs
        pendingOrders = pendingOrdersRes.docs as PendingOrder[]

        // Process timeseries
        const days = eachDayOfInterval({ start: startDate, end: now })
        
        const processSeries = (res: { rows?: MetricRow[] }) => {
            const dataMap = new Map()
            if (res.rows) {
                res.rows.forEach((r: MetricRow) => {
                    dataMap.set(r.date_str, Number(r.count || 0))
                })
            }
            return days.map(d => {
                const dStr = format(d, 'yyyy-MM-dd')
                return {
                    date: dStr,
                    value: dataMap.get(dStr) || 0
                }
            })
        }

        viewsSeries = processSeries(viewsSeriesRes as unknown as { rows?: MetricRow[] })
        leadsSeries = processSeries(leadsSeriesRes as unknown as { rows?: MetricRow[] })
        engagementSeries = processSeries(engagementSeriesRes as unknown as { rows?: MetricRow[] })
        revenueSeries = processSeries(revenueSeriesRes as unknown as { rows?: MetricRow[] })

        try {
            // Get all sites for this tenant to query pages
            const sitesRes = await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 100 })
            const siteIds = sitesRes.docs.map(s => s.id)
            if (sitesRes.docs[0]) siteId = sitesRes.docs[0].id

            const [productsRes, pagesRes, blogsRes] = await Promise.all([
                payload.find({ collection: 'products', where: { tenant: { equals: tenantId }, status: { equals: 'active' } }, limit: 1000, depth: 0 }),
                siteIds.length > 0 
                  ? payload.find({ collection: 'pages', where: { site: { in: siteIds } }, limit: 1000, depth: 0 })
                  : Promise.resolve({ docs: [] }),
                payload.find({ collection: 'blogs', where: { tenant: { equals: tenantId }, status: { equals: 'published' } }, limit: 1000, depth: 0 })
            ])
            
            let missingTitleCount = 0
            let missingDescCount = 0
            let missingAltCount = 0
            let invalidPageTitleCount = 0
            let invalidBlogTitleCount = 0
            
            // Scan Products
            productsRes.docs.forEach((product: unknown) => {
                const p = product as ProductWithSEO
                if (!p.seo?.title) missingTitleCount++
                if (!p.seo?.description) missingDescCount++

                let hasMissingAlt = false
                if (p.images && p.images.length > 0) {
                    p.images.forEach((imgObj) => {
                        if (!imgObj.alt || imgObj.alt.trim() === '') hasMissingAlt = true
                    })
                }
                if (hasMissingAlt) missingAltCount++

                const missing: string[] = []
                if (!p.seo?.title) missing.push('title')
                if (!p.seo?.description) missing.push('description')
                if (missing.length > 0) {
                    missingSeoItems.push({
                        collection: 'products', id: p.id, title: p.name || 'Untitled Product',
                        context: (p.shortDescription || '').slice(0, 150), missingFields: missing,
                        currentTitle: p.seo?.title || undefined, currentDescription: p.seo?.description || undefined,
                    })
                }
            })

            // Scan Pages
            pagesRes.docs.forEach((page: unknown) => {
                const p = page as PageWithSEO
                if (!p.seo?.title) invalidPageTitleCount++
                if (!p.seo?.description) missingDescCount++

                const missing: string[] = []
                if (!p.seo?.title) missing.push('title')
                if (!p.seo?.description) missing.push('description')
                if (missing.length > 0) {
                    const textContext = Array.isArray(p.layout)
                        ? p.layout.map(b => b.headline || b.sectionLabel || '').filter(Boolean).join('. ').slice(0, 150) : ''
                    missingSeoItems.push({
                        collection: 'pages', id: p.id, title: p.title || 'Untitled Page',
                        context: textContext, missingFields: missing,
                        currentTitle: p.seo?.title || undefined, currentDescription: p.seo?.description || undefined,
                    })
                }
            })

            // Scan Blogs
            blogsRes.docs.forEach((blog: unknown) => {
                const b = blog as BlogWithSEO
                if (!b.seo?.metaTitle) invalidBlogTitleCount++
                if (!b.seo?.metaDescription) missingDescCount++
            })
            
            seoIssueCounts.missingTitle = missingTitleCount
            seoIssueCounts.missingPageTitle = invalidPageTitleCount
            seoIssueCounts.missingBlogTitle = invalidBlogTitleCount
            seoIssueCounts.missingDesc = missingDescCount
            seoIssueCounts.missingAlt = missingAltCount

            // Score calculation matching SEOView (PRD FR-09: Meta Tags 40%, Content 35%, Technical 25%)
            const metaTitleDeduction = Math.min(20, missingTitleCount * 5) + Math.min(20, invalidPageTitleCount * 5) + Math.min(10, invalidBlogTitleCount * 5)
            const metaDescDeduction = Math.min(30, missingDescCount * 5)
            const altTextDeduction = Math.min(20, missingAltCount * 10)

            const site = sitesRes.docs[0]
            const noIndexCount = pagesRes.docs.filter((p: unknown) => (p as { seo?: { noIndex?: boolean } }).seo?.noIndex === true).length
            const technicalSeoScore = calculateTechnicalSeoScore({
                siteHasOgImage: Boolean(site?.seo?.ogImage),
                siteHasGoogleVerification: Boolean(site?.seo?.googleVerificationToken),
                pageSlugs: pagesRes.docs.map((p: unknown) => ((p as { slug?: string }).slug || '')),
                noIndexCount,
            })

            const metaTagsScore = Math.max(0, 100 - metaTitleDeduction - metaDescDeduction)

            const hasContactSection = pagesRes.docs.some((p: unknown) => {
                const layout = (p as { layout?: Array<{ blockType?: string }> }).layout
                return Array.isArray(layout) && layout.some(b => b.blockType === 'contact')
            })
            const contentQualityScore = calculateContentQualityScore({
                pages: pagesRes.docs.map((p: unknown) => ({ layout: (p as { layout?: Array<{ blockType?: string; headline?: string; description?: string; content?: string; sectionLabel?: string; subheadline?: string; body?: string }> }).layout })),
                productMissingAltCount: missingAltCount,
                hasContactSection,
            })
            seoScore = Math.floor((metaTagsScore * 0.4) + (contentQualityScore * 0.35) + (technicalSeoScore * 0.25))
        } catch (e) {
            console.error('Error computing extended SEO metrics', e)
        }
    }

    return (
        <div className="space-y-6 mt-6">
            {/* Stats Cards */}
                    {/* Main Content Grid: Combined Stats and SEO Health */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        <DashboardStats 
                            views={views}
                            leads={leads}
                            engagement={engagement}
                            // TODO: Re-enable when F10 e-commerce is ready
                            // revenue={revenue}
                            pendingOrdersCount={pendingOrdersCount}
                            currency="MYR"
                            preferences={dashboardPreferences}
                            viewsSeries={viewsSeries}
                            leadsSeries={leadsSeries}
                            engagementSeries={engagementSeries}
                            // TODO: Re-enable revenue stats when F10 is ready
                            // revenueSeries={revenueSeries}
                            viewsChange={viewsChange}
                            leadsChange={leadsChange}
                            engagementChange={engagementChange}
                            // revenueChange={revenueChange}
                        />
                        
                        {/* TODO: Re-enable ActionList when F10 Orders is ready */}
                        {/* <DashboardActionList pendingOrders={pendingOrders} /> */}
                        <div className="h-full">
                            <SEOHealthWidget score={seoScore} issueCounts={seoIssueCounts} siteId={siteId} missingSeoItems={missingSeoItems} />
                        </div>
                    </div>
        </div>
    )
}

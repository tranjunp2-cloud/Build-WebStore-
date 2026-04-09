import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { startOfDay, subDays } from 'date-fns'

// Force dynamic — requires auth context + getPayload() at runtime
export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { SEOHealthWidget } from '@/components/dashboard/SEOHealthWidget'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'
import { DashboardSiteGrid } from '@/components/dashboard/DashboardSiteGrid'
import { AISmartInsights } from '@/components/dashboard/AISmartInsights'
import { DashboardOnboarding } from '@/components/dashboard/DashboardOnboarding'

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: Props) {
    const user = await getCurrentUser()
    const payload = await getPayload({ config })

    // Extract tenantId from user directly — avoid 2nd getCurrentUser() call
    const typedUserForTenant = user as PlatformUser | null
    const userTenants = typedUserForTenant?.tenants as Array<{ tenant: string | { id: string } }> | undefined
    const firstUserTenant = userTenants?.[0]?.tenant
    const tenantId = typeof firstUserTenant === 'string' ? firstUserTenant : firstUserTenant?.id || null

    // Using Next.js 15 asynchronous searchParams
    const resolvedParams = await searchParams
    const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : '7d'

    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'

    let totalSites = 0
    let recentSites: any[] = []
    let hasPublishedSite = false
    if (tenantId) {
        const sitesResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            sort: '-updatedAt',
            limit: 6
        })
        totalSites = sitesResult.totalDocs
        recentSites = sitesResult.docs
        hasPublishedSite = recentSites.some((s: any) => s.status === 'published')
    }

    // Detect onboarding state
    const hasWebsite = totalSites > 0
    const isOnboarding = !hasWebsite || !hasPublishedSite

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
    let dashboardPreferences: string[] | undefined = undefined

    if (tenantId) {
        const tenantResult: any = await payload.findByID({ collection: 'tenants', id: tenantId })
        dashboardPreferences = tenantResult?.settings?.dashboardPreferences

        const [viewsRes, prevViewsRes, leadsRes, engagementRes] = await Promise.all([
            payload.count({
                collection: 'analytics',
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { equals: 'pageview' } }
            }),
            payload.count({
                collection: 'analytics',
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: prevStartDate.toISOString(), less_than: startDate.toISOString() }, event: { equals: 'pageview' } }
            }),
            payload.count({
                collection: 'analytics',
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { equals: 'click' } }
            }),
            payload.count({
                collection: 'analytics',
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { not_equals: 'pageview' } }
            }),
        ])

        views = viewsRes.totalDocs
        prevViews = prevViewsRes.totalDocs
        leads = leadsRes.totalDocs
        engagement = engagementRes.totalDocs
    }

    const hasAnalyticsData = views > 0 || leads > 0 || engagement > 0

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <div className="space-y-8">
                {/* Header: Greeting + Controls */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <DashboardGreeting userName={userName} />
                    {hasAnalyticsData && (
                        <div className="flex items-center gap-4">
                            <PeriodSelector />
                            <DashboardCustomizeModal defaultPreferences={dashboardPreferences} />
                        </div>
                    )}
                </div>

                {/* Onboarding: Quick Actions + Setup Checklist */}
                {isOnboarding && (
                    <DashboardOnboarding
                        hasWebsite={hasWebsite}
                        hasPublishedSite={hasPublishedSite}
                        hasProducts={false}
                        hasPaymentSetup={false}
                    />
                )}

                {/* My Websites — always show if user has sites */}
                {hasWebsite && (
                    <DashboardSiteGrid sites={recentSites} />
                )}

                {/* Analytics — only show when there's actual data */}
                {hasAnalyticsData && (
                    <>
                        <AISmartInsights views={views} prevViews={prevViews} />
                        <DashboardStats
                            views={views}
                            leads={leads}
                            engagement={engagement}
                            preferences={dashboardPreferences}
                        />
                    </>
                )}

                {/* SEO Health — only show when site exists */}
                {hasWebsite && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <SEOHealthWidget score={68} />
                    </div>
                )}
            </div>
        </Suspense>
    )
}

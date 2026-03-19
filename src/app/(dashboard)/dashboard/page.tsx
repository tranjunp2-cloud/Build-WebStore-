import { Suspense } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { startOfDay, subDays } from 'date-fns'

import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { DashboardActionList } from '@/components/dashboard/DashboardActionList'
import { SEOHealthWidget } from '@/components/dashboard/SEOHealthWidget'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'
import { DashboardSiteGrid } from '@/components/dashboard/DashboardSiteGrid'
import { AISmartInsights } from '@/components/dashboard/AISmartInsights'

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: Props) {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })
    
    // Using Next.js 15 asynchronous searchParams
    const resolvedParams = await searchParams
    const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : '7d'

    const typedUser = user as PlatformUser | null
    const userName = typedUser?.firstName || typedUser?.email?.split('@')[0] || 'User'

    let totalSites = 0
    let recentSites: any[] = []
    if (tenantId) {
        const sitesResult = await payload.find({ 
            collection: 'sites', 
            where: { tenant: { equals: tenantId } }, 
            sort: '-updatedAt',
            limit: 6 
        })
        totalSites = sitesResult.totalDocs
        recentSites = sitesResult.docs
    }

    if (totalSites === 0) {
        return (
            <div className="space-y-8">
                <DashboardGreeting userName={userName} />
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
    let pendingOrders: any[] = []
    let dashboardPreferences: string[] | undefined = undefined

    if (tenantId) {
        const tenantResult: any = await payload.findByID({ collection: 'tenants', id: tenantId })
        dashboardPreferences = tenantResult?.settings?.dashboardPreferences

        const [viewsRes, prevViewsRes, leadsRes, engagementRes, ordersRes, pendingOrdersRes] = await Promise.all([
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
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, event: { in: ['add_to_cart', 'checkout'] } }
            }),
            payload.find({ 
                collection: 'orders', 
                where: { tenant: { equals: tenantId }, createdAt: { greater_than_equal: startDate.toISOString() }, status: { in: ['paid', 'completed'] } }, 
                limit: 2000 
            }),
            payload.find({ 
                collection: 'orders', 
                where: { tenant: { equals: tenantId }, status: { equals: 'pending' } }, 
                sort: '-createdAt', 
                limit: 5 
            })
        ])

        views = viewsRes.totalDocs
        prevViews = prevViewsRes.totalDocs
        leads = leadsRes.totalDocs
        engagement = engagementRes.totalDocs

        ordersRes.docs.forEach((doc: any) => {
            if (doc.total) revenue += doc.total
        })

        pendingOrdersCount = pendingOrdersRes.totalDocs
        pendingOrders = pendingOrdersRes.docs
    }

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <div className="space-y-8">
                {/* Header: Greeting + Period Selector */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <DashboardGreeting userName={userName} />
                    <div className="flex items-center gap-4">
                        <PeriodSelector />
                        <DashboardCustomizeModal defaultPreferences={dashboardPreferences} />
                    </div>
                </div>

                {/* AI Insights & Alerts */}
                <AISmartInsights views={views} prevViews={prevViews} />

                {/* Stats Cards */}
                <DashboardStats 
                    views={views}
                    leads={leads}
                    engagement={engagement}
                    revenue={revenue}
                    pendingOrdersCount={pendingOrdersCount}
                    currency="MYR"
                    preferences={dashboardPreferences}
                />

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <DashboardActionList pendingOrders={pendingOrders} />
                    <SEOHealthWidget score={68} />
                </div>

                {/* Recent Sites */}
                <div className="mt-8">
                    <DashboardSiteGrid sites={recentSites} />
                </div>
            </div>
        </Suspense>
    )
}

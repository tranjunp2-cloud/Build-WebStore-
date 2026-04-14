import { Suspense } from 'react'

import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { OverviewView } from '@/components/dashboard/views/OverviewView'
import { AnalyticsView } from '@/components/dashboard/views/AnalyticsView'
import { SEOView } from '@/components/dashboard/views/SEOView'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'

export const dynamic = 'force-dynamic'
interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardRoot({ searchParams }: Props) {
    const resolvedParams = await searchParams
    const tab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'overview'

    // We fetch preferences here so we can pass it down to modal safely
    let dashboardPreferences: string[] | undefined = undefined
    const tenantId = await getCurrentTenantId()
    if (tenantId) {
        const payload = await getPayload({ config })
        const tenantResult = await payload.findByID({ collection: 'tenants', id: tenantId })
        dashboardPreferences = (tenantResult as { settings?: { dashboardPreferences?: string[] } })?.settings?.dashboardPreferences
    }

    return (
        <div className="space-y-6">
            {/* Universal Page Header / Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <DashboardTabs />

                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <PeriodSelector />
                    <DashboardCustomizeModal defaultPreferences={dashboardPreferences} />
                </div>
            </div>

            {/* Suspend the individual view fetching */}
            <Suspense fallback={<DashboardSkeleton />}>
                {tab === 'overview' && <OverviewView searchParams={searchParams} />}
                {tab === 'analytics' && <AnalyticsView searchParams={searchParams} />}
                {tab === 'seo' && <SEOView />}
            </Suspense>
        </div>
    )
}

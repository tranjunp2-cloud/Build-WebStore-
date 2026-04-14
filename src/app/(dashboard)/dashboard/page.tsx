import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { OverviewSkeleton, AnalyticsSkeleton, SEOSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { OverviewView } from '@/components/dashboard/views/OverviewView'
import { AnalyticsView } from '@/components/dashboard/views/AnalyticsView'
import { SEOView } from '@/components/dashboard/views/SEOView'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'
import { DashboardTabContent } from '@/components/dashboard/DashboardTabContent'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
    const cookieStore = await cookies()
    const locale = cookieStore.get('prefer_lang')?.value ?? 'en'
    const isMs = locale === 'ms'
    return {
        title: isMs ? 'Papan Pemuka | PrimeWeb' : 'Dashboard | PrimeWeb',
        description: isMs
            ? 'Pantau prestasi kedai anda dan urus perniagaan dalam talian.'
            : 'Monitor your store performance and manage your online business.',
    }
}

export const dynamic = 'force-dynamic'
interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardRoot({ searchParams }: Props) {
    const resolvedParams = await searchParams
    const rawTab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'overview'

    // We fetch preferences here so we can pass it down to modal safely
    let dashboardPreferences: string[] | undefined = undefined
    let hasUsableSites = false
    const tenantId = await getCurrentTenantId()
    if (tenantId) {
        const payload = await getPayload({ config })
        const tenantResult = await payload.findByID({ collection: 'tenants', id: tenantId })
        dashboardPreferences = (tenantResult as { settings?: { dashboardPreferences?: string[] } })?.settings?.dashboardPreferences

        const usableSiteCount = await payload.count({
            collection: 'sites',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    {
                        or: [
                            { generationStatus: { equals: 'completed' } },
                            { generationStatus: { equals: 'none' } },
                            { generationStatus: { exists: false } },
                        ],
                    },
                ],
            },
        })
        hasUsableSites = usableSiteCount.totalDocs > 0
    }

    // Force overview tab when no usable sites — prevents empty analytics/seo views via direct URL
    const tab = hasUsableSites ? rawTab : 'overview'

    return (
        <div className="space-y-6">
            <DashboardTabContent defaultTab={tab}>
                {/* Universal Page Header / Toolbar — hidden when no usable sites */}
                {hasUsableSites && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <DashboardTabs />

                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <PeriodSelector />
                            <DashboardCustomizeModal defaultPreferences={dashboardPreferences} />
                        </div>
                    </div>
                )}

                {/* Only render the active tab — avoids 3x query cost */}
                {tab === 'overview' && (
                    <Suspense fallback={<OverviewSkeleton />}>
                        <OverviewView searchParams={searchParams} />
                    </Suspense>
                )}
                {tab === 'analytics' && (
                    <Suspense fallback={<AnalyticsSkeleton />}>
                        <AnalyticsView searchParams={searchParams} />
                    </Suspense>
                )}
                {tab === 'seo' && (
                    <Suspense fallback={<SEOSkeleton />}>
                        <SEOView />
                    </Suspense>
                )}
            </DashboardTabContent>
        </div>
    )
}

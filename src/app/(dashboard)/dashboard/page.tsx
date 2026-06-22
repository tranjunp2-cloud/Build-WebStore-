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
import { DashboardOnboarding } from '@/components/dashboard/DashboardOnboarding'
import { DashboardTabContent, TabPanel } from '@/components/dashboard/DashboardTabContent'
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
    let siteId: string | null = null
    let hasPublishedSite = false
    let isDesignCustomized = false
    let hasProducts = false
    let hasPaymentConfigured = false
    let hasShippingConfigured = false
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
                            { generationStatus: { equals: null } },
                            { generationStatus: { exists: false } },
                        ],
                    },
                ],
            },
        })
        hasUsableSites = usableSiteCount.totalDocs > 0

        if (hasUsableSites) {
            // Onboarding status — skipped when no usable sites; tenantResult already in scope above
            const tenantPayments = (tenantResult as { payments?: Record<string, boolean> })?.payments
            hasPaymentConfigured = !!(
                tenantPayments?.payment_cod || tenantPayments?.payment_qr ||
                tenantPayments?.payment_card || tenantPayments?.payment_fpx ||
                tenantPayments?.xendit_tng || tenantPayments?.xendit_grabpay ||
                tenantPayments?.xendit_duitnow || tenantPayments?.xendit_fpx ||
                tenantPayments?.xendit_shopeepay || tenantPayments?.xendit_boost ||
                tenantPayments?.xendit_mae
            )
            const [onboardingSitesResult, onboardingProductsCount] = await Promise.all([
                payload.find({
                    collection: 'sites',
                    where: {
                        and: [
                            { tenant: { equals: tenantId } },
                            { or: [
                                { generationStatus: { equals: 'completed' } },
                                { generationStatus: { equals: 'none' } },
                                { generationStatus: { equals: null } },
                                { generationStatus: { exists: false } },
                            ]},
                        ],
                    },
                    limit: 1,
                }),
                payload.count({ collection: 'products', where: { tenant: { equals: tenantId }, status: { equals: 'active' } } }),
            ])
            const siteDoc = onboardingSitesResult.docs[0]
            siteId = siteDoc?.id != null ? String(siteDoc.id) : null
            isDesignCustomized = !!(siteDoc as { themeCustomized?: boolean })?.themeCustomized
            hasPublishedSite = (siteDoc as { status?: string })?.status === 'published'
            hasProducts = onboardingProductsCount.totalDocs > 0
            hasShippingConfigured = !!(siteDoc as { shippingConfig?: { shippingSetupConfirmed?: boolean } })?.shippingConfig?.shippingSetupConfirmed
        }
    }

    // Force overview tab when no usable sites — prevents empty analytics/seo views via direct URL
    const tab = hasUsableSites ? rawTab : 'overview'

    return (
        <div className="space-y-6">
            <DashboardTabContent defaultTab={tab}>
                {/* Onboarding checklist — above toolbar per Figma; hidden when all 4 steps done */}
                {hasUsableSites && !(hasProducts && isDesignCustomized && hasPaymentConfigured && hasShippingConfigured && hasPublishedSite) && (
                    <DashboardOnboarding
                        hasPublishedSite={hasPublishedSite}
                        siteId={siteId}
                        hasProducts={hasProducts}
                        isDesignCustomized={isDesignCustomized}
                        hasPaymentConfigured={hasPaymentConfigured}
                        hasShippingConfigured={hasShippingConfigured}
                    />
                )}

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

                {/* Render all tabs — TabPanel hides inactive via CSS for instant switching.
                   Note: PeriodSelector still uses router.push() which re-renders all tabs.
                   This is an accepted tradeoff — period changes are rare (1-2x/session)
                   while tab switches are frequent and must be instant. */}
                <TabPanel tabId="overview">
                    <Suspense fallback={<OverviewSkeleton />}>
                        <OverviewView searchParams={searchParams} />
                    </Suspense>
                </TabPanel>
                {hasUsableSites && (
                    <>
                        <TabPanel tabId="analytics">
                            <Suspense fallback={<AnalyticsSkeleton />}>
                                <AnalyticsView searchParams={searchParams} />
                            </Suspense>
                        </TabPanel>
                        <TabPanel tabId="seo">
                            <Suspense fallback={<SEOSkeleton />}>
                                <SEOView />
                            </Suspense>
                        </TabPanel>
                    </>
                )}
            </DashboardTabContent>
        </div>
    )
}

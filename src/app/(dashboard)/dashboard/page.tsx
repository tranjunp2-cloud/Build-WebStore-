import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { normalizeDashboardBlocks, parsePeriod, type DashboardBlockId } from '@/lib/dashboard-utils'
import { getGlanceData, emptyGlanceData } from '@/lib/dashboard/glance-data'
import { getTrafficData } from '@/lib/dashboard/traffic-data'
import { getSeoData } from '@/lib/dashboard/seo-data'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { CustomizeModal } from '@/components/dashboard/revamp/customize-modal'
import { OnboardingCard, type OnboardingStep } from '@/components/dashboard/revamp/onboarding-card'
import { AtAGlance } from '@/components/dashboard/revamp/at-a-glance'
import { TrafficPerformance } from '@/components/dashboard/revamp/traffic-performance'
import { SeoHealth } from '@/components/dashboard/revamp/seo-health'
import { SeoTools } from '@/components/dashboard/revamp/seo-tools'
import { PendingOrders } from '@/components/dashboard/revamp/pending-orders'
import { DashboardToolbarHeader } from '@/components/dashboard/revamp/dashboard-toolbar-header'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardGenerationFailed } from '@/components/dashboard/DashboardGenerationFailed'
import './dashboard-revamp.css'

export async function generateMetadata(): Promise<Metadata> {
    const cookieStore = await cookies()
    const isMs = (cookieStore.get('prefer_lang')?.value ?? 'en') === 'ms'
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
    const period = parsePeriod(typeof resolvedParams.period === 'string' ? resolvedParams.period : undefined)

    const aiStatusFailed = typeof resolvedParams.ai_status === 'string' && resolvedParams.ai_status === 'failed'

    let dashboardPreferences: string[] | undefined
    let hasUsableSites = false
    let hasFailedSite = false
    let siteId: string | null = null
    let hasPublishedSite = false
    let isDesignCustomized = false
    let hasProducts = false
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

        // No usable site → distinguish a failed AI generation from a brand-new (no site) account
        if (!hasUsableSites) {
            const failedSiteCount = await payload.count({
                collection: 'sites',
                where: { and: [{ tenant: { equals: tenantId } }, { generationStatus: { equals: 'failed' } }] },
            })
            hasFailedSite = failedSiteCount.totalDocs > 0
        }

        if (hasUsableSites) {
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
                            ] },
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

    const blocks = normalizeDashboardBlocks(dashboardPreferences)
    const editHref = siteId ? `/editor/${siteId}` : '/builder/new'
    // "Publish" step opens the editor with the publish modal pre-opened (only when a site exists)
    const launchHref = siteId ? `/editor/${siteId}?publish=1` : '/builder/new'

    // Onboarding steps — id/done/href only; name/desc/cta come from i18n in OnboardingCard
    const steps: OnboardingStep[] = [
        { id: 'products', done: hasProducts, href: '/products' },
        { id: 'design', done: isDesignCustomized, href: editHref },
        { id: 'shipping', done: hasShippingConfigured, href: '/settings/shipping' },
        { id: 'launch', done: hasPublishedSite, href: launchHref },
    ]
    const allStepsDone = steps.every(s => s.done)
    const showOnboarding = blocks.includes('onboarding') && !allStepsDone

    // Fetch block data only when the store has a usable site
    const [glance, traffic, seo] = hasUsableSites
        ? await Promise.all([getGlanceData(period), getTrafficData(period), getSeoData()])
        : [emptyGlanceData(), null, null]

    const renderBlock = (id: DashboardBlockId) => {
        switch (id) {
            case 'onboarding':
                return showOnboarding ? <OnboardingCard key="onboarding" steps={steps} /> : null
            case 'glance':
                return <AtAGlance key="glance" data={glance} showHeader={showOnboarding} period={period} />
            case 'traffic':
                return traffic ? <TrafficPerformance key="traffic" data={traffic} period={period} /> : null
            case 'seo':
                return seo ? <SeoHealth key="seo" data={seo} /> : null
            case 'tools':
                return seo ? <SeoTools key="tools" siteId={seo.siteId} autoMetaEnabled={seo.autoMetaEnabled} /> : null
            case 'orders':
                return <PendingOrders key="orders" />
            default:
                return null
        }
    }

    // Brand-new account (no usable site) → original empty/failed state only (no toolbar, no stats)
    if (!hasUsableSites) {
        return (
            <div className="dash-revamp">
                <div className="stream">
                    {hasFailedSite || aiStatusFailed ? <DashboardGenerationFailed /> : <DashboardEmptyState />}
                </div>
            </div>
        )
    }

    return (
        <div className="dash-revamp">
            <div className="dash-toolbar">
                <DashboardToolbarHeader period={period} rangeLabel={glance.rangeLabel} />
                <div className="dt-right">
                    <PeriodSelector />
                    <CustomizeModal defaultVisible={blocks} onboardingComplete={allStepsDone} />
                </div>
            </div>

            <div className="stream">
                {blocks.map(renderBlock)}
            </div>
        </div>
    )
}

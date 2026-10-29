import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { normalizeDashboardBlocks, parsePeriod, type DashboardBlockId } from '@/lib/dashboard-utils'
import { getGlanceData, emptyGlanceData } from '@/lib/dashboard/glance-data'
import { canReadPendingOrders, getPendingOrdersData } from '@/lib/dashboard/pending-orders-data'
import type { PendingOrdersLoadState } from '@/lib/dashboard/dashboard-types'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'
import { CustomizeModal } from '@/components/dashboard/revamp/customize-modal'
import { OnboardingCard, type OnboardingStep } from '@/components/dashboard/revamp/onboarding-card'
import { AtAGlance } from '@/components/dashboard/revamp/at-a-glance'
import { TrafficPerformanceClient } from '@/components/dashboard/revamp/traffic-performance-client'
import { SeoHealth } from '@/components/dashboard/revamp/seo-health'
import { PendingOrders } from '@/components/dashboard/revamp/pending-orders'
import { DashboardToolbarHeader } from '@/components/dashboard/revamp/dashboard-toolbar-header'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'
import { dashboardRefreshKinds } from './refresh-kinds'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { DashboardGenerationFailed } from '@/components/dashboard/DashboardGenerationFailed'
import './dashboard-revamp.css'

export async function generateMetadata(): Promise<Metadata> {
    const cookieStore = await cookies()
    const isMs = (cookieStore.get('prefer_lang')?.value ?? 'en') === 'ms'
    return {
        title: isMs ? 'Papan Pemuka | Web Store' : 'Dashboard | Web Store',
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
    let shippingCompletionSource: OnboardingStep['completionSource']

    const user = await getCurrentUser()
    const tenantId = tenantIdForQuery(user)
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
            const hasSelfDeliveryShipping = (siteDoc as {
                shippingConfig?: { shippingSetupConfirmed?: boolean }
            })?.shippingConfig?.shippingSetupConfirmed === true
            const hasEasyParcelShipping = (tenantResult as {
                easyParcelIntegration?: { enabled?: boolean }
            })?.easyParcelIntegration?.enabled === true
            hasShippingConfigured = hasSelfDeliveryShipping || hasEasyParcelShipping
            shippingCompletionSource = hasSelfDeliveryShipping && hasEasyParcelShipping
                ? 'both'
                : hasEasyParcelShipping
                    ? 'easyparcel'
                    : hasSelfDeliveryShipping ? 'self-delivery' : undefined
        }
    }

    const blocks = normalizeDashboardBlocks(dashboardPreferences)
    const canViewOrders = canReadPendingOrders(user)
    const editHref = siteId ? `/editor/${siteId}` : '/builder/new'
    // "Publish" step opens the editor with the publish modal pre-opened (only when a site exists)
    const launchHref = siteId ? `/editor/${siteId}?publish=1` : '/builder/new'

    // Step text comes from i18n; completionSource is non-secret diagnostic metadata for Shipping.
    const steps: OnboardingStep[] = [
        { id: 'products', done: hasProducts, href: '/products' },
        { id: 'design', done: isDesignCustomized, href: editHref },
        {
            id: 'shipping',
            done: hasShippingConfigured,
            href: '/settings/shipping',
            completionSource: shippingCompletionSource,
        },
        { id: 'launch', done: hasPublishedSite, href: launchHref },
    ]
    const allStepsDone = steps.every(s => s.done)
    const showOnboarding = blocks.includes('onboarding') && !allStepsDone

    const emptyPendingOrders: PendingOrdersLoadState = {
        state: 'ready',
        orders: [],
        totalCount: 0,
    }
    const pendingOrdersPromise: Promise<PendingOrdersLoadState> =
        tenantId != null
        && hasUsableSites
        && blocks.includes('orders')
        && canViewOrders
            ? getPendingOrdersData({ user })
                .then((data): PendingOrdersLoadState => ({ state: 'ready', ...data }))
                .catch((): PendingOrdersLoadState => {
                    console.error('[Dashboard] Pending Orders data is unavailable')
                    return { state: 'unavailable' }
                })
            : Promise.resolve(emptyPendingOrders)

    // Fetch independent block data in parallel only when the store has a usable site.
    const [glance, pendingOrders] = hasUsableSites
        ? await Promise.all([
            getGlanceData(period, { user }),
            pendingOrdersPromise,
        ])
        : [emptyGlanceData(), emptyPendingOrders]

    const renderBlocks = canViewOrders ? blocks : blocks.filter(id => id !== 'orders')

    const renderBlock = (id: DashboardBlockId) => {
        switch (id) {
            case 'onboarding':
                return showOnboarding ? <OnboardingCard key="onboarding" steps={steps} /> : null
            case 'glance':
                return <AtAGlance key="glance" data={glance} showHeader={showOnboarding} period={period} />
            case 'traffic':
                return <TrafficPerformanceClient key="traffic" period={period} />
            case 'seo':
                return siteId ? <SeoHealth key="seo" siteId={siteId} /> : null
            case 'orders':
                return <PendingOrders key="orders" data={pendingOrders} />
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

    const refreshKinds = dashboardRefreshKinds(renderBlocks, { onboarding: showOnboarding, canViewOrders })

    return (
        <div className="dash-revamp">
            {refreshKinds.length > 0 && <AgentRefresh kinds={refreshKinds} />}
            <div className="dash-toolbar">
                <DashboardToolbarHeader period={period} rangeLabel={glance.rangeLabel} />
                <div className="dt-right">
                    <PeriodSelector />
                    <CustomizeModal defaultVisible={blocks} onboardingComplete={allStepsDone} />
                </div>
            </div>

            <div className="stream">
                {renderBlocks.map(renderBlock)}
            </div>
        </div>
    )
}

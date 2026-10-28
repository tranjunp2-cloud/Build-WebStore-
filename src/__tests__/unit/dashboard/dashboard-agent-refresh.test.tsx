/**
 * TC-AICP-317 — the dashboard home (server-rendered To do card, glance, pending orders) renders again when the
 * assistant applies or undoes a change it shows: a burst of 3 changes refreshes ONCE, a change to something no block
 * shows (a blog post, a customer, a category) refreshes nothing, and hiding a block stops its kinds from refreshing.
 * Real: dashboard page, refresh-kinds, AgentRefresh, the change bus. Faked: Payload, auth, the other blocks, next/navigation.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAgentChange } from '@/lib/agent-changes/bus'
import type { AgentChange, AgentChangeEntity } from '@/lib/agent-changes/types'

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
    getPayload: vi.fn(),
    cookies: vi.fn(),
    findByID: vi.fn(),
    count: vi.fn(),
    find: vi.fn(),
}))

vi.mock('next/navigation', () => {
    const router = { refresh: mocks.refresh, push: vi.fn() }
    return { useRouter: () => router }
})
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, tenantIdForQuery: mocks.tenantIdForQuery }))
vi.mock('@/lib/dashboard/pending-orders-data', () => ({ canReadPendingOrders: vi.fn(() => true), getPendingOrdersData: vi.fn(async () => ({ orders: [], totalCount: 0 })) }))
vi.mock('@/lib/dashboard/glance-data', () => ({ getGlanceData: vi.fn(async () => ({ rangeLabel: 'x' })), emptyGlanceData: vi.fn(() => ({ rangeLabel: 'x' })) }))
vi.mock('@/components/dashboard/PeriodSelector', () => ({ PeriodSelector: () => <div /> }))
vi.mock('@/components/dashboard/revamp/customize-modal', () => ({ CustomizeModal: () => <div /> }))
vi.mock('@/components/dashboard/revamp/onboarding-card', () => ({ OnboardingCard: () => <div data-testid="onboarding-block" /> }))
vi.mock('@/components/dashboard/revamp/at-a-glance', () => ({ AtAGlance: () => <div /> }))
vi.mock('@/components/dashboard/revamp/traffic-performance-client', () => ({ TrafficPerformanceClient: () => <div /> }))
vi.mock('@/components/dashboard/revamp/seo-health', () => ({ SeoHealth: () => <div /> }))
vi.mock('@/components/dashboard/revamp/pending-orders', () => ({ PendingOrders: () => <div /> }))
vi.mock('@/components/dashboard/revamp/dashboard-toolbar-header', () => ({ DashboardToolbarHeader: () => <div /> }))
vi.mock('@/components/dashboard/DashboardEmptyState', () => ({ DashboardEmptyState: () => <div /> }))
vi.mock('@/components/dashboard/DashboardGenerationFailed', () => ({ DashboardGenerationFailed: () => <div /> }))

import DashboardRoot from '@/app/(dashboard)/dashboard/page'
import { dashboardRefreshKinds } from '@/app/(dashboard)/dashboard/refresh-kinds'

const user = { id: 7, roles: [], tenants: [{ tenant: 42, role: 'owner', status: 'active', permissions: [] }] }
let seq = 0
const change = (kind: string, ...entities: AgentChangeEntity[]): AgentChange => ({ action: 'applied', kind, entities, changeSetId: `cs-${++seq}`, at: Date.now() })
const announce = (...changes: AgentChange[]) => act(() => { changes.forEach(announceAgentChange); vi.advanceTimersByTime(150); vi.advanceTimersByTime(50) })

const renderPage = async (preferences?: string[]) => {
    mocks.findByID.mockResolvedValue({ settings: preferences ? { dashboardPreferences: preferences } : {} })
    render(await DashboardRoot({ searchParams: Promise.resolve({}) }))
}

describe('dashboard home refreshes with the assistant [TC-AICP-317]', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        seq = 0
        mocks.refresh.mockClear()
        mocks.getCurrentUser.mockResolvedValue(user)
        mocks.tenantIdForQuery.mockReturnValue(42)
        mocks.cookies.mockResolvedValue({ get: () => undefined })
        mocks.getPayload.mockResolvedValue({ findByID: mocks.findByID, count: mocks.count, find: mocks.find })
        mocks.count.mockResolvedValue({ totalDocs: 1 })
        mocks.find.mockResolvedValue({ docs: [{ id: 'site-1', themeCustomized: true, status: 'published', shippingConfig: { shippingSetupConfirmed: true } }] })
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('TC-AICP-317 renders the server data once for a burst of 3 matching changes', async () => {
        await renderPage()

        announce(
            change('store.orders_patch', { kind: 'store_order', id: '1' }),
            change('store.discounts_patch', { kind: 'store_discount', id: '2' }),
            change('shop_product.set_status', { kind: 'product', id: '3' }),
        )

        expect(mocks.refresh).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-317 ignores changes to things no block shows', async () => {
        await renderPage()

        announce(
            change('blog.update', { kind: 'blog_post', id: '1' }),
            change('store.customers_patch', { kind: 'store_customer', id: '2' }),
            change('store.categories_patch', { kind: 'store_category', id: '3' }),
            change('shop_product.create_drafts', { kind: 'media', id: '*' }),
        )

        expect(mocks.refresh).not.toHaveBeenCalled()
    })

    it('TC-AICP-317 no longer refreshes for a site page change (no Issues block on the page), still does for an undone order', async () => {
        await renderPage()

        announce({ ...change('site.seo_patch', { kind: 'site_page', id: 'p1' }), action: 'undone' })
        expect(mocks.refresh).not.toHaveBeenCalled()

        announce({ ...change('store.orders_patch', { kind: 'store_order', id: '1' }), action: 'undone' })
        expect(mocks.refresh).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-317 stops refreshing for orders when the merchant hid every block that shows them', async () => {
        await renderPage(['traffic', 'seo'])

        announce(change('store.orders_patch', { kind: 'store_order', id: '1' }))

        expect(mocks.refresh).not.toHaveBeenCalled()
    })

    it('TC-AICP-317 derives the kinds from the blocks on show', () => {
        expect(dashboardRefreshKinds(['traffic', 'seo'], { onboarding: false, canViewOrders: true })).toEqual([])
        expect(dashboardRefreshKinds(['glance'], { onboarding: false, canViewOrders: true })).toEqual(['store_order'])
        expect(dashboardRefreshKinds(['glance'], { onboarding: false, canViewOrders: false })).toEqual([])
        expect(dashboardRefreshKinds(['onboarding'], { onboarding: true, canViewOrders: true })).toEqual(expect.arrayContaining(['product', 'site_theme']))
        expect(dashboardRefreshKinds(['orders'], { onboarding: false, canViewOrders: true })).toEqual(['store_order'])
    })
})

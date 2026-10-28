/**
 * Dashboard Pending Orders orchestration tests — GH-1627
 * Coverage Map:
 *   TC-F03.73 → tenant, usable-site, block, and permission gates
 *   TC-F03.74 → fail-soft Pending Orders loading
 *   TC-F03.78–80 → Self Delivery/EasyParcel shipping setup truth table
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PendingOrdersLoadState } from '@/lib/dashboard/dashboard-types'
import type { OnboardingStep } from '@/components/dashboard/revamp/onboarding-card'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
    getPayload: vi.fn(),
    canReadPendingOrders: vi.fn(),
    getPendingOrdersData: vi.fn(),
    getGlanceData: vi.fn(),
    emptyGlanceData: vi.fn(),
    getSeoData: vi.fn(),
    findByID: vi.fn(),
    count: vi.fn(),
    find: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/agent-changes/agent-refresh', () => ({ AgentRefresh: () => null }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: mocks.getCurrentUser,
    tenantIdForQuery: mocks.tenantIdForQuery,
}))
vi.mock('@/lib/dashboard/pending-orders-data', () => ({
    canReadPendingOrders: mocks.canReadPendingOrders,
    getPendingOrdersData: mocks.getPendingOrdersData,
}))
vi.mock('@/lib/dashboard/glance-data', () => ({
    getGlanceData: mocks.getGlanceData,
    emptyGlanceData: mocks.emptyGlanceData,
}))
vi.mock('@/lib/dashboard/seo-data', () => ({
    getSeoData: mocks.getSeoData,
}))

vi.mock('@/components/dashboard/PeriodSelector', () => ({
    PeriodSelector: () => <div data-testid="period-selector" />,
}))
vi.mock('@/components/dashboard/revamp/customize-modal', () => ({
    CustomizeModal: () => <div data-testid="customize-modal" />,
}))
vi.mock('@/components/dashboard/revamp/onboarding-card', () => ({
    OnboardingCard: ({ steps }: { steps: OnboardingStep[] }) => (
        <div data-testid="onboarding-block">
            {steps.map(step => (
                <div
                    key={step.id}
                    data-testid={'onboarding-step-' + step.id}
                    data-done={String(step.done)}
                    data-completion-source={step.completionSource}
                />
            ))}
        </div>
    ),
}))
vi.mock('@/components/dashboard/revamp/at-a-glance', () => ({
    AtAGlance: () => <div data-testid="glance-block" />,
}))
vi.mock('@/components/dashboard/revamp/traffic-performance-client', () => ({
    TrafficPerformanceClient: () => <div data-testid="traffic-block" />,
}))
vi.mock('@/components/dashboard/revamp/seo-health', () => ({
    SeoHealth: () => <div data-testid="seo-block" />,
}))
vi.mock('@/components/dashboard/revamp/pending-orders', () => ({
    PendingOrders: ({ data }: { data: PendingOrdersLoadState }) => (
        <div data-testid="pending-orders-block">{data.state}</div>
    ),
}))
vi.mock('@/components/dashboard/revamp/dashboard-toolbar-header', () => ({
    DashboardToolbarHeader: () => <div data-testid="toolbar-header" />,
}))
vi.mock('@/components/dashboard/DashboardEmptyState', () => ({
    DashboardEmptyState: () => <div data-testid="dashboard-empty-state" />,
}))
vi.mock('@/components/dashboard/DashboardGenerationFailed', () => ({
    DashboardGenerationFailed: () => <div data-testid="dashboard-generation-failed" />,
}))

import DashboardRoot from '@/app/(dashboard)/dashboard/page'

const authorizedUser = {
    id: 7,
    roles: [],
    tenants: [{
        tenant: 42,
        role: 'owner',
        status: 'active',
        permissions: [],
    }],
}

async function renderDashboard() {
    const dashboard = await DashboardRoot({ searchParams: Promise.resolve({}) })
    return render(dashboard)
}

describe('DashboardRoot Pending Orders orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.getCurrentUser.mockResolvedValue(authorizedUser)
        mocks.tenantIdForQuery.mockReturnValue(42)
        mocks.canReadPendingOrders.mockReturnValue(true)
        mocks.getPayload.mockResolvedValue({
            findByID: mocks.findByID,
            count: mocks.count,
            find: mocks.find,
        })
        mocks.findByID.mockResolvedValue({
            settings: {
                dashboardPreferences: ['glance', 'traffic', 'seo', 'tools', 'orders'],
            },
        })
        mocks.count.mockResolvedValue({ totalDocs: 1 })
        mocks.find.mockResolvedValue({
            docs: [{
                id: 'site-1',
                themeCustomized: true,
                status: 'published',
                shippingConfig: { shippingSetupConfirmed: true },
            }],
        })
        mocks.getGlanceData.mockResolvedValue({ rangeLabel: '1–7 Jul 2026' })
        mocks.emptyGlanceData.mockReturnValue({ rangeLabel: '1–7 Jul 2026' })
        mocks.getSeoData.mockResolvedValue({
            siteId: 'site-1',
            autoMetaEnabled: true,
            aiCrawlersEnabled: true,
        })
        mocks.getPendingOrdersData.mockResolvedValue({
            orders: [],
            totalCount: 0,
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('[TC-F03.73] skips the query and widget when no tenant is available', async () => {
        // Arrange
        mocks.tenantIdForQuery.mockReturnValue(null)
        mocks.canReadPendingOrders.mockReturnValue(false)

        // Act
        await renderDashboard()

        // Assert
        expect(mocks.getPayload).not.toHaveBeenCalled()
        expect(mocks.getPendingOrdersData).not.toHaveBeenCalled()
        expect(screen.queryByTestId('pending-orders-block')).not.toBeInTheDocument()
    })

    it('[TC-F03.73] skips the query and widget when no usable site exists', async () => {
        // Arrange
        mocks.count
            .mockResolvedValueOnce({ totalDocs: 0 })
            .mockResolvedValueOnce({ totalDocs: 0 })

        // Act
        await renderDashboard()

        // Assert
        expect(mocks.getPendingOrdersData).not.toHaveBeenCalled()
        expect(screen.queryByTestId('pending-orders-block')).not.toBeInTheDocument()
        expect(screen.getByTestId('dashboard-empty-state')).toBeInTheDocument()
    })

    it('[TC-F03.73] skips the query and widget when the Orders block is disabled', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            settings: {
                dashboardPreferences: ['glance', 'traffic', 'seo', 'tools'],
            },
        })

        // Act
        await renderDashboard()

        // Assert
        expect(mocks.getPendingOrdersData).not.toHaveBeenCalled()
        expect(screen.queryByTestId('pending-orders-block')).not.toBeInTheDocument()
        expect(screen.getByTestId('glance-block')).toBeInTheDocument()
    })

    it('[TC-F03.73] skips the query and widget when the user lacks Orders permission', async () => {
        // Arrange
        mocks.canReadPendingOrders.mockReturnValue(false)

        // Act
        await renderDashboard()

        // Assert
        expect(mocks.getPendingOrdersData).not.toHaveBeenCalled()
        expect(screen.queryByTestId('pending-orders-block')).not.toBeInTheDocument()
        expect(screen.getByTestId('glance-block')).toBeInTheDocument()
    })

    it('[TC-F03.73] loads and renders Pending Orders when all gates pass', async () => {
        // Arrange
        mocks.getPendingOrdersData.mockResolvedValue({
            orders: [],
            totalCount: 0,
        })

        // Act
        await renderDashboard()

        // Assert
        expect(mocks.getPendingOrdersData).toHaveBeenCalledTimes(1)
        expect(mocks.getPendingOrdersData).toHaveBeenCalledWith({ user: authorizedUser })
        expect(mocks.getGlanceData).toHaveBeenCalledWith(expect.anything(), { user: authorizedUser })
        expect(screen.getByTestId('pending-orders-block')).toHaveTextContent('ready')
    })

    it('[TC-F03.74] isolates loader failure and keeps independent blocks visible', async () => {
        // Arrange
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.getPendingOrdersData.mockRejectedValue(new Error('tenant 42 order ORD-SECRET'))

        // Act
        await renderDashboard()

        // Assert
        expect(screen.getByTestId('pending-orders-block')).toHaveTextContent('unavailable')
        expect(screen.getByTestId('glance-block')).toBeInTheDocument()
        expect(screen.getByTestId('traffic-block')).toBeInTheDocument()
        expect(screen.getByTestId('seo-block')).toBeInTheDocument()
        expect(screen.queryByTestId('tools-block')).not.toBeInTheDocument()
        expect(errorSpy).toHaveBeenCalledWith('[Dashboard] Pending Orders data is unavailable')
        expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('ORD-SECRET')
        expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('tenant 42')
    })

    it('[TC-F03.78] marks Shipping complete when only EasyParcel is enabled', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            settings: { dashboardPreferences: ['onboarding', 'glance'] },
            easyParcelIntegration: { enabled: true },
        })
        mocks.find.mockResolvedValue({
            docs: [{
                id: 'site-1',
                themeCustomized: false,
                status: 'published',
                shippingConfig: { shippingSetupConfirmed: false },
            }],
        })

        // Act
        await renderDashboard()

        // Assert
        const shippingStep = screen.getByTestId('onboarding-step-shipping')
        expect(shippingStep).toHaveAttribute('data-done', 'true')
        expect(shippingStep).toHaveAttribute('data-completion-source', 'easyparcel')
    })

    it('[TC-F03.79] marks Shipping complete when only Self Delivery is confirmed', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            settings: { dashboardPreferences: ['onboarding', 'glance'] },
            easyParcelIntegration: { enabled: false },
        })
        mocks.find.mockResolvedValue({
            docs: [{
                id: 'site-1',
                themeCustomized: false,
                status: 'published',
                shippingConfig: { shippingSetupConfirmed: true },
            }],
        })

        // Act
        await renderDashboard()

        // Assert
        const shippingStep = screen.getByTestId('onboarding-step-shipping')
        expect(shippingStep).toHaveAttribute('data-done', 'true')
        expect(shippingStep).toHaveAttribute('data-completion-source', 'self-delivery')
    })

    it('[TC-F03.80] keeps Shipping incomplete when neither method is configured', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            settings: { dashboardPreferences: ['onboarding', 'glance'] },
            easyParcelIntegration: { enabled: false },
        })
        mocks.find.mockResolvedValue({
            docs: [{
                id: 'site-1',
                themeCustomized: false,
                status: 'published',
                shippingConfig: { shippingSetupConfirmed: false },
            }],
        })

        // Act
        await renderDashboard()

        // Assert
        expect(screen.getByTestId('onboarding-step-shipping')).toHaveAttribute('data-done', 'false')
    })

    it('[TC-F03.80] keeps Shipping incomplete when optional setup groups are missing', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            settings: { dashboardPreferences: ['onboarding', 'glance'] },
        })
        mocks.find.mockResolvedValue({
            docs: [{
                id: 'site-1',
                themeCustomized: false,
                status: 'published',
            }],
        })

        // Act
        await renderDashboard()

        // Assert
        expect(screen.getByTestId('onboarding-step-shipping')).toHaveAttribute('data-done', 'false')
    })
})

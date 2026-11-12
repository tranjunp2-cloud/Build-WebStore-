/**
 * TC-PERF-008, TC-PERF-009, TC-PERF-012 — a DB incident shows "Couldn't load — try again", never a 500 or a login.
 * Real: dashboard page + layout, (dashboard)/error.tsx, LoadRetryState, I18nProvider, AuthUnavailableError,
 * tenantIdForQuery. Faked: getCurrentUser's outcome, Payload reads, child blocks, the router.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getPayload: vi.fn(),
    findByID: vi.fn(),
    count: vi.fn(),
    refresh: vi.fn(),
    cookies: vi.fn(async () => ({ get: () => undefined })),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }), redirect: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/auth', async () => {
    const unavailable = await vi.importActual<typeof import('@/lib/auth/auth-unavailable')>('@/lib/auth/auth-unavailable')
    // tenantIdForQuery is pure: the real one.
    const real = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
    return { ...unavailable, getCurrentUser: mocks.getCurrentUser, tenantIdForQuery: real.tenantIdForQuery }
})
vi.mock('@/lib/agent-changes/agent-refresh', () => ({ AgentRefresh: () => null }))
vi.mock('@/lib/dashboard/pending-orders-data', () => ({ canReadPendingOrders: vi.fn(() => false), getPendingOrdersData: vi.fn() }))
vi.mock('@/lib/dashboard/glance-data', () => ({ getGlanceData: vi.fn(), emptyGlanceData: vi.fn(() => ({ rangeLabel: 'x' })) }))
vi.mock('@/components/dashboard/PeriodSelector', () => ({ PeriodSelector: () => <div /> }))
vi.mock('@/components/dashboard/revamp/customize-modal', () => ({ CustomizeModal: () => <div /> }))
vi.mock('@/components/dashboard/revamp/onboarding-card', () => ({ OnboardingCard: () => <div /> }))
vi.mock('@/components/dashboard/revamp/at-a-glance', () => ({ AtAGlance: () => <div /> }))
vi.mock('@/components/dashboard/revamp/traffic-performance-client', () => ({ TrafficPerformanceClient: () => <div /> }))
vi.mock('@/components/dashboard/revamp/seo-health', () => ({ SeoHealth: () => <div /> }))
vi.mock('@/components/dashboard/revamp/pending-orders', () => ({ PendingOrders: () => <div /> }))
vi.mock('@/components/dashboard/revamp/dashboard-toolbar-header', () => ({ DashboardToolbarHeader: () => <div /> }))
vi.mock('@/components/dashboard/DashboardEmptyState', () => ({ DashboardEmptyState: () => <div data-testid="dashboard-empty-state" /> }))
vi.mock('@/components/dashboard/DashboardGenerationFailed', () => ({ DashboardGenerationFailed: () => <div /> }))
// layout children
vi.mock('@/components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/providers/theme-provider', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/lib/dashboard/sidebar-badge-counts-cached', () => ({ getCachedSidebarBadgeCounts: vi.fn(async () => ({})) }))
vi.mock('@/lib/dashboard/get-tenant-site-state', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/dashboard/get-tenant-site-state')>()),
    getTenantSiteState: vi.fn(async () => ({ hasUsableSite: true })),
    // the layout + page share one sites read per request (TC-PERF-055)
    findDashboardSites: vi.fn(async () => [{ id: 1, generationStatus: 'completed' }]),
}))
vi.mock('@/app/(dashboard)/_components/CMSLayoutClient', () => ({
    CMSLayoutClient: ({ children }: { children: React.ReactNode }) => <div data-testid="cms-shell">{children}</div>,
}))
vi.mock('@/components/dashboard/AIDiscoveryWizard', () => ({ AIDiscoveryWizard: () => null }))
vi.mock('@/providers/NotificationProvider', () => ({ NotificationProvider: () => null }))
vi.mock('@/components/notifications/ToastContainer', () => ({ ToastContainer: () => null }))
vi.mock('@/components/notifications/PushOptInPrompt', () => ({ PushOptInPrompt: () => null }))
vi.mock('@/components/agent/DashboardAgentDockLoader', () => ({ DashboardAgentDockLoader: () => null }))
vi.mock('@/lib/ai-platform/config', () => ({ isAiAgentEnabled: () => false }))

import { I18nProvider } from '@/i18n'
import { AuthUnavailableError } from '@/lib/auth/auth-unavailable'
import DashboardRoot from '@/app/(dashboard)/dashboard/page'
import DashboardLayout from '@/app/(dashboard)/layout'
import DashboardError from '@/app/(dashboard)/error'

const RETRY_TITLE = "Couldn't load this page"
const poolTimeout = () => Object.assign(new Error('Failed query'), { cause: new Error('timeout exceeded when trying to connect') })

async function renderPage() {
    const page = await DashboardRoot({ searchParams: Promise.resolve({}) })
    return render(<I18nProvider defaultLocale="en">{page}</I18nProvider>)
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getPayload.mockResolvedValue({ findByID: mocks.findByID, count: mocks.count })
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
})

describe('dashboard page when the session cannot be checked [TC-PERF-008]', () => {
    it('renders the retry state instead of throwing', async () => {
        // Arrange
        mocks.getCurrentUser.mockRejectedValue(new AuthUnavailableError(poolTimeout()))

        // Act
        await renderPage()

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent(RETRY_TITLE)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })
})

describe('dashboard page tenant data and null users [TC-PERF-009]', () => {
    it('renders the retry state when a tenant query times out', async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: 7, tenants: [{ tenant: 42 }] })
        mocks.findByID.mockRejectedValue(poolTimeout())

        await renderPage()

        expect(screen.getByRole('alert')).toHaveTextContent(RETRY_TITLE)
    })

    it('renders the normal empty state for a null user (no tenantIdForQuery crash)', async () => {
        mocks.getCurrentUser.mockResolvedValue(null)

        await renderPage()

        expect(screen.getByTestId('dashboard-empty-state')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).toBeNull()
    })
})

describe('dashboard layout and error boundary [TC-PERF-012]', () => {
    it('layout shows the retry state, not the shell or a login redirect, when the session cannot be checked', async () => {
        mocks.getCurrentUser.mockRejectedValue(new AuthUnavailableError(poolTimeout()))

        const layout = await DashboardLayout({ children: <div data-testid="page" /> })
        render(layout)

        expect(screen.getByRole('alert')).toHaveTextContent(RETRY_TITLE)
        expect(screen.queryByTestId('cms-shell')).toBeNull()
        expect(screen.queryByTestId('page')).toBeNull()
    })

    it('layout reads the avatar off the session user (no second users read)', async () => {
        mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'a@b.my', tenants: [{ tenant: { id: 42 } }], avatar: { url: '/a.png' } })

        const layout = await DashboardLayout({ children: <div data-testid="page" /> })
        render(layout)

        expect(screen.getByTestId('page')).toBeInTheDocument()
        expect(mocks.findByID).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'users' }))
        // the one by-id read left is the store name for the feedback report (#2050): name only, no relations
        for (const [args] of mocks.findByID.mock.calls) {
            expect(args).toMatchObject({ collection: 'tenants', depth: 0, select: { name: true } })
        }
    })

    it('error boundary offers a retry that re-fetches the server data and resets', () => {
        const reset = vi.fn()
        render(<I18nProvider defaultLocale="en"><DashboardError error={new Error('x')} reset={reset} /></I18nProvider>)

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

        expect(mocks.refresh).toHaveBeenCalledTimes(1)
        expect(reset).toHaveBeenCalledTimes(1)
    })
})

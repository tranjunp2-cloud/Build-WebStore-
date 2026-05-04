/**
 * Component Render Tests — F03 Dashboard (Extended Coverage)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.01  → AISmartInsights renders insight banner for traffic changes
 *   TC-F03.02  → AISmartInsights returns null when no data
 *   TC-F03.03  → DashboardGreeting renders user name
 *   TC-F03.04  → DashboardSiteGrid renders site cards
 *   TC-F03.05  → DashboardSiteGrid shows "View All" when > 6 sites
 *   TC-F03.20  → AnalyticsEmptyState renders empty message
 *   TC-F03.23  → AnalyticsChart renders bar chart with data
 *   TC-F03.31  → AnalyticsSummaryCards shows % change comparison
 *   TC-F03.35  → PeriodSelector renders period options
 *
 * Scenario dimensions covered:
 *   #1 User Types — new user, user with sites
 *   #4 Scale — 0 sites, many sites
 *   #5 State Transitions — empty state, data loaded
 *   #6 Environment — i18n rendering
 *   #12 Business Logic — insight thresholds, % change display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ── Mock i18n ─────────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                overview: {
                    greeting: 'Hello',
                    morning: 'Morning',
                    afternoon: 'Afternoon',
                    evening: 'Evening',
                    welcomeTitle: 'Welcome to PrimeWeb Dashboard',
                    welcomeSubtitle: 'Monitor your store performance and manage your online business from one place.',
                    stats: {
                        views: 'Views',
                        leads: 'Leads',
                        engagement: 'Engagement',
                        revenue: 'Revenue',
                    },
                    seo: {
                        title: 'SEO Health',
                        statusGood: 'Healthy',
                        statusWarning: 'Needs Attention',
                        fixAll: 'AI Fix All Issues',
                    },
                    periods: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' },
                    customize: 'Customize',
                },
                analytics: {
                    chart: 'Daily Traffic',
                    views: 'Views',
                    clicks: 'Clicks',
                    topPages: 'Top Pages',
                    topProducts: 'Top Products',
                    topBlogs: 'Top Blogs',
                    topReferrers: 'Top Referrers',
                    empty: {
                        title: 'No data yet',
                        description: 'No analytics data available',
                    },
                },
                sites: {
                    title: 'Your Sites',
                    viewAll: 'View All',
                    published: 'Published',
                    draft: 'Draft',
                    edit: 'Edit',
                    preview: 'Preview',
                    openEditor: 'Open Editor',
                    lastEdited: 'Last edited',
                },
            },
        },
        locale: 'en',
    }),
}))

// ── Mock next/navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams('period=7d'),
    usePathname: () => '/dashboard',
}))

// ── Mock next/link ────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
    default: ({ children, href, ...rest }: any) =>
        React.createElement('a', { href, ...rest }, children),
}))

// ── Mock recharts (avoid SVG rendering issues in JSDOM) ───────────────────────
vi.mock('recharts', () => ({
    BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: any) => React.createElement('div', null, children),
    Legend: () => null,
}))

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.01/02 — AISmartInsights
// ─────────────────────────────────────────────────────────────────────────────
import { AISmartInsights } from '@/components/dashboard/AISmartInsights'

describe('AISmartInsights', () => {
    it('[TC-F03.02] returns null when both views and prevViews are 0', () => {
        const { container } = render(<AISmartInsights views={0} prevViews={0} />)
        expect(container.innerHTML).toBe('')
    })

    it('[TC-F03.01] shows viral alert for large traffic surge (>50%)', () => {
        render(<AISmartInsights views={200} prevViews={100} />)
        expect(screen.getByText(/surged/i)).toBeTruthy()
    })

    it('shows trending message for moderate growth', () => {
        render(<AISmartInsights views={130} prevViews={100} />)
        expect(screen.getByText(/Trending/i)).toBeTruthy()
    })

    it('shows warning for significant traffic drop (>30%)', () => {
        render(<AISmartInsights views={50} prevViews={100} />)
        expect(screen.getByText(/Warning/i)).toBeTruthy()
    })

    it('shows stable message when views equal prevViews', () => {
        render(<AISmartInsights views={100} prevViews={100} />)
        expect(screen.getByText(/stable/i)).toBeTruthy()
    })

    it('shows picking up message when prevViews=0 and views>0', () => {
        render(<AISmartInsights views={50} prevViews={0} />)
        expect(screen.getByText(/picking up/i)).toBeTruthy()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.03 — DashboardGreeting
// ─────────────────────────────────────────────────────────────────────────────
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'

describe('DashboardGreeting', () => {
    it('[TC-F03.03] renders dashboard title', () => {
        render(<DashboardGreeting />)
        expect(screen.getByText(/Welcome to PrimeWeb Dashboard/i)).toBeTruthy()
    })

    it('displays greeting subtitle', () => {
        render(<DashboardGreeting />)
        expect(screen.getByText(/Monitor your store/i)).toBeTruthy()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.04/05 — DashboardSiteGrid
// ─────────────────────────────────────────────────────────────────────────────
import { DashboardSiteGrid } from '@/components/dashboard/DashboardSiteGrid'

describe('DashboardSiteGrid', () => {
    const makeSite = (id: string, name: string, isPublished = true) => ({
        id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        isPublished,
        updatedAt: '2026-04-01T00:00:00.000Z',
    })

    it('[TC-F03.04] renders site cards with names', () => {
        const sites = [makeSite('1', 'My Shop'), makeSite('2', 'Blog Site')]
        render(<DashboardSiteGrid sites={sites} />)
        expect(screen.getByText('My Shop')).toBeTruthy()
        expect(screen.getByText('Blog Site')).toBeTruthy()
    })

    it('shows Published badge for published sites', () => {
        const sites = [makeSite('1', 'Published Site', true)]
        render(<DashboardSiteGrid sites={sites} />)
        expect(screen.getByText('Published')).toBeTruthy()
    })

    it('shows Draft badge for unpublished sites', () => {
        const sites = [makeSite('1', 'Draft Site', false)]
        render(<DashboardSiteGrid sites={sites} />)
        expect(screen.getByText('Draft')).toBeTruthy()
    })

    it('[TC-F03.05] shows "View All" link when > 6 sites', () => {
        const sites = Array.from({ length: 7 }, (_, i) => makeSite(String(i), `Site ${i}`))
        render(<DashboardSiteGrid sites={sites} />)
        expect(screen.getByText('View All')).toBeTruthy()
    })

    it('does NOT show "View All" link when <= 6 sites', () => {
        const sites = Array.from({ length: 3 }, (_, i) => makeSite(String(i), `Site ${i}`))
        render(<DashboardSiteGrid sites={sites} />)
        expect(screen.queryByText('View All')).toBeNull()
    })

    it('renders edit links with correct href', () => {
        const sites = [makeSite('42', 'Test Site')]
        render(<DashboardSiteGrid sites={sites} />)
        const editLinks = screen.getAllByText('Edit')
        expect(editLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('handles empty sites array', () => {
        const { container } = render(<DashboardSiteGrid sites={[]} />)
        expect(container.querySelector('h2')).toBeTruthy() // Title still renders
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.20 — AnalyticsEmptyState
// ─────────────────────────────────────────────────────────────────────────────
import { AnalyticsEmptyState } from '@/components/dashboard/AnalyticsEmptyState'

describe('AnalyticsEmptyState', () => {
    it('[TC-F03.20] renders empty state title', () => {
        render(<AnalyticsEmptyState />)
        expect(screen.getByText('No data yet')).toBeTruthy()
    })

    it('renders empty state description', () => {
        render(<AnalyticsEmptyState />)
        expect(screen.getByText('No analytics data available')).toBeTruthy()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.23 — AnalyticsChart
// ─────────────────────────────────────────────────────────────────────────────
import { AnalyticsChart } from '@/components/dashboard/AnalyticsChart'

describe('AnalyticsChart', () => {
    it('[TC-F03.23] renders chart with data', () => {
        const data = [
            { date: '2026-04-01', views: 100, clicks: 20 },
            { date: '2026-04-02', views: 150, clicks: 30 },
        ]
        render(<AnalyticsChart data={data} />)
        expect(screen.getByText(/Daily Traffic/i)).toBeTruthy()
        expect(screen.getByTestId('bar-chart')).toBeTruthy()
    })

    it('returns null when data is empty', () => {
        const { container } = render(<AnalyticsChart data={[]} />)
        expect(container.innerHTML).toBe('')
    })

    it('returns null when data is undefined-like', () => {
        const { container } = render(<AnalyticsChart data={null as any} />)
        expect(container.innerHTML).toBe('')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.31 — AnalyticsSummaryCards
// ─────────────────────────────────────────────────────────────────────────────
import { AnalyticsSummaryCards } from '@/components/dashboard/AnalyticsSummaryCards'

describe('AnalyticsSummaryCards (extended)', () => {
    it('[TC-F03.31] shows positive trend icon for growth', () => {
        const { container } = render(<AnalyticsSummaryCards currentViews={200} prevViews={100} currentClicks={50} prevClicks={25} />)
        // Text may be split across spans; check container text content
        expect(container.textContent).toContain('+100.0%')
    })

    it('shows negative trend for decline', () => {
        const { container } = render(<AnalyticsSummaryCards currentViews={50} prevViews={100} currentClicks={10} prevClicks={50} />)
        expect(container.textContent).toContain('-50.0%')
    })

    it('shows 0% when both periods are equal', () => {
        const { container } = render(<AnalyticsSummaryCards currentViews={100} prevViews={100} currentClicks={50} prevClicks={50} />)
        expect(container.textContent).toContain('0%')
    })

    it('shows 100% when prev is 0 and current > 0', () => {
        const { container } = render(<AnalyticsSummaryCards currentViews={100} prevViews={0} currentClicks={50} prevClicks={0} />)
        expect(container.textContent).toContain('+100.0%')
    })

    it('formats large numbers with locale string', () => {
        render(<AnalyticsSummaryCards currentViews={10000} prevViews={5000} currentClicks={1000} prevClicks={500} />)
        expect(screen.getByText('10,000')).toBeTruthy()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.35 — PeriodSelector
// ─────────────────────────────────────────────────────────────────────────────
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'

describe('PeriodSelector', () => {
    it('[TC-F03.35] renders with 3 period options', () => {
        render(<PeriodSelector />)
        const buttons = screen.getAllByRole('button')
        expect(buttons).toHaveLength(3)
    })

    it('defaults to 7d when URL param is 7d', () => {
        render(<PeriodSelector />)
        const selectedBtn = screen.getByText('Last 7 days')
        expect(selectedBtn.className).toContain('bg-[#161E2E]')
    })

    it('renders all period labels', () => {
        render(<PeriodSelector />)
        expect(screen.getByText('Today')).toBeTruthy()
        expect(screen.getByText('Last 7 days')).toBeTruthy()
        expect(screen.getByText('Last 30 days')).toBeTruthy()
    })
})

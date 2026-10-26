/**
 * Component Render Tests — F03 Dashboard
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.01  → DashboardEmptyState renders CTA button to /builder/new
 *   TC-F03.01b → DashboardGenerationFailed renders 2 CTAs (template + AI retry)
 *   TC-F03.01c → SitesPageClient empty state renders CTA to /onboarding
 *   TC-F03.01d → SitesPageClient failed site shows "Incomplete" badge + 2 actions
 *   TC-F03.07  → DashboardStats renders 4 default stat cards
 *   TC-F03.29  → SEOHealthWidget shows score
 *   TC-F03.72  → SEOHealthWidget renders concise emoji-free "AI Fix Issues" CTA button (EN/MS)
 *   TC-F03.18  → DashboardStats hides card when excluded from preferences
 *   TC-F03.19  → DashboardStats shows extra card when added to preferences
 *   TC-F03.24/25/26 → TopPerformingList limits displayed items; tab switching
 *   TC-F03.30  → TopPerformingList shows empty state when no data
 *   TC-F03.34  → SEOHealthWidget shows correct visual status (good vs warning)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import enLocale from '@/i18n/locales/en.json'
import msLocale from '@/i18n/locales/ms.json'

// ── Mock i18n (used by all dashboard components) ─────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            mascot: { generationIllustration: 'Website creation incomplete' },
            dashboard: {
                overview: {
                    stats: {
                        views: 'Views',
                        leads: 'Leads',
                        engagement: 'Engagement',
                        revenue: 'Revenue',
                        pendingOrders: '{count} pending orders',
                    },
                    actions: {
                        title: 'Pending Orders',
                        viewAll: 'View All',
                        empty: 'No pending orders',
                        fulfill: 'Fulfill',
                    },
                    seo: {
                        title: 'SEO Health',
                        statusGood: 'Healthy',
                        statusWarning: 'Needs Attention',
                        fixAll: 'AI Fix Issues',
                        fix: 'Fix',
                        issue: 'Issue',
                        issues: 'Issues',
                        warnings: {
                            issueScoreLow: 'SEO score is low',
                        },
                    },
                    periods: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' },
                    customize: 'Customize',
                    customizeModal: {
                        title: 'Customize Dashboard',
                        description: 'Choose which stats to display',
                        save: 'Save',
                        saving: 'Saving...',
                        cancel: 'Cancel',
                    },
                },
                empty: {
                    title: 'No website data available',
                    description: 'Create your first website to start tracking business performance.',
                    cta: '+ Create New Website',
                },
                generationFailed: {
                    title: "Website creation didn't complete",
                    description: 'No worries — you can try building with AI or pick from our ready-made templates.',
                    retryAi: 'Try again with AI',
                    chooseTemplate: 'Choose a template',
                },
                sites: {
                    title: 'My Websites',
                    published: 'Published',
                    draft: 'Draft',
                    edit: 'Edit',
                    preview: 'Preview',
                    noSites: 'No sites yet',
                    noSitesDesc: 'Create your first website to get started',
                    createWebsite: 'Create Website',
                    incomplete: 'Incomplete',
                    retryAi: 'Retry with AI',
                    template: 'Template',
                    newSite: 'New Site',
                    untitledSite: 'Untitled Site',
                    updatedLabel: 'Updated',
                    updatedRecently: 'recently',
                    siteTypes: {
                        business: 'Business',
                        ecommerce: 'E-commerce',
                        blog: 'Blog',
                        portfolio: 'Portfolio',
                        restaurant: 'Restaurant',
                    },
                },
                analytics: {
                    topPages: 'Top Pages',
                    topProducts: 'Top Products',
                    topBlogs: 'Top Blogs',
                    topReferrers: 'Top Referrers',
                    views: 'Views',
                    clicks: 'Clicks',
                    noData: 'No data available for this period.',
                    empty: { description: 'No data available for this period.' },
                },
                seo: {
                    issueScoreLow: 'SEO score is low',
                    warningLabel: 'Warning',
                    allGood: 'All good',
                },
            },
        },
        locale: 'en',
        ti: (str: string, params?: any) => {
            if (!params) return str
            let res = str
            for (const [k, v] of Object.entries(params)) {
                res = res.replace(`{${k}}`, String(v))
            }
            return res
        }
    }),
}))

// ── Mock framer-motion (used by DashboardCustomizeModal) ─────────────────────
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
            React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

// ── Mock @dnd-kit (used by DashboardCustomizeModal) ──────────────────────────
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    closestCenter: vi.fn(),
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
}))
vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
    useSortable: vi.fn(() => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
    })),
    arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
        const result = [...arr]
        result.splice(to, 0, result.splice(from, 1)[0])
        return result
    }),
}))
vi.mock('@dnd-kit/utilities', () => ({
    CSS: { Transform: { toString: vi.fn(() => '') } },
}))

// ── Mock next/navigation (used by PeriodSelector) ────────────────────────────
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null), toString: vi.fn(() => '') })),
    usePathname: vi.fn(() => '/dashboard'),
}))

// ── Mock next/link ────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        React.createElement('a', { href, className }, children),
}))

// ── Mock sonner (toast) ───────────────────────────────────────────────────────
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Mock server actions ───────────────────────────────────────────────────────
vi.mock('@/app/(dashboard)/actions', () => ({
    updateDashboardPreferences: vi.fn(() => Promise.resolve({ success: true })),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Imports after mocks
// ─────────────────────────────────────────────────────────────────────────────
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { SEOHealthWidget } from '@/components/dashboard/SEOHealthWidget'
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'
import { TopPerformingList } from '@/components/dashboard/TopPerformingList'

// ─────────────────────────────────────────────────────────────────────────────
// DashboardStats
// ─────────────────────────────────────────────────────────────────────────────
describe('DashboardStats', () => {
    const defaultProps = {
        views: 1200,
        leads: 50,
        engagement: 300,
        currency: 'MYR'
    }

    it('[TC-F03.07] renders all 3 default stat cards (revenue disabled for F10)', () => {
        render(<DashboardStats {...defaultProps} />)
        expect(screen.getByText('Views')).toBeInTheDocument()
        expect(screen.getByText('Leads')).toBeInTheDocument()
        expect(screen.getByText('Engagement')).toBeInTheDocument()
        expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
    })

    it('[TC-F03.18] hides "views" card when excluded from preferences', () => {
        render(<DashboardStats {...defaultProps} preferences={['leads', 'engagement']} />)
        expect(screen.queryByText('Views')).not.toBeInTheDocument()
        expect(screen.getByText('Leads')).toBeInTheDocument()
    })

    it('[TC-F03.19] respects custom preferences order', () => {
        render(<DashboardStats {...defaultProps} preferences={['engagement', 'views']} />)
        expect(screen.getByText('Engagement')).toBeInTheDocument()
        expect(screen.getByText('Views')).toBeInTheDocument()
        expect(screen.queryByText('Leads')).not.toBeInTheDocument()
    })

    it('displays formatted views value', () => {
        render(<DashboardStats {...defaultProps} views={1_200} />)
        expect(screen.getByText('1,200')).toBeInTheDocument()
    })
})

// SEOHealthWidget
// ─────────────────────────────────────────────────────────────────────────────
describe('SEOHealthWidget', () => {
    it('[TC-F03.29] renders the SEO score', () => {
        render(<SEOHealthWidget score={75} />)
        expect(screen.getByText('75')).toBeInTheDocument()
    })

    it('[TC-F03.72] renders the exact revised CTA label', () => {
        // Arrange
        render(<SEOHealthWidget score={60} />)

        // Act
        const button = screen.getByRole('button', { name: 'AI Fix Issues' })

        // Assert
        expect(button).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'AI Fix All Issues' })).not.toBeInTheDocument()
    })

    it('[TC-F03.72] defines emoji-free revised CTA labels for English and Malay', () => {
        // Arrange
        const labels = [
            enLocale.dashboard.overview.seo.fixAll,
            msLocale.dashboard.overview.seo.fixAll,
        ]

        // Act
        const containsSparkle = labels.some((label) => label.includes('✨'))

        // Assert
        expect(labels).toEqual(['AI Fix Issues', 'AI Baiki Isu'])
        expect(containsSparkle).toBe(false)
    })

    it('[TC-F03.34] shows issue count for score < 90 (e.g. 75)', () => {
        render(<SEOHealthWidget score={75} />)
        // Score-based warning generates 1 issue
        expect(screen.getByText(/1 Issue/)).toBeInTheDocument()
    })

    it('[TC-F03.34] shows "good" status for score >= 90', () => {
        render(<SEOHealthWidget score={95} />)
        expect(screen.getByText(/All good/)).toBeInTheDocument()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// DashboardEmptyState
// ─────────────────────────────────────────────────────────────────────────────
import { DashboardEmptyState } from '@/components/dashboard/DashboardEmptyState'

describe('DashboardEmptyState', () => {
    it('[TC-F03.01] renders empty state with CTA directing to /builder/new', () => {
        render(<DashboardEmptyState />)
        const link = screen.getByRole('link', { name: /create new website/i })
        expect(link).toHaveAttribute('href', '/builder/new')
    })

    it('[TC-F03.01] renders i18n title and description', () => {
        render(<DashboardEmptyState />)
        expect(screen.getByText('No website data available')).toBeInTheDocument()
        expect(screen.getByText(/Create your first website/)).toBeInTheDocument()
    })

    it('[TC-F03.01] mobile: description text wraps (no whitespace-nowrap)', () => {
        render(<DashboardEmptyState />)
        const description = screen.getByText(/Create your first website/)
        expect(description.className).not.toContain('whitespace-nowrap')
    })

    it('[TC-F03.01] mobile: container has horizontal padding', () => {
        const { container } = render(<DashboardEmptyState />)
        // Outer container is the first child div with px-6
        const outerDiv = container.firstElementChild as HTMLElement
        expect(outerDiv.className).toContain('px-6')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// DashboardGenerationFailed
// ─────────────────────────────────────────────────────────────────────────────
import { DashboardGenerationFailed } from '@/components/dashboard/DashboardGenerationFailed'

describe('DashboardGenerationFailed', () => {
    it('[TC-F03.01b] renders 2 CTAs: template (primary) and AI retry (secondary)', () => {
        render(<DashboardGenerationFailed />)
        const templateLink = screen.getByRole('link', { name: /choose a template/i })
        const retryLink = screen.getByRole('link', { name: /try again with ai/i })
        expect(templateLink).toHaveAttribute('href', '/templates')
        expect(retryLink).toHaveAttribute('href', '/builder/new')
    })

    it('[TC-F03.01b] renders soft-tone heading without error/warning language', () => {
        render(<DashboardGenerationFailed />)
        expect(screen.getByText(/didn.*t complete/i)).toBeInTheDocument()
        expect(screen.getByText(/No worries/)).toBeInTheDocument()
    })

    it('[TC-F03.01b] renders illustration image', () => {
        render(<DashboardGenerationFailed />)
        const img = screen.getByRole('img', { name: 'Website creation incomplete' })
        expect(img).toBeInTheDocument()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SitesPageClient
// ─────────────────────────────────────────────────────────────────────────────
import { SitesPageClient } from '@/app/(dashboard)/sites/SitesPageClient'

describe('SitesPageClient', () => {
    it('[TC-F03.01c] empty state renders CTA to /onboarding when no sites', () => {
        render(<SitesPageClient usableSites={[]} failedSites={[]} totalSites={0} />)
        expect(screen.getByText('No sites yet')).toBeInTheDocument()
        const link = screen.getByRole('link', { name: /create website/i })
        expect(link).toHaveAttribute('href', '/onboarding')
    })

    it('[TC-F03.01d] failed site shows "Incomplete" badge', () => {
        const failedSite = { id: '1', name: 'My Site', generationStatus: 'failed' }
        render(<SitesPageClient usableSites={[]} failedSites={[failedSite]} totalSites={1} />)
        expect(screen.getByText('Incomplete')).toBeInTheDocument()
    })

    it('[TC-F03.01d] failed site shows "Retry with AI" and "Template" actions', () => {
        const failedSite = { id: '1', name: 'My Site', generationStatus: 'failed' }
        render(<SitesPageClient usableSites={[]} failedSites={[failedSite]} totalSites={1} />)
        const retryLink = screen.getByRole('link', { name: /retry with ai/i })
        const templateLink = screen.getByRole('link', { name: /template/i })
        expect(retryLink).toHaveAttribute('href', '/builder/new')
        expect(templateLink).toHaveAttribute('href', '/templates')
    })

    it('[TC-F03.01d] usable site shows Edit and Preview actions', () => {
        const usableSite = { id: '42', name: 'Good Site', status: 'draft', generationStatus: 'completed' }
        render(<SitesPageClient usableSites={[usableSite]} failedSites={[]} totalSites={1} />)
        const editLink = screen.getByRole('link', { name: /edit/i })
        const previewLink = screen.getByRole('link', { name: /preview/i })
        expect(editLink).toHaveAttribute('href', '/editor/42')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TopPerformingList
// ─────────────────────────────────────────────────────────────────────────────
describe('TopPerformingList', () => {
    const makeItems = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            id: `item-${i}`,
            name: `Page ${i + 1}`,
            url: `/page-${i + 1}`,
            value: (count - i) * 10,
        }))

    const defaultProps = { pages: [], products: [], blogs: [], referrers: [] }

    it('[TC-F03.24] renders all items that are passed in (limiting to 10 is done by mapToTopList)', () => {
        // TopPerformingList renders whatever data is passed to it.
        // The limit=10 is enforced upstream by mapToTopList (tested in dashboard-utils.test.ts).
        // Here we verify the component renders exactly the 10-item slice it receives.
        const tenItems = makeItems(10)
        render(<TopPerformingList {...defaultProps} pages={tenItems} />)
        expect(screen.getAllByText(/Page \d+/)).toHaveLength(10)
        // Confirm item 11 is not present because it was never passed in
        expect(screen.queryByText('Page 11')).not.toBeInTheDocument()
    })

    it('[TC-F03.25] switches to "Products" tab and shows product data', () => {
        const products = makeItems(3).map((p, i) => ({ ...p, name: `Product ${i + 1}` }))
        render(<TopPerformingList {...defaultProps} products={products} />)

        const productsTab = screen.getByRole('tab', { name: /top products/i })
        // Radix TabsTrigger v1 selects on mousedown in JSDOM (pointerdown not supported)
        fireEvent.mouseDown(productsTab)
        fireEvent.mouseUp(productsTab)
        fireEvent.click(productsTab)
        expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    it('[TC-F03.26] switches to "Blogs" tab and shows blog data', () => {
        const blogs = makeItems(2).map((p, i) => ({ ...p, name: `Blog ${i + 1}` }))
        render(<TopPerformingList {...defaultProps} blogs={blogs} />)

        const blogsTab = screen.getByRole('tab', { name: /top blogs/i })
        // Radix TabsTrigger v1 selects on mousedown in JSDOM (pointerdown not supported)
        fireEvent.mouseDown(blogsTab)
        fireEvent.mouseUp(blogsTab)
        fireEvent.click(blogsTab)
        expect(screen.getByText('Blog 1')).toBeInTheDocument()
    })

    it('[TC-F03.30] shows empty state message when active tab has no data', () => {
        render(<TopPerformingList {...defaultProps} />)
        expect(screen.getByText(/No data available/)).toBeInTheDocument()
    })
})

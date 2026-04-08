/**
 * Component Render Tests (Pass 3) — F03 Dashboard Gap Coverage
 *
 * Covers gaps found in rà soát lần 3:
 *   TC-F03.17 → DashboardCustomizeModal renders trigger button + opens modal
 *   TC-F03.21 → handleSave calls updateDashboardPreferences + dispatches success toast
 *   TC-F03.27/28/29 → AnalyticsSummaryCards renders correct delta % and trend indicator
 *   TC-F03.46 → KeywordTracker renders input disabled & button disabled at keyword limit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Global mocks ─────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                overview: {
                    stats: {
                        views: 'Views',
                        leads: 'Leads',
                        engagement: 'Engagement',
                        revenue: 'Revenue',
                    },
                    customize: 'Customize',
                    customizeModal: {
                        title: 'Customize Dashboard',
                        description: 'Choose stats',
                        save: 'Save',
                        saving: 'Saving...',
                        cancel: 'Cancel',
                    },
                    analytics: {},
                    seo: {},
                    periods: {},
                    actions: {},
                },
                analytics: {
                    views: 'Views',
                    clicks: 'Clicks',
                    topPages: 'Top Pages',
                    topProducts: 'Top Products',
                    topBlogs: 'Top Blogs',
                    topReferrers: 'Top Referrers',
                    empty: { description: 'No data available' },
                },
                seo: {
                    keywordTracker: {
                        title: 'Keyword Tracker',
                        description: 'Track up to 5 keywords',
                        add: 'Add',
                        placeholder: 'Enter keyword...',
                        empty: 'No keywords tracked yet',
                        errorLoad: 'Failed to load keywords',
                        errorAdd: 'Failed to add keyword',
                        errorMaxKeywords: 'Max 5 keywords reached',
                        errorKeywordExists: 'Keyword already exists',
                        errorConnect: 'Connection error',
                        errorDelete: 'Failed to delete keyword',
                        successAdd: 'Keyword added',
                        notInTopResults: 'Not in top 30',
                    },
                },
            },
        },
        locale: 'en',
    }),
}))

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
            React.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
}))

vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
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

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
    usePathname: vi.fn(() => '/dashboard'),
}))

const mockUpdatePreferences = vi.fn(() => Promise.resolve({ success: true }))
vi.mock('@/app/(dashboard)/actions', () => ({
    updateDashboardPreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'
import { AnalyticsSummaryCards } from '@/components/dashboard/AnalyticsSummaryCards'
import { KeywordTracker } from '@/components/seo/KeywordTracker'

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.17 — DashboardCustomizeModal: trigger button & modal open/close
// ─────────────────────────────────────────────────────────────────────────────
describe('DashboardCustomizeModal', () => {
    it('[TC-F03.17] renders a "Customize" trigger button', () => {
        render(<DashboardCustomizeModal />)
        expect(screen.getByText('Customize')).toBeInTheDocument()
    })

    it('[TC-F03.17] opens modal when trigger button is clicked', () => {
        render(<DashboardCustomizeModal />)
        fireEvent.click(screen.getByText('Customize'))
        expect(screen.getByText('Customize Dashboard')).toBeInTheDocument()
    })

    it('[TC-F03.17] modal contains all 4 metric items by default', () => {
        render(<DashboardCustomizeModal />)
        fireEvent.click(screen.getByText('Customize'))
        expect(screen.getByText('Views')).toBeInTheDocument()
        expect(screen.getByText('Leads')).toBeInTheDocument()
        expect(screen.getByText('Engagement')).toBeInTheDocument()
        expect(screen.getByText('Revenue')).toBeInTheDocument()
    })

    it('[TC-F03.17] closes modal when Cancel is clicked', () => {
        render(<DashboardCustomizeModal />)
        fireEvent.click(screen.getByText('Customize'))
        expect(screen.getByText('Customize Dashboard')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Cancel'))
        expect(screen.queryByText('Customize Dashboard')).not.toBeInTheDocument()
    })

    it('[TC-F03.17] modal has Save and Cancel buttons', () => {
        render(<DashboardCustomizeModal />)
        fireEvent.click(screen.getByText('Customize'))
        expect(screen.getByText('Save')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('[TC-F03.21] calls updateDashboardPreferences when Save is clicked', async () => {
        mockUpdatePreferences.mockResolvedValueOnce({ success: true })
        render(<DashboardCustomizeModal />)
        fireEvent.click(screen.getByText('Customize'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => {
            expect(mockUpdatePreferences).toHaveBeenCalledWith(
                expect.arrayContaining(['views', 'leads', 'engagement', 'revenue'])
            )
        })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.27/28/29 — AnalyticsSummaryCards: delta % display
// ─────────────────────────────────────────────────────────────────────────────
describe('AnalyticsSummaryCards', () => {
    it('[TC-F03.27] shows positive trend (+%) for views growth', () => {
        render(
            <AnalyticsSummaryCards
                currentViews={2000}
                prevViews={1500}
                currentClicks={0}
                prevClicks={0}
            />
        )
        // +33.3% displayed
        expect(screen.getByText(/\+33\.3%/)).toBeInTheDocument()
    })

    it('[TC-F03.28] shows negative trend (-%) for views decline', () => {
        render(
            <AnalyticsSummaryCards
                currentViews={200}
                prevViews={300}
                currentClicks={0}
                prevClicks={0}
            />
        )
        expect(screen.getByText(/-33\.3%/)).toBeInTheDocument()
    })

    it('[TC-F03.29] shows "0%" when views are unchanged', () => {
        render(
            <AnalyticsSummaryCards
                currentViews={500}
                prevViews={500}
                currentClicks={0}
                prevClicks={0}
            />
        )
        // Both views delta and clicks delta will show 0%
        const zeros = screen.getAllByText('0%')
        expect(zeros.length).toBeGreaterThanOrEqual(1)
    })

    it('renders current views and clicks values', () => {
        render(
            <AnalyticsSummaryCards
                currentViews={1234}
                prevViews={1000}
                currentClicks={56}
                prevClicks={40}
            />
        )
        expect(screen.getByText('1,234')).toBeInTheDocument()
        expect(screen.getByText('56')).toBeInTheDocument()
    })

    it('shows "Views" and "Clicks" labels', () => {
        render(
            <AnalyticsSummaryCards
                currentViews={0}
                prevViews={0}
                currentClicks={0}
                prevClicks={0}
            />
        )
        expect(screen.getByText('Views')).toBeInTheDocument()
        expect(screen.getByText('Clicks')).toBeInTheDocument()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.46/47 — KeywordTracker component: UI & input limit enforcement
// ─────────────────────────────────────────────────────────────────────────────
describe('KeywordTracker', () => {
    beforeEach(() => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: { keywords: [] } }),
            } as Response)
        )
    })

    it('[TC-F03.46] renders keyword input and Add button when siteId provided', async () => {
        render(<KeywordTracker siteId="site-1" />)
        await waitFor(() => expect(screen.getByPlaceholderText('Enter keyword...')).toBeInTheDocument())
        expect(screen.getByText('Add')).toBeInTheDocument()
    })

    it('renders nothing when siteId is null', () => {
        const { container } = render(<KeywordTracker siteId={null} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('[TC-F03.47] disables input and Add button when 5 keywords already tracked', async () => {
        const keywords = Array.from({ length: 5 }, (_, i) => ({
            id: `kw-${i}`,
            keyword: `keyword-${i}`,
            rank: i + 1,
            trend: 'same' as const,
            lastCheckedAt: new Date().toISOString(),
        }))

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: { keywords } }),
            } as Response)
        )

        render(<KeywordTracker siteId="site-1" />)

        await waitFor(() => expect(screen.getByText('keyword-0')).toBeInTheDocument())

        const input = screen.getByPlaceholderText('Enter keyword...')
        const addButton = screen.getByRole('button', { name: /add/i })

        expect(input).toBeDisabled()
        expect(addButton).toBeDisabled()
    })

    it('[TC-F03.46] shows empty state when no keywords', async () => {
        render(<KeywordTracker siteId="site-1" />)
        await waitFor(() =>
            expect(screen.getByText('No keywords tracked yet')).toBeInTheDocument()
        )
    })

    it('[TC-F03.46] shows keyword count badge as "0 / 5" initially', async () => {
        render(<KeywordTracker siteId="site-1" />)
        await waitFor(() => expect(screen.getByText('0 / 5')).toBeInTheDocument())
    })
})

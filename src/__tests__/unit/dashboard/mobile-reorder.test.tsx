/**
 * Component Tests — Mobile Up/Down Reorder Buttons (FR-18)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.18  → Mobile reorder via Up/Down buttons
 *   TC-F03.19  → Custom preferences order respected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(''),
    usePathname: () => '/dashboard',
}))

vi.mock('@/app/(dashboard)/actions', () => ({
    updateDashboardPreferences: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                overview: {
                    customize: 'Customize',
                    stats: { views: 'Views', leads: 'Leads', engagement: 'Engagement', revenue: 'Revenue' },
                    customizeModal: {
                        title: 'Customize Dashboard',
                        description: 'Select which widgets to display',
                        save: 'Save',
                        saving: 'Saving...',
                        cancel: 'Cancel',
                    },
                },
            },
        },
    }),
}))

// Mock dnd-kit to avoid drag complexity in unit tests
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: any) => <div>{children}</div>,
    closestCenter: vi.fn(),
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    TouchSensor: vi.fn(),
    useSensor: vi.fn(() => ({})),
    useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: any) => <div>{children}</div>,
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null,
    }),
    arrayMove: (arr: any[], from: number, to: number) => {
        const result = [...arr]
        const [item] = result.splice(from, 1)
        result.splice(to, 0, item)
        return result
    },
}))

vi.mock('@dnd-kit/utilities', () => ({
    CSS: { Transform: { toString: () => '' } },
}))

vi.mock('framer-motion', () => ({
    motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import { DashboardCustomizeModal } from '@/components/dashboard/DashboardCustomizeModal'

describe('Mobile Up/Down Reorder [TC-F03.18, TC-F03.19]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function openModal() {
        render(<DashboardCustomizeModal defaultPreferences={['views', 'leads', 'engagement']} />)
        fireEvent.click(screen.getByTestId('customize-dashboard-btn'))
    }

    it('[TC-F03.18] renders Up/Down buttons for each item', () => {
        openModal()

        expect(screen.getByTestId('move-up-views')).toBeInTheDocument()
        expect(screen.getByTestId('move-down-views')).toBeInTheDocument()
        expect(screen.getByTestId('move-up-leads')).toBeInTheDocument()
        expect(screen.getByTestId('move-down-leads')).toBeInTheDocument()
        expect(screen.getByTestId('move-up-engagement')).toBeInTheDocument()
        expect(screen.getByTestId('move-down-engagement')).toBeInTheDocument()
    })

    it('[TC-F03.18] first item has move-up disabled', () => {
        openModal()

        const upBtn = screen.getByTestId('move-up-views')
        expect(upBtn).toBeDisabled()
    })

    it('[TC-F03.18] last item has move-down disabled', () => {
        openModal()

        const downBtn = screen.getByTestId('move-down-engagement')
        expect(downBtn).toBeDisabled()
    })

    it('[TC-F03.18] middle items have both buttons enabled', () => {
        openModal()

        expect(screen.getByTestId('move-up-leads')).not.toBeDisabled()
        expect(screen.getByTestId('move-down-leads')).not.toBeDisabled()
    })

    it('[TC-F03.19] clicking move-down reorders items', () => {
        openModal()

        // Views is first — click move-down
        fireEvent.click(screen.getByTestId('move-down-views'))

        // After reorder, views should no longer be first (move-up should be enabled)
        const items = screen.getAllByTestId(/^customize-item-/)
        const order = items.map(el => el.getAttribute('data-testid')?.replace('customize-item-', ''))

        // views moved to index 1, leads is now at index 0
        expect(order[0]).toBe('leads')
        expect(order[1]).toBe('views')
    })

    it('[TC-F03.19] clicking move-up reorders items', () => {
        openModal()

        // Leads is second — click move-up
        fireEvent.click(screen.getByTestId('move-up-leads'))

        const items = screen.getAllByTestId(/^customize-item-/)
        const order = items.map(el => el.getAttribute('data-testid')?.replace('customize-item-', ''))

        // leads moved to index 0, views is now at index 1
        expect(order[0]).toBe('leads')
        expect(order[1]).toBe('views')
    })

    it('[TC-F03.18] renders customize-item testids for each metric', () => {
        openModal()

        expect(screen.getByTestId('customize-item-views')).toBeInTheDocument()
        expect(screen.getByTestId('customize-item-leads')).toBeInTheDocument()
        expect(screen.getByTestId('customize-item-engagement')).toBeInTheDocument()
        expect(screen.queryByTestId('customize-item-revenue')).not.toBeInTheDocument()
    })
})

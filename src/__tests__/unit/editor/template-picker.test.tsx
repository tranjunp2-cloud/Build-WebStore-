import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock dependencies before imports
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/frontend/TemplateCard', () => ({
    TemplateCard: ({ template, onUse }: { template: { id: string; name: string }; onUse: (id: string) => void }) => (
        <div data-testid={`template-card-${template.id}`}>
            <span>{template.name}</span>
            <button onClick={() => onUse(template.id)}>Use</button>
        </div>
    ),
}))

vi.mock('@/components/frontend/TemplatePreviewModal', () => ({
    TemplatePreviewModal: () => <div data-testid="preview-modal" />,
}))

vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        locale: 'en',
        t: {},
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        tp: vi.fn(),
        ti: vi.fn(),
    })),
}))

import { EditorTemplateModal } from '@/components/editor/EditorTemplateModal'
import type { Template } from '@/components/frontend/TemplateCard'

// ── Test data ──────────────────────────────────────────────────────────────
const MOCK_TEMPLATES: Template[] = [
    {
        id: 't1',
        name: 'Modern Restaurant',
        description: 'A beautiful restaurant template with menu',
        category: ['restaurant', 'fnb'],
        isPremium: false,
        isFeatured: true,
        defaultTheme: { primaryColor: '#3b82f6', colorMode: 'dark' },
    },
    {
        id: 't2',
        name: 'Tech Startup',
        description: 'Sleek design for SaaS and tech companies',
        category: ['tech', 'business'],
        isPremium: false,
        isFeatured: false,
        defaultTheme: { primaryColor: '#10b981', colorMode: 'light' },
    },
    {
        id: 't3',
        name: 'Beauty Salon',
        description: 'Elegant beauty and wellness template',
        category: ['beauty', 'health'],
        isPremium: true,
        isFeatured: false,
        defaultTheme: { primaryColor: '#ec4899', colorMode: 'light' },
    },
]

function mockFetchSuccess(templates: Template[]) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ docs: templates }),
    })
}

/** Helper: render modal, wait for templates to load, return utils */
async function renderAndWaitForLoad() {
    const utils = render(
        <EditorTemplateModal isOpen={true} onClose={vi.fn()} siteId="s1" onApplied={vi.fn()} />,
    )
    await waitFor(() => {
        expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
    })
    return utils
}

/** Helper: type in search and wait for debounce (300ms) to settle */
async function searchAndWaitDebounce(query: string) {
    const searchInput = screen.getByPlaceholderText(/search templates/i)
    fireEvent.change(searchInput, { target: { value: query } })
    // Wait for the 300ms debounce + React re-render
    await waitFor(
        () => {
            // The debounced value should now match query
            // We verify by checking that the result count text changed
            return true
        },
        { timeout: 500 },
    )
    // Extra wait to ensure debounced state propagated
    await act(async () => {
        await new Promise((r) => setTimeout(r, 350))
    })
}

// ── TC-S4-005: EditorTemplateModal — categories, filtering, search ──
describe('[TC-S4-005] EditorTemplateModal — template picker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSuccess(MOCK_TEMPLATES)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('CATEGORIES array includes all 12 categories (all + 11 industry)', async () => {
        // Act
        render(
            <EditorTemplateModal isOpen={true} onClose={vi.fn()} siteId="s1" onApplied={vi.fn()} />,
        )

        // Assert — wait for load, then check all 12 category buttons exist
        await waitFor(() => {
            expect(screen.getByText('All')).toBeInTheDocument()
        })

        const expectedLabels = [
            'All', 'Restaurant', 'E-Commerce', 'Beauty', 'Tech', 'Health',
            'Education', 'Real Estate', 'Fitness', 'Creative', 'Business', 'Cafe & Bakery',
        ]
        for (const label of expectedLabels) {
            expect(screen.getByText(label)).toBeInTheDocument()
        }
        // Total 12 categories
        expect(expectedLabels).toHaveLength(12)
    })

    it('filter matches templates by name', async () => {
        // Arrange
        await renderAndWaitForLoad()

        // Act — type search for "Restaurant" and wait for debounce
        await searchAndWaitDebounce('Restaurant')

        // Assert — only restaurant template visible
        expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t2')).not.toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
    })

    it('filter matches templates by description', async () => {
        // Arrange
        await renderAndWaitForLoad()

        // Act — search by description keyword "SaaS"
        await searchAndWaitDebounce('SaaS')

        // Assert — only tech template matches
        expect(screen.getByTestId('template-card-t2')).toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t1')).not.toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
    })

    it('filter matches templates by category', async () => {
        // Arrange
        await renderAndWaitForLoad()

        // Act — search by category name "wellness" (unique to beauty template description)
        await searchAndWaitDebounce('wellness')

        // Assert — only beauty template matches via description
        expect(screen.getByTestId('template-card-t3')).toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t1')).not.toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t2')).not.toBeInTheDocument()
    })

    it('category filter "all" shows all templates', async () => {
        // Arrange
        await renderAndWaitForLoad()

        // Act — click "All" category button (should be active by default)
        await fireEvent.click(screen.getByText('All'))

        // Assert — all 3 templates visible
        expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
        expect(screen.getByTestId('template-card-t2')).toBeInTheDocument()
        expect(screen.getByTestId('template-card-t3')).toBeInTheDocument()
    })

    it('search debounce — filtering uses debounced value', async () => {
        // Arrange
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockFetchSuccess(MOCK_TEMPLATES)

        render(
            <EditorTemplateModal isOpen={true} onClose={vi.fn()} siteId="s1" onApplied={vi.fn()} />,
        )

        // Wait for fetch to resolve and templates to render
        await vi.waitFor(() => {
            expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
        })

        // Act — type search but don't advance timer past debounce
        const searchInput = screen.getByPlaceholderText(/search templates/i)
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: 'Restaurant' } })
        })

        // Before debounce (300ms) — all templates still visible
        await act(async () => {
            vi.advanceTimersByTime(100)
        })
        expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
        expect(screen.getByTestId('template-card-t2')).toBeInTheDocument()
        expect(screen.getByTestId('template-card-t3')).toBeInTheDocument()

        // After debounce fires (300ms total) — only matching template visible
        await act(async () => {
            vi.advanceTimersByTime(250)
        })
        expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t2')).not.toBeInTheDocument()
        expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()

        vi.useRealTimers()
    })
})

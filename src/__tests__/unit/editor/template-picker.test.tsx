import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import { toast } from 'sonner'

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }))

vi.mock('next/navigation', () => ({
    usePathname: () => '/editor/s1',
    useRouter: () => ({ replace: mockReplace }),
}))

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
        t: {
            common: { subscriptionErrors: {} },
            editor: {
                template: {
                    title: 'Choose a template', searchPlaceholder: 'Search templates...',
                    searchAction: 'Search templates', clearSearch: 'Clear search',
                    showingCount: 'Showing {filtered} of {total} templates',
                    loading: 'Loading templates...', loadError: 'Failed to load templates',
                    errorTitle: "We couldn't load the templates", retry: 'Try again',
                    close: 'Close template chooser',
                    noTemplates: 'No templates available yet.',
                    noTemplatesDescription: 'Template designs will appear here when they are available.',
                    seedHint: 'Run POST /api/templates/seed to create templates.',
                    noMatch: 'No templates match this filter.',
                    noMatchVi: 'Không tìm thấy mẫu phù hợp',
                    noMatchDescription: 'Try a different description or browse all templates.',
                    clearFilters: 'Show all templates',
                    applyConfirmTitle: 'Apply "{name}"?',
                    applyConfirmDesc: 'This will apply the new template layout and theme.',
                    cancel: 'Cancel', applying: 'Applying...', applyButton: 'Apply Template',
                    appliedSuccess: 'Template "{name}" applied!', applyFailed: 'Failed to apply template',
                    previewTitle: 'Preview: {name}',
                    all: 'All', restaurant: 'Restaurant', ecommerce: 'E-Commerce', beauty: 'Beauty',
                    tech: 'Tech', health: 'Health', education: 'Education', realEstate: 'Real Estate',
                    fitness: 'Fitness', creative: 'Creative', business: 'Business',
                    cafeBakery: 'Cafe & Bakery', events: 'Events', blog: 'Blog', travel: 'Travel',
                },
            },
        },
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        tp: vi.fn(),
        ti: vi.fn(),
    })),
}))

import { EditorTemplateModal } from '@/components/editor/EditorTemplateModal'
import type { Template } from '@/components/frontend/TemplateCard'

const MOCK_TEMPLATES: Template[] = [
    {
        id: 't1', name: 'Activewear Store', description: 'Sports apparel shop',
        defaultBlocks: [{ blockType: 'hero', variant: 'split-left', headline: 'Template' }],
        category: ['ecommerce', 'fitness'], isPremium: false, isFeatured: true,
        defaultTheme: { primaryColor: '#3b82f6', colorMode: 'dark' },
    },
    {
        id: 't2', name: 'Fitness Studio', description: 'Template for gym and yoga classes',
        defaultBlocks: [{ blockType: 'hero', headline: 'Fitness' }],
        category: ['fitness'], isPremium: false, isFeatured: false,
        defaultTheme: { primaryColor: '#10b981', colorMode: 'light' },
    },
    {
        id: 't3', name: 'Beauty Salon', description: 'Elegant beauty and wellness template',
        defaultBlocks: [{ blockType: 'hero', headline: 'Beauty' }],
        category: ['beauty', 'health'], isPremium: true, isFeatured: false,
        defaultTheme: { primaryColor: '#ec4899', colorMode: 'light' },
    },
]

function mockFetch(defaultTemplates: Template[], searchTemplates = defaultTemplates) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/templates/search') {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { templates: searchTemplates } }) })
        }
        if (url === '/api/ai/apply-template') {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true, data: { siteId: 's1', templateName: 'Activewear Store' } }),
            })
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: defaultTemplates }) })
    })
}

async function renderAndWaitForLoad() {
    const rendered = renderModal()
    await waitFor(() => expect(screen.getByTestId('template-card-t1')).toBeInTheDocument())
    return rendered
}

function renderModal(props: Partial<ComponentProps<typeof EditorTemplateModal>> = {}) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <EditorTemplateModal
                isOpen={true}
                onClose={vi.fn()}
                siteId="s1"
                onApplied={vi.fn()}
                {...props}
            />
        </QueryClientProvider>,
    )
}

async function submitSearch(query: string) {
    const input = screen.getByPlaceholderText('Search templates...')
    fireEvent.change(input, { target: { value: query } })
    fireEvent.click(screen.getByRole('button', { name: 'Search templates' }))
}

describe('[TC_F07_037] EditorTemplateModal natural-language template search', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mockFetch(MOCK_TEMPLATES)
    })

    afterEach(() => vi.restoreAllMocks())

    it('TC_F07_037: renders a one-line search input above default template thumbnails', async () => {
        // Arrange / Act
        await renderAndWaitForLoad()

        // Assert
        expect(screen.getByPlaceholderText('Search templates...')).toBeVisible()
        expect(screen.getByTestId('template-card-t1')).toBeVisible()
        expect(screen.getByTestId('template-card-t2')).toBeVisible()
        expect(screen.getByTestId('template-card-t3')).toBeVisible()
    })

    it('TC_F07_037: renders card-shaped skeletons while templates load', () => {
        // Arrange
        global.fetch = vi.fn(() => new Promise<Response>(() => {}))

        // Act
        renderModal()

        // Assert
        expect(screen.getByTestId('template-loading-state')).toBeVisible()
    })

    it('TC_F07_037: submits Vietnamese natural language to the search API and renders its cards', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES, [MOCK_TEMPLATES[0], MOCK_TEMPLATES[1]])
        await renderAndWaitForLoad()

        // Act
        await submitSearch('mẫu cho shop thể thao')

        // Assert
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
            '/api/templates/search',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ query: 'mẫu cho shop thể thao', locale: 'vi' }),
            }),
        ))
        await waitFor(() => {
            expect(screen.getByTestId('template-card-t1')).toBeVisible()
            expect(screen.getByTestId('template-card-t2')).toBeVisible()
            expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
        })
    })

    it('TC_F07_037: resets the category filter when submitting a new search', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES, [MOCK_TEMPLATES[1]])
        await renderAndWaitForLoad()
        fireEvent.click(screen.getByText('Restaurant'))

        // Act
        await submitSearch('gym')

        // Assert
        await waitFor(() => expect(screen.getByTestId('template-card-t2')).toBeVisible())
        expect(screen.queryByText('No templates match this filter.')).not.toBeInTheDocument()
    })

    it('TC_F07_037: narrows submitted API search results with the selected category', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES, [MOCK_TEMPLATES[0], MOCK_TEMPLATES[1]])
        await renderAndWaitForLoad()
        await submitSearch('kedai baju')
        await waitFor(() => {
            expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
            expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
        })

        // Act
        fireEvent.click(screen.getByText('E-Commerce'))

        // Assert
        expect(screen.getByTestId('template-card-t1')).toBeVisible()
        expect(screen.queryByTestId('template-card-t2')).not.toBeInTheDocument()
    })

    it('TC_F07_037: ignores an older search response that resolves after a newer search', async () => {
        // Arrange
        type SearchResponse = {
            ok: boolean
            status: number
            json: () => Promise<{ success: boolean; data: { templates: Template[] } }>
        }
        const pendingSearches: Array<(response: SearchResponse) => void> = []
        const searchSignals: AbortSignal[] = []
        global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
            if (url === '/api/templates/search') {
                searchSignals.push(options?.signal as AbortSignal)
                return new Promise<SearchResponse>((resolve) => pendingSearches.push(resolve))
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        await renderAndWaitForLoad()

        // Act
        await submitSearch('first query')
        await waitFor(() => expect(pendingSearches).toHaveLength(1))
        fireEvent.change(screen.getByPlaceholderText('Search templates...'), { target: { value: 'second query' } })
        await waitFor(() => expect(screen.getByPlaceholderText('Search templates...')).toHaveValue('second query'))
        fireEvent.submit(screen.getByPlaceholderText('Search templates...').closest('form')!)
        await waitFor(() => expect(pendingSearches).toHaveLength(2))
        pendingSearches[1]({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { templates: [MOCK_TEMPLATES[1]] } }) })
        await waitFor(() => expect(screen.getByTestId('template-card-t2')).toBeVisible())
        pendingSearches[0]({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { templates: [MOCK_TEMPLATES[0]] } }) })

        // Assert
        await waitFor(() => expect(searchSignals[0].aborted).toBe(true))
        expect(screen.getByTestId('template-card-t2')).toBeVisible()
        expect(screen.queryByTestId('template-card-t1')).not.toBeInTheDocument()
    })

    it('TC_F07_038: shows the no-match message when a category has no templates', async () => {
        // Arrange
        await renderAndWaitForLoad()

        // Act
        fireEvent.click(screen.getByText('Restaurant'))

        // Assert
        expect(screen.getByText('No templates match this filter.')).toBeVisible()
    })

    it('TC_F07_037: aborts an in-flight search when the modal unmounts', async () => {
        // Arrange
        const searchSignals: AbortSignal[] = []
        global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
            if (url === '/api/templates/search') {
                searchSignals.push(options?.signal as AbortSignal)
                return new Promise<Response>(() => {})
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        const { unmount } = await renderAndWaitForLoad()

        // Act
        await submitSearch('query in flight')
        await waitFor(() => expect(searchSignals).toHaveLength(1))
        unmount()

        // Assert
        expect(searchSignals[0]?.aborted).toBe(true)
    })

    it('TC_F07_037: aborts an in-flight search when a new search is submitted', async () => {
        // Arrange
        const searchSignals: AbortSignal[] = []
        global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
            if (url === '/api/templates/search') {
                searchSignals.push(options?.signal as AbortSignal)
                return new Promise<Response>(() => {})
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        await renderAndWaitForLoad()

        // Act
        await submitSearch('first query')
        await waitFor(() => expect(searchSignals).toHaveLength(1))
        fireEvent.change(screen.getByPlaceholderText('Search templates...'), { target: { value: 'second query' } })
        fireEvent.submit(screen.getByPlaceholderText('Search templates...').closest('form')!)

        // Assert
        await waitFor(() => expect(searchSignals).toHaveLength(2))
        expect(searchSignals[0]?.aborted).toBe(true)
    })

    it('TC_F07_037: closes the modal when Escape is pressed in the search input', async () => {
        // Arrange
        const onClose = vi.fn()
        renderModal({ onClose })
        await waitFor(() => expect(screen.getByTestId('template-card-t1')).toBeInTheDocument())

        // Act
        fireEvent.keyDown(screen.getByPlaceholderText('Search templates...'), { key: 'Escape' })

        // Assert
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('TC_F07_037: keeps the submitted results while editing the next query', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES, [MOCK_TEMPLATES[0], MOCK_TEMPLATES[1]])
        await renderAndWaitForLoad()
        await submitSearch('mẫu cho shop thể thao')
        await waitFor(() => {
            expect(screen.getByTestId('template-card-t1')).toBeInTheDocument()
            expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
        })

        // Act
        fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
            target: { value: 'mẫu spa chăm sóc da' },
        })

        // Assert
        expect(screen.getByTestId('template-card-t1')).toBeVisible()
        expect(screen.getByTestId('template-card-t2')).toBeVisible()
        expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
        expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('TC_F07_037: replaces stale results with an actionable error state when a newer search fails', async () => {
        // Arrange
        let searchCount = 0
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url !== '/api/templates/search') {
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
            }
            searchCount += 1
            if (searchCount === 1) {
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { templates: [MOCK_TEMPLATES[0]] } }) })
            }
            return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: { message: 'Search unavailable' } }) })
        })
        await renderAndWaitForLoad()
        await submitSearch('first query')
        await waitFor(() => {
            expect(screen.getByTestId('template-card-t1')).toBeVisible()
            expect(screen.queryByTestId('template-card-t3')).not.toBeInTheDocument()
        })

        // Act
        await submitSearch('second query')

        // Assert
        await waitFor(() => expect(screen.getByTestId('template-error-state')).toBeVisible())
        expect(screen.queryByTestId('template-card-t1')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    it('TC_F07_037: does not let a pending list request hide successful search results', async () => {
        // Arrange
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/templates/search') {
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { templates: [MOCK_TEMPLATES[1]] } }) })
            }
            return new Promise<Response>(() => {})
        })
        renderModal()

        // Act
        await submitSearch('gym')

        // Assert
        await waitFor(() => expect(screen.getByTestId('template-card-t2')).toBeVisible())
        expect(screen.queryByTestId('template-loading-state')).not.toBeInTheDocument()
    })

    it('TC_F07_037: redirects 401 responses to login with the current editor returnUrl', async () => {
        // Arrange
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/templates/search') {
                return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'Unauthorized' } }) })
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        await renderAndWaitForLoad()

        // Act
        await submitSearch('gym')

        // Assert
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login?returnUrl=%2Feditor%2Fs1'))
    })

    it('TC_F07_037: treats a malformed 200 search response as an actionable error', async () => {
        // Arrange
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/templates/search') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, data: { templates: 'invalid' } }),
                })
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        await renderAndWaitForLoad()

        // Act
        await submitSearch('gym')

        // Assert
        await waitFor(() => expect(screen.getByTestId('template-error-state')).toBeVisible())
        expect(screen.queryByTestId('template-search-empty')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    it('TC_F07_037: rejects malformed cards inside an otherwise valid 200 response', async () => {
        // Arrange
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/templates/search') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, data: { templates: [null] } }),
                })
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        await renderAndWaitForLoad()

        // Act
        await submitSearch('gym')

        // Assert
        await waitFor(() => expect(screen.getByTestId('template-error-state')).toBeVisible())
        expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    it('TC_F07_037: disables Apply during pre-save and prevents double submit', async () => {
        // Arrange
        let releasePreSave: (() => void) | undefined
        const onBeforeApply = vi.fn(() => new Promise<void>((resolve) => {
            releasePreSave = resolve
        }))
        const onApplied = vi.fn()
        renderModal({ onBeforeApply, onApplied })
        await waitFor(() => expect(screen.getByTestId('template-card-t1')).toBeInTheDocument())
        fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0])
        const applyButton = screen.getByRole('button', { name: 'Apply Template' })

        // Act
        fireEvent.click(applyButton)
        fireEvent.click(applyButton)

        // Assert
        expect(onBeforeApply).toHaveBeenCalledTimes(1)
        expect(applyButton).toBeDisabled()
        releasePreSave?.()
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
        const applyCalls = vi.mocked(global.fetch).mock.calls.filter(([url]) => url === '/api/ai/apply-template')
        expect(applyCalls).toHaveLength(1)
        expect(applyCalls[0]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }))
    })

    it('TC_F07_037: rejects incomplete Apply success responses without losing the retry confirmation', async () => {
        // Arrange
        const onApplied = vi.fn()
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/ai/apply-template') {
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) })
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ docs: MOCK_TEMPLATES }) })
        })
        renderModal({ onApplied })
        await waitFor(() => expect(screen.getByTestId('template-card-t1')).toBeInTheDocument())
        fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0])

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Apply Template' }))

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalled())
        expect(onApplied).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled()
    })

    it.each([200, 500])('TC_F07_037: prevents repeated list Retry after HTTP %s while pending', async (status) => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: status === 200, status, json: async () => ({ docs: [] }) })
            .mockImplementation(() => new Promise<Response>(() => {}))
        renderModal()
        const retry = await screen.findByRole('button', { name: 'Try again' })
        fireEvent.click(retry)
        if (status === 200) {
            await waitFor(() => expect(retry).toBeDisabled())
            expect(retry.querySelector('.animate-spin')).not.toBeNull()
            fireEvent.click(retry)
        } else {
            await waitFor(() => expect(screen.getByTestId('template-loading-state')).toBeVisible())
            expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
        }
        expect(global.fetch).toHaveBeenCalledTimes(2)
    })
})

describe('[TC_F07_038] EditorTemplateModal empty template search', () => {
    it('TC_F07_038: shows the no-match message when the search API returns no templates', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES, [])
        await renderAndWaitForLoad()

        // Act
        await submitSearch('phi hành gia vũ trụ')

        // Assert
        await waitFor(() => expect(screen.getByText('Không tìm thấy mẫu phù hợp')).toBeVisible())
        expect(screen.getByTestId('template-search-empty')).toBeVisible()
        expect(screen.getAllByRole('button', { name: 'Clear search' })).toHaveLength(2)
    })
})

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// ── TC_F07_016 / TC_F07_020 / TC_F07_039: authenticated apply flow ──
describe('[TC_F07_016, TC_F07_020, TC_F07_039] EditorTemplateModal — apply flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.history.replaceState({}, '', '/editor/101?panel=templates')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    async function openConfirmation(props?: Partial<ComponentProps<typeof EditorTemplateModal>>) {
        renderModal({ siteId: '101', ...props })
        await screen.findByTestId('template-card-t1')
        fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0])
        return screen.getByRole('button', { name: 'Apply Template' })
    }

    it('prepares only the selected search template before enabling Apply and keeps raw theme for optimism', async () => {
        // Arrange — search carries card metadata; selected detail carries the actual layout/theme.
        const { defaultBlocks: _blocks, ...metadata } = MOCK_TEMPLATES[0]
        const card = { ...metadata, id: '83' }
        const rawTheme = { primaryColor: '#123456', backgroundColor: '#abcdef' }
        const fullTemplate = { ...card, defaultTheme: rawTheme, defaultBlocks: [{ blockType: 'hero', headline: 'Template' }] }
        let resolveDetail: ((response: Response) => void) | undefined
        const detail = new Promise<Response>(resolve => { resolveDetail = resolve })
        const onApplyStarted = vi.fn()
        const onApplied = vi.fn()
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url === '/api/templates/search') return Promise.resolve(jsonResponse({ success: true, data: { templates: [card] } }))
            if (url === '/api/templates/list?templateId=83') return detail
            if (url === '/api/ai/apply-template') return Promise.resolve(jsonResponse({ success: true, data: { siteId: 101 } }))
            return Promise.resolve(jsonResponse({ docs: MOCK_TEMPLATES }))
        })
        renderModal({ siteId: '101', onApplyStarted, onApplied })
        await screen.findByTestId('template-card-t1')
        await submitSearch('sports shop')
        await screen.findByTestId('template-card-83')

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Use' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/templates/list?templateId=83', expect.anything()))

        // Assert — persistence cannot begin until the selected detail is ready.
        expect(screen.getByRole('button', { name: 'Apply Template' })).toBeDisabled()
        expect(onApplyStarted).not.toHaveBeenCalled()
        await act(async () => {
            resolveDetail?.(jsonResponse({ docs: [fullTemplate] }))
            await detail
        })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Apply Template' }))
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
        expect(onApplyStarted).toHaveBeenCalledWith(expect.objectContaining({
            defaultTheme: rawTheme, defaultBlocks: fullTemplate.defaultBlocks,
        }))
    })

    it('keeps Apply disabled after selected-detail failure and allows retry', async () => {
        // Arrange
        const { defaultBlocks: _blocks, ...card } = MOCK_TEMPLATES[0]
        let detailCalls = 0
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('templateId=')) {
                detailCalls += 1
                return Promise.resolve(detailCalls === 1
                    ? jsonResponse({ error: 'Detail unavailable' }, 503)
                    : jsonResponse({ docs: [MOCK_TEMPLATES[0]] }))
            }
            return Promise.resolve(jsonResponse({ docs: [card] }))
        })
        renderModal()
        await screen.findByTestId('template-card-t1')

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Use' }))
        await screen.findByText('Detail unavailable')

        // Assert
        expect(screen.getByRole('button', { name: 'Apply Template' })).toBeDisabled()
        expect(toast.error).toHaveBeenCalledWith('Failed to load templates')
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled())
        expect(detailCalls).toBe(2)
    })

    it('holds the apply guard until the committed editor snapshot finishes applying', async () => {
        // Arrange
        mockFetch(MOCK_TEMPLATES)
        let finishApplied: (() => void) | undefined
        const committed = new Promise<void>(resolve => { finishApplied = resolve })
        const onApplied = vi.fn(() => committed)
        const applyButton = await openConfirmation({ onApplied })

        // Act
        fireEvent.click(applyButton)
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
        fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0])

        // Assert
        expect(screen.getByRole('button', { name: 'Applying...' })).toBeDisabled()
        expect(vi.mocked(global.fetch).mock.calls.filter(([url]) => url === '/api/ai/apply-template')).toHaveLength(1)
        await act(async () => { finishApplied?.(); await committed })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled())
    })

    it('unwraps the success envelope before notifying the editor', async () => {
        // Arrange
        const onApplied = vi.fn()
        const appliedState = { site: { theme: {}, headerBlock: null, footerBlock: null, globalBlocks: null },
            page: { id: 202, layout: [{ blockType: 'hero', headline: 'Preserved' }] } }
        global.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ docs: MOCK_TEMPLATES }))
            .mockResolvedValueOnce(jsonResponse({
                success: true,
                data: { siteId: 101, unmatchedBlocks: ['testimonials'], appliedState },
                meta: { timestamp: '2026-09-08T00:00:00.000Z' },
            }))
        const applyButton = await openConfirmation({ onApplied, pageId: '202' })

        // Act
        fireEvent.click(applyButton)

        // Assert
        await waitFor(() => {
            expect(onApplied).toHaveBeenCalledWith({
                templateName: 'Activewear Store',
                siteId: 101,
                unmatchedBlocks: ['testimonials'],
                appliedState,
            })
        })
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/apply-template', expect.objectContaining({
            body: JSON.stringify({ templateId: 't1', siteId: '101', pageId: '202' }),
        }))
    })

    it('redirects a 401 to login with the complete current returnUrl', async () => {
        // Arrange
        const onApplied = vi.fn()
        global.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ docs: MOCK_TEMPLATES }))
            .mockResolvedValueOnce(jsonResponse({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            }, 401))
        const applyButton = await openConfirmation({ onApplied })

        // Act
        fireEvent.click(applyButton)

        // Assert
        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith(
                '/login?returnUrl=%2Feditor%2Fs1%3Fpanel%3Dtemplates',
            )
        })
        expect(onApplied).not.toHaveBeenCalled()
    })

    it('prevents duplicate apply requests while the first request is pending', async () => {
        // Arrange
        let resolveApply: ((response: Response) => void) | undefined
        const pendingApply = new Promise<Response>((resolve) => {
            resolveApply = resolve
        })
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ docs: MOCK_TEMPLATES }))
            .mockReturnValueOnce(pendingApply)
        global.fetch = fetchMock
        const onBeforeApply = vi.fn().mockResolvedValue(undefined)
        const applyButton = await openConfirmation({ onBeforeApply })

        // Act
        fireEvent.click(applyButton)
        fireEvent.click(applyButton)

        // Assert
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(onBeforeApply).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveApply?.(jsonResponse({ success: true, data: { siteId: 101 } }))
            await pendingApply
        })
    })

    it('locks the editor before waiting for the pre-save barrier', async () => {
        // Arrange
        let resolvePreSave: (() => void) | undefined
        const pendingPreSave = new Promise<void>((resolve) => {
            resolvePreSave = resolve
        })
        const onApplyPending = vi.fn()
        const onBeforeApply = vi.fn().mockReturnValue(pendingPreSave)
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ docs: MOCK_TEMPLATES }))
            .mockResolvedValueOnce(jsonResponse({ success: true, data: { siteId: 101 } }))
        global.fetch = fetchMock
        const applyButton = await openConfirmation({ onApplyPending, onBeforeApply })

        // Act
        fireEvent.click(applyButton)

        // Assert — the editor lock is synchronous; the POST waits for the save barrier.
        await waitFor(() => expect(onApplyPending).toHaveBeenCalledTimes(1))
        expect(onBeforeApply).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolvePreSave?.()
            await pendingPreSave
        })
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    })

    it('keeps the confirmation open and enables retry after an apply error', async () => {
        // Arrange
        const onApplyStarted = vi.fn()
        const onApplyFailed = vi.fn()
        global.fetch = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ docs: MOCK_TEMPLATES }))
            .mockResolvedValueOnce(jsonResponse({
                success: false,
                error: { code: 'TEMPLATE_SWAP_FAILED', message: 'Swap failed' },
            }, 500))
        const applyButton = await openConfirmation({ onApplyStarted, onApplyFailed })

        // Act
        fireEvent.click(applyButton)

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalled())
        expect(onApplyStarted).toHaveBeenCalledWith(expect.objectContaining(MOCK_TEMPLATES[0]))
        expect(onApplyFailed).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled()
        expect(screen.getByText('Apply "Activewear Store"?')).toBeInTheDocument()
    })
})

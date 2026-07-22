// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

const mockPush = vi.fn()

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: en,
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        message: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('lucide-react', () => ({
    GripVertical: () => <svg />,
    Loader2: () => <svg />,
    Lock: () => <svg />,
}))

vi.mock('framer-motion', () => ({
    Reorder: {
        Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    },
}))

vi.mock('@/components/builder/BusinessInfoForm', () => ({
    default: ({ onSubmit }: { onSubmit?: (info: Record<string, string>) => void }) => (
        <button
            type="button"
            onClick={() => onSubmit?.({
                businessName: 'Long Running Bakery',
                shortDescription: 'Fresh artisan bread and pastries',
                industry: 'Food',
                products: 'Bread and cakes',
                language: 'en',
            })}
        >
            Generate Website
        </button>
    ),
}))

vi.mock('@/components/builder/BuilderGenerationView', () => ({
    default: () => <div data-testid="builder-generation-view" />,
}))

vi.mock('@/components/builder/BuilderFullPreview', () => ({
    default: () => <div data-testid="builder-full-preview" />,
}))

vi.mock('@/components/builder/CongratsModal', () => ({
    CongratsModal: () => null,
}))

vi.mock('@/components/editor/LanguageConfirmBanner', () => ({
    LanguageConfirmBanner: () => null,
}))

vi.mock('@/components/builder/DraftRecoveryDialog', () => ({
    DraftRecoveryDialog: () => null,
}))

vi.mock('@/components/builder/PaywallCard', () => ({
    PaywallCard: () => null,
}))

vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({
    GoogleFontsLoader: () => null,
}))

vi.mock('@/blocks/ErrorBoundary', () => ({
    BlockErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getComponent: () => null,
    },
}))

vi.mock('@/lib/theme/resolve', () => ({
    resolveTheme: (theme: unknown) => theme,
    generateThemeCSS: () => '',
}))

vi.mock('@/lib/detect-locale', () => ({
    detectLocaleFromText: vi.fn().mockResolvedValue('en'),
}))

vi.mock('@/lib/generation-errors', () => ({
    getGenerationError: vi.fn(),
    formatErrorMessage: vi.fn(),
}))

vi.mock('@/lib/ai/coerce-video-variants', () => ({
    coerceVideoVariants: vi.fn((x: unknown) => x),
}))

vi.mock('@/components/builder/BuilderCompletionView', () => ({
    default: ({
        onDashboard,
        onMoveBlock,
        onOpenEditor,
        onPublish,
    }: {
        onDashboard: () => void
        onMoveBlock: (blockId: string, direction: 'up' | 'down') => void
        onOpenEditor: () => void
        onPublish: () => void
    }) => (
        <div>
            <button type="button" onClick={onDashboard}>Dashboard</button>
            <button type="button" onClick={() => onMoveBlock('block-1', 'down')}>Move Block</button>
            <button type="button" onClick={onOpenEditor}>Open Editor</button>
            <button type="button" onClick={onPublish}>Publish Website</button>
        </div>
    ),
}))

import AIBuilderPageClient from '@/app/(builder)/builder/new/AIBuilderPageClient'
import { useBuilderStore } from '@/store/builderStore'

describe('AIBuilderPageClient — no-user-edits save guard (BUG-F01-26)', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches: false,
                media: '(max-width: 1023px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        })
        fetchMock.mockReset()
        global.fetch = fetchMock as unknown as typeof fetch

        useBuilderStore.getState().reset()
        useBuilderStore.setState({
            userId: 'user-1',
            step: 'chat',
            status: 'done',
            blocks: [
                { _id: 'block-1', blockType: 'hero' },
                { _id: 'block-2', blockType: 'features' },
            ],
            theme: { name: 'test-theme' } as never,
            siteId: 'site-123',
            siteName: 'Chibi Studio',
            businessInfo: {
                businessName: 'Chibi Studio',
                shortDescription: 'Cute character art',
                industry: 'creative',
                products: 'chibi animation',
                language: 'en',
            },
            messages: [],
            progress: { step: '', label: '', progress: 0 },
            contentBrief: null,
            error: null,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does not call /save when Publish Website is clicked before any manual edits', async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.includes('/publish')) {
                return {
                    ok: true,
                    json: async () => ({ data: { id: 'site-123', url: 'http://localhost/site-123' } }),
                } as Response
            }
            return {
                ok: true,
                json: async () => ({}),
            } as Response
        })

        render(<AIBuilderPageClient userId="user-1" />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Publish Website' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Publish Website' }))

        await waitFor(() => {
            const urls = fetchMock.mock.calls.map(([input]) => String(input))
            expect(urls.some((url) => url.includes('/api/sites/site-123/save'))).toBe(false)
            expect(urls.some((url) => url.includes('/api/sites/site-123/publish'))).toBe(true)
        })
    })

    it('does not call /save when Open Editor is clicked before any manual edits', async () => {
        render(<AIBuilderPageClient userId="user-1" />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Open Editor' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }))

        expect(fetchMock).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/editor/site-123')
    })

    it('does not call /save when Dashboard is clicked before any manual edits', async () => {
        render(<AIBuilderPageClient userId="user-1" />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))

        expect(fetchMock).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('calls /save with edited blocks before Publish Website when manual edits exist', async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)
            if (url.includes('/save')) {
                return {
                    ok: true,
                    json: async () => ({ ok: true }),
                } as Response
            }
            if (url.includes('/publish')) {
                return {
                    ok: true,
                    json: async () => ({ data: { id: 'site-123', url: 'http://localhost/site-123' } }),
                } as Response
            }
            return {
                ok: true,
                json: async () => ({}),
            } as Response
        })

        render(<AIBuilderPageClient userId="user-1" />)

        await waitFor(() => expect(screen.getByRole('button', { name: 'Move Block' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Move Block' }))
        fireEvent.click(screen.getByRole('button', { name: 'Publish Website' }))

        await waitFor(() => {
            const saveCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/sites/site-123/save'))
            expect(saveCall).toBeTruthy()

            const [, init] = saveCall!
            expect(init).toMatchObject({ method: 'PATCH' })

            const body = JSON.parse(String(init?.body ?? '{}')) as { blocks?: Array<{ _id: string }>; theme?: unknown }
            expect(body.blocks?.map((block) => block._id)).toEqual(['block-2', 'block-1'])
            expect(body.theme).toEqual({ name: 'test-theme' })
        })

        expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/sites/site-123/publish'))).toBe(true)
    })

    it('TC-GENPERF-W3-33: keeps the generation stream open after 75 seconds', async () => {
        // Arrange
        vi.useFakeTimers()
        useBuilderStore.setState({
            step: 'info',
            status: 'idle',
            businessInfo: null,
            blocks: [],
            theme: null,
            siteId: null,
            siteName: '',
        })
        let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
        const encoder = new TextEncoder()
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                streamController = controller
                controller.enqueue(encoder.encode(
                    'event: generation_accepted\ndata: {"generationRequestId":"request-1"}\n\n',
                ))
            },
        })
        fetchMock.mockResolvedValue({ ok: true, body } as Response)
        render(<AIBuilderPageClient userId="user-1" />)

        // Act
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Generate Website' }))
            await Promise.resolve()
        })
        const generationCall = fetchMock.mock.calls.find(
            ([input]) => String(input).includes('/api/ai/generate-site?stream=true'),
        )
        expect(generationCall).toBeTruthy()
        const signal = generationCall?.[1]?.signal
        await act(async () => {
            await vi.advanceTimersByTimeAsync(76_000)
        })

        // Assert
        expect(signal?.aborted).toBe(false)

        await act(async () => {
            streamController?.enqueue(encoder.encode(
                'event: done\ndata: {"siteId":"site-123","pageId":"page-1","siteName":"Long Running Bakery","totalBlocks":1,"totalPages":1,"timeMs":76000}\n\n',
            ))
            streamController?.close()
            await Promise.resolve()
        })
        expect(useBuilderStore.getState().status).toBe('done')
    })
})

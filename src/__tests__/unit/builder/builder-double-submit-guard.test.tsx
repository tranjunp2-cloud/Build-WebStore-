/**
 * TC-F01.80 / TC-F01.97 (GH-2153) — two Generate clicks dispatched in the same task (AI/automation
 * testers, fast touch) must send ONE request. React state (`status`) only flips on the next render, so the
 * guard has to be synchronous. Real: AIBuilderPageClient + builderStore. Faked: form, child views, fetch.
 */
// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
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
    // Fires onSubmit twice inside ONE click handler: no React render can happen between the two calls.
    default: ({ onSubmit }: { onSubmit?: (info: Record<string, string>) => void }) => (
        <button
            type="button"
            onClick={() => {
                const info = { businessName: 'Kopi Ipoh', shortDescription: 'Ipoh white coffee', industry: 'Food', products: 'Coffee', language: 'en' }
                onSubmit?.(info)
                onSubmit?.(info)
            }}
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

describe('AIBuilderPageClient — double Generate submit guard [TC-F01.80, TC-F01.97]', () => {
    const fetchMock = vi.fn()
    const generateCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/ai/generate-site'))

    beforeEach(() => {
        cleanup()
        document.body.innerHTML = ''
        vi.clearAllMocks()
        window.localStorage.clear()
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches: false, media: '', onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
                addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
            })),
        })
        fetchMock.mockReset()
        global.fetch = fetchMock as unknown as typeof fetch
        useBuilderStore.getState().reset()
        useBuilderStore.setState({ userId: 'user-1' })
    })

    afterEach(() => {
        cleanup()
        document.body.innerHTML = ''
    })

    it('sends a single generate-site request when submit fires twice before React re-renders', async () => {
        fetchMock.mockImplementation(() => new Promise(() => {})) // generation stays in flight

        render(<AIBuilderPageClient userId="user-1" />)
        await act(async () => { fireEvent.click(await screen.findByText('Generate Website')) })

        expect(generateCalls()).toHaveLength(1)
    })

    it('releases the guard after a rejected generation so the merchant can try again', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: { code: 'GENERATION_IN_PROGRESS' } }) })

        render(<AIBuilderPageClient userId="user-1" />)
        await act(async () => { fireEvent.click(await screen.findByText('Generate Website')) })
        await waitFor(() => expect(useBuilderStore.getState().status).not.toBe('streaming'))
        expect(generateCalls()).toHaveLength(1)

        await act(async () => { fireEvent.click(await screen.findByText('Generate Website')) })

        expect(generateCalls()).toHaveLength(2)
    })
})

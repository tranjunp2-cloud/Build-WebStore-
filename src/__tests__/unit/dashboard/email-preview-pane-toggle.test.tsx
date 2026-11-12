import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { EmailPreviewPane } from '@/app/(dashboard)/settings/email-templates/_components/EmailPreviewPane'

// GH-1499 issue 4 — code review follow-up: the Desktop/Mobile toggle visibility and
// the forced-mobile-mode effect are real JS logic driven by useMediaQuery, not CSS,
// so they need behavioral coverage rather than relying on manual QA alone.

function mockMatchMedia(belowDesktop: boolean) {
    const matchMediaSpy = vi.fn((query: string) => ({
        matches: query === '(max-width: 1279px)' ? belowDesktop : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
    window.matchMedia = matchMediaSpy as unknown as typeof window.matchMedia
    return matchMediaSpy
}

function renderPane(uiLocale: 'en' | 'ms' = 'en') {
    return render(
        <I18nProvider defaultLocale={uiLocale}>
            <EmailPreviewPane
                templateType="order-confirmation"
                locale="en"
                draftConfig={{ enabled: true }}
                onReset={vi.fn()}
            />
        </I18nProvider>
    )
}

describe('[TC-F32.93] EmailPreviewPane — Desktop/Mobile toggle visibility', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ subject: 'Test subject', html: '<p>preview</p>' }),
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    // The Desktop/Mobile toggle buttons are icon-only (no aria-label; tooltip text isn't
    // in the DOM until hovered), so query by the lucide icon class rather than accessible name.
    it('hides the Desktop/Mobile toggle below xl (1280px) and shows Refresh only', async () => {
        mockMatchMedia(true)
        const { container } = renderPane()

        await waitFor(() => {
            expect(container.querySelector('svg.lucide-refresh-cw')).toBeInTheDocument()
        })
        expect(container.querySelector('svg.lucide-monitor')).not.toBeInTheDocument()
        expect(container.querySelector('svg.lucide-smartphone')).not.toBeInTheDocument()
    })

    it('shows the Desktop/Mobile toggle at xl (1280px) and up', async () => {
        mockMatchMedia(false)
        const { container } = renderPane()

        await waitFor(() => {
            expect(container.querySelector('svg.lucide-monitor')).toBeInTheDocument()
        })
        expect(container.querySelector('svg.lucide-smartphone')).toBeInTheDocument()
    })

    it('renders the mobile-width preview frame when below xl, without needing a toggle click', async () => {
        mockMatchMedia(true)
        const { container } = renderPane()

        await waitFor(() => {
            const iframe = container.querySelector('iframe')
            expect(iframe).toHaveStyle({ width: '360px' })
        })
    })
})

describe('[TC-F32.105] EmailPreviewPane — chrome text follows CMS UI locale', () => {
    beforeEach(() => {
        window.localStorage.clear()
        mockMatchMedia(false)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ subject: 'Test subject', html: '<p>preview</p>' }),
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('shows Malay footer note, reset button and demo data labels when UI locale is ms', async () => {
        const msPreview = ms.dashboard.settings.emailTemplates.preview
        const enPreview = en.dashboard.settings.emailTemplates.preview
        renderPane('ms')

        expect(await screen.findByText(msPreview.footerNote)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: msPreview.resetToDefault })).toBeInTheDocument()
        expect(screen.getByText(msPreview.demoTitle)).toBeInTheDocument()
        expect(screen.getByText(msPreview.live)).toBeInTheDocument()
        expect(screen.queryByText(enPreview.footerNote)).not.toBeInTheDocument()
        expect(screen.queryByText(enPreview.resetToDefault)).not.toBeInTheDocument()
    })

    it('keeps English text when UI locale is en', async () => {
        const enPreview = en.dashboard.settings.emailTemplates.preview
        renderPane('en')

        expect(await screen.findByText(enPreview.footerNote)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: enPreview.resetToDefault })).toBeInTheDocument()
    })
})

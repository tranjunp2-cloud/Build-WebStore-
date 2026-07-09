import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

function renderPane() {
    return render(
        <EmailPreviewPane
            templateType="order-confirmation"
            locale="en"
            draftConfig={{ enabled: true }}
            onReset={vi.fn()}
        />
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

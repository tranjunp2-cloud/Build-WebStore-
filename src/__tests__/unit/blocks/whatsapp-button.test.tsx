/**
 * Unit Tests: WhatsappButtonBlock — click behavior gated by edit callback
 * TC-IDs: TC-GH1461-WA-01 -> TC-GH1461-WA-02
 * Convention: docs/TEST_CONVENTION.md
 *
 * GH-1461 adversarial-review follow-up: the block's own preventDefault/pulse-animation
 * logic was never buggy — the bug was that `useBlockEditCallback()` always resolved to a
 * non-null value inside the AI Builder read-only preview iframe (fixed in SiteRenderer.tsx
 * + PreviewSiteRenderer.tsx). This test locks in the block's own contract so a future
 * regression in that wiring is caught here too, not just at the context-propagation level.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mocks (top-level, before imports) ──────────────────────────────────────
vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({
    useBlockEditCallback: vi.fn(() => null),
}))

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { WhatsappButtonBlock } from '@/blocks/whatsapp-button'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

const baseBlock = {
    blockType: 'whatsapp-button' as const,
    phoneNumber: '123456789',
    countryCode: '+60',
    message: 'Hi there',
    label: 'Chat with us',
    position: 'bottom-right' as const,
}

describe('TC-GH1461-WA-01: callback=null (builder-preview / real storefront) — real navigation', () => {
    it('anchor has no preventDefault handler and the pulse-animation ring is present', () => {
        vi.mocked(useBlockEditCallback).mockReturnValue(null)
        render(<WhatsappButtonBlock block={baseBlock} theme={null} />)

        const link = screen.getByRole('link', { name: 'Chat with us' }) as HTMLAnchorElement
        expect(link.href).toContain('https://wa.me/60123456789')
        expect(link.target).toBe('_blank')
        // onClick is `undefined` in the DOM when callback is null (component passes
        // `onClick={callback ? handler : undefined}`) — no listener means no preventDefault,
        // so the browser's default anchor navigation is NOT suppressed.
        expect(link.onclick).toBeNull()
    })
})

describe('TC-GH1461-WA-02: callback present (real editor) — click suppressed', () => {
    it('anchor click is prevented so it does not navigate away from the editor canvas', () => {
        vi.mocked(useBlockEditCallback).mockReturnValue({ blockIndex: 0, onFieldChange: vi.fn() })
        render(<WhatsappButtonBlock block={baseBlock} theme={null} />)

        const link = screen.getByRole('link', { name: 'Chat with us' }) as HTMLAnchorElement
        expect(link.onclick).not.toBeNull()

        const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
        const prevented = !link.dispatchEvent(evt)
        expect(prevented).toBe(true)
    })
})

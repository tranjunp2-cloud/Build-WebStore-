/**
 * F26-01: Language confirm modal — pre-generation language recommendation
 * TC-IDs: F26-01-01 → F26-01-07
 *
 * Modal shows when detected locale is outside EN/BM.
 * Interaction: click radio card to select → click Continue to confirm.
 * Cancel → dismiss. Default selected = English.
 *
 * Covers:
 *   AC-1: Modal renders detected locale in title
 *   AC-2: English card selected + Continue → onAction("switch", "en")
 *   AC-3: Malay card selected + Continue → onAction("switch", "ms")
 *   AC-4: Detected locale card selected + Continue → onAction("confirm", detectedLocale)
 *   AC-5: Cancel → onAction("dismiss", detectedLocale)
 *   AC-6: Modal not rendered when isOpen = false
 *   AC-7: Unknown locale shows raw code + flag fallback
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageConfirmBanner } from '@/components/editor/LanguageConfirmBanner'

vi.mock('next/font/google', () => ({
    Inter: () => ({ className: 'inter' }),
}))

// ── AC-1: Modal renders detected locale in title ──────────────────────────────

describe('TC-F26-01-01: modal renders detected locale label', () => {
    it('shows "Thai language detected" title for Thai locale', () => {
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={vi.fn()} />,
        )
        expect(screen.getByText(/Thai language detected/i)).toBeTruthy()
    })

    it('always shows English and Malay as recommended options', () => {
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={vi.fn()} />,
        )
        expect(screen.getAllByText('English').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Malay').length).toBeGreaterThan(0)
    })
})

// ── AC-2: English selected (default) + Continue ───────────────────────────────

describe('TC-F26-01-02: English default selected + Continue → onAction("switch", "en")', () => {
    it('fires switch with en when Continue is clicked with English selected (default)', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={onAction} />,
        )
        // English is selected by default — click Continue directly
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
        expect(onAction).toHaveBeenCalledWith('switch', 'en')
    })
})

// ── AC-3: Malay card selected + Continue ──────────────────────────────────────

describe('TC-F26-01-03: Malay selected + Continue → onAction("switch", "ms")', () => {
    it('fires switch with ms when Malay card is selected then Continue clicked', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={onAction} />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Malay/i }))
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
        expect(onAction).toHaveBeenCalledWith('switch', 'ms')
    })
})

// ── AC-4: Detected locale card selected + Continue ────────────────────────────

describe('TC-F26-01-04: Keep Thai selected + Continue → onAction("confirm", "th")', () => {
    it('fires confirm with th when Keep Thai card is selected then Continue clicked', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={onAction} />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Thai/i }))
        fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
        expect(onAction).toHaveBeenCalledWith('confirm', 'th')
    })
})

// ── AC-5: Cancel → dismiss ────────────────────────────────────────────────────

describe('TC-F26-01-05: Cancel → onAction("dismiss", detectedLocale)', () => {
    it('fires dismiss with th when Cancel is clicked', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="th" onAction={onAction} />,
        )
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
        expect(onAction).toHaveBeenCalledWith('dismiss', 'th')
    })
})

// ── AC-6: Modal not visible when isOpen = false ───────────────────────────────

describe('TC-F26-01-06: modal not visible when isOpen = false', () => {
    it('does not render modal content', () => {
        render(
            <LanguageConfirmBanner isOpen={false} detectedLocale="th" onAction={vi.fn()} />,
        )
        expect(screen.queryByText(/language detected/i)).toBeNull()
    })
})

// ── AC-7: Unknown locale fallback ─────────────────────────────────────────────

describe('TC-F26-01-07: unknown locale shows raw code fallback', () => {
    it('shows "{locale} language detected" and "Keep {locale}" for unknown locale', () => {
        render(
            <LanguageConfirmBanner isOpen={true} detectedLocale="fr" onAction={vi.fn()} />,
        )
        expect(screen.getByText(/French language detected/i)).toBeTruthy()
        expect(screen.getByRole('button', { name: /French/i })).toBeTruthy()
    })
})

/**
 * F26-01: Language confirm after AI generate — unit tests
 * TC-IDs: F26-01-01 → F26-01-05
 *
 * Covers:
 *   AC-1: Dialog renders with detected locale pre-selected
 *   AC-2: confirm → locale unchanged, pendingLocaleConfirm = false
 *   AC-3: switch  → locale changes to alternate, pendingLocaleConfirm = false
 *   AC-4: dismiss → locale unchanged, pendingLocaleConfirm = false
 *   AC-5: Dialog does not re-appear after action
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageConfirmDialog } from '@/components/editor/LanguageConfirmDialog'

vi.mock('next/font/google', () => ({
    Inter: () => ({ className: 'inter' }),
}))

// ── AC-1: Dialog renders with detected locale ─────────────────────────────────

describe('TC-F26-01-01: dialog renders detected locale label', () => {
    it('shows "Bahasa Melayu" for ms locale', () => {
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="ms"
                onAction={vi.fn()}
            />,
        )
        // At least one element contains the locale label
        expect(screen.getAllByText(/Bahasa Melayu/).length).toBeGreaterThan(0)
    })

    it('shows "English" as alternate switch option for ms locale', () => {
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="ms"
                onAction={vi.fn()}
            />,
        )
        expect(screen.getByText(/switch to English/i)).toBeTruthy()
    })
})

// ── AC-2: confirm action ──────────────────────────────────────────────────────

describe('TC-F26-01-02: confirm → calls onAction("confirm", detectedLocale)', () => {
    it('fires confirm with ms locale', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="ms"
                onAction={onAction}
            />,
        )
        fireEvent.click(screen.getByText(/Yes, continue in Bahasa Melayu/i))
        expect(onAction).toHaveBeenCalledWith('confirm', 'ms')
    })
})

// ── AC-3: switch action ───────────────────────────────────────────────────────

describe('TC-F26-01-03: switch → calls onAction("switch", alternateLocale)', () => {
    it('fires switch with "en" when detected was "ms"', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="ms"
                onAction={onAction}
            />,
        )
        fireEvent.click(screen.getByText(/No, switch to English/i))
        expect(onAction).toHaveBeenCalledWith('switch', 'en')
    })

    it('fires switch with "ms" when detected was "en"', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="en"
                onAction={onAction}
            />,
        )
        fireEvent.click(screen.getByText(/No, switch to Bahasa Melayu/i))
        expect(onAction).toHaveBeenCalledWith('switch', 'ms')
    })
})

// ── AC-4: dismiss action ──────────────────────────────────────────────────────

describe('TC-F26-01-04: dismiss → calls onAction("dismiss", detectedLocale)', () => {
    it('fires dismiss with original locale intact', () => {
        const onAction = vi.fn()
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="ms"
                onAction={onAction}
            />,
        )
        fireEvent.click(screen.getByText(/Dismiss/i))
        expect(onAction).toHaveBeenCalledWith('dismiss', 'ms')
    })
})

// ── AC-5: dialog does not render when isOpen = false ─────────────────────────

describe('TC-F26-01-05: dialog not visible when isOpen = false', () => {
    it('does not render dialog content', () => {
        render(
            <LanguageConfirmDialog
                isOpen={false}
                detectedLocale="ms"
                onAction={vi.fn()}
            />,
        )
        expect(screen.queryByText(/Language Detected/)).toBeNull()
    })
})

// ── AC-6: unknown locale fallback ─────────────────────────────────────────────

describe('TC-F26-01-06: unknown locale fallback', () => {
    it('shows raw locale code when locale not in LOCALE_LABELS map', () => {
        // Arrange — 'fr' is not in LOCALE_LABELS (only 'ms' and 'en' are mapped)
        render(
            <LanguageConfirmDialog
                isOpen={true}
                detectedLocale="fr"
                onAction={vi.fn()}
            />,
        )

        // Assert — raw locale code 'fr' appears in the description span
        // The component uses: LOCALE_LABELS[detectedLocale] ?? detectedLocale
        // getAllByText is correct here — 'fr' appears in both the <span> and the button text
        expect(screen.getAllByText(/fr/).length).toBeGreaterThan(0)

        // Assert — confirm button uses raw code as label fallback (exact button text)
        expect(screen.getByText(/Yes, continue in fr/i)).toBeTruthy()
    })
})

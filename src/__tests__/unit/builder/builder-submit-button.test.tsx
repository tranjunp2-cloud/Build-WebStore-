// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: en }),
}))

import { BuilderSubmitButton } from '@/components/builder/fields/BuilderSubmitButton'

const GRADIENT = '[background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)]'

// ── TC-F01.04: compact Generate button — quiet until the form is valid ──
describe('[TC-F01.04] BuilderSubmitButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: quiet slate styling while the details are incomplete, still clickable', () => {
        // Arrange
        const onClick = vi.fn()
        render(<BuilderSubmitButton onClick={onClick} type="button">Generate website</BuilderSubmitButton>)
        const btn = screen.getByRole('button', { name: /Generate website/ })

        // Act
        fireEvent.click(btn)

        // Assert
        expect(btn).toHaveClass('bg-[#1e293b]', 'text-[#64748b]')
        expect(btn.className).not.toContain(GRADIENT)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('TC-F01.04: switches to the primary gradient with white text when ready — same 200×36 size', () => {
        // Arrange + Act
        const { rerender } = render(<BuilderSubmitButton type="button">Generate website</BuilderSubmitButton>)
        const quietSize = ['h-9', 'w-[200px]']
        expect(screen.getByRole('button')).toHaveClass(...quietSize)
        rerender(<BuilderSubmitButton ready type="button">Generate website</BuilderSubmitButton>)

        // Assert
        const btn = screen.getByRole('button')
        expect(btn.className).toContain(GRADIENT)
        expect(btn).toHaveClass('text-white', ...quietSize)
        expect(btn).toHaveAttribute('data-ready', 'true')
    })

    it('TC-F01.75: shows the loading label and is disabled while generating', () => {
        // Arrange + Act
        render(<BuilderSubmitButton disabled loading ready type="button">Generate website</BuilderSubmitButton>)

        // Assert
        expect(screen.getByRole('button')).toBeDisabled()
        expect(screen.getByText(en.onboarding.form.initializing)).toBeInTheDocument()
    })
})

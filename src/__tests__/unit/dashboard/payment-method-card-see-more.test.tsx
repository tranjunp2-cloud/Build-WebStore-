import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { PaymentMethodCard } from '@/app/(dashboard)/settings/payments/PaymentMethodCard'
import { I18nProvider } from '@/i18n'

// GH-1499 issue 2 — code review follow-up: the expand/collapse toggle is real JS
// state (not CSS-only), so it needs behavioral coverage, not just visual QA.
const SHORT_DESC = 'Pay with a credit or debit card.'
const LONG_DESC = 'Buyer pays in cash when the courier delivers. You will need to confirm receipt in the order before shipment is marked paid and this sentence pushes it well past the truncation threshold.'

function renderCard(desc: string) {
    const onChange = vi.fn()
    render(
        <I18nProvider defaultLocale="en">
            <PaymentMethodCard
                icon={<span>icon</span>}
                title="Cash on Delivery"
                desc={desc}
                on={false}
                onChange={onChange}
            />
        </I18nProvider>
    )
    return { onChange }
}

describe('[TC-F13.165] PaymentMethodCard — description truncation + See more toggle', () => {
    it('does not render a See more toggle for a short description', () => {
        renderCard(SHORT_DESC)
        expect(screen.queryByRole('button', { name: /see more/i })).not.toBeInTheDocument()
    })

    it('renders a See more toggle for a long description, collapsed by default', () => {
        renderCard(LONG_DESC)
        const toggle = screen.getByRole('button', { name: /see more/i })
        expect(toggle).toBeInTheDocument()
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('clicking See more expands the description and flips the button to See less', () => {
        renderCard(LONG_DESC)
        const toggle = screen.getByRole('button', { name: /see more/i })

        fireEvent.click(toggle)

        const collapseToggle = screen.getByRole('button', { name: /see less/i })
        expect(collapseToggle).toHaveAttribute('aria-expanded', 'true')
    })

    it('clicking See less collapses the description back', () => {
        renderCard(LONG_DESC)
        fireEvent.click(screen.getByRole('button', { name: /see more/i }))
        fireEvent.click(screen.getByRole('button', { name: /see less/i }))

        const toggle = screen.getByRole('button', { name: /see more/i })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('the description text renders regardless of expanded state (only clamping changes)', () => {
        renderCard(LONG_DESC)
        expect(screen.getByText(LONG_DESC)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /see more/i }))
        expect(screen.getByText(LONG_DESC)).toBeInTheDocument()
    })
})

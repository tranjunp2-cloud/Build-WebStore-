/**
 * Customer Badge Components — TC-CUST-26 through TC-CUST-29
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { I18nProvider } from '@/i18n'
import { CustomerStatusBadge } from '@/app/(dashboard)/customers/_components/customer-status-badge'
import { CustomerSourceBadge } from '@/app/(dashboard)/customers/_components/customer-source-badge'

function withI18n(ui: React.ReactElement) {
    return render(<I18nProvider defaultLocale="en">{ui}</I18nProvider>)
}

describe('[TC-CUST-26..27] CustomerStatusBadge', () => {
    it('[TC-CUST-26] renders "New" label with amber color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="new" />)
        expect(screen.getByText('New')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(251, 191, 36)')
    })

    it('[TC-CUST-26b] renders "Contacted" label with teal color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="contacted" />)
        expect(screen.getByText('Contacted')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(45, 212, 191)')
    })

    it('[TC-CUST-26c] renders "Ignored" label with gray color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="ignored" />)
        expect(screen.getByText('Ignored')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(156, 163, 175)')
    })

    it('[TC-CUST-27] renders "Subscribed" label with violet color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="subscribed" />)
        expect(screen.getByText('Subscribed')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(167, 139, 250)')
    })
})

describe('[TC-CUST-28..29] CustomerSourceBadge', () => {
    it('[TC-CUST-28] renders "Contact Forms" label with blue color for contact-form', () => {
        const { container } = render(<CustomerSourceBadge source="contact-form" />)
        expect(screen.getByText('Contact Forms')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(59, 130, 246)')
    })

    it('[TC-CUST-29] renders "Newsletter Subscriptions" label with indigo color', () => {
        const { container } = render(<CustomerSourceBadge source="newsletter" />)
        expect(screen.getByText('Newsletter Subscriptions')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.style.color).toBe('rgb(138, 129, 245)')
    })
})

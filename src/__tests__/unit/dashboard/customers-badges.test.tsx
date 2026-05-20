/**
 * Customer Badge Components — TC-CUST-26..26d, TC-CUST-27..29
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CustomerStatusBadge } from '@/app/(dashboard)/customers/_components/customer-status-badge'
import { CustomerSourceBadge } from '@/app/(dashboard)/customers/_components/customer-source-badge'

function withI18n(ui: React.ReactElement) {
    return render(
        <I18nProvider defaultLocale="en">
            <TooltipProvider>{ui}</TooltipProvider>
        </I18nProvider>
    )
}

describe('[TC-CUST-26..27] CustomerStatusBadge', () => {
    it('[TC-CUST-26] renders "New" label with amber color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="new" />)
        expect(screen.getByText('New')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-amber-400')
    })

    it('[TC-CUST-26b] renders "Contacted" label with teal color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="contacted" />)
        expect(screen.getByText('Contacted')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-teal')
    })

    it('[TC-CUST-26c] renders "Ignored" label with gray color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="ignored" />)
        expect(screen.getByText('Ignored')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-zinc')
    })

    it('[TC-CUST-26d] renders "Read" label with indigo color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="read" />)
        expect(screen.getByText('Read')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-indigo')
    })

    it('[TC-CUST-27] renders "Subscribed" label with violet color', () => {
        const { container } = withI18n(<CustomerStatusBadge status="subscribed" />)
        expect(screen.getByText('Subscribed')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-violet')
    })
})

describe('[TC-CUST-28..29] CustomerSourceBadge', () => {
    it('[TC-CUST-28] renders "Contact Forms" label with blue color for contact-form', () => {
        const { container } = withI18n(<CustomerSourceBadge source="contact-form" />)
        expect(screen.getByText('Contact Forms')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-blue')
    })

    it('[TC-CUST-29] renders "Newsletter Subscriptions" label with indigo color', () => {
        const { container } = withI18n(<CustomerSourceBadge source="newsletter" />)
        expect(screen.getByText('Newsletter Subscriptions')).toBeTruthy()
        const span = container.querySelector('span')!
        expect(span.className).toContain('text-violet')
    })
})

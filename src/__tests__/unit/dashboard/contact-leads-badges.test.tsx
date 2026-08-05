/**
 * Customer Badge Components — TC-CUST-26..26d, TC-CUST-27..29
 *
 * GH-1337: badges rewritten to match Figma spec (node-id=32179-5360/5364).
 * Now use tinted inline styles via badge-tokens.ts (DRY, no shadcn variants).
 * Assertions migrated from className.toContain() to toHaveStyle({ color }).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CustomerStatusBadge } from '@/app/(dashboard)/contact-leads/_components/customer-status-badge'
import { CustomerSourceBadge } from '@/app/(dashboard)/contact-leads/_components/customer-source-badge'

function withI18n(ui: React.ReactElement) {
    return render(
        <I18nProvider defaultLocale="en">
            <TooltipProvider>{ui}</TooltipProvider>
        </I18nProvider>
    )
}

describe('[TC-CUST-26..27] CustomerStatusBadge', () => {
    it('[TC-CUST-26] renders "New" label with amber tinted color', () => {
        withI18n(<CustomerStatusBadge status="new" />)
        expect(screen.getByText('New')).toHaveStyle({ color: '#fbbf24' })
    })

    it('[TC-CUST-26b] renders "Contacted" label with teal tinted color', () => {
        withI18n(<CustomerStatusBadge status="contacted" />)
        expect(screen.getByText('Contacted')).toHaveStyle({ color: '#2dd4bf' })
    })

    it('[TC-CUST-26c] renders "Ignored" label with gray tinted color', () => {
        withI18n(<CustomerStatusBadge status="ignored" />)
        expect(screen.getByText('Ignored')).toHaveStyle({ color: '#9ca3af' })
    })

    it('[TC-CUST-26d] renders "Read" label with indigo tinted color', () => {
        withI18n(<CustomerStatusBadge status="read" />)
        expect(screen.getByText('Read')).toHaveStyle({ color: '#818cf8' })
    })

    it('[TC-CUST-27] renders "Subscribed" label with violet tinted color', () => {
        withI18n(<CustomerStatusBadge status="subscribed" />)
        expect(screen.getByText('Subscribed')).toHaveStyle({ color: '#8a81f5' })
    })
})

describe('[TC-CUST-28..29] CustomerSourceBadge', () => {
    it('[TC-CUST-28] renders "Contact forms" label with blue tinted color', () => {
        withI18n(<CustomerSourceBadge source="contact-form" />)
        expect(screen.getByText('Contact forms')).toHaveStyle({ color: '#3b82f6' })
    })

    it('[TC-CUST-29] renders "Newsletter subscriptions" label with violet tinted color', () => {
        withI18n(<CustomerSourceBadge source="newsletter" />)
        expect(screen.getByText('Newsletter subscriptions')).toHaveStyle({ color: '#8a81f5' })
    })
})

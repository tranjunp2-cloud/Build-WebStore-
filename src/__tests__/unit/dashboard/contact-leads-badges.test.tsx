/**
 * Customer Badge Components — TC-CUST-26..26d, TC-CUST-27..29
 *
 * GH-1222: these badges were migrated to the shared <Badge> design-system component,
 * which maps each status/source to a theme-aware VARIANT (light -700 / dark -300 tints)
 * instead of bespoke -400 colors. Tests now assert the variant's signature class on the
 * Badge element (a <div>, queried via its label) — the status→variant mapping is the
 * component's real responsibility; the exact color shade lives in <Badge>.
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
    it('[TC-CUST-26] renders "New" label with warning variant (amber)', () => {
        withI18n(<CustomerStatusBadge status="new" />)
        expect(screen.getByText('New').className).toContain('text-amber-700')
    })

    it('[TC-CUST-26b] renders "Contacted" label with success variant (emerald)', () => {
        withI18n(<CustomerStatusBadge status="contacted" />)
        expect(screen.getByText('Contacted').className).toContain('text-emerald-700')
    })

    it('[TC-CUST-26c] renders "Ignored" label with secondary variant (slate)', () => {
        withI18n(<CustomerStatusBadge status="ignored" />)
        expect(screen.getByText('Ignored').className).toContain('text-slate-600')
    })

    it('[TC-CUST-26d] renders "Read" label with outline variant', () => {
        withI18n(<CustomerStatusBadge status="read" />)
        expect(screen.getByText('Read').className).toContain('border-slate-300')
    })

    it('[TC-CUST-27] renders "Subscribed" label with default variant (blue)', () => {
        withI18n(<CustomerStatusBadge status="subscribed" />)
        expect(screen.getByText('Subscribed').className).toContain('bg-blue-600')
    })
})

describe('[TC-CUST-28..29] CustomerSourceBadge', () => {
    it('[TC-CUST-28] renders "Contact Forms" label with default variant (blue)', () => {
        withI18n(<CustomerSourceBadge source="contact-form" />)
        expect(screen.getByText('Contact Forms').className).toContain('bg-blue-600')
    })

    it('[TC-CUST-29] renders "Newsletter Subscriptions" label with secondary variant (slate)', () => {
        withI18n(<CustomerSourceBadge source="newsletter" />)
        expect(screen.getByText('Newsletter Subscriptions').className).toContain('text-slate-600')
    })
})

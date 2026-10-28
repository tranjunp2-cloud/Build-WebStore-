/**
 * TC-AICP-279 — Settings > Email templates: the template list with the Automations slot under it renders without React's
 * "Each child in a list should have a unique key" warning (both siblings are keyed), the slot shows under the list, and
 * a page without a slot renders the list alone. Real: EmailTemplatesClient, list view, en strings. Faked: server actions, sonner.
 */
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/settings/email-templates/actions', () => ({ saveEmailTemplateConfig: vi.fn(), resetEmailTemplateConfig: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EmailTemplatesClient } from '@/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient'
import { I18nProvider } from '@/i18n'

afterEach(cleanup)

const mount = (slot?: React.ReactNode) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
        <I18nProvider defaultLocale="en">
            <EmailTemplatesClient initialRows={[]} defaultsByType={{} as never} automationsSlot={slot} />
        </I18nProvider>,
    )
    return errors
}

describe('EmailTemplatesClient keys [TC-AICP-279]', () => {
    it('renders the list and the automations slot without a key warning', () => {
        const errors = mount(<section data-testid="slot">Automations</section>)

        expect(screen.getByTestId('slot')).toBeInTheDocument()
        expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
        const warnings = errors.mock.calls.filter((call) => String(call[0]).includes('unique "key"') || String(call.join(' ')).includes('unique "key"'))
        expect(warnings).toEqual([])
        errors.mockRestore()
    })

    it('puts the slot after the list, and renders the list alone without a slot', () => {
        const withSlot = mount(<section data-testid="slot">Automations</section>)
        const list = screen.getAllByRole('tab')[0]!
        expect(list.compareDocumentPosition(screen.getByTestId('slot')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        withSlot.mockRestore()
        cleanup()

        const alone = mount()
        expect(screen.queryByTestId('slot')).not.toBeInTheDocument()
        expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
        alone.mockRestore()
    })
})

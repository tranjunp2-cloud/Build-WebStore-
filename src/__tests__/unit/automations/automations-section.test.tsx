/**
 * TC-AICP-236 — Settings > Email templates > Automations: a switch per automation and for the digest (frequency only
 * while it is on), Save sends exactly the switches and is off until something changed, a refusal shows the
 * translated reason, owners / admins can edit while anyone else sees the same page read-only, Bahasa Melayu strings.
 * TC-AICP-237 — "Run now" shows what would be sent (with the fix link and the Monday note) or "nothing needs you",
 * is blocked while changes are unsaved, and the preview is cleared by a save.
 * TC-AICP-242 — a bell notification of the new type shows its own icon and its stored (already translated) text.
 * Real: AutomationsSection, Switch / Button, en + ms strings, NotificationItem. Faked: the two server actions, next/link, sonner.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({ save: vi.fn(), preview: vi.fn() }))
vi.mock('@/app/(dashboard)/settings/email-templates/automation-actions', () => ({ saveAutomationSettingsAction: actions.save, previewAutomationsAction: actions.preview }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { AutomationsSection } from '@/app/(dashboard)/settings/email-templates/_components/automations-section'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { defaultAutomationSettings, type AutomationSettings } from '@/lib/automations/automation-config'
import { I18nProvider } from '@/i18n'

const wrap = (initial: AutomationSettings = defaultAutomationSettings(), canEdit = true, locale: 'en' | 'ms' = 'en') =>
    render(<I18nProvider defaultLocale={locale}><AutomationsSection initial={initial} canEdit={canEdit} /></I18nProvider>)
const sw = (name: string) => screen.getByRole('switch', { name })

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    actions.save.mockImplementation(async (input: { enabled: AutomationSettings['enabled']; digest: AutomationSettings['digest'] }) => ({ success: true, data: { ...defaultAutomationSettings(), ...input } }))
    actions.preview.mockResolvedValue({ success: true, data: { day: '2026-10-27', reminders: [], mondayOnly: [], off: [], digest: { enabled: false, frequency: 'daily' } } })
})
afterEach(cleanup)

describe('AutomationsSection [TC-AICP-236]', () => {
    it('shows every automation switched on and the digest off, as the defaults say', () => {
        wrap()

        expect(screen.getByRole('heading', { name: 'Automations' })).toBeInTheDocument()
        for (const name of ['Discount codes', 'Stock', 'Orders waiting', 'Unanswered messages', 'Website health']) expect(sw(name)).toHaveAttribute('aria-checked', 'true')
        expect(sw('Email digest')).toHaveAttribute('aria-checked', 'false')
        expect(screen.queryByRole('group', { name: 'How often' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('saves exactly the switches after a change, then goes quiet again', async () => {
        wrap()

        fireEvent.click(sw('Stock'))
        fireEvent.click(sw('Email digest'))
        const frequency = screen.getByRole('group', { name: 'How often' })
        fireEvent.click(within(frequency).getByRole('button', { name: 'Mondays only' }))
        expect(within(frequency).getByRole('button', { name: 'Mondays only' })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenCalledWith({
            enabled: { discounts: true, stock: false, orders_waiting: true, leads: true, site_health: true },
            digest: { enabled: true, frequency: 'weekly' },
        })
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Automations saved.'))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    })

    it('shows the translated reason when the server refuses', async () => {
        actions.save.mockResolvedValue({ success: false, error: 'forbidden' })
        wrap()

        fireEvent.click(sw('Stock'))
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only the owner or an admin can change the automations.'))
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })

    it('is read-only for anyone who may not change it', () => {
        wrap(defaultAutomationSettings(), false)

        expect(screen.getByRole('note')).toHaveTextContent('Only the owner or an admin can change the automations.')
        expect(sw('Stock')).toBeDisabled()
        expect(sw('Email digest')).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Run now/ })).not.toBeInTheDocument()
    })

    it('speaks Bahasa Melayu', () => {
        wrap(defaultAutomationSettings(), true, 'ms')

        expect(screen.getByRole('heading', { name: 'Automasi' })).toBeInTheDocument()
        expect(sw('Kod diskaun')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Jalankan sekarang/ })).toBeInTheDocument()
    })
})

describe('Run now [TC-AICP-237]', () => {
    const reminder = { automation: 'stock', dedupeKey: 'automation:stock:2026-10-27', title: '6 live products are out of stock', message: 'Active products with 0 in stock.', actionUrl: '/products?todo=out_of_stock', kind: 'out_of_stock', count: 6, items: [] }

    it('lists what would be sent, with the fix link, and says what is left for Monday', async () => {
        actions.preview.mockResolvedValue({ success: true, data: { day: '2026-10-27', reminders: [reminder], mondayOnly: ['site_health'], off: [], digest: { enabled: false, frequency: 'daily' } } })
        wrap()

        fireEvent.click(screen.getByRole('button', { name: /Run now/ }))

        const preview = await screen.findByTestId('automations-preview')
        expect(within(preview).getByText('6 live products are out of stock')).toBeInTheDocument()
        expect(within(preview).getByText('Active products with 0 in stock.')).toBeInTheDocument()
        expect(within(preview).getByRole('link', { name: /Fix with the assistant/ })).toHaveAttribute('href', '/products?todo=out_of_stock')
        expect(within(preview).getByText('Left for Monday: Website health.')).toBeInTheDocument()
        expect(within(preview).getByText('Preview only: nothing is sent and no email goes out.')).toBeInTheDocument()
        expect(actions.save).not.toHaveBeenCalled()
    })

    it('says nothing needs the merchant when the preview is empty', async () => {
        wrap()

        fireEvent.click(screen.getByRole('button', { name: /Run now/ }))

        expect(await screen.findByText('Nothing needs you right now, so no reminder would be sent.')).toBeInTheDocument()
    })

    it('waits for unsaved changes to be saved, and clears the preview once they are', async () => {
        wrap()
        fireEvent.click(screen.getByRole('button', { name: /Run now/ }))
        await screen.findByTestId('automations-preview')

        fireEvent.click(sw('Stock'))
        expect(screen.getByRole('button', { name: /Run now/ })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(screen.queryByTestId('automations-preview')).not.toBeInTheDocument())
        expect(screen.getByRole('button', { name: /Run now/ })).toBeEnabled()
    })

    it('shows the translated reason when the preview is refused', async () => {
        actions.preview.mockResolvedValue({ success: false, error: 'rate_limited' })
        wrap()

        fireEvent.click(screen.getByRole('button', { name: /Run now/ }))

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many checks. Try again in a little while.'))
        expect(screen.queryByTestId('automations-preview')).not.toBeInTheDocument()
    })
})

describe('bell notification of the new type [TC-AICP-242]', () => {
    it('shows the stored reminder text with its own icon, not the order icon', () => {
        const { container } = render(
            <I18nProvider defaultLocale="en">
                <NotificationItem notification={{ id: '1', type: 'AUTOMATION_REMINDER', title: '6 live products are out of stock', message: 'Active products with 0 in stock.', metadata: { automation: 'stock' }, actionUrl: '/products?todo=out_of_stock', isRead: false, createdAt: new Date().toISOString() }} />
            </I18nProvider>,
        )

        expect(screen.getByText('6 live products are out of stock')).toBeInTheDocument()
        expect(screen.getByText('Active products with 0 in stock.')).toBeInTheDocument()
        expect(container.querySelector('svg.lucide-clipboard-check')).not.toBeNull()
        expect(container.querySelector('svg.lucide-shopping-cart')).toBeNull()
    })
})

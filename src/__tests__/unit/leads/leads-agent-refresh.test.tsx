/**
 * TC-AICP-315 — contact leads: the list refetches the page on screen (same search / status / page) when the assistant
 * changes a lead status or sends a reply, rows stay meanwhile, a failed fetch shows no toast and a burst gives ONE fetch;
 * the open lead panel reads its thread (replies) and status again for THAT lead only, a status picked in the panel and
 * not yet saved is kept, and nothing is typed over (the panel has no reply composer: replies are read-only here).
 * Real: CustomersClientLayout (contact leads), CustomerDetailPanel, useAgentChanges, announceAgentChange (the bus),
 * en strings. Faked: the page's server actions, sonner.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/contact-leads/actions', () => ({
    getCustomersAction: vi.fn(),
    deleteCustomerAction: vi.fn(),
    exportCustomersCsvAction: vi.fn(),
    getCustomerDetailAction: vi.fn(),
    updateContactStatusAction: vi.fn(async () => ({})),
}))

import { CustomerDetailPanel } from '@/app/(dashboard)/contact-leads/_components/customer-detail-panel'
import { CustomersClientLayout } from '@/app/(dashboard)/contact-leads/_components/customers-client-layout'
import * as actions from '@/app/(dashboard)/contact-leads/actions'
import { mapContactSubmission } from '@/app/(dashboard)/contact-leads/_lib/customer-record'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const list = vi.mocked(actions.getCustomersAction)
const detail = vi.mocked(actions.getCustomerDetailAction)
const c = en.dashboard.customers

const lead = (id: number, over: Record<string, unknown> = {}) => mapContactSubmission({
    id, name: `Lead ${id}`, email: `l${id}@x.my`, message: `Question ${id}`, status: 'read', site: 5, createdAt: '2026-10-10T08:00:00.000Z', ...over,
})
const reply = { id: 'r1', subject: 'Re: shipping', body: 'Yes, we ship to Sabah.', sentAt: '2026-10-11T09:30:00.000Z', sentBy: 'owner@kedai.my' }
const page = (...names: string[]) => ({ data: names.map((n, i) => lead(i + 1, { name: n })), meta: { total: names.length } })
const change = (id: string, kind = 'contact_lead'): AgentChange => ({
    action: 'applied', kind: 'store.customers_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const wrap = (ui: React.ReactElement) => render(<I18nProvider defaultLocale="en"><TooltipProvider>{ui}</TooltipProvider></I18nProvider>)
const settle = () => act(() => new Promise((r) => setTimeout(r, 260)))

beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

describe('contact leads list refreshes on a lead change or reply [TC-AICP-315]', () => {
    it('TC-AICP-315: refetches the same query, keeps rows meanwhile, one fetch per burst, other kinds ignored', async () => {
        list.mockResolvedValue(page('Ahmad') as never)
        wrap(<CustomersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('Ahmad').length).toBeGreaterThan(0))

        fireEvent.change(screen.getByPlaceholderText(c.searchPlaceholder), { target: { value: 'ahm' } })
        await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ahm' })), { timeout: 2000 })
        const query = list.mock.calls.at(-1)![0]

        list.mockClear()
        act(() => announceAgentChange(change('1', 'store_order')))
        await settle()
        expect(list).not.toHaveBeenCalled()

        let finish!: (v: never) => void
        list.mockImplementationOnce(() => new Promise((r) => { finish = r as typeof finish }))
        act(() => { announceAgentChange(change('1')); announceAgentChange(change('1', 'lead_reply')) })
        await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
        expect(list).toHaveBeenCalledWith(query)
        // the rows stay, and the loading text of the mobile list is not shown
        expect(screen.getAllByText('Ahmad').length).toBeGreaterThan(0)
        expect(screen.queryByText(c.loading)).toBeNull()

        await act(async () => { finish(page('Ahmad Zaki') as never) })
        await waitFor(() => expect(screen.getAllByText('Ahmad Zaki').length).toBeGreaterThan(0))
        await settle()
        expect(list).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-315: a failed background fetch keeps the rows with no toast', async () => {
        list.mockResolvedValue(page('Ahmad') as never)
        wrap(<CustomersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('Ahmad').length).toBeGreaterThan(0))

        list.mockRejectedValue(new Error('offline'))
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(screen.getAllByText('Ahmad').length).toBeGreaterThan(0)
        expect(toast.error).not.toHaveBeenCalled()
    })
})

describe('open lead panel follows the assistant [TC-AICP-315]', () => {
    const open = () => wrap(<CustomerDetailPanel record={lead(1)} onClose={vi.fn()} onStatusUpdate={vi.fn()} />)
    const threadOf = (replies: unknown[], status = 'read') => ({ record: lead(1, { status }), timeline: [lead(1, { replies, status })] })

    it('TC-AICP-315: a reply the assistant sent shows in the thread without reopening; another lead is ignored', async () => {
        detail.mockResolvedValue(threadOf([]) as never)
        open()
        await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument())
        expect(screen.queryByText(c.replySent)).toBeNull()

        detail.mockClear()
        act(() => announceAgentChange(change('2', 'lead_reply')))
        await settle()
        expect(detail).not.toHaveBeenCalled()

        detail.mockResolvedValue(threadOf([reply]) as never)
        act(() => announceAgentChange(change('1', 'lead_reply')))
        await waitFor(() => expect(screen.getByText('Re: shipping')).toBeInTheDocument())
        expect(detail).toHaveBeenCalledWith(1, 'contact-form')
        expect(screen.getByText(c.replySent)).toBeInTheDocument()
    })

    it('TC-AICP-315: a status change by the assistant updates the dropdown; a status picked and not saved is kept', async () => {
        detail.mockResolvedValue(threadOf([]) as never)
        open()
        await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument())
        const statusButton = () => screen.getByRole('button', { name: new RegExp(`^(${c.statusRead}|${c.statusContacted}|${c.statusIgnored})`) })
        expect(statusButton()).toHaveTextContent(c.statusRead)

        // nothing picked: the new status shows
        detail.mockResolvedValue(threadOf([], 'replied') as never)
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(statusButton()).toHaveTextContent(c.statusContacted))
        cleanup()

        // the merchant picked Contacted and has not pressed Update: the assistant's change does not override it
        detail.mockResolvedValue(threadOf([]) as never)
        open()
        await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument())
        fireEvent.click(statusButton())
        fireEvent.click(screen.getByRole('button', { name: c.statusContacted }))
        expect(statusButton()).toHaveTextContent(c.statusContacted)

        detail.mockClear()
        detail.mockResolvedValue(threadOf([reply], 'archived') as never)
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(screen.getByText('Re: shipping')).toBeInTheDocument())
        expect(statusButton()).toHaveTextContent(c.statusContacted)
        expect(screen.getByRole('button', { name: c.update })).toBeEnabled()
    })

    it('TC-AICP-315: a failed background read keeps the panel and shows no toast', async () => {
        detail.mockResolvedValueOnce(threadOf([]) as never)
        open()
        await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument())

        detail.mockRejectedValue(new Error('offline'))
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(detail).toHaveBeenCalledTimes(2))
        await settle()
        expect(screen.getByText('Question 1')).toBeInTheDocument()
        expect(toast.error).not.toHaveBeenCalled()
    })
})

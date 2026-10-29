/**
 * TC-AICP-314 — customers: the list refetches the page on screen (same search / rank / page / sort) when the assistant
 * changes a customer, rows stay meanwhile and a failed fetch shows no toast; the detail page follows its own customer:
 * no unsaved edits → reset to the new values silently; unsaved edits → the notice (Reload takes the new values, Keep
 * mine keeps the edits); another customer is ignored; the customer's orders tab re-reads on an order change.
 * Real: ShopCustomersClientLayout, CustomersDetail, the orders tab, useAgentChanges / useAgentRecordSync,
 * announceAgentChange (the bus), en strings. Faked: the page's server actions, next/navigation, sonner.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/customers',
    useSearchParams: () => new URLSearchParams(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/customers/actions', () => ({
    getShopCustomersAction: vi.fn(),
    getShopCustomerDetailAction: vi.fn(),
    updateShopCustomerAction: vi.fn(),
    exportShopCustomersCsvAction: vi.fn(),
    getCustomerOrdersAction: vi.fn(),
}))

import { CustomersDetail } from '@/app/(dashboard)/customers/_components/customers-detail'
import { ShopCustomersClientLayout } from '@/app/(dashboard)/customers/_components/customers-client-layout'
import * as actions from '@/app/(dashboard)/customers/actions'
import type { ShopCustomerRecord } from '@/app/(dashboard)/customers/_lib/shop-customer-record'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

const list = vi.mocked(actions.getShopCustomersAction)
const detail = vi.mocked(actions.getShopCustomerDetailAction)
const orders = vi.mocked(actions.getCustomerOrdersAction)

const customer = (over: Partial<ShopCustomerRecord> = {}): ShopCustomerRecord => ({
    id: 5, email: 'aisyah@x.my', name: 'Aisyah', phone: null, rank: null, notes: null, addresses: [], firstOrderAt: null,
    orderCount: 2, lifetime: 100, completedRate: 100, failedRate: 0, latestOrderAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...over,
})
const answer = (...names: string[]) => ({ data: names.map((n, i) => customer({ id: i + 1, name: n, email: `${n}@x.my` })), meta: { total: names.length } })
const change = (id: string, kind = 'store_customer'): AgentChange => ({
    action: 'applied', kind: 'store.customers_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const wrap = (ui: React.ReactElement) => render(<I18nProvider defaultLocale="en"><TooltipProvider>{ui}</TooltipProvider></I18nProvider>)
const settle = () => act(() => new Promise((r) => setTimeout(r, 260)))

beforeEach(() => {
    vi.resetAllMocks()
    orders.mockResolvedValue({ orders: [], total: 0, totalPages: 1 } as never)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

describe('customers list refreshes when the assistant changes a customer [TC-AICP-314]', () => {
    it('TC-AICP-314: refetches the same query, keeps rows meanwhile, ignores other kinds, one fetch per burst', async () => {
        list.mockResolvedValue(answer('Aisyah') as never)
        wrap(<ShopCustomersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('Aisyah').length).toBeGreaterThan(0))

        // a filter in place: the refetch must keep it
        fireEvent.change(screen.getByPlaceholderText(en.dashboard.shopCustomers.toolbar.searchPlaceholder), { target: { value: 'ais' } })
        await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ais' })), { timeout: 2000 })
        const query = list.mock.calls.at(-1)![0]

        list.mockClear()
        act(() => announceAgentChange(change('9', 'shop_product')))
        await settle()
        expect(list).not.toHaveBeenCalled()

        let finish!: (v: never) => void
        list.mockImplementationOnce(() => new Promise((r) => { finish = r as typeof finish }))
        act(() => { announceAgentChange(change('1')); announceAgentChange(change('2')); announceAgentChange(change('3')) })
        await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
        expect(list).toHaveBeenCalledWith(query)
        // rows stay while it loads (no skeleton)
        expect(screen.getAllByText('Aisyah').length).toBeGreaterThan(0)

        await act(async () => { finish(answer('Aisyah Binti') as never) })
        await waitFor(() => expect(screen.getAllByText('Aisyah Binti').length).toBeGreaterThan(0))
        await settle()
        expect(list).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-314: a failed background fetch keeps the rows with no toast', async () => {
        list.mockResolvedValue(answer('Aisyah') as never)
        wrap(<ShopCustomersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('Aisyah').length).toBeGreaterThan(0))

        list.mockRejectedValue(new Error('offline'))
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(screen.getAllByText('Aisyah').length).toBeGreaterThan(0)
        expect(toast.error).not.toHaveBeenCalled()
    })
})

describe('customer detail follows the assistant [TC-AICP-314]', () => {
    const name = () => screen.getByPlaceholderText(en.dashboard.shopCustomers.detail.fieldNamePlaceholder) as HTMLInputElement
    const notice = en.dashboard.agentChanged.customer

    it('TC-AICP-314: no unsaved edits: the form is reset to the new values silently', async () => {
        detail.mockResolvedValue(customer({ name: 'Aisyah Rahman', rank: 'gold' }) as never)
        wrap(<CustomersDetail customer={customer()} />)
        expect(name().value).toBe('Aisyah')

        act(() => announceAgentChange(change('5')))
        await waitFor(() => expect(name().value).toBe('Aisyah Rahman'))
        expect(detail).toHaveBeenCalledWith(5)
        expect(screen.queryByText(notice)).toBeNull()
        expect(screen.queryByText(en.dashboard.shopCustomers.detail.unsavedBanner)).toBeNull()
    })

    it('TC-AICP-314: unsaved edits: notice, nothing overwritten; Reload takes the new values; Keep mine keeps the edits', async () => {
        detail.mockResolvedValue(customer({ name: 'Aisyah Rahman' }) as never)
        wrap(<CustomersDetail customer={customer()} />)
        fireEvent.change(name(), { target: { value: 'Mine' } })

        act(() => announceAgentChange(change('5')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())
        await settle()
        expect(detail).not.toHaveBeenCalled()
        expect(name().value).toBe('Mine')

        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.keepMine }))
        expect(screen.queryByText(notice)).toBeNull()
        expect(name().value).toBe('Mine')

        act(() => announceAgentChange(change('5')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.reload }))
        await waitFor(() => expect(name().value).toBe('Aisyah Rahman'))
        expect(screen.queryByText(notice)).toBeNull()
    })

    it('TC-AICP-314: another customer is ignored; a failed read keeps the form', async () => {
        detail.mockRejectedValue(new Error('offline'))
        wrap(<CustomersDetail customer={customer()} />)
        act(() => announceAgentChange(change('6')))
        await settle()
        expect(detail).not.toHaveBeenCalled()

        act(() => announceAgentChange(change('5')))
        await waitFor(() => expect(detail).toHaveBeenCalledTimes(1))
        await settle()
        expect(name().value).toBe('Aisyah')
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-AICP-314: the orders tab reads the customer\'s orders again on an order change', async () => {
        const row = (status: string) => ({ id: 1, orderNumber: 'ORD-1', status, total: 5000, currency: 'MYR', paymentStatus: 'paid', createdAt: '2026-10-01T00:00:00Z' })
        orders.mockResolvedValue({ orders: [row('confirmed')], total: 1, totalPages: 1 } as never)
        wrap(<CustomersDetail customer={customer()} />)
        fireEvent.click(screen.getByRole('button', { name: new RegExp(en.dashboard.shopCustomers.detail.tabOrders) }))
        await waitFor(() => expect(screen.getByText('ORD-1')).toBeInTheDocument())

        orders.mockClear()
        orders.mockResolvedValue({ orders: [row('cancelled')], total: 1, totalPages: 1 } as never)
        act(() => announceAgentChange(change('1', 'store_order')))
        await waitFor(() => expect(orders).toHaveBeenCalledWith(5, 1))
        await waitFor(() => expect(screen.getByText(en.dashboard.shopCustomers.ordersTab.statusCancelled)).toBeInTheDocument())
    })
})

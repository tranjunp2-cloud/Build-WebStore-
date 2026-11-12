/**
 * TC-AICP-313 — orders: when the assistant changes an order, the list refetches the page on screen (same page, sort,
 * filters) in place: the rows stay (no spinner), the status counts and the "awaiting verification" chip are read again,
 * a failed background fetch keeps everything, other kinds are ignored and a burst gives ONE fetch of each; the order
 * detail of THAT order re-reads silently (no full-page spinner) and another order's change is ignored.
 * Real: OrdersClientLayout (table, metrics, chip), OrderDetailView, useAgentChanges, announceAgentChange (the bus), en
 * strings. Faked: fetch, next/navigation, sonner, the detail page's heavy cards (probes that show the order status).
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/orders',
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/app/(dashboard)/orders/_components/OrderDetailPanel', () => ({ OrderProgress: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/ManualPaymentVerificationBlock', () => ({ ManualPaymentVerificationBlock: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/CancelOrderModal', () => ({ CancelOrderModal: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/detail/fulfillment-zone', () => ({ FulfillmentZone: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/detail/order-items-card', () => ({ OrderItemsCard: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/detail/customer-card', () => ({ CustomerCard: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/detail/order-actions-card', () => ({ OrderActionsCard: () => null }))
vi.mock('@/app/(dashboard)/orders/_components/detail/payment-card', () => ({
    PaymentCard: ({ order }: { order: { status: string } }) => <div data-testid="status">{order.status}</div>,
}))

import { OrderDetailView } from '@/app/(dashboard)/orders/_components/order-detail-view'
import { OrdersClientLayout } from '@/app/(dashboard)/orders/_components/OrdersClientLayout'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentDashboardQueryProvider } from '../../helpers/agent-query-provider'
import { resetQueryCache } from '../../helpers/query-provider'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'

type Reply = Response | Promise<Response>
const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
const order = (id: string, status = 'pending') => ({ id, orderNumber: `ORD-${id}`, customerName: 'Aisyah', total: 5000, currency: 'MYR', status, paymentMethod: 'cod', createdAt: '2026-10-01T00:00:00Z' })
const rows = (status: string, ...ids: string[]) => json({ success: true, docs: ids.map((i) => order(i, status)), totalDocs: ids.length })

const net = {
    list: vi.fn<(url: string) => Reply>(),
    metrics: vi.fn<(url: string) => Reply>(),
    chip: vi.fn<(url: string) => Reply>(),
    detail: vi.fn<(url: string) => Reply>(),
}
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/orders/metrics')) return net.metrics(url)
    if (url.includes('paymentStatus=pending_verification')) return net.chip(url)
    if (/^\/api\/orders\/[^/?]+/.test(url)) return net.detail(url)
    return net.list(url)
})

const change = (id: string, kind = 'store_order'): AgentChange => ({
    action: 'applied', kind: 'store.orders_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const wrap = (ui: React.ReactElement) => render(<AgentDashboardQueryProvider><I18nProvider defaultLocale="en"><TooltipProvider>{ui}</TooltipProvider></I18nProvider></AgentDashboardQueryProvider>)
const settle = () => act(() => new Promise((r) => setTimeout(r, 260)))

beforeEach(() => {
    resetQueryCache()
    Object.values(net).forEach((m) => m.mockReset())
    net.metrics.mockImplementation(() => json({ success: true, data: { pending: 3 } }))
    net.chip.mockImplementation(() => json({ totalDocs: 2 }))
    toast.error.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    fetchMock.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('orders list refreshes when the assistant changes an order [TC-AICP-313]', () => {
    it('TC-AICP-313: refetches the page on screen in place, and reads the counts and the chip again', async () => {
        net.list.mockImplementation(() => rows('pending', '1'))
        wrap(<OrdersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0))
        await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
        expect(screen.getByText(/Awaiting Verification/)).toHaveTextContent('(2)')

        net.list.mockClear()
        let finish!: (r: Response) => void
        net.list.mockImplementationOnce(() => new Promise<Response>((r) => { finish = r }))
        net.metrics.mockImplementation(() => json({ success: true, data: { pending: 2 } }))
        net.chip.mockImplementation(() => json({ totalDocs: 0 }))
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(net.list).toHaveBeenCalledTimes(1))
        // same page, limit and sort as the one on screen; the row stays and no spinner meanwhile
        expect(net.list.mock.calls[0][0]).toBe('/api/orders?page=1&limit=10&sort=-createdAt')
        expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0)
        expect(document.querySelector('.animate-spin')).toBeNull()

        await act(async () => { finish(await rows('cancelled', '1')) })
        await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
        expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/cancelled/i).length).toBeGreaterThan(0)
    })

    it('TC-AICP-313: a failed background fetch keeps the rows with no toast; other kinds are ignored', async () => {
        net.list.mockImplementation(() => rows('pending', '1'))
        wrap(<OrdersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0))
        net.list.mockClear()

        act(() => announceAgentChange(change('p1', 'shop_product')))
        await settle()
        expect(net.list).not.toHaveBeenCalled()

        net.list.mockImplementation(() => Promise.reject(new Error('offline')))
        act(() => announceAgentChange(change('1')))
        await waitFor(() => expect(net.list).toHaveBeenCalled())
        await settle()
        expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0)
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-AICP-313: three announcements in one burst give ONE fetch of the list, the counts and the chip', async () => {
        net.list.mockImplementation(() => rows('pending', '1'))
        wrap(<OrdersClientLayout />)
        await waitFor(() => expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0))
        await waitFor(() => expect(net.chip).toHaveBeenCalled())
        net.list.mockClear(); net.metrics.mockClear(); net.chip.mockClear()

        act(() => { announceAgentChange(change('1')); announceAgentChange(change('2')); announceAgentChange(change('3')) })
        await settle()
        expect(net.list).toHaveBeenCalledTimes(1)
        expect(net.metrics).toHaveBeenCalledTimes(1)
        expect(net.chip).toHaveBeenCalledTimes(1)
    })
})

describe('order detail refreshes when the assistant changes that order [TC-AICP-313]', () => {
    it('TC-AICP-313: re-reads the order silently; another order is ignored', async () => {
        net.detail.mockImplementation(() => json({ data: order('7', 'confirmed') }))
        wrap(<OrderDetailView orderId="7" />)
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('confirmed'))

        net.detail.mockClear()
        act(() => announceAgentChange(change('8')))
        await settle()
        expect(net.detail).not.toHaveBeenCalled()

        let finish!: (r: Response) => void
        net.detail.mockImplementationOnce(() => new Promise<Response>((r) => { finish = r }))
        act(() => announceAgentChange(change('7')))
        await waitFor(() => expect(net.detail).toHaveBeenCalledTimes(1))
        expect(net.detail.mock.calls[0][0]).toBe('/api/orders/7?depth=2')
        // no full-page spinner while it loads
        expect(screen.getByTestId('status')).toHaveTextContent('confirmed')
        await act(async () => { finish(json({ data: order('7', 'cancelled') })) })
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('cancelled'))
    })

    it('TC-AICP-313: a failed background read keeps the order on screen without a toast', async () => {
        net.detail.mockImplementationOnce(() => json({ data: order('7', 'confirmed') }))
        wrap(<OrderDetailView orderId="7" />)
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('confirmed'))

        net.detail.mockImplementation(() => new Response('{}', { status: 500 }))
        act(() => announceAgentChange(change('7')))
        await waitFor(() => expect(net.detail).toHaveBeenCalledTimes(2))
        await settle()
        expect(screen.getByTestId('status')).toHaveTextContent('confirmed')
        expect(toast.error).not.toHaveBeenCalled()
    })
})

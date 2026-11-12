/**
 * TC-F21-02-02 — order detail header (back button + created date) is translated in BM and stays English in EN.
 * Real: OrderDetailView, I18nProvider, en/ms strings. Faked: fetch, next/navigation, sonner, heavy detail cards.
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
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentDashboardQueryProvider } from '../../helpers/agent-query-provider'
import { resetQueryCache } from '../../helpers/query-provider'

const order = { id: '7', orderNumber: 'ORD-7', customerName: 'Aisyah', total: 5000, currency: 'MYR', status: 'cancelled', paymentMethod: 'cod', createdAt: '2026-05-05T03:44:00Z' }
const wrap = (locale: 'en' | 'ms') => render(
    <AgentDashboardQueryProvider><I18nProvider defaultLocale={locale}><TooltipProvider><OrderDetailView orderId="7" /></TooltipProvider></I18nProvider></AgentDashboardQueryProvider>,
)

beforeEach(() => {
    resetQueryCache()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: order }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('order detail header i18n [TC-F21-02-02]', () => {
    it('TC-F21-02-02: BM shows "Pesanan" and "Dicipta", no English "Orders"/"Created"', async () => {
        wrap('ms')
        await waitFor(() => expect(screen.getByText('ORD-7')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Pesanan' })).toBeInTheDocument()
        expect(screen.getByText(/^Dicipta /)).toBeInTheDocument()
        expect(screen.queryByText(/^Created /)).toBeNull()
        expect(screen.queryByRole('button', { name: 'Orders' })).toBeNull()
    })

    it('TC-F21-02-02: EN keeps "Orders" and "Created"', async () => {
        wrap('en')
        await waitFor(() => expect(screen.getByText('ORD-7')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Orders' })).toBeInTheDocument()
        expect(screen.getByText(/^Created 5 May 2026/)).toBeInTheDocument()
    })
})

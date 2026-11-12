/**
 * TC-PERF-105..113 — list and detail screens on the shared query cache.
 * TC-PERF-105 products: another page keeps the rows on screen (no skeleton) until it answers.
 * TC-PERF-106 products: the next page is prefetched once idle; opening it then costs no request.
 * TC-PERF-107 products: a filter changed on page 2 requests page 1 only (never the old page with the new filter).
 * TC-PERF-108 orders: a newer filter aborts the request still in flight for the old one.
 * TC-PERF-109 orders: a new-order notification refetches page 1 in place and shows the new row (no spinner).
 * TC-PERF-110 order detail: a 404 on a background re-read keeps the order; a 404 on the first read is "not found".
 * TC-PERF-111 discounts: page/limit go to the URL with history.replaceState (no router round trip).
 * TC-PERF-112 dashboard traffic: the chart opened again within its freshness window needs no request.
 * TC-PERF-113 a write from a detail form (useInvalidateDomain) makes the cached list refetch when it is opened again.
 * Real: the screens, QueryProvider. Faked: server actions / fetch, next/*, heavy children.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
    useRouter: () => nav,
    useSearchParams: () => new URLSearchParams(window.location.search),
    usePathname: () => window.location.pathname,
}))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }))
vi.mock('next/image', () => ({ default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} /> }))
vi.mock('react-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-dom')>()), createPortal: (node: React.ReactNode) => node }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/hooks/use-auto-resize-textarea', () => ({ useAutoResizeTextarea: vi.fn() }))
const actions = vi.hoisted(() => ({ page: vi.fn(), categories: vi.fn(), traffic: vi.fn() }))
vi.mock('@/app/(dashboard)/products/actions', () => ({ getProductsPageAction: actions.page, updateProductFieldAction: vi.fn() }))
vi.mock('@/app/(dashboard)/products/categories/actions', () => ({ getCategoriesAction: actions.categories, getAiCategoriesAction: vi.fn() }))
vi.mock('@/app/(dashboard)/dashboard/actions', () => ({ getTrafficDataAction: actions.traffic }))
vi.mock('@/components/dashboard/BulkCreateModal', () => ({ BulkCreateModal: () => null }))
vi.mock('@/components/dashboard/product-form/ProductDetailsMobile', () => ({ ProductDetailsMobile: () => null }))
vi.mock('@/components/dashboard/ProductQuickViewModal', () => ({ ProductQuickViewModal: () => null }))
vi.mock('@/components/dashboard/revamp/traffic-performance', () => ({ TrafficPerformance: ({ period }: { period: string }) => <div data-testid="traffic">{period}</div> }))
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

import ProductsPageClient from '@/app/(dashboard)/products/ProductsPageClient'
import { OrdersTable } from '@/app/(dashboard)/orders/_components/OrdersTable'
import { OrdersClientLayout } from '@/app/(dashboard)/orders/_components/OrdersClientLayout'
import { OrderDetailView } from '@/app/(dashboard)/orders/_components/order-detail-view'
import { DiscountsClientLayout } from '@/app/(dashboard)/discounts/_components/discounts-client-layout'
import { TrafficPerformanceClient } from '@/components/dashboard/revamp/traffic-performance-client'
import { useInvalidateDomain } from '@/hooks/queries/use-invalidate-domain'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardQueryProvider, resetQueryCache } from '../../helpers/query-provider'

const wrap = (ui: React.ReactElement) => (
    <I18nProvider defaultLocale="en"><DashboardQueryProvider><TooltipProvider>{ui}</TooltipProvider></DashboardQueryProvider></I18nProvider>
)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const settle = (ms = 300) => act(() => new Promise((r) => setTimeout(r, ms)))

const product = (id: string, name: string) => ({ id, name, slug: id, price: 10, currency: 'MYR', status: 'active', inventory: 5, images: [], category: [] })
const productsPage = (page: number, total: number, prefix = 'Item') => ({
    docs: Array.from({ length: Math.min(10, total - (page - 1) * 10) }, (_, i) => product(`${page}-${i}`, `${prefix} p${page} #${i}`)),
    totalDocs: total,
    counts: { all: total, active: total, draft: 0, archived: 0 },
    page,
})
const order = (id: string, status = 'pending') => ({ id, orderNumber: `ORD-${id}`, customerName: 'Aisyah', total: 5000, currency: 'MYR', status, paymentMethod: 'cod', createdAt: '2026-10-01T00:00:00Z' })

beforeEach(() => {
    resetQueryCache()
    actions.page.mockReset()
    actions.categories.mockReset().mockResolvedValue([])
    actions.traffic.mockReset()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
})

describe('products list paging [TC-PERF-105..107]', () => {
    it('TC-PERF-105 another page keeps the current rows on screen until it answers', async () => {
        // Arrange
        actions.page.mockImplementation(async (input: { page: number }) => input.page === 1 ? productsPage(1, 25) : new Promise(() => {}))
        render(wrap(<ProductsPageClient />))
        await screen.findAllByText('Item p1 #0')

        // Act
        fireEvent.click(screen.getAllByRole('button', { name: '3' })[0])

        // Assert
        await waitFor(() => expect(actions.page).toHaveBeenCalledWith(expect.objectContaining({ page: 3 })))
        expect(screen.getAllByText('Item p1 #0').length).toBeGreaterThan(0)
    })

    it('TC-PERF-106 prefetches the next page when idle; opening it makes no further request', async () => {
        // Arrange
        actions.page.mockImplementation(async (input: { page: number }) => productsPage(input.page, 25))
        render(wrap(<ProductsPageClient />))
        await screen.findAllByText('Item p1 #0')

        // Act
        await waitFor(() => expect(actions.page).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))
        const calls = actions.page.mock.calls.length
        fireEvent.click(screen.getAllByRole('button', { name: '2' })[0])

        // Assert
        await screen.findAllByText('Item p2 #0')
        expect(actions.page.mock.calls.slice(0, calls).filter(([input]) => input.page === 2)).toHaveLength(1)
        expect(actions.page.mock.calls.slice(calls).filter(([input]) => input.page === 2)).toHaveLength(0)
    })

    it('TC-PERF-107 a filter changed on page 2 asks for page 1 only', async () => {
        // Arrange
        actions.page.mockImplementation(async (input: { page: number }) => productsPage(input.page, 25))
        render(wrap(<ProductsPageClient />))
        await screen.findAllByText('Item p1 #0')
        fireEvent.click(screen.getAllByRole('button', { name: '2' })[0])
        await screen.findAllByText('Item p2 #0')
        actions.page.mockClear()

        // Act
        fireEvent.mouseDown(screen.getByRole('tab', { name: /Draft/ }), { button: 0 })

        // Assert
        await waitFor(() => expect(actions.page).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', page: 1 })))
        expect(actions.page.mock.calls.filter(([input]) => input.status === 'draft' && input.page !== 1)).toHaveLength(0)
    })
})

describe('orders [TC-PERF-108..110]', () => {
    it('TC-PERF-108 a newer filter aborts the request still in flight', async () => {
        // Arrange
        const signals: AbortSignal[] = []
        vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
            signals.push(init!.signal!)
            return new Promise<Response>(() => {})
        }))
        const view = render(wrap(<OrdersTable statusFilter="all" />))
        await waitFor(() => expect(signals).toHaveLength(1))

        // Act
        view.rerender(wrap(<OrdersTable statusFilter="pending" />))

        // Assert
        await waitFor(() => expect(signals).toHaveLength(2))
        expect(signals[0].aborted).toBe(true)
        expect(signals[1].aborted).toBe(false)
    })

    it('TC-PERF-109 a new-order notification refetches page 1 in place and shows the new row', async () => {
        // Arrange
        let docs = [order('1')]
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.startsWith('/api/orders/metrics')) return json({ success: true, data: {} })
            if (url.includes('paymentStatus=')) return json({ totalDocs: 0 })
            return json({ success: true, docs, totalDocs: docs.length })
        }))
        render(wrap(<OrdersClientLayout />))
        await waitFor(() => expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0))
        docs = [order('2'), order('1')]

        // Act
        act(() => { window.dispatchEvent(new CustomEvent('notification-toast', { detail: { type: 'ORDER_NEW' } })) })

        // Assert
        await waitFor(() => expect(screen.getAllByText('ORD-2').length).toBeGreaterThan(0))
        expect(screen.getAllByText('ORD-1').length).toBeGreaterThan(0)
        expect(document.querySelector('.animate-spin')).toBeNull()
    })

    it('TC-PERF-110 a 404 on a background re-read keeps the order; on the first read it is "not found"', async () => {
        // Arrange
        const replies = [json({ data: order('7', 'confirmed') }), json({}, 404)]
        vi.stubGlobal('fetch', vi.fn(async () => replies.shift() ?? json({}, 404)))
        render(wrap(<OrderDetailView orderId="7" />))
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('confirmed'))

        // Act — the re-read (as after the poll or the assistant) answers 404
        const { getQueryClient } = await import('@/providers/query-provider')
        await act(async () => { await getQueryClient().invalidateQueries() })
        await settle(50)

        // Assert
        expect(screen.getByTestId('status')).toHaveTextContent('confirmed')
        cleanup()
        resetQueryCache()
        render(wrap(<OrderDetailView orderId="8" />))
        expect(await screen.findByText(/not found/i)).toBeInTheDocument()
    })
})

describe('discounts URL paging [TC-PERF-111]', () => {
    it('TC-PERF-111 writes ?page&limit with history.replaceState, not a router navigation', async () => {
        // Arrange
        window.history.replaceState(null, '', '/discounts')
        vi.stubGlobal('fetch', vi.fn(async () => json({ docs: [], totalDocs: 0 })))
        const replaceState = vi.spyOn(window.history, 'replaceState')

        // Act
        render(wrap(<DiscountsClientLayout />))

        // Assert
        await waitFor(() => expect(replaceState).toHaveBeenCalled())
        expect(window.location.search).toBe('?page=1&limit=10')
        expect(nav.replace).not.toHaveBeenCalled()
    })
})

describe('dashboard traffic [TC-PERF-112]', () => {
    it('TC-PERF-112 the chart opened again (or its period chosen again) while fresh needs no request', async () => {
        // Arrange
        actions.traffic.mockImplementation(async (period: string) => ({ total: 1, isHourly: false, days: [], top: { pages: [], blogs: [], referrers: [] }, hasData: true, period }))
        const view = render(wrap(<TrafficPerformanceClient period="7d" />))
        await screen.findByTestId('traffic')
        view.rerender(wrap(<TrafficPerformanceClient period="30d" />))
        await waitFor(() => expect(screen.getByTestId('traffic')).toHaveTextContent('30d'))
        view.unmount()

        // Act
        render(wrap(<TrafficPerformanceClient period="7d" />))

        // Assert
        expect(screen.getByTestId('traffic')).toHaveTextContent('7d')
        expect(actions.traffic).toHaveBeenCalledTimes(2)
    })
})

describe('writes from detail forms [TC-PERF-113]', () => {
    it('TC-PERF-113 a save elsewhere makes the cached products list refetch when it is opened again', async () => {
        // Arrange
        actions.page.mockResolvedValueOnce(productsPage(1, 1, 'Before'))
        const list = render(wrap(<ProductsPageClient />))
        await screen.findAllByText('Before p1 #0')
        list.unmount()
        const SavedForm = () => {
            const invalidate = useInvalidateDomain()
            useEffect(() => { void invalidate('products') }, [invalidate])
            return null
        }
        render(wrap(<SavedForm />))
        await settle(50)
        cleanup()
        actions.page.mockResolvedValueOnce(productsPage(1, 1, 'After'))

        // Act
        render(wrap(<ProductsPageClient />))

        // Assert
        await screen.findAllByText('After p1 #0')
        expect(actions.page).toHaveBeenCalledTimes(2)
    })
})

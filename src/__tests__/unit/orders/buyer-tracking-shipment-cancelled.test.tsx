/**
 * Component tests for the buyer Order Tracking page — F36 (GH-1333)
 *
 * When EasyParcel cancels a shipment, applyTrackingUpdate reopens the order (status →
 * 'confirmed') and NULLs every EP field, awbNo included. The shipment card keyed off awbNo,
 * so the buyer fell back to the generic "being prepared" line AND lost the whole courier
 * history — as if the parcel had never shipped.
 *
 * TC-F36.195 (docs/qa/F36-easyparcel-delivery.md § 3.18h).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import OrderTrackingClient from '@/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient'

vi.mock('next/navigation', () => ({
    usePathname: () => '/sites/demo/orders/PRM-1042',
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// The page opens an SSE channel on mount — jsdom has no EventSource.
class FakeEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    close = vi.fn()
}

const HISTORY = [
    { description: 'Waiting for Pickup', eventTime: '2026-07-13T02:24:53.000Z' },
    { description: 'Order was Canceled', eventTime: '2026-07-13T10:25:27.000Z' },
]

// EP cancelled the shipment → order reopened to 'confirmed', awbNo/trackingNumber wiped,
// shippingTrackingStatus left at 'cancelled'. Mirrors the live 2026-07-13 webhook.
function makeOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        orderNumber: 'PRM-1042',
        status: 'confirmed',
        paymentStatus: 'paid',
        paymentMethod: 'card',
        total: 134.14,
        subtotal: 119,
        shippingFee: 8,
        tax: 7.14,
        currency: 'MYR',
        customerName: 'Azlan Ridzuan',
        customerPhone: '60123456789',
        trackingNumber: null,
        awbNo: null,
        shippingCourier: 'J&T Express',
        shippingTrackingStatus: 'cancelled',
        shippingTrackingHistory: HISTORY,
        createdAt: '2026-07-13T01:00:00.000Z',
        items: [{ productName: 'Cotton Crew Tee', variant: 'M', quantity: 1, unitPrice: 40 }],
        shippingAddress: {
            line1: 'No. 14, Jalan SS 2/63',
            city: 'Petaling Jaya',
            state: 'Selangor',
            postcode: '47301',
            country: 'MY',
        },
        ...overrides,
    } as never
}

describe('[TC-F36.195] buyer tracking — EP shipment cancelled', () => {
    beforeEach(() => {
        vi.stubGlobal('EventSource', FakeEventSource)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    /** The `.ot-card` wrapping the "Activity Timeline" heading. */
    function activityCard(): HTMLElement {
        const head = screen.getByRole('heading', { name: /activity timeline/i })
        const card = head.closest('.ot-card')
        if (!card) throw new Error('Activity Timeline card not found')
        return card as HTMLElement
    }

    it('[TC-F36.195] keeps the courier history after the AWB is wiped', () => {
        render(<OrderTrackingClient order={makeOrder()} slug="demo" />)

        // The history is what the buyer already saw — losing it reads as "the order vanished".
        // It belongs in the activity log, NOT in the shipping-info card: assert the placement,
        // otherwise this test passes no matter which card renders it.
        expect(within(activityCard()).getByText('Waiting for Pickup')).toBeInTheDocument()
        expect(within(activityCard()).getByText('Order was Canceled')).toBeInTheDocument()
    })

    // NOTE: match the shipment card's own sentence, not just "being prepared" — the separate
    // order-journey timeline carries an "Order is being prepared" step of its own.
    const PREPARING = /tracking number will appear once picked up/i
    const CANCELLED = /earlier shipment was cancelled/i

    it('[TC-F36.195] explains the cancelled shipment instead of "being prepared"', () => {
        render(<OrderTrackingClient order={makeOrder()} slug="demo" />)

        expect(screen.getByText(CANCELLED)).toBeInTheDocument()
        expect(screen.queryByText(PREPARING)).not.toBeInTheDocument()
    })

    // TC-F36.197: shippingCourier holds EP's machine code ("EP-CR0DW"). It was rendered raw, so
    // buyers with an AWB were reading an internal EasyParcel identifier as their courier name.
    it('[TC-F36.197] shows the friendly courier name, never the raw EP code', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    awbNo: 'RMC002322989MY',
                    trackingNumber: 'RMC002322989MY',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingCourier: 'EP-CR0DW',
                    shippingCourierName: 'Pos Malaysia Berhad (Melplus)',
                })}
                slug="demo"
            />,
        )

        expect(screen.getByText('Pos Malaysia Berhad (Melplus)')).toBeInTheDocument()
        expect(screen.queryByText('EP-CR0DW')).not.toBeInTheDocument()
    })

    it('[TC-F36.197] falls back to the code only when no friendly name was stored', () => {
        // Orders placed before shippingCourierName existed — a code beats an empty row.
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    awbNo: 'RMC002322989MY',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingCourier: 'EP-CR0DW',
                    shippingCourierName: null,
                })}
                slug="demo"
            />,
        )

        expect(screen.getByText('EP-CR0DW')).toBeInTheDocument()
    })

    // TC-F36.198: "Shipping Information" and "Shipment Tracking" were two cards, and the AWB and
    // the tracking number are the same string for an EP shipment — so the buyer read it twice.
    it('[TC-F36.198] shows one shipping card with the tracking number printed once', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    awbNo: 'RMC002322989MY',
                    trackingNumber: 'RMC002322989MY',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingCourierName: 'Pos Malaysia Berhad (Melplus)',
                })}
                slug="demo"
            />,
        )

        expect(screen.getAllByText('RMC002322989MY')).toHaveLength(1)
        expect(screen.getByRole('heading', { name: /shipping information/i })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /shipment tracking/i })).not.toBeInTheDocument()
        // Courier + history must survive the merge — they lived in the card that went away.
        expect(screen.getByText('Pos Malaysia Berhad (Melplus)')).toBeInTheDocument()
        expect(within(activityCard()).getByText('Waiting for Pickup')).toBeInTheDocument()
    })

    // TC-F36.199: EP's courier_logo lives on GET /courier/list, which the buyer page can't call —
    // it's persisted at label creation. Old orders have no logo, so the icon fallback must hold.
    it('[TC-F36.199] renders the real courier logo when one was captured', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    awbNo: 'RMC002322989MY',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingCourierName: 'Pos Malaysia Berhad (Melplus)',
                    shippingCourierLogo: 'https://cdn.easyparcel.com/pos.png',
                })}
                slug="demo"
            />,
        )

        const logo = screen.getByAltText('Pos Malaysia Berhad (Melplus)')
        expect(logo).toHaveAttribute('src', 'https://cdn.easyparcel.com/pos.png')
    })

    it('[TC-F36.199] falls back to the icon when no logo was captured', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    awbNo: 'RMC002322989MY',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingCourierName: 'Pos Malaysia Berhad (Melplus)',
                    shippingCourierLogo: null,
                })}
                slug="demo"
            />,
        )

        // Name still renders; no broken <img> is emitted.
        expect(screen.getByText('Pos Malaysia Berhad (Melplus)')).toBeInTheDocument()
        expect(screen.queryByAltText('Pos Malaysia Berhad (Melplus)')).not.toBeInTheDocument()
    })

    it('[TC-F36.195] a never-shipped order still shows the generic "being prepared" line', () => {
        // No EP cancel — shippingTrackingStatus null, no history yet.
        render(
            <OrderTrackingClient
                order={makeOrder({ status: 'paid', shippingTrackingStatus: null, shippingTrackingHistory: [] })}
                slug="demo"
            />,
        )

        expect(screen.getByText(PREPARING)).toBeInTheDocument()
        expect(screen.queryByText(CANCELLED)).not.toBeInTheDocument()
    })
})

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
import { render, screen } from '@testing-library/react'
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

    it('[TC-F36.195] keeps the courier history after the AWB is wiped', () => {
        render(<OrderTrackingClient order={makeOrder()} slug="demo" />)

        // The history is what the buyer already saw — losing it reads as "the order vanished".
        expect(screen.getByText('Waiting for Pickup')).toBeInTheDocument()
        expect(screen.getByText('Order was Canceled')).toBeInTheDocument()
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

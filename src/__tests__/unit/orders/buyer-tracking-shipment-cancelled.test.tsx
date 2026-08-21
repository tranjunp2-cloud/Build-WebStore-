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
import { act, render, screen, within } from '@testing-library/react'
import OrderTrackingClient from '@/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient'

vi.mock('next/navigation', () => ({
    usePathname: () => '/sites/demo/orders/PRM-1042',
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// The page opens an SSE channel on mount — jsdom has no EventSource.
let latestEventSource: FakeEventSource | null = null

class FakeEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    close = vi.fn()

    constructor() {
        latestEventSource = this
    }
}

const HISTORY = [
    { status: 'pending_pickup', description: 'Waiting for Pickup', eventTime: '2026-07-13T02:24:53.000Z' },
    { status: 'cancelled', description: 'Order was Canceled', eventTime: '2026-07-13T10:25:27.000Z' },
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
        collectionMethod: 'pickup',
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
        latestEventSource = null
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

    it('[TC-F36.200] renders courier events with the same title and raw note as CMS', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    collectionMethod: 'dropoff',
                    shippingTrackingHistory: [
                        {
                            status: 'pending_pickup',
                            description: 'Order Successfully Created or received',
                            eventTime: '2026-07-28T06:26:00.000Z',
                        },
                        {
                            status: 'pending_pickup',
                            description: 'Shipment created — RMC002353646MY',
                            eventTime: '2026-07-28T06:42:00.000Z',
                        },
                    ],
                })}
                slug="demo"
            />,
        )

        const timeline = within(activityCard())
        expect(timeline.getByText('Waiting for Drop-off')).toBeInTheDocument()
        expect(timeline.getByText('Order Successfully Created or received')).toBeInTheDocument()
        expect(timeline.getByText('Shipment created — RMC002353646MY')).toBeInTheDocument()
        expect(timeline.queryByText('Courier update')).not.toBeInTheDocument()
        expect(timeline.queryByText('Waiting for Pickup')).not.toBeInTheDocument()
    })

    it('[TC-F36.202] keeps an old drop-off event after the order is re-labelled as pickup', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    collectionMethod: 'pickup',
                    shippingTrackingHistory: [{
                        status: 'pending_pickup',
                        description: 'Schedule In Arrangement',
                        eventTime: '2026-07-28T06:26:00.000Z',
                        collectionMethod: 'dropoff',
                    }],
                })}
                slug="demo"
            />,
        )

        const timeline = within(activityCard())
        expect(timeline.getByText('Waiting for Drop-off')).toBeInTheDocument()
        expect(timeline.queryByText('Waiting for Pickup')).not.toBeInTheDocument()
    })

    it('[TC-F36.201] applies new courier events received while storefront tracking is open', () => {
        render(
            <OrderTrackingClient
                order={makeOrder({
                    status: 'shipped',
                    collectionMethod: 'dropoff',
                    shippingTrackingHistory: [],
                })}
                slug="demo"
            />,
        )

        act(() => {
            latestEventSource?.onmessage?.({
                data: JSON.stringify({
                    status: 'shipped',
                    paymentStatus: 'paid',
                    trackingNumber: 'RMC002353646MY',
                    awbNo: 'RMC002353646MY',
                    shippingCourier: 'EP-CR0DW',
                    shippingCourierName: 'Pos Malaysia Berhad (Melplus)',
                    shippingCourierLogo: null,
                    collectionMethod: 'dropoff',
                    shippingTrackingStatus: 'pending_pickup',
                    shippingTrackingHistory: [{
                        status: 'pending_pickup',
                        description: 'Order Successfully Created or received',
                        eventTime: '2026-07-28T06:26:00.000Z',
                    }],
                    terminal: false,
                }),
            } as MessageEvent)
        })

        const timeline = within(activityCard())
        expect(timeline.getByText('Waiting for Drop-off')).toBeInTheDocument()
        expect(timeline.getByText('Order Successfully Created or received')).toBeInTheDocument()
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

    it('[TC-GH1734-UI] shows the Self-delivery courier in Shipping Information', () => {
        // Arrange
        const order = makeOrder({
            status: 'shipped',
            trackingNumber: 'LOCAL-GH1734-001',
            shippingCourier: null,
            shippingCourierName: null,
            selfDeliveryCourier: 'Pos Laju',
            shippingTrackingStatus: 'pending_pickup',
            shippingTrackingHistory: [{
                status: 'delivered',
                description: 'Order marked as completed',
                eventTime: '2026-08-05T03:00:00.000Z',
            }],
        })

        // Act
        render(<OrderTrackingClient order={order} slug="demo" />)

        // Assert
        expect(screen.getByText('Pos Laju')).toBeInTheDocument()
        expect(screen.getByText('LOCAL-GH1734-001')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delivery route' })).toBeInTheDocument()
        expect(screen.getByText('Tracked shipment')).toBeInTheDocument()
        expect(screen.queryByText('EasyParcel')).not.toBeInTheDocument()
    })

    it('[TC-GH1734-UI] shows Courier and Tracking placeholders while fulfillment is pending', () => {
        // Arrange
        const order = makeOrder({
            status: 'confirmed',
            trackingNumber: null,
            awbNo: null,
            shippingCourier: null,
            shippingCourierName: null,
            selfDeliveryCourier: null,
            shippingTrackingHistory: [],
        })

        // Act
        render(<OrderTrackingClient order={order} slug="demo" />)

        // Assert
        expect(screen.getByText('Courier')).toBeInTheDocument()
        expect(screen.getByText('Tracking No.')).toBeInTheDocument()
        expect(screen.getAllByText('Not yet assigned')).toHaveLength(2)
        expect(screen.queryByText(/Your order is being prepared/i)).not.toBeInTheDocument()
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

    it('[TC-F36.195] a never-shipped order uses field placeholders without a generic preparation message', () => {
        // No EP cancel — shippingTrackingStatus null, no history yet.
        render(
            <OrderTrackingClient
                order={makeOrder({ status: 'paid', shippingTrackingStatus: null, shippingTrackingHistory: [] })}
                slug="demo"
            />,
        )

        expect(screen.queryByText(PREPARING)).not.toBeInTheDocument()
        expect(screen.queryByText(CANCELLED)).not.toBeInTheDocument()
    })
})

// @vitest-environment jsdom
// GH-2209: the buyer tracking page showed "Pending · COD" for cancelled and refunded orders.
// TC-F10.tracking.01 (docs/qa/F10-orders-management.md § 4.4).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import RealOrderTrackingClient from '@/app/sites/[slug]/orders/[orderNumber]/OrderTrackingClient'
import { I18nProvider } from '@/i18n'
import { getPaymentChip } from '@/app/sites/[slug]/orders/[orderNumber]/order-tracking-payment-chip'

// The page reads its copy through useI18n(), which needs a provider (the site layout supplies it in prod).
function OrderTrackingClient(props: ComponentProps<typeof RealOrderTrackingClient>) {
    return <I18nProvider><RealOrderTrackingClient {...props} /></I18nProvider>
}

vi.mock('next/navigation', () => ({
    usePathname: () => '/sites/demo/orders/ORD-MW0EPAOO',
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

function makeOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: 2166,
        orderNumber: 'ORD-MW0EPAOO',
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'cod',
        total: 224,
        subtotal: 214,
        shippingFee: 10,
        tax: 0,
        currency: 'MYR',
        customerName: 'QC E2E',
        customerPhone: '60123456789',
        trackingNumber: null,
        awbNo: null,
        createdAt: '2026-11-03T01:00:00.000Z',
        items: [{ productName: 'Cotton Crew Tee', variant: 'M', quantity: 1, unitPrice: 214 }],
        shippingAddress: { line1: 'No. 14, Jalan SS 2/63', city: 'Petaling Jaya', state: 'Selangor', postcode: '47301', country: 'MY' },
        ...overrides,
    } as never
}

describe('[TC-F10.tracking.01] getPaymentChip follows the real payment state', () => {
    it.each([
        // status, paymentStatus, method → label, class   (combinations seen in order data)
        ['cancelled', 'unpaid', 'cod', 'Cancelled', 'cancelled'],
        ['cancelled', 'cancelled', 'cod', 'Cancelled', 'cancelled'],
        ['refunded', 'refunded', 'cod', 'Refunded', 'refunded'],
        ['cancelled', 'refunded', 'card', 'Refunded', 'refunded'],
        ['refunded', 'paid', 'card', 'Refunded', 'refunded'],
        ['cancelled', 'paid', 'card', 'Paid', 'paid'],
        ['completed', 'paid', 'fpx', 'Paid', 'paid'],
        ['cancelled', 'payment_failed', 'fpx', 'Payment Failed', 'failed'],
        ['payment_failed', 'failed', 'card', 'Payment Failed', 'failed'],
        ['pending', 'unpaid', 'cod', 'Pending · COD', 'pending'],
        ['pending', 'awaiting_payment', 'bank_transfer', 'Pending · Bank Transfer', 'pending'],
        // GH-2316 (TC-F10.tracking.06): a COD order handed over is not "pending", even if paymentStatus stays unpaid
        ['completed', 'unpaid', 'cod', 'Cash on delivery', 'neutral'],
        ['completed', 'awaiting_payment', 'cod', 'Cash on delivery', 'neutral'],
        ['completed', 'paid', 'cod', 'Paid', 'paid'],
        ['completed', 'refunded', 'cod', 'Refunded', 'refunded'],
        ['completed', 'failed', 'cod', 'Payment Failed', 'failed'],
    ])('status %s + payment %s (%s) → "%s"', (status, paymentStatus, paymentMethod, label, cls) => {
        // Arrange / Act
        const chip = getPaymentChip({ status, paymentStatus, paymentMethod })

        // Assert
        expect(chip).toEqual({ label, cls })
    })
})

describe('[TC-F10.tracking.01] tracking page badge', () => {
    beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource))
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    const chipOf = (container: HTMLElement) => container.querySelector('.ot-payment-chip')!

    it('cancelled COD order (ORD-MW0EPAOO) shows CANCELLED, not "Pending · COD"', () => {
        // Arrange / Act
        const { container } = render(<OrderTrackingClient order={makeOrder({ status: 'cancelled' })} slug="demo" />)

        // Assert
        expect(chipOf(container)).toHaveTextContent('Cancelled')
        expect(chipOf(container)).toHaveClass('cancelled')
        expect(container).not.toHaveTextContent('Pending · COD')
    })

    it('completed-then-refunded COD order (ORD-MW0ECPGJ) shows REFUNDED', () => {
        // Arrange / Act
        const { container } = render(<OrderTrackingClient order={makeOrder({ id: 2165, orderNumber: 'ORD-MW0ECPGJ', status: 'refunded', paymentStatus: 'refunded' })} slug="demo" />)

        // Assert
        expect(chipOf(container)).toHaveTextContent('Refunded')
        expect(chipOf(container)).toHaveClass('refunded')
    })

    it('an open COD order still shows "Pending · COD"', () => {
        // Arrange / Act
        const { container } = render(<OrderTrackingClient order={makeOrder()} slug="demo" />)

        // Assert
        expect(chipOf(container)).toHaveTextContent('Pending · COD')
        expect(chipOf(container)).toHaveClass('pending')
    })
})

describe('[TC-F10.tracking.05] total label follows payment status (GH-2316)', () => {
    beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource))
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
        localStorage.clear()
    })

    const totalLabel = (container: HTMLElement) => container.querySelector('.ot-items-totals .row.total .lbl')!

    it('paid order shows "Total paid"', () => {
        const { container } = render(<OrderTrackingClient order={makeOrder({ status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'card' })} slug="demo" />)
        expect(totalLabel(container)).toHaveTextContent(/^Total paid$/)
    })

    it.each([
        ['pending', 'unpaid'],
        ['pending', 'awaiting_payment'],
        ['pending', 'pending_verification'],
        ['cancelled', 'unpaid'],
        ['cancelled', 'payment_failed'],
        ['payment_failed', 'failed'],
        ['refunded', 'refunded'],
        ['completed', 'unpaid'],
    ])('status %s + payment %s shows "Total"', (status, paymentStatus) => {
        const { container } = render(<OrderTrackingClient order={makeOrder({ status, paymentStatus })} slug="demo" />)
        expect(totalLabel(container)).toHaveTextContent(/^Total$/)
    })

    it('uses the Malay copy when the buyer prefers ms', async () => {
        localStorage.setItem('prefer_lang', 'ms')
        const paid = render(<OrderTrackingClient order={makeOrder({ status: 'confirmed', paymentStatus: 'paid' })} slug="demo" />)
        await waitFor(() => expect(totalLabel(paid.container)).toHaveTextContent(/^Jumlah dibayar$/))
        cleanup()
        const unpaid = render(<OrderTrackingClient order={makeOrder()} slug="demo" />)
        await waitFor(() => expect(totalLabel(unpaid.container)).toHaveTextContent(/^Jumlah$/))
    })

    it.each(['pending', 'confirmed', 'completed', 'cancelled'])('never shows the "Address Verified" tag (%s)', (status) => {
        const { container } = render(<OrderTrackingClient order={makeOrder({ status })} slug="demo" />)
        expect(container).not.toHaveTextContent('Address Verified')
        expect(container.querySelector('.ot-addr-tag')).toBeNull()
    })

    it('completed COD order (unpaid) shows "Cash on delivery", not "Pending"', () => {
        const { container } = render(<OrderTrackingClient order={makeOrder({ status: 'completed' })} slug="demo" />)
        const chip = container.querySelector('.ot-payment-chip')!
        expect(chip).toHaveTextContent('Cash on delivery')
        expect(chip).toHaveClass('neutral')
        expect(chip).not.toHaveTextContent('Pending')
    })
})

/**
 * TC-PERF-140 — the public order tracking page (order number only) shows the buyer's contact masked unless the
 * browser holds the buyer's confirm cookie: first name, last 3 phone digits, town / state / postcode.
 */
import { describe, expect, it } from 'vitest'
import { maskBuyerContact } from '@/lib/orders/mask-buyer-contact'

const order = {
    orderNumber: 'ORD-abc', customerName: 'Siti Aminah Hassan', customerPhone: '+60 12-345 6781',
    shippingAddress: { line1: '12 Jalan Bunga', line2: 'Taman Melati', city: 'Melaka', state: 'Melaka', postcode: '75000', country: 'Malaysia' },
}

describe('maskBuyerContact [TC-PERF-140]', () => {
    it('keeps first name, last 3 digits and the town; drops the street lines', () => {
        // Act
        const shown = maskBuyerContact(order)

        // Assert
        expect(shown.customerName).toBe('Siti')
        expect(shown.customerPhone).toBe('•••• 781')
        expect(shown.shippingAddress).toEqual({ line1: null, line2: null, city: 'Melaka', state: 'Melaka', postcode: '75000', country: 'Malaysia' })
        expect(shown.orderNumber).toBe('ORD-abc')
        expect(JSON.stringify(shown)).not.toMatch(/Jalan Bunga|Taman|Hassan|345/)
    })

    it('handles a missing phone and a blank name', () => {
        const shown = maskBuyerContact({ ...order, customerName: '', customerPhone: null })
        expect(shown.customerName).toBe('')
        expect(shown.customerPhone).toBeNull()
    })
})

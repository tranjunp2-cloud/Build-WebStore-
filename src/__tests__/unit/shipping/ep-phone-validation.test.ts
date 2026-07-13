/**
 * EP phone validation — F36 create-label phone guard (GH-1333)
 * Covers TC-F36.186: hasUsablePhone acceptance/rejection matrix, buildSubmitParams
 * never emits the legacy '0000000' placeholder (a fake number passes EP submit but
 * strands the shipment at "Pending AWB" — verified live 2026-07-13), and
 * isWarehouseComplete rejects an all-zero warehouse phone via the shared helper.
 */

import { describe, it, expect } from 'vitest'
import { hasUsablePhone, splitPhone } from '@/lib/shipping/easyparcel/normalize'
import { isWarehouseComplete } from '@/lib/shipping/easyparcel/warehouse'
import { buildSubmitParams } from '@/app/api/orders/[id]/create-label/build-submit-params'

const baseInput = {
    warehouse: { name: 'WH', phone: '01116127971', address1: 'A1', city: 'KL', state: 'Kuala Lumpur', postcode: '55100' },
    shippingAddress: { line1: 'L1', city: 'KL', state: 'Kuala Lumpur', postcode: '55100' },
    customerName: 'Ocean',
    customerPhone: '+60 12 345 6789',
    total: 13.72,
    shippingServiceId: 'svc-1',
    shippingCourier: 'poslaju',
    weightGrams: 200,
}

describe('hasUsablePhone [TC-F36.186a]', () => {
    it('accepts valid MY phones in common formats', () => {
        expect(hasUsablePhone('01116127971')).toBe(true)
        expect(hasUsablePhone('+60 12 345 6789')).toBe(true)
        expect(hasUsablePhone('60123456789')).toBe(true)
        expect(hasUsablePhone('03-1234 5678')).toBe(true)
    })

    it('rejects empty, short, and all-zero values', () => {
        expect(hasUsablePhone('')).toBe(false)
        expect(hasUsablePhone(null)).toBe(false)
        expect(hasUsablePhone(undefined)).toBe(false)
        expect(hasUsablePhone('12345')).toBe(false)          // < 8 digits
        expect(hasUsablePhone('0000000')).toBe(false)         // legacy placeholder
        expect(hasUsablePhone('000000000')).toBe(false)       // all-zero, length ok
        expect(hasUsablePhone('---')).toBe(false)             // no digits at all
    })

    it('validates the POST-splitPhone number, not raw digits (review #1595)', () => {
        // 9 raw digits pass a raw-length check, but splitPhone strips '60' and
        // emits '0000000' — the exact placeholder that stranded the live shipment.
        expect(hasUsablePhone('600000000')).toBe(false)       // legacy receiver fallback literal
        expect(hasUsablePhone('60000000')).toBe(false)        // 60 + zeros → '000000'
        expect(hasUsablePhone('60123456')).toBe(false)        // emits 6 digits — courier-invalid
        expect(hasUsablePhone('60412345678')).toBe(true)      // emits 9 digits — valid
    })
})

describe('buildSubmitParams — no placeholder phone [TC-F36.186c]', () => {
    it('passes real sender + receiver phones through splitPhone verbatim', () => {
        const p = buildSubmitParams(baseInput)

        expect(p.sender.phone_number).toBe(splitPhone('01116127971').number)
        expect(p.sender.phone_number_country_code).toBe('60')
        expect(p.receiver.phone_number).toBe(splitPhone('+60 12 345 6789').number)
        expect(p.receiver.phone_number_country_code).toBe('60')
    })

    it('never emits the legacy 0000000 placeholder anywhere in the params', () => {
        const p = buildSubmitParams(baseInput)

        expect(JSON.stringify(p)).not.toContain('0000000')
    })

    it('emits an EMPTY receiver phone for an empty input — no silent fallback (review #1595)', () => {
        // Locks the placeholder removal itself: with the old `|| '0000000'` /
        // `|| '600000000'` fallbacks, an empty phone emitted '0000000' here.
        const p = buildSubmitParams({ ...baseInput, customerPhone: '' })

        expect(p.receiver.phone_number).toBe('')
        expect(JSON.stringify(p)).not.toContain('0000000')
    })
})

describe('isWarehouseComplete — shared phone rule [TC-F36.186a]', () => {
    const wh = { label: 'WH', phone: '01116127971', address1: 'A1', state: 'Kuala Lumpur', postcode: '55100' }

    it('accepts a warehouse with a usable phone', () => {
        expect(isWarehouseComplete(wh)).toBe(true)
    })

    it('rejects an all-zero warehouse phone (previously passed the length-only check)', () => {
        expect(isWarehouseComplete({ ...wh, phone: '000000000' })).toBe(false)
    })

    it('rejects a short warehouse phone', () => {
        expect(isWarehouseComplete({ ...wh, phone: '0123' })).toBe(false)
    })
})

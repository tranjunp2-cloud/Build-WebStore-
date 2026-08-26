/**
 * EP phone validation — F36 create-label phone guard (GH-1333)
 * Covers TC-F36.186: hasUsablePhone acceptance/rejection matrix, buildSubmitParams
 * never emits the legacy '0000000' placeholder (a fake number passes EP submit but
 * strands the shipment at "Pending AWB" — verified live 2026-07-13), and
 * isWarehouseComplete rejects an all-zero warehouse phone via the shared helper.
 */

import { describe, it, expect } from 'vitest'
import { hasUsablePhone, normalizeMyPhone, splitPhone } from '@/lib/shipping/easyparcel/phone'
import { isWarehouseComplete, normalizeWarehouses } from '@/lib/shipping/easyparcel/warehouse'
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

    it('rejects letters and unsupported separators before stripping formatting', () => {
        expect(hasUsablePhone('abc0123456789')).toBe(false)
        expect(hasUsablePhone('0123456789 ext 2')).toBe(false)
        expect(hasUsablePhone('0123/456789')).toBe(false)
    })

    it('validates the POST-splitPhone number, not raw digits (review #1595)', () => {
        // 9 raw digits pass a raw-length check, but splitPhone strips '60' and
        // emits '0000000' — the exact placeholder that stranded the live shipment.
        expect(hasUsablePhone('600000000')).toBe(false)       // legacy receiver fallback literal
        expect(hasUsablePhone('60000000')).toBe(false)        // 60 + zeros → '000000'
        expect(hasUsablePhone('60123456')).toBe(false)        // emits 6 digits — courier-invalid
        expect(hasUsablePhone('60412345678')).toBe(true)      // emits 9 digits — valid
        // Post-split leading zero = double trunk prefix — a valid MY number never
        // starts with 0 after the strip (review #1595 round 2).
        expect(hasUsablePhone('0000000060')).toBe(false)      // emits '000000060'
        expect(hasUsablePhone('00123456789')).toBe(false)     // double-0 typo → emits '0123456789'
        // Length cap: multi-number paste in legacy data emits a >11-digit blob
        // the courier cannot dial (review #1595 round 3).
        expect(hasUsablePhone('0123456789 / 0198765432')).toBe(false)
        expect(hasUsablePhone('606012345678')).toBe(false)   // double country prefix
    })
})

describe('buildSubmitParams — no placeholder phone [TC-F36.186c]', () => {
    it('passes real sender + receiver phones through splitPhone verbatim', () => {
        const p = buildSubmitParams(baseInput)

        expect(p.sender.phone_number).toBe(splitPhone('01116127971').number)
        expect(p.receiver.phone_number).toBe(splitPhone('+60 12 345 6789').number)
    })

    it('sends phone_number_country_code as ISO "MY", not dialing code "60" (TC-F36.187)', () => {
        // Official EP spec: phone_number_country_code is ISO 3166-1 alpha-2. Sending
        // "60" leaves EP's country field empty → "missing a valid country calling code".
        const p = buildSubmitParams(baseInput)

        expect(p.sender.phone_number_country_code).toBe('MY')
        expect(p.receiver.phone_number_country_code).toBe('MY')
        expect(JSON.stringify(p)).not.toContain('"phone_number_country_code":"60"')
    })

    it('maps email + company onto sender/receiver, omits when absent (TC-F36.187)', () => {
        const withContacts = buildSubmitParams({
            ...baseInput,
            customerEmail: 'buyer@example.com',
            senderEmail: 'merchant@store.my',
            senderCompany: 'My Store',
        })
        expect(withContacts.receiver.email).toBe('buyer@example.com')
        expect(withContacts.sender.email).toBe('merchant@store.my')
        expect(withContacts.sender.company).toBe('My Store')

        // Absent → omitted (undefined drops out of the JSON body), never empty string
        const bare = buildSubmitParams(baseInput)
        expect(bare.sender.email).toBeUndefined()
        expect(bare.sender.company).toBeUndefined()
        expect(bare.receiver.email).toBeUndefined()
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
    const wh = { label: 'WH', phone: '01116127971', address1: 'A1', city: 'KL', state: 'Kuala Lumpur', postcode: '55100' }

    it('accepts a warehouse with a usable phone', () => {
        expect(isWarehouseComplete(wh)).toBe(true)
    })

    it('rejects an all-zero warehouse phone (previously passed the length-only check)', () => {
        expect(isWarehouseComplete({ ...wh, phone: '000000000' })).toBe(false)
    })

    it('rejects a short warehouse phone', () => {
        expect(isWarehouseComplete({ ...wh, phone: '0123' })).toBe(false)
    })

    it('rejects a warehouse without a city', () => {
        expect(isWarehouseComplete({ ...wh, city: '' })).toBe(false)
    })
})

describe('warehouse canonicalization [TC-F36.202]', () => {
    it('normalizes common MY phone formats into a digits-only 60 prefix', () => {
        expect(normalizeMyPhone('012-345 6789')).toBe('60123456789')
        expect(normalizeMyPhone('+60 12 345 6789')).toBe('60123456789')
    })

    it('keeps exactly one default warehouse and moves it first without mutating input', () => {
        const input = [
            { id: 'a', label: 'A', phone: '0123456789', isDefault: false },
            { id: 'b', label: 'B', phone: '+60 13 456 7890', isDefault: true },
            { id: 'c', label: 'C', phone: '0145678901', isDefault: true },
        ]

        const result = normalizeWarehouses(input)

        expect(result.map((warehouse) => warehouse.id)).toEqual(['b', 'a', 'c'])
        expect(result.map((warehouse) => warehouse.isDefault)).toEqual([true, false, false])
        expect(result[0].phone).toBe('60134567890')
        expect(input[0].phone).toBe('0123456789')
    })

    it('can preserve draft order while changing the default flag', () => {
        const input = [
            { id: 'a', label: 'A', isDefault: false },
            { id: 'b', label: 'B', isDefault: true },
        ]

        const result = normalizeWarehouses(input, { defaultFirst: false })

        expect(result.map((warehouse) => warehouse.id)).toEqual(['a', 'b'])
        expect(result.map((warehouse) => warehouse.isDefault)).toEqual([false, true])
    })
})

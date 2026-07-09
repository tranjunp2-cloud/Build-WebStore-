/**
 * buildSubmitParams() tests — F36 create-label (GH-1333)
 * Covers: EasyParcel requires parcel dimensions (height mandatory). Verifies the
 * default 10×10×10 cm parcel size is applied to both the top-level params and item[0],
 * and that a caller override is honored. Guards the "The item 0 height field is
 * required" EP submit error. TC: TC-F36.OD.028 (create-label parcel dimensions).
 */

import { describe, it, expect } from 'vitest'
import { buildSubmitParams } from '@/app/api/orders/[id]/create-label/build-submit-params'

const baseInput = {
    warehouse: { name: 'WH', phone: '+60123456789', address1: 'A1', city: 'PJ', state: 'Selangor', postcode: '47810' },
    shippingAddress: { line1: 'L1', city: 'PJ', state: 'Selangor', postcode: '47100' },
    customerName: 'Aisyah',
    customerPhone: '+60123456789',
    total: 100,
    shippingServiceId: 'svc-1',
    shippingCourier: 'jnt',
    weightGrams: 500,
}

describe('buildSubmitParams — parcel dimensions', () => {
    it('[TC-F36.OD.028] applies default 10×10×10 cm to top-level + item when no override', () => {
        const p = buildSubmitParams(baseInput)

        expect(p.height).toBe(10)
        expect(p.width).toBe(10)
        expect(p.length).toBe(10)
        expect(p.item[0].height).toBe(10)
        expect(p.item[0].width).toBe(10)
        expect(p.item[0].length).toBe(10)
    })

    it('[TC-F36.OD.028] honors a caller dimensions override', () => {
        const p = buildSubmitParams({ ...baseInput, dimensionsCm: { width: 20, length: 30, height: 15 } })

        expect(p.width).toBe(20)
        expect(p.length).toBe(30)
        expect(p.height).toBe(15)
        expect(p.item[0].width).toBe(20)
        expect(p.item[0].length).toBe(30)
        expect(p.item[0].height).toBe(15)
    })

    it('[TC-F36.OD.028] falls back to defaults for partial override', () => {
        const p = buildSubmitParams({ ...baseInput, dimensionsCm: { height: 25 } })

        expect(p.item[0].height).toBe(25)
        expect(p.item[0].width).toBe(10)
        expect(p.item[0].length).toBe(10)
    })
})

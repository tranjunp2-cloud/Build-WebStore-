/**
 * EasyParcel readiness gate — F36 (GH-1333)
 * Covers: isWarehouseComplete, isEpReady, getDefaultWarehouse (multi + legacy fallback).
 * Source of truth for whether checkout may use EP vs fall back to flat rate.
 */

import { describe, it, expect } from 'vitest'
import {
    isWarehouseComplete,
    isEpReady,
    getDefaultWarehouse,
    getAllowedCouriers,
} from '@/lib/shipping/easyparcel/warehouse'

const completeWh = {
    id: 'w1', label: 'HQ', phone: '0123456789',
    address1: 'No.12 Jalan', city: 'Petaling Jaya', state: 'Selangor', postcode: '47810',
    country: 'MY', isDefault: true,
}

describe('isWarehouseComplete', () => {
    it('true when all mandatory fields present', () => {
        expect(isWarehouseComplete(completeWh)).toBe(true)
    })
    it('accepts legacy `name` in place of `label`', () => {
        const { label, ...rest } = completeWh
        expect(isWarehouseComplete({ ...rest, name: 'HQ' })).toBe(true)
    })
    it.each([
        ['missing label/name', { ...completeWh, label: '', name: undefined }],
        ['short phone', { ...completeWh, phone: '123' }],
        ['no phone', { ...completeWh, phone: '' }],
        ['no address1', { ...completeWh, address1: '' }],
        ['no state', { ...completeWh, state: '' }],
        ['no postcode', { ...completeWh, postcode: '' }],
    ])('false when %s', (_label, wh) => {
        expect(isWarehouseComplete(wh as any)).toBe(false)
    })
    it('false for null/undefined', () => {
        expect(isWarehouseComplete(null)).toBe(false)
        expect(isWarehouseComplete(undefined)).toBe(false)
    })
})

describe('getDefaultWarehouse', () => {
    it('returns the isDefault entry', () => {
        const ep = { warehouses: [{ id: 'a', postcode: '10000' }, { id: 'b', postcode: '47810', isDefault: true }] }
        expect(getDefaultWarehouse(ep).postcode).toBe('47810')
    })
    it('falls back to first entry when none marked default', () => {
        const ep = { warehouses: [{ id: 'a', postcode: '10000' }, { id: 'b', postcode: '47810' }] }
        expect(getDefaultWarehouse(ep).postcode).toBe('10000')
    })
    it('falls back to legacy single warehouse', () => {
        const ep = { warehouse: { postcode: '50000', address1: 'x' } }
        expect(getDefaultWarehouse(ep).postcode).toBe('50000')
    })
    it('returns {} when nothing configured', () => {
        expect(getDefaultWarehouse({})).toEqual({})
    })
})

describe('getAllowedCouriers', () => {
    // TC-F14.124 — `selectedCouriers:['jnt','flash']` → `['jnt','flash']`
    it('[TC-F14.124] selectedCouriers array present → return as-is', () => {
        const ep = { selectedCouriers: ['jnt', 'flash'] }
        expect(getAllowedCouriers(ep)).toEqual(['jnt', 'flash'])
    })

    // TC-F14.125 — legacy only `selectedCourier:'flash'` → `['flash']`
    it('[TC-F14.125] legacy selectedCourier only → wrap in array', () => {
        const ep = { selectedCourier: 'flash' }
        expect(getAllowedCouriers(ep)).toEqual(['flash'])
    })

    // TC-F14.126 — neither set → `[]`
    it('[TC-F14.126] neither array nor legacy → empty array', () => {
        const ep = { accessToken: 'tok' }
        expect(getAllowedCouriers(ep)).toEqual([])
    })

    // TC-F14.127 — array wins when both present
    it('[TC-F14.127] array takes precedence over legacy scalar', () => {
        const ep = { selectedCouriers: ['jnt'], selectedCourier: 'flash' }
        expect(getAllowedCouriers(ep)).toEqual(['jnt'])
    })

    // TC-F14.128 — trim + filter empty + dedupe
    it('[TC-F14.128] array with whitespace/empty entries → trimmed + deduped', () => {
        const ep = { selectedCouriers: ['  jnt  ', '', 'jnt', 'flash', '   '] }
        expect(getAllowedCouriers(ep)).toEqual(['jnt', 'flash'])
    })

    it('returns empty when selectedCouriers is empty array', () => {
        const ep = { selectedCouriers: [] }
        expect(getAllowedCouriers(ep)).toEqual([])
    })

    it('returns empty when selectedCourier is empty string', () => {
        const ep = { selectedCourier: '' }
        expect(getAllowedCouriers(ep)).toEqual([])
    })

    it('handles null/undefined ep gracefully', () => {
        expect(getAllowedCouriers(null)).toEqual([])
        expect(getAllowedCouriers(undefined)).toEqual([])
    })

    it('filters out non-string entries in array', () => {
        const ep = { selectedCouriers: ['jnt', 123, null, 'flash', undefined] }
        expect(getAllowedCouriers(ep as any)).toEqual(['jnt', 'flash'])
    })
})

describe('isEpReady', () => {
    const ready = { accessToken: 'tok', selectedCourier: 'EP-CR0AP', warehouses: [completeWh] }

    it('true when token + complete default warehouse + courier', () => {
        expect(isEpReady(ready)).toBe(true)
    })
    it('false without token (connected != ready)', () => {
        expect(isEpReady({ ...ready, accessToken: undefined })).toBe(false)
    })
    it('false without a selected courier', () => {
        expect(isEpReady({ ...ready, selectedCourier: '' })).toBe(false)
    })
    it('false when default warehouse incomplete (missing phone)', () => {
        expect(isEpReady({ ...ready, warehouses: [{ ...completeWh, phone: '' }] })).toBe(false)
    })
    it('false when no warehouse at all', () => {
        expect(isEpReady({ accessToken: 'tok', selectedCourier: 'EP-CR0AP' })).toBe(false)
    })
    it('works via legacy single warehouse', () => {
        const { id, isDefault, ...legacy } = completeWh
        expect(isEpReady({ accessToken: 'tok', selectedCourier: 'EP-CR0AP', warehouse: legacy })).toBe(true)
    })

    // TC-F14.129 — true with array courier allowlist
    it('[TC-F14.129] true when token + warehouse + ≥1 courier (array)', () => {
        expect(isEpReady({ accessToken: 'tok', warehouses: [completeWh], selectedCouriers: ['jnt', 'flash'] })).toBe(true)
    })

    // TC-F14.130 — false when allowlist empty
    it('[TC-F14.130] false when allowlist length=0 (empty array)', () => {
        expect(isEpReady({ accessToken: 'tok', warehouses: [completeWh], selectedCouriers: [] })).toBe(false)
    })
})

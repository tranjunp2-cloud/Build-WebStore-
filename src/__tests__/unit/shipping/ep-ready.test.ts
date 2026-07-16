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


describe('isEpReady', () => {
    it('true when token + complete default warehouse (no courier check)', () => {
        const ready = { accessToken: 'tok', warehouses: [completeWh] }
        expect(isEpReady(ready)).toBe(true)
    })
    it('false without token (connected != ready)', () => {
        expect(isEpReady({ warehouses: [completeWh] })).toBe(false)
    })
    it('false when default warehouse incomplete (missing phone)', () => {
        expect(isEpReady({ accessToken: 'tok', warehouses: [{ ...completeWh, phone: '' }] })).toBe(false)
    })
    it('false when no warehouse at all', () => {
        expect(isEpReady({ accessToken: 'tok' })).toBe(false)
    })
    it('works via legacy single warehouse', () => {
        const { id, isDefault, ...legacy } = completeWh
        expect(isEpReady({ accessToken: 'tok', warehouse: legacy })).toBe(true)
    })
})

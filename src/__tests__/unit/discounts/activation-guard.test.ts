/**
 * Unit tests for discountActivationBlocks (src/lib/discounts/activation-guard.ts).
 *
 * TC-F33-13-02 (expired guard), TC-F33-13-03 (at-limit guard), TC-F33-13-04 (KL end-of-day
 * boundary — same-day expiry stays valid), TC-F33-13-06 (normal reactivation allowed).
 *
 * Mirrors persistence: expiresAt is pinned to END OF DAY Asia/Kuala_Lumpur (UTC+8) on save.
 * endOfDayKL("2026-06-22") = 2026-06-22T15:59:59.999Z (= 23:59:59.999 KL).
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { discountActivationBlocks } from '@/lib/discounts/activation-guard'

// ── TC-F33-13-02: expired blocks activation ──────────────────────────────────
describe('discountActivationBlocks — TC-F33-13-02: expired', () => {
    it('flags expired when the KL end-of-day is in the past', () => {
        const now = new Date('2026-06-22T12:00:00.000Z')
        const r = discountActivationBlocks({ expiresAt: '2026-06-20' }, now)
        expect(r).toEqual({ expired: true, atLimit: false })
    })
})

// ── TC-F33-13-04: KL end-of-day boundary (same-day expiry still valid) ────────
describe('discountActivationBlocks — TC-F33-13-04: KL boundary', () => {
    it('same-day expiry is NOT expired before end-of-day KL (17:00 UTC == 01:00 KL next day is after; 15:00 UTC is before)', () => {
        // endOfDayKL("2026-06-22") = 2026-06-22T15:59:59.999Z
        const beforeEod = new Date('2026-06-22T15:00:00.000Z') // 23:00 KL same day → still valid
        expect(discountActivationBlocks({ expiresAt: '2026-06-22' }, beforeEod).expired).toBe(false)
    })

    it('same-day expiry IS expired once past end-of-day KL', () => {
        const afterEod = new Date('2026-06-22T16:00:00.000Z') // 00:00 KL next day → expired
        expect(discountActivationBlocks({ expiresAt: '2026-06-22' }, afterEod).expired).toBe(true)
    })

    it('regression: a naive midnight-UTC compare would wrongly expire it — guard must not', () => {
        // new Date("2026-06-22") = 2026-06-22T00:00Z; a noon-UTC "now" is after midnight but the
        // code is valid through 15:59:59.999Z. The guard must report NOT expired.
        const noon = new Date('2026-06-22T12:00:00.000Z')
        expect(discountActivationBlocks({ expiresAt: '2026-06-22' }, noon).expired).toBe(false)
    })
})

// ── TC-F33-13-03: at-limit blocks activation ─────────────────────────────────
describe('discountActivationBlocks — TC-F33-13-03: at-limit', () => {
    const now = new Date('2026-06-22T12:00:00.000Z')
    it('flags at-limit when usageCount >= usageLimit', () => {
        expect(discountActivationBlocks({ usageLimit: 5, usageCount: 5 }, now)).toEqual({ expired: false, atLimit: true })
        expect(discountActivationBlocks({ usageLimit: 5, usageCount: 9 }, now).atLimit).toBe(true)
    })
    it('not at-limit when under, unlimited (null), or NaN limit', () => {
        expect(discountActivationBlocks({ usageLimit: 5, usageCount: 4 }, now).atLimit).toBe(false)
        expect(discountActivationBlocks({ usageLimit: null, usageCount: 999 }, now).atLimit).toBe(false)
        expect(discountActivationBlocks({ usageLimit: NaN, usageCount: 999 }, now).atLimit).toBe(false)
    })
})

// ── TC-F33-13-06: normal reactivation allowed ────────────────────────────────
describe('discountActivationBlocks — TC-F33-13-06: allowed', () => {
    const now = new Date('2026-06-22T12:00:00.000Z')
    it('no block when not expired and under limit', () => {
        expect(discountActivationBlocks({ expiresAt: '2027-01-01', usageLimit: 10, usageCount: 3 }, now)).toEqual({
            expired: false,
            atLimit: false,
        })
    })
    it('no block when all bounds empty', () => {
        expect(discountActivationBlocks({ expiresAt: null, usageLimit: null }, now)).toEqual({ expired: false, atLimit: false })
    })
    it('reports both blocks when expired AND at-limit', () => {
        expect(discountActivationBlocks({ expiresAt: '2025-01-01', usageLimit: 2, usageCount: 2 }, now)).toEqual({
            expired: true,
            atLimit: true,
        })
    })
})

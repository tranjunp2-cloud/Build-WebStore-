/**
 * Unit tests for computeEffectiveDiscountStatus (src/lib/discounts/effective-status.ts).
 * Pure function, no I/O, deterministic — `now` is always injected.
 *
 * TC-F33-11-01..08: effective lifecycle state (inactive/expired/used-up/scheduled/active),
 * boundary instants, null/invalid fields, and display-priority ordering.
 *
 * Semantics mirror applyDiscount (TC-F33-01..09) — raw instant comparison.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { computeEffectiveDiscountStatus, type EffectiveStatusInput } from '@/lib/discounts/effective-status'

// Fixed reference instant for deterministic boundary checks (KL noon, but raw instant).
const NOW = new Date('2026-06-22T12:00:00.000Z')
const PAST = new Date('2026-06-20T12:00:00.000Z').toISOString()
const FUTURE = new Date('2026-06-25T12:00:00.000Z').toISOString()

const base: EffectiveStatusInput = {
    status: 'active',
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    usageCount: 0,
}

// ── TC-F33-11-01: Manual inactive toggle wins ────────────────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-01: inactive', () => {
    it('returns inactive when status !== active, regardless of dates/usage', () => {
        expect(computeEffectiveDiscountStatus({ ...base, status: 'inactive' }, NOW)).toBe('inactive')
        // even if otherwise "active-able"
        expect(
            computeEffectiveDiscountStatus({ status: 'inactive', startsAt: PAST, expiresAt: FUTURE, usageLimit: 10, usageCount: 0 }, NOW),
        ).toBe('inactive')
    })
})

// ── TC-F33-11-02: Active (in window, under limit) ────────────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-02: active', () => {
    it('returns active when started, not expired, under usage limit', () => {
        expect(
            computeEffectiveDiscountStatus({ status: 'active', startsAt: PAST, expiresAt: FUTURE, usageLimit: 10, usageCount: 3 }, NOW),
        ).toBe('active')
    })

    it('returns active when all optional bounds are null (open-ended code)', () => {
        expect(computeEffectiveDiscountStatus(base, NOW)).toBe('active')
    })
})

// ── TC-F33-11-03: Expired ────────────────────────────────────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-03: expired', () => {
    it('returns expired when expiresAt is in the past', () => {
        expect(computeEffectiveDiscountStatus({ ...base, expiresAt: PAST }, NOW)).toBe('expired')
    })
})

// ── TC-F33-11-04: Used up ────────────────────────────────────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-04: used-up', () => {
    it('returns used-up when usageCount >= usageLimit', () => {
        expect(computeEffectiveDiscountStatus({ ...base, usageLimit: 5, usageCount: 5 }, NOW)).toBe('used-up')
        expect(computeEffectiveDiscountStatus({ ...base, usageLimit: 5, usageCount: 6 }, NOW)).toBe('used-up')
    })

    it('stays active when under limit, and unlimited (limit null) never used-up', () => {
        expect(computeEffectiveDiscountStatus({ ...base, usageLimit: 5, usageCount: 4 }, NOW)).toBe('active')
        expect(computeEffectiveDiscountStatus({ ...base, usageLimit: null, usageCount: 9999 }, NOW)).toBe('active')
    })
})

// ── TC-F33-11-05: Scheduled ──────────────────────────────────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-05: scheduled', () => {
    it('returns scheduled when startsAt is in the future', () => {
        expect(computeEffectiveDiscountStatus({ ...base, startsAt: FUTURE }, NOW)).toBe('scheduled')
    })
})

// ── TC-F33-11-06: Boundary instants (mirror applyDiscount strict comparison) ──
describe('computeEffectiveDiscountStatus — TC-F33-11-06: boundaries', () => {
    it('expiresAt exactly === now is NOT yet expired (expires < now is strict)', () => {
        expect(computeEffectiveDiscountStatus({ ...base, expiresAt: NOW.toISOString() }, NOW)).toBe('active')
    })

    it('expiresAt one ms before now IS expired', () => {
        const justExpired = new Date(NOW.getTime() - 1).toISOString()
        expect(computeEffectiveDiscountStatus({ ...base, expiresAt: justExpired }, NOW)).toBe('expired')
    })

    it('startsAt exactly === now is already active (starts > now is strict)', () => {
        expect(computeEffectiveDiscountStatus({ ...base, startsAt: NOW.toISOString() }, NOW)).toBe('active')
    })

    it('startsAt one ms after now IS scheduled', () => {
        const justFuture = new Date(NOW.getTime() + 1).toISOString()
        expect(computeEffectiveDiscountStatus({ ...base, startsAt: justFuture }, NOW)).toBe('scheduled')
    })
})

// ── TC-F33-11-07: Display priority (inactive > expired > used-up > scheduled) ─
describe('computeEffectiveDiscountStatus — TC-F33-11-07: priority', () => {
    it('expired wins over used-up', () => {
        expect(
            computeEffectiveDiscountStatus({ status: 'active', startsAt: PAST, expiresAt: PAST, usageLimit: 5, usageCount: 5 }, NOW),
        ).toBe('expired')
    })

    it('used-up wins over scheduled', () => {
        // startsAt future + at-limit → used-up shown (limit reached before window opens is an edge, but deterministic)
        expect(
            computeEffectiveDiscountStatus({ status: 'active', startsAt: FUTURE, expiresAt: null, usageLimit: 2, usageCount: 2 }, NOW),
        ).toBe('used-up')
    })
})

// ── TC-F33-11-08: Invalid / malformed dates are ignored ──────────────────────
describe('computeEffectiveDiscountStatus — TC-F33-11-08: invalid dates', () => {
    it('ignores unparseable expiresAt/startsAt rather than throwing', () => {
        expect(computeEffectiveDiscountStatus({ ...base, expiresAt: 'not-a-date' }, NOW)).toBe('active')
        expect(computeEffectiveDiscountStatus({ ...base, startsAt: 'garbage' }, NOW)).toBe('active')
    })

    it('accepts Date objects as well as ISO strings', () => {
        expect(computeEffectiveDiscountStatus({ ...base, expiresAt: new Date(NOW.getTime() - 1000) }, NOW)).toBe('expired')
    })
})

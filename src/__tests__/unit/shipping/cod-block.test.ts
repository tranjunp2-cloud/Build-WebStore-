/**
 * Unit tests for isCodBlocked — F36 (GH-1333)
 * Tests COD availability check: COD is blocked for East Malaysia states when codAmount > 0.
 *
 * TC-F36.U01–F36.U08: Pure function, no framework dependencies.
 */

import { describe, it, expect } from 'vitest'
import { isCodBlocked } from '@/lib/shipping/cod-block'
import { EAST_MY_STATES, WEST_MY_STATES } from '@/lib/shipping/constants'

describe('isCodBlocked', () => {
  // TC-F36.U01: Happy path — COD amount > 0, East Malaysia state → COD blocked
  it('[TC-F36.U01] East Malaysia + codAmount > 0 → true (COD blocked)', () => {
    const order = {
      codAmount: 5000,
      shippingAddress: { state: 'Sabah' },
    }
    expect(isCodBlocked(order)).toBe(true)
  })

  // TC-F36.U02: West Malaysia + codAmount > 0 → COD available
  it('[TC-F36.U02] West Malaysia + codAmount > 0 → false (COD available)', () => {
    const order = {
      codAmount: 5000,
      shippingAddress: { state: 'Selangor' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U03: All East states trigger block
  it('[TC-F36.U03] All East Malaysia states block COD when codAmount > 0', () => {
    EAST_MY_STATES.forEach((state) => {
      const order = {
        codAmount: 1000,
        shippingAddress: { state },
      }
      expect(isCodBlocked(order)).toBe(true)
    })
  })

  // TC-F36.U04: All West states allow COD
  it('[TC-F36.U04] All West Malaysia states allow COD when codAmount > 0', () => {
    WEST_MY_STATES.forEach((state) => {
      const order = {
        codAmount: 1000,
        shippingAddress: { state },
      }
      expect(isCodBlocked(order)).toBe(false)
    })
  })

  // TC-F36.U05: No COD amount → COD always available
  it('[TC-F36.U05] codAmount = 0 → false (COD available even in East)', () => {
    const order = {
      codAmount: 0,
      shippingAddress: { state: 'Sabah' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U06: Null/undefined codAmount → COD available
  it('[TC-F36.U06] codAmount = null → false (COD available)', () => {
    const order = {
      codAmount: null,
      shippingAddress: { state: 'Sabah' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  it('[TC-F36.U06b] codAmount = undefined → false (COD available)', () => {
    const order = {
      codAmount: undefined,
      shippingAddress: { state: 'Sabah' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U07: Missing state → COD available (can't determine, so allow)
  it('[TC-F36.U07] Missing state → false (COD available, cannot determine)', () => {
    const order = {
      codAmount: 5000,
      shippingAddress: { city: 'Kota Kinabalu' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U08: Null address → COD available
  it('[TC-F36.U08] null shippingAddress → false (COD available)', () => {
    const order = {
      codAmount: 5000,
      shippingAddress: null,
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U09: Negative codAmount (edge case) → COD available
  it('[TC-F36.U09] Negative codAmount → false (COD available)', () => {
    const order = {
      codAmount: -100,
      shippingAddress: { state: 'Sabah' },
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U10: Minimal East state, codAmount at boundary
  it('[TC-F36.U10] Labuan (East boundary) + codAmount > 0 → true (COD blocked)', () => {
    const order = {
      codAmount: 1,
      shippingAddress: { state: 'Labuan' },
    }
    expect(isCodBlocked(order)).toBe(true)
  })

  // TC-F36.U11: Missing shippingAddress entirely
  it('[TC-F36.U11] Undefined shippingAddress → false (COD available)', () => {
    const order = {
      codAmount: 5000,
      shippingAddress: undefined,
    }
    expect(isCodBlocked(order)).toBe(false)
  })

  // TC-F36.U12: Empty object (minimal valid order shape)
  it('[TC-F36.U12] Empty order object → false (COD available, no COD amount)', () => {
    const order = {}
    expect(isCodBlocked(order)).toBe(false)
  })
})

/**
 * Unit tests for evaluateCodEligibility — F36 (GH-1333, PD-021 follow-EP model)
 * COD eligibility rules R1/R2/R3, per-route LIVE from quotation rates:
 *   R1: codAmount ≤ courier max · R2: codAmount ≥ courier min · R3: cod.available=true
 * Replaces the retired isCodBlocked East-MY hardcode (TC-F36.U01–U11 superseded).
 *
 * TC-F36.U01–F36.U10: Pure function, no framework dependencies.
 */

import { describe, it, expect } from 'vitest'
import { evaluateCodEligibility } from '@/lib/shipping/cod-eligibility'
import type { RateOption } from '@/lib/shipping/easyparcel/types'

function rate(overrides: Partial<RateOption>): RateOption {
  return {
    courier: 'EP-CR0A',
    serviceId: 'SVC-1',
    courierName: 'J&T Express',
    serviceName: 'Standard',
    priceSen: 1000,
    codAvailable: false,
    estDelivery: '2-3 days',
    ...overrides,
  }
}

describe('evaluateCodEligibility', () => {
  // TC-F36.U01: non-COD order (amount 0) → all rates pass untouched
  it('[TC-F36.U01] codAmountSen=0 → all rates eligible (not a COD order)', () => {
    const rates = [rate({ codAvailable: false }), rate({ codAvailable: true })]
    const result = evaluateCodEligibility(rates, 0)
    expect(result.eligible).toEqual(rates)
    expect(result.reason).toBeUndefined()
  })

  // TC-F36.U02: R3 — only cod.available couriers qualify
  it('[TC-F36.U02] R3: keeps only codAvailable couriers within limits', () => {
    const codRate = rate({ courier: 'jnt', codAvailable: true, codMinSen: 750, codMaxSen: 100_000 })
    const noCodRate = rate({ courier: 'citylink', codAvailable: false })
    const result = evaluateCodEligibility([codRate, noCodRate], 5000)
    expect(result.eligible).toEqual([codRate])
    expect(result.reason).toBeUndefined()
  })

  // TC-F36.U03: R3 fail — no COD-capable courier on route
  it('[TC-F36.U03] no codAvailable courier → reason "no_cod_courier"', () => {
    const result = evaluateCodEligibility([rate({ codAvailable: false })], 5000)
    expect(result.eligible).toEqual([])
    expect(result.reason).toBe('no_cod_courier')
  })

  // TC-F36.U04: R1 fail — amount above every courier max (Case A: J&T max RM1000)
  it('[TC-F36.U04] R1: amount over all courier maxes → reason "over_max"', () => {
    const result = evaluateCodEligibility(
      [rate({ codAvailable: true, codMinSen: 750, codMaxSen: 100_000 })],
      500_000, // RM5000 > RM1000 max
    )
    expect(result.eligible).toEqual([])
    expect(result.reason).toBe('over_max')
  })

  // TC-F36.U05: R2 fail — amount below every courier min (Case C: J&T min RM7.50)
  it('[TC-F36.U05] R2: amount under all courier mins → reason "under_min"', () => {
    const result = evaluateCodEligibility(
      [rate({ codAvailable: true, codMinSen: 750, codMaxSen: 100_000 })],
      50, // RM0.50 < RM7.50 min
    )
    expect(result.eligible).toEqual([])
    expect(result.reason).toBe('under_min')
  })

  // TC-F36.U06: boundary — amount exactly at min and at max is eligible (≤ / ≥ inclusive)
  it('[TC-F36.U06] amounts exactly at min/max boundaries are eligible', () => {
    const r = rate({ codAvailable: true, codMinSen: 750, codMaxSen: 100_000 })
    expect(evaluateCodEligibility([r], 750).eligible).toEqual([r])
    expect(evaluateCodEligibility([r], 100_000).eligible).toEqual([r])
  })

  // TC-F36.U07: missing min/max metadata → limits not enforced (R3 only)
  it('[TC-F36.U07] codAvailable without min/max metadata → eligible (no limit data to enforce)', () => {
    const r = rate({ codAvailable: true })
    const result = evaluateCodEligibility([r], 999_999_999)
    expect(result.eligible).toEqual([r])
  })

  // TC-F36.U08: mixed couriers — one over-limit, one in-range → in-range courier survives
  it('[TC-F36.U08] amount over courier A max but within courier B max → B eligible', () => {
    const jnt = rate({ courier: 'jnt', codAvailable: true, codMaxSen: 100_000 })
    const dhl = rate({ courier: 'dhl', codAvailable: true, codMaxSen: 200_000 })
    const result = evaluateCodEligibility([jnt, dhl], 150_000)
    expect(result.eligible).toEqual([dhl])
    expect(result.reason).toBeUndefined()
  })

  // TC-F36.U09: mixed failure reasons → 'over_max' wins deterministically
  it('[TC-F36.U09] disjoint ranges, some over-max some under-min → reason "over_max"', () => {
    const small = rate({ courier: 'a', codAvailable: true, codMinSen: 100, codMaxSen: 2000 })
    const big = rate({ courier: 'b', codAvailable: true, codMinSen: 10_000, codMaxSen: 100_000 })
    const result = evaluateCodEligibility([small, big], 5000) // over a's max, under b's min
    expect(result.eligible).toEqual([])
    expect(result.reason).toBe('over_max')
  })

  // TC-F36.U10: negative amount treated as non-COD
  it('[TC-F36.U10] negative codAmountSen → treated as non-COD, all rates pass', () => {
    const rates = [rate({ codAvailable: false })]
    const result = evaluateCodEligibility(rates, -100)
    expect(result.eligible).toEqual(rates)
    expect(result.reason).toBeUndefined()
  })

  // TC-F36.U11 (PD-021 regression): NO region input exists — eligibility is rate-driven only
  it('[TC-F36.U11] eligibility has no region dimension — East-route rates behave identically', () => {
    // Same rates regardless of destination; the function signature cannot take a state (R4)
    const r = rate({ codAvailable: true, codMinSen: 750, codMaxSen: 100_000 })
    expect(evaluateCodEligibility([r], 50_000).eligible).toEqual([r])
  })
})

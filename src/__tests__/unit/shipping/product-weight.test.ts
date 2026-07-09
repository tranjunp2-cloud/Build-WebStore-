/**
 * Unit tests for productWeightToGrams — GH-1458 unit decision wiring (GH-1333 F36)
 * Products.weight canonical unit is KG; the shipping pipeline runs in integer grams.
 * This is the single conversion point used by checkout, stripe-checkout, and the
 * calculate-shipping quote lookup.
 *
 * TC-F14.158 (docs/qa/F14-shipping.md § Parcel Weight Unit).
 */

import { describe, it, expect } from 'vitest'
import { productWeightToGrams, DEFAULT_ITEM_WEIGHT_GRAMS } from '@/lib/shipping/product-weight'

describe('productWeightToGrams', () => {
  it('[TC-F14.158] converts kg to integer grams', () => {
    expect(productWeightToGrams(0.5)).toBe(500)
    expect(productWeightToGrams(1.5)).toBe(1500)
    expect(productWeightToGrams(0.123)).toBe(123)
    expect(productWeightToGrams(0.0004)).toBe(0) // rounds — floor handled later by aggregateWeightKg
  })

  it('[TC-F14.158] unset/zero/invalid weight → 500 g default', () => {
    expect(productWeightToGrams(null)).toBe(DEFAULT_ITEM_WEIGHT_GRAMS)
    expect(productWeightToGrams(undefined)).toBe(DEFAULT_ITEM_WEIGHT_GRAMS)
    expect(productWeightToGrams(0)).toBe(DEFAULT_ITEM_WEIGHT_GRAMS)
    expect(productWeightToGrams(-1)).toBe(DEFAULT_ITEM_WEIGHT_GRAMS)
    expect(productWeightToGrams(NaN)).toBe(DEFAULT_ITEM_WEIGHT_GRAMS)
  })

  it('[TC-F14.158] regression: kg values must NOT be re-divided by 1000 (grams-era bug)', () => {
    // A 0.5 kg product used to be read as "0.5 grams" → aggregateWeightKg → 0.0005 kg.
    // Correct wiring: 0.5 kg → 500 g → aggregateWeightKg(500) → 0.5 kg.
    expect(productWeightToGrams(0.5) / 1000).toBe(0.5)
  })
})

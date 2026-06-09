/**
 * Unit tests for feature gating utilities.
 *
 * TC-SUB-030: canUse returns true for YES value
 * TC-SUB-031: canUse returns true for UNLIMITED value
 * TC-SUB-032: canUse returns false for '0' value
 * TC-SUB-033: canUse returns true for numeric > 0 (e.g. '3')
 * TC-SUB-033b: canUse returns true for numeric '1'
 * TC-SUB-034: canUse returns false when feature not found
 * TC-SUB-034b: canUse is case-insensitive (accepts 'yes')
 * TC-SUB-035: getFeatureSettings returns null when settings field is null
 * TC-SUB-035b: getFeatureSettings returns null when feature not found
 * TC-SUB-036: getFeatureSettings returns parsed JSON settings object
 * TC-SUB-036b: getFeatureSettings returns payment code settings
 * TC-SUB-037: getFeatureValue returns raw string value
 * TC-SUB-038: getFeatureValue returns null when feature not found
 */

import { describe, it, expect, vi } from 'vitest'
import { canUse, getFeatureValue, getFeatureSettings } from '@/lib/subscriptions/plan-subscription'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(doc?: Record<string, unknown>) {
  return {
    find: vi.fn().mockResolvedValue({ docs: doc ? [doc] : [], totalDocs: doc ? 1 : 0 }),
  }
}

// ── getFeatureValue ───────────────────────────────────────────────────────────

describe('getFeatureValue', () => {
  // TC-SUB-037
  it('[TC-SUB-037] returns raw string value from plan_features row', async () => {
    const payload = makePayload({ value: 'YES' })
    const result = await getFeatureValue(payload as any, 'FREEMIUM', 'website_builder')
    expect(result).toBe('YES')
  })

  // TC-SUB-038
  it('[TC-SUB-038] returns null when feature not found', async () => {
    const payload = makePayload()
    const result = await getFeatureValue(payload as any, 'FREEMIUM', 'unknown_feature')
    expect(result).toBeNull()
  })
})

// ── canUse ────────────────────────────────────────────────────────────────────

describe('canUse', () => {
  // TC-SUB-030
  it('[TC-SUB-030] returns true for YES value', async () => {
    const payload = makePayload({ value: 'YES' })
    expect(await canUse(payload as any, 'FREEMIUM', 'website_builder')).toBe(true)
  })

  // TC-SUB-031
  it('[TC-SUB-031] returns true for UNLIMITED value', async () => {
    const payload = makePayload({ value: 'UNLIMITED' })
    expect(await canUse(payload as any, 'PROFESSIONAL_TM_USER', 'template_limit')).toBe(true)
  })

  // TC-SUB-032
  it('[TC-SUB-032] returns false for "0" value', async () => {
    const payload = makePayload({ value: '0' })
    expect(await canUse(payload as any, 'FREEMIUM', 'staff_limit')).toBe(false)
  })

  // TC-SUB-033
  it('[TC-SUB-033] returns true for numeric string > 0', async () => {
    const payload = makePayload({ value: '3' })
    expect(await canUse(payload as any, 'STARTER_TM_USER', 'staff_limit')).toBe(true)
  })

  // TC-SUB-033b
  it('[TC-SUB-033b] returns true for numeric value 1', async () => {
    const payload = makePayload({ value: '1' })
    expect(await canUse(payload as any, 'STARTER_TM_USER', 'delivery_provider_limit')).toBe(true)
  })

  // TC-SUB-034
  it('[TC-SUB-034] returns false when feature not found in DB', async () => {
    const payload = makePayload()
    expect(await canUse(payload as any, 'FREEMIUM', 'nonexistent_feature')).toBe(false)
  })

  // TC-SUB-034b
  it('[TC-SUB-034b] is case-insensitive for value check (yes → true)', async () => {
    const payload = makePayload({ value: 'yes' })
    expect(await canUse(payload as any, 'FREEMIUM', 'website_builder')).toBe(true)
  })
})

// ── getFeatureSettings ────────────────────────────────────────────────────────

describe('getFeatureSettings', () => {
  // TC-SUB-035
  it('[TC-SUB-035] returns null when settings field is absent', async () => {
    const payload = makePayload({ value: 'YES', settings: null })
    const result = await getFeatureSettings(payload as any, 'FREEMIUM', 'template_limit')
    expect(result).toBeNull()
  })

  // TC-SUB-035b
  it('[TC-SUB-035b] returns null when feature not found', async () => {
    const payload = makePayload()
    const result = await getFeatureSettings(payload as any, 'FREEMIUM', 'template_limit')
    expect(result).toBeNull()
  })

  // TC-SUB-036
  it('[TC-SUB-036] returns settings object when present', async () => {
    const settings = { name: ['template-a', 'template-b'] }
    const payload = makePayload({ value: 'YES', settings })
    const result = await getFeatureSettings(
      payload as any,
      'STARTER_TM_USER',
      'template_limit',
    )
    expect(result).toEqual({ name: ['template-a', 'template-b'] })
  })

  // TC-SUB-036b
  it('[TC-SUB-036b] returns payment code settings for payment_integration', async () => {
    const settings = { code: ['cod', 'billplz'] }
    const payload = makePayload({ value: 'YES', settings })
    const result = await getFeatureSettings(
      payload as any,
      'PROFESSIONAL_NON_TM_USER',
      'payment_integration',
    )
    expect(result).toEqual({ code: ['cod', 'billplz'] })
  })
})

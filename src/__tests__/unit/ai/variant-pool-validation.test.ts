/**
 * Variant pool validation — every pool value must exist in the target
 * block's Zod/meta variant enum. Catches typos that would silently fall
 * back to the block's default variant at render time.
 *
 * Coverage: TC-F01-W.A1 (pool ↔ enum match)
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-01-A1-variant-wiring-validation.md
 */

import { describe, expect, it } from 'vitest'

import { poolCoverageSummary, validateAllPools } from '@/lib/ai/variant-pool-validator'

describe('TC-F01-W.A1 — variant pool validation', () => {
  it('every pool value matches the block variant enum', () => {
    const errors = validateAllPools()

    if (errors.length > 0) {
      const message = errors
        .map(
          (e) =>
            `  [${e.blockType}/${e.category}] invalid variant "${e.variant}" — valid: ${e.validVariants.join(', ')}`,
        )
        .join('\n')
      throw new Error(`${errors.length} invalid pool entries:\n${message}`)
    }
    expect(errors).toHaveLength(0)
  })

  it('each pool uses at least 2 distinct variants for rotation to matter', () => {
    const summary = poolCoverageSummary()

    for (const { blockType, poolSize } of summary) {
      expect(poolSize, `pool ${blockType} has only ${poolSize} distinct variants`).toBeGreaterThanOrEqual(2)
    }
  })

  it('validator covers 11 rotation pools', () => {
    const summary = poolCoverageSummary()

    expect(summary).toHaveLength(11)
    for (const row of summary) {
      expect(row.poolSize).toBeGreaterThan(0)
      expect(row.enumSize).toBeGreaterThanOrEqual(row.poolSize)
    }
  })
})

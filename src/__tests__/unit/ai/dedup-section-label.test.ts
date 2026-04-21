/**
 * Section label dedup — kills stacked eyebrow/headline duplicates.
 *
 * Coverage: TC-F01-W.A3
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-03-A3-quick-wins.md
 */

import { describe, expect, it } from 'vitest'

import { dedupSectionLabel } from '@/lib/ai/dedup-section-label'

describe('TC-F01-W.A3 — dedupSectionLabel', () => {
  it('drops label when all label keywords appear in headline', () => {
    expect(dedupSectionLabel('Why Choose Us', 'Why customers choose X')).toBeUndefined()
  })

  it('drops label when ≥ 2 keywords overlap', () => {
    expect(dedupSectionLabel('Our Features Overview', 'Features overview for 2026')).toBeUndefined()
  })

  it('keeps label when headline is distinct', () => {
    expect(dedupSectionLabel('Services', 'What We Offer')).toBe('Services')
    expect(dedupSectionLabel('About', 'Our Story')).toBe('About')
  })

  it('keeps label for category + specific headline', () => {
    expect(dedupSectionLabel('Our Story', 'The Passion Behind Nike')).toBe('Our Story')
  })

  it('keeps label when only 1 keyword overlaps', () => {
    expect(dedupSectionLabel('Premium Quality', 'Our Top Services')).toBe('Premium Quality')
  })

  it('returns label as-is when empty string passed', () => {
    expect(dedupSectionLabel('', 'Hello')).toBe('')
    expect(dedupSectionLabel(undefined, 'Hello')).toBeUndefined()
  })

  it('returns label when headline missing', () => {
    expect(dedupSectionLabel('Services', undefined)).toBe('Services')
  })
})

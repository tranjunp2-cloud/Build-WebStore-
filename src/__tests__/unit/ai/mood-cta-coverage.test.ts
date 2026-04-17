/**
 * CI coverage test for the 168-cell mood × category × role CTA table.
 *
 * Blocks merge on ANY blank cell, duplicate cell, or oversized cell (> 25 chars).
 * Rationale: hand-curated table is error-prone; this test is cheap insurance.
 *
 * Also sanity-checks mood metadata (voiceStyle length, imageryKeywords length,
 * mood label/description non-empty).
 *
 * Coverage: TC-F01-W.09, TC-F01-W.12
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import {
  THEME_MOODS,
  ALL_MOOD_IDS,
  ALL_MOOD_CATEGORIES,
  CTA_MAX_LENGTH,
  getCategoryCTA,
  getMood,
  type MoodId,
  type MoodCategory,
  type CTARole,
} from '@/lib/ai/theme-moods'

describe('TC-F01-W.09 — mood metadata shape', () => {
  it('has exactly 6 moods', () => {
    expect(ALL_MOOD_IDS).toHaveLength(6)
    expect(Object.keys(THEME_MOODS)).toHaveLength(6)
  })

  it('has exactly 14 categories', () => {
    expect(ALL_MOOD_CATEGORIES).toHaveLength(14)
  })

  it.each(ALL_MOOD_IDS)('mood "%s" has valid shape', (moodId: MoodId) => {
    const mood = THEME_MOODS[moodId]
    expect(mood).toBeDefined()
    expect(mood.id).toBe(moodId)
    expect(mood.label.length).toBeGreaterThan(0)
    expect(mood.description.length).toBeGreaterThan(20)
    expect(mood.imageryKeywords.length).toBeGreaterThanOrEqual(3)
    expect(mood.imageryKeywords.length).toBeLessThanOrEqual(6)
    expect(mood.voiceStyle.length).toBeGreaterThanOrEqual(4)
    expect(mood.voiceStyle.length).toBeLessThanOrEqual(6)
  })

  it.each(ALL_MOOD_IDS)('mood "%s" imagery keywords are all non-empty', (moodId: MoodId) => {
    const mood = THEME_MOODS[moodId]
    for (const keyword of mood.imageryKeywords) {
      expect(keyword.trim().length).toBeGreaterThan(0)
    }
  })

  it.each(ALL_MOOD_IDS)('mood "%s" voice style rules are meaningful sentences', (moodId: MoodId) => {
    const mood = THEME_MOODS[moodId]
    for (const rule of mood.voiceStyle) {
      // A meaningful voice rule is at least 10 chars and ends with punctuation
      expect(rule.trim().length).toBeGreaterThan(10)
      expect(rule).toMatch(/[.!?]$/)
    }
  })
})

describe('TC-F01-W.12 — 168-cell CTA coverage', () => {
  const ROLES: CTARole[] = ['primary', 'secondary']

  it('total cell count is 168 (6 × 14 × 2)', () => {
    let count = 0
    for (const moodId of ALL_MOOD_IDS) {
      const mood = THEME_MOODS[moodId]
      for (const category of ALL_MOOD_CATEGORIES) {
        const cell = mood.ctaByCategory[category]
        expect(cell).toBeDefined()
        count += 2 // primary + secondary
      }
    }
    expect(count).toBe(168)
  })

  it.each(ALL_MOOD_IDS)('mood "%s" covers all 14 categories', (moodId: MoodId) => {
    const mood = THEME_MOODS[moodId]
    for (const category of ALL_MOOD_CATEGORIES) {
      expect(mood.ctaByCategory[category]).toBeDefined()
    }
  })

  // Flatten into individual test cases so a failure pinpoints exactly which cell.
  for (const moodId of ALL_MOOD_IDS) {
    for (const category of ALL_MOOD_CATEGORIES) {
      for (const role of ROLES) {
        it(`${moodId} × ${category} × ${role} — non-empty string ≤${CTA_MAX_LENGTH} chars`, () => {
          const mood = THEME_MOODS[moodId]
          const cta = mood.ctaByCategory[category][role]
          expect(cta).toBeTypeOf('string')
          expect(cta.trim().length).toBeGreaterThan(0)
          expect(cta.length).toBeLessThanOrEqual(CTA_MAX_LENGTH)
          // No obvious placeholder markers
          expect(cta).not.toMatch(/TODO|FIXME|XXX|PLACEHOLDER/i)
        })
      }
    }
  }

  it('primary and secondary CTAs are distinct within the same cell', () => {
    for (const moodId of ALL_MOOD_IDS) {
      const mood = THEME_MOODS[moodId]
      for (const category of ALL_MOOD_CATEGORIES) {
        const { primary, secondary } = mood.ctaByCategory[category]
        expect(primary).not.toBe(secondary)
      }
    }
  })

  it('no mood falls back to generic "Get Started"/"Learn More" across all 14 categories', () => {
    // Serene is intentionally allowed to use generic phrasing for some categories (calm tone).
    // But NO mood should use "Get Started" or "Learn More" for EVERY category.
    const generic = ['Get Started', 'Learn More']
    for (const moodId of ALL_MOOD_IDS) {
      const mood = THEME_MOODS[moodId]
      let genericCount = 0
      for (const category of ALL_MOOD_CATEGORIES) {
        const { primary, secondary } = mood.ctaByCategory[category]
        if (generic.includes(primary)) genericCount++
        if (generic.includes(secondary)) genericCount++
      }
      // 28 cells per mood; allow max 2 generic (rare escape hatches for tech × serene etc.)
      expect(genericCount).toBeLessThanOrEqual(2)
    }
  })
})

describe('getCategoryCTA helper', () => {
  it('returns correct CTA for known category + mood + role', () => {
    const mood = getMood('elegant')
    expect(getCategoryCTA(mood, 'restaurant', 'primary')).toBe('Reserve a Table')
    expect(getCategoryCTA(mood, 'restaurant', 'secondary')).toBe('View Our Menu')
  })

  it('falls back to business category for unknown category', () => {
    const mood = getMood('bold')
    const unknown = getCategoryCTA(mood, 'not-a-category', 'primary')
    expect(unknown).toBe(mood.ctaByCategory.business.primary)
  })

  it('works for all 6 moods × restaurant × primary', () => {
    const results: Record<string, string> = {}
    for (const moodId of ALL_MOOD_IDS) {
      const mood = getMood(moodId)
      results[moodId] = getCategoryCTA(mood, 'restaurant', 'primary')
    }
    // Different moods produce different CTAs (not all identical)
    const unique = new Set(Object.values(results))
    expect(unique.size).toBeGreaterThanOrEqual(4)
  })
})

describe('getMood helper', () => {
  it('returns mood for valid id', () => {
    const mood = getMood('playful')
    expect(mood.id).toBe('playful')
  })

  it('throws for invalid id', () => {
    expect(() => getMood('invalid' as MoodId)).toThrow(/Unknown moodId/)
  })
})

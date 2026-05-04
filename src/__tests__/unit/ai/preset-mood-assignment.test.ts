/**
 * Preset ↔ mood assignment totality test.
 *
 * Asserts every ThemePreset in theme-presets.ts has a valid moodId that
 * resolves to a real ThemeMood, and every mood has at least one preset
 * using it (distribution sanity check).
 *
 * Coverage: TC-F01-W.09b
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import { CATEGORY_PRESETS, type ThemePreset } from '@/lib/ai/theme-presets'
import { THEME_MOODS, ALL_MOOD_IDS, type MoodId } from '@/lib/ai/theme-moods'

function allPresets(): Array<{ category: string; preset: ThemePreset }> {
  const out: Array<{ category: string; preset: ThemePreset }> = []
  for (const [category, presets] of Object.entries(CATEGORY_PRESETS)) {
    for (const preset of presets) {
      out.push({ category, preset })
    }
  }
  return out
}

describe('TC-F01-W.09b — preset mood assignment totality', () => {
  const presets = allPresets()

  it('has at least 70 presets across 14 categories', () => {
    expect(presets.length).toBeGreaterThanOrEqual(70)
  })

  it('every preset has a moodId field', () => {
    for (const { category, preset } of presets) {
      expect(
        preset.moodId,
        `preset "${preset.name}" in category "${category}" missing moodId`,
      ).toBeDefined()
    }
  })

  it('every preset moodId resolves to a real ThemeMood', () => {
    for (const { category, preset } of presets) {
      const mood = THEME_MOODS[preset.moodId]
      expect(
        mood,
        `preset "${preset.name}" in "${category}" has unknown moodId "${preset.moodId}"`,
      ).toBeDefined()
      expect(mood.id).toBe(preset.moodId)
    }
  })

  it('every mood is used by at least 3 presets (no dead moods)', () => {
    const usage: Record<MoodId, number> = {
      playful: 0,
      elegant: 0,
      bold: 0,
      serene: 0,
      editorial: 0,
      'tech-minimal': 0,
    }
    for (const { preset } of presets) {
      usage[preset.moodId]++
    }
    for (const moodId of ALL_MOOD_IDS) {
      expect(
        usage[moodId],
        `mood "${moodId}" assigned to ${usage[moodId]} presets — should be ≥3`,
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it('no mood dominates more than 30% of total presets', () => {
    const usage: Record<MoodId, number> = {
      playful: 0,
      elegant: 0,
      bold: 0,
      serene: 0,
      editorial: 0,
      'tech-minimal': 0,
    }
    for (const { preset } of presets) {
      usage[preset.moodId]++
    }
    const max = Math.max(...Object.values(usage))
    expect(max / presets.length).toBeLessThanOrEqual(0.3)
  })

  it('every category has at least 2 distinct moods (variety per category)', () => {
    for (const [category, categoryPresets] of Object.entries(CATEGORY_PRESETS)) {
      const moods = new Set(categoryPresets.map((p) => p.moodId))
      expect(
        moods.size,
        `category "${category}" only has ${moods.size} distinct mood(s) — should be ≥2`,
      ).toBeGreaterThanOrEqual(2)
    }
  })
})

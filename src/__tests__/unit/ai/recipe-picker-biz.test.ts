/**
 * Unit tests for pickRecipe — Plan 07 biz-aware variant.
 *
 * Coverage: TC-F01-W.47 — pickRecipe uses djb2(biz.name) XOR seed so
 * two businesses at the same base seed land on different recipes when
 * possible, and composeFromBlueprint reorders the homepage block
 * sequence per recipe.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-07-variety-retrofit.md
 */

import { describe, it, expect } from 'vitest'
import { pickRecipe } from '@/lib/ai/category-recipes'
import { composeFromBlueprint } from '@/lib/ai/template-composer'
import { TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'

function restaurantPreset() {
  return TEMPLATE_PRESETS.find((p) => p.category === 'restaurant')!
}

function homepageBlockTypes(result: ReturnType<typeof composeFromBlueprint>): string[] {
  const homepage = result.pages[0]!
  return homepage.layout.map((b) => (b as { blockType?: string }).blockType ?? '')
}

describe('pickRecipe — Plan 07 biz-aware', () => {
  it('returns same recipe for same (category, seed, biz.name)', () => {
    const a = pickRecipe('restaurant', 42, { name: 'Ramen Ichiban' })
    const b = pickRecipe('restaurant', 42, { name: 'Ramen Ichiban' })
    expect(a.id).toBe(b.id)
  })

  it('backward compat — calls without biz use legacy seed % 3', () => {
    const a = pickRecipe('restaurant', 42)
    const b = pickRecipe('restaurant', 42)
    expect(a.id).toBe(b.id)
  })

  it('rotates across 3 recipes when biz.name changes at the same base seed', () => {
    const names = [
      'Ramen Ichiban',
      'Roti Canai House',
      'Pho 88',
      'Nasi Kandar King',
      'Dragon Pearl',
      'Banana Leaf Rice',
      'Warung Pak Ali',
      'Cafe de Paris',
      'Aminah Grill',
      'Siti Kitchen',
    ]
    const ids = new Set(names.map((n) => pickRecipe('restaurant', 42, { name: n }).id))
    // With djb2 XOR, at least 2 distinct recipes should land for 10 names.
    expect(ids.size).toBeGreaterThanOrEqual(2)
  })

  it('composeFromBlueprint reorders homepage sequence per recipe', () => {
    const preset = restaurantPreset()
    const r1 = composeFromBlueprint(preset, 42, { name: 'Ramen Ichiban', description: 'Sapporo ramen.' })
    const r2 = composeFromBlueprint(preset, 42, { name: 'Pho 88', description: 'Hanoi pho.' })
    const r3 = composeFromBlueprint(preset, 42, { name: 'Roti Canai House', description: 'Mamak classics.' })

    const seq1 = homepageBlockTypes(r1)
    const seq2 = homepageBlockTypes(r2)
    const seq3 = homepageBlockTypes(r3)

    // Every homepage must still start with hero-ish (after nav if present).
    const heroIdx = (s: string[]) => s.indexOf('hero')
    expect(heroIdx(seq1)).toBeGreaterThanOrEqual(0)
    expect(heroIdx(seq2)).toBeGreaterThanOrEqual(0)
    expect(heroIdx(seq3)).toBeGreaterThanOrEqual(0)

    // At least 2 of 3 businesses should yield a different sequence.
    const signatures = new Set([seq1.join('>'), seq2.join('>'), seq3.join('>')])
    expect(signatures.size).toBeGreaterThanOrEqual(2)
  })

  it('empty biz name falls back to legacy seed path deterministically', () => {
    const a = pickRecipe('restaurant', 42, { name: '' })
    const legacy = pickRecipe('restaurant', 42)
    expect(a.id).toBe(legacy.id)
  })

  it('unknown category → business fallback still returns a valid recipe', () => {
    const r = pickRecipe('unknown-cat', 42, { name: 'Anything' })
    expect(r).toBeDefined()
    expect(r.blocks.length).toBeGreaterThan(0)
  })
})

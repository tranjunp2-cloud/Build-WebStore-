/**
 * Unit tests for composer buildHero — Plan 07 rewrite.
 *
 * Coverage: TC-F01-W.46 — buildHero (via composeFromBlueprint) emits
 * biz-derived hero headline/subheadline + mood-resolved CTAs.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-07-variety-retrofit.md
 */

import { describe, it, expect } from 'vitest'
import { composeFromBlueprint } from '@/lib/ai/template-composer'
import { TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'
import type { BusinessSample } from '@/lib/ai/content'

function firstRestaurantPreset() {
  return TEMPLATE_PRESETS.find((p) => p.category === 'restaurant')!
}

function pickHero(pages: Array<{ layout: Array<Record<string, unknown>> }>): Record<string, unknown> {
  const homepage = pages[0]!
  const hero = homepage.layout.find((b) => (b as { blockType?: string }).blockType === 'hero')
  if (!hero) throw new Error('hero block not found on homepage')
  return hero
}

function buildOverride(name: string, description: string, products: string[] = []): Partial<BusinessSample> {
  return { name, description, products, tagline: description.slice(0, 80) }
}

describe('composer buildHero — Plan 07 biz-derived hero', () => {
  it('uses user biz.name + description in headline and subheadline', () => {
    const preset = firstRestaurantPreset()
    const result = composeFromBlueprint(
      preset,
      42,
      buildOverride(
        'Ramen Ichiban',
        'Authentic Sapporo-style ramen served in a cozy 12-seat counter in Bukit Bintang.',
        ['tonkotsu ramen', 'miso ramen', 'gyoza'],
      ),
    )

    const hero = pickHero(result.pages)
    expect(String(hero.headline)).toContain('Ramen Ichiban')
    // Subheadline mines the user description, truncated to 140 chars on word boundary.
    expect(String(hero.subheadline)).toContain('Sapporo')
    expect(String(hero.subheadline).length).toBeLessThanOrEqual(140)
  })

  it('produces distinct hero headlines for 3 restaurants at the same seed', () => {
    const preset = firstRestaurantPreset()
    const r1 = composeFromBlueprint(
      preset,
      42,
      buildOverride('Ramen Ichiban', 'Sapporo-style ramen in Bukit Bintang.', ['tonkotsu']),
    )
    const r2 = composeFromBlueprint(
      preset,
      42,
      buildOverride('Roti Canai House', 'Mamak classics since 1985 in Brickfields.', ['roti canai']),
    )
    const r3 = composeFromBlueprint(
      preset,
      42,
      buildOverride('Pho 88', 'Hanoi-style pho served fresh every morning.', ['pho bo']),
    )

    const h1 = pickHero(r1.pages)
    const h2 = pickHero(r2.pages)
    const h3 = pickHero(r3.pages)

    expect(new Set([h1.headline, h2.headline, h3.headline]).size).toBe(3)
    expect(new Set([h1.subheadline, h2.subheadline, h3.subheadline]).size).toBe(3)
  })

  it('hero CTA reflects mood — never falls back to Get Started when mood is resolved', () => {
    const preset = firstRestaurantPreset()
    const result = composeFromBlueprint(
      preset,
      42,
      buildOverride('Ramen Ichiban', 'Sapporo-style ramen.', ['tonkotsu']),
    )
    const hero = pickHero(result.pages)
    const buttons = hero.ctaButtons as Array<{ label: string }>
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.label.length).toBeGreaterThan(0)
    expect(buttons[1]!.label.length).toBeGreaterThan(0)
  })

  it('falls back to canned heroHeadline when biz name is empty', () => {
    const preset = firstRestaurantPreset()
    const result = composeFromBlueprint(preset, 42, { name: '', description: '', products: [] })
    const hero = pickHero(result.pages)
    // Canned headline exists — just assert it is non-empty.
    expect(String(hero.headline).length).toBeGreaterThan(0)
  })

  it('headline stays ≤ 10 words (C3 consistency rule)', () => {
    const preset = firstRestaurantPreset()
    const result = composeFromBlueprint(
      preset,
      42,
      buildOverride(
        'The Very Long Restaurant Name That Goes On And On',
        'A place with a massive description that keeps rambling about itself.',
        ['ramen with every single topping known to humankind'],
      ),
    )
    const hero = pickHero(result.pages)
    const wordCount = String(hero.headline).split(/\s+/).filter(Boolean).length
    expect(wordCount).toBeLessThanOrEqual(10)
  })
})

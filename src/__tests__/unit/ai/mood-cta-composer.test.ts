/**
 * End-to-end test — mood-driven CTAs flow from preset → composer → blocks.
 *
 * Coverage: TC-F01-W.12b — hero CTA, nav CTA, mid-page CTA all match
 * the resolved mood's category-tuned CTA, not the legacy "Get Started".
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { THEME_MOODS } from '@/lib/ai/theme-moods'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

function findBlock(result: GenerationResult, blockType: string): Record<string, unknown> | undefined {
  type Page = { blocks?: Array<Record<string, unknown>>; layout?: Array<Record<string, unknown>> }
  const pages = (result.pages ?? []) as unknown as Page[]
  for (const page of pages) {
    const blocks = page.blocks ?? page.layout ?? []
    const hit = blocks.find((b) => b.blockType === blockType)
    if (hit) return hit
  }
  const top = (result.blocks ?? []) as unknown as Array<Record<string, unknown>>
  return top.find((b) => b.blockType === blockType)
}

describe('TC-F01-W.12b — mood CTAs flow through composer', () => {
  it('hero CTA buttons use mood-resolved labels', () => {
    const result = composeFallbackResult('restaurant', 42, 'en', 'Test Restaurant')
    const hero = findBlock(result, 'hero')
    expect(hero).toBeDefined()
    const buttons = hero!.ctaButtons as Array<{ label: string }>
    expect(buttons).toHaveLength(2)
    // Primary button label should be non-generic.
    // With 5 restaurant presets × 6 moods, at least one mood-specific CTA lands.
    // We assert: label is a known restaurant-category CTA from some mood.
    const allRestaurantPrimaries = Object.values(THEME_MOODS).map(
      (m) => m.ctaByCategory.restaurant.primary,
    )
    expect(allRestaurantPrimaries).toContain(buttons[0]!.label)
  })

  it('nav CTA button uses mood-resolved primary', () => {
    const result = composeFallbackResult('restaurant', 42, 'en', 'Test')
    const nav = findBlock(result, 'navigation')
    expect(nav).toBeDefined()
    const button = nav!.ctaButton as { label: string }
    const allRestaurantPrimaries = Object.values(THEME_MOODS).map(
      (m) => m.ctaByCategory.restaurant.primary,
    )
    expect(allRestaurantPrimaries).toContain(button.label)
  })

  it('cta block uses mood-resolved label', () => {
    const result = composeFallbackResult('restaurant', 42, 'en', 'Test')
    const cta = findBlock(result, 'cta')
    if (cta) {
      const allRestaurantPrimaries = Object.values(THEME_MOODS).map(
        (m) => m.ctaByCategory.restaurant.primary,
      )
      expect(allRestaurantPrimaries).toContain(cta.ctaLabel)
    }
  })

  it('different seeds may produce different CTAs (mood variety)', () => {
    const seeds = [1, 2, 3, 4, 5, 42, 100, 200]
    const labels = new Set<string>()
    for (const seed of seeds) {
      const result = composeFallbackResult('restaurant', seed, 'en', 'Test')
      const hero = findBlock(result, 'hero')
      if (hero) {
        const buttons = hero.ctaButtons as Array<{ label: string }>
        labels.add(buttons[0]!.label)
      }
    }
    // Across 8 seeds on restaurant, we should see at least 2 distinct moods' CTAs.
    expect(labels.size).toBeGreaterThanOrEqual(2)
  })

  it('no more hardcoded "Get Started" on hero for mood-bearing presets', () => {
    // Sample many categories to confirm "Get Started" is not the dominant CTA.
    const categories = ['restaurant', 'beauty', 'tech', 'fitness', 'health']
    let getStartedCount = 0
    for (const cat of categories) {
      const result = composeFallbackResult(`${cat} business`, 42, 'en', 'Sample')
      const hero = findBlock(result, 'hero')
      if (hero) {
        const buttons = hero.ctaButtons as Array<{ label: string }>
        if (buttons[0]?.label === 'Get Started') getStartedCount++
      }
    }
    // Tech × serene legitimately uses "Get Started" — allow at most 1.
    expect(getStartedCount).toBeLessThanOrEqual(1)
  })

  it('ecommerce mood CTA shows in hero (different category lookup)', () => {
    const result = composeFallbackResult('ecommerce store', 42, 'en', 'Shop')
    const hero = findBlock(result, 'hero')
    expect(hero).toBeDefined()
    const buttons = hero!.ctaButtons as Array<{ label: string }>
    const allEcommercePrimaries = Object.values(THEME_MOODS).map(
      (m) => m.ctaByCategory.ecommerce.primary,
    )
    expect(allEcommercePrimaries).toContain(buttons[0]!.label)
  })
})

/**
 * Variant rotation — distribution + regen stability for the 14 block types
 * wired through `rotateStructuralVariants`.
 *
 * Coverage: TC-F01-W.A1 (rotation distribution, regen stability)
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-01-A1-variant-wiring-validation.md
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { hashString } from '@/lib/ai/seeded-random'
import { rotateStructuralVariants, type TemplatePage } from '@/lib/ai/template-composer'

const ROTATED_BLOCK_TYPES = [
  'navigation', 'contact', 'footer',
  'features', 'testimonials', 'about', 'cta', 'stats', 'newsletter',
  'team', 'faq', 'gallery', 'pricing', 'service-cards',
] as const

const CATEGORIES = [
  'beauty', 'restaurant', 'fnb', 'tech', 'health', 'education',
  'realestate', 'fitness', 'creative', 'business', 'ecommerce',
  'events', 'blog', 'travel',
] as const

function buildPages(): TemplatePage[] {
  return [{
    title: 'Home',
    slug: '/',
    layout: ROTATED_BLOCK_TYPES.map((blockType) => ({ blockType, variant: 'default' })),
  }]
}

function collectVariants(pages: TemplatePage[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const page of pages) {
    for (const block of page.layout) {
      out[String(block.blockType)] = String(block.variant)
    }
  }
  return out
}

describe('TC-F01-W.A1 — variant rotation distribution', () => {
  let pages: TemplatePage[]
  beforeEach(() => { pages = buildPages() })

  it('rotates at least 2 distinct variants across 20 realistic seeds per category', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => hashString(`biz-${i}-sample`))
    for (const category of CATEGORIES) {
      const histograms: Record<string, Set<string>> = {}
      for (const seed of seeds) {
        const fresh = buildPages()
        rotateStructuralVariants(fresh, category, seed)
        const picked = collectVariants(fresh)
        for (const [blockType, variant] of Object.entries(picked)) {
          histograms[blockType] = histograms[blockType] ?? new Set()
          histograms[blockType].add(variant)
        }
      }
      for (const blockType of ROTATED_BLOCK_TYPES) {
        const unique = histograms[blockType]?.size ?? 0
        expect(unique, `${category}/${blockType} only hit ${unique} variants in 20 seeds`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('TC-F01-W.A1 — variant rotation stability', () => {
  it('same (seed, category) produces identical variants across runs', () => {
    for (const category of CATEGORIES) {
      for (const seed of [1, 42, 999]) {
        const a = buildPages()
        const b = buildPages()
        rotateStructuralVariants(a, category, seed)
        rotateStructuralVariants(b, category, seed)
        expect(collectVariants(b)).toEqual(collectVariants(a))
      }
    }
  })

  it('different seeds usually produce different variant for at least 1 block', () => {
    const a = buildPages()
    const b = buildPages()
    rotateStructuralVariants(a, 'tech', 1)
    rotateStructuralVariants(b, 'tech', 100)
    const diffs = ROTATED_BLOCK_TYPES.filter((t) => collectVariants(a)[t] !== collectVariants(b)[t])
    expect(diffs.length).toBeGreaterThanOrEqual(1)
  })
})

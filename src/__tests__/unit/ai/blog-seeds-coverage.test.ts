/**
 * Coverage tests for blog-seeds.ts (Phase 05).
 *
 * Coverage: TC-F01-W.20 (BlogPost shape) + TC-F01-W.21 (14 cats × ≥3 posts)
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-05-multipage-completeness.md
 */

import { describe, it, expect } from 'vitest'
import { BLOG_SEEDS_BY_CATEGORY, getBlogSeeds, totalBlogSeedCount } from '@/lib/ai/content/blog-seeds'

const EXPECTED_CATEGORIES = [
  'restaurant', 'ecommerce', 'beauty', 'tech', 'health', 'education',
  'realestate', 'fitness', 'creative', 'business', 'fnb', 'events',
  'blog', 'travel',
] as const

describe('TC-F01-W.20 — BlogPost shape', () => {
  it('every seed has required fields', () => {
    for (const [cat, seeds] of Object.entries(BLOG_SEEDS_BY_CATEGORY)) {
      for (const post of seeds) {
        expect(post.title, `${cat}: post missing title`).toBeTypeOf('string')
        expect(post.title.length).toBeGreaterThan(5)
        expect(post.excerpt).toBeTypeOf('string')
        expect(post.excerpt.length).toBeGreaterThan(20)
        expect(post.slug).toBeTypeOf('string')
        expect(post.slug).toMatch(/^[a-z0-9-]+$/)
      }
    }
  })

  it('titles are non-empty and not placeholder', () => {
    for (const seeds of Object.values(BLOG_SEEDS_BY_CATEGORY)) {
      for (const post of seeds) {
        expect(post.title.trim().length).toBeGreaterThan(0)
        expect(post.title.toLowerCase()).not.toContain('lorem ipsum')
        expect(post.title.toLowerCase()).not.toContain('todo')
      }
    }
  })
})

describe('TC-F01-W.21 — 14 categories × ≥3 posts each', () => {
  it('has exactly 14 categories', () => {
    expect(Object.keys(BLOG_SEEDS_BY_CATEGORY).length).toBe(14)
  })

  it.each(EXPECTED_CATEGORIES)('category "%s" has ≥3 seeds', (cat) => {
    const seeds = BLOG_SEEDS_BY_CATEGORY[cat]
    expect(seeds).toBeDefined()
    expect(seeds!.length).toBeGreaterThanOrEqual(3)
  })

  it.each(EXPECTED_CATEGORIES)('category "%s" has ≤6 seeds (cap)', (cat) => {
    const seeds = BLOG_SEEDS_BY_CATEGORY[cat]
    expect(seeds!.length).toBeLessThanOrEqual(6)
  })

  it('total seed count ≥ 42 (14 cats × 3)', () => {
    expect(totalBlogSeedCount()).toBeGreaterThanOrEqual(42)
  })

  it('unique slugs within each category', () => {
    for (const [cat, seeds] of Object.entries(BLOG_SEEDS_BY_CATEGORY)) {
      const slugs = seeds.map((s) => s.slug)
      const unique = new Set(slugs)
      expect(
        unique.size,
        `${cat}: duplicate slugs ${slugs.join(', ')}`,
      ).toBe(slugs.length)
    }
  })
})

describe('getBlogSeeds helper', () => {
  it('returns seeds for known category', () => {
    expect(getBlogSeeds('restaurant').length).toBeGreaterThanOrEqual(3)
  })

  it('normalizes category key (case + separators)', () => {
    expect(getBlogSeeds('Restaurant').length).toBeGreaterThan(0)
    expect(getBlogSeeds('real-estate').length).toBeGreaterThan(0)
    expect(getBlogSeeds('REAL_ESTATE').length).toBeGreaterThan(0)
  })

  it('falls back to business for unknown category', () => {
    const unknown = getBlogSeeds('spaceship-repair')
    expect(unknown.length).toBeGreaterThan(0)
    expect(unknown).toEqual(BLOG_SEEDS_BY_CATEGORY.business)
  })
})

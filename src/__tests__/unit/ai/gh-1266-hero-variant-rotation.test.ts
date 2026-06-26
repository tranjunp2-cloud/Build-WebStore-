/**
 * Unit Tests: hero variant rotation — pool defense + diversity post GH-1266 fix
 * TC-IDs: TC-1266-10 → TC-1266-14
 * GH Issue: #1266 (AI gen hero banner showing "No video URL provided" placeholder)
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F01-ai-builder-variety.md
 *
 * Background:
 *   RC1 — BROKEN_VARIANTS missing video/split-video (phase 01)
 *   RC2 — tech/fitness hero pools too narrow (4 → 6 variants) (phase 02)
 *   RC3 — batch3 presets 34% minimal-dominant (phase 03)
 *   RC4 — seed determinism amplified by narrow pools (addressed via RC2)
 */

import { describe, expect, it } from 'vitest'

import { BROKEN_VARIANTS, CATEGORY_HERO_VARIANTS, selectVariant } from '@/lib/ai/template-composer'
import { CATEGORY_VARIANT_WEIGHTS } from '@/lib/ai/openai-generator'
import { BATCH3_PRESETS } from '@/lib/ai/template-presets-batch3'
import { heroMeta } from '@/blocks/hero/config'

const HERO_ENUM = new Set(heroMeta.variants)
const BANNED = ['video', 'split-video', 'animated-gradient']

const CATEGORIES = [
  'beauty', 'restaurant', 'fnb', 'tech', 'health', 'education',
  'realestate', 'fitness', 'creative', 'business', 'ecommerce',
  'events', 'blog', 'travel',
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Block A — RC1 defense: BROKEN_VARIANTS + no banned variant from selectVariant
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266-10] BROKEN_VARIANTS.hero defense (RC1)', () => {
  it('contains video, split-video, and animated-gradient', () => {
    // Arrange
    const broken = BROKEN_VARIANTS['hero'] ?? []

    // Assert
    expect(broken).toContain('video')
    expect(broken).toContain('split-video')
    expect(broken).toContain('animated-gradient')
  })

  it('selectVariant never returns a banned hero variant across 50 seeds × 14 categories', () => {
    // Act + Assert
    for (const category of CATEGORIES) {
      for (let seed = 0; seed < 50; seed++) {
        const variant = selectVariant('hero', seed, category)
        expect(
          BANNED,
          `seed=${seed} category=${category} returned banned variant "${variant}"`,
        ).not.toContain(variant)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Block B — RC2 pools: ≥6 distinct for tech/fitness; cross-map sync; all ∈ enum
// NOTE: sync assertion is RC2-scoped (tech+fitness only). Other categories have
// pre-existing divergence between composer and openai maps that predates this fix.
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266-11] Hero pool size and cross-map sync — RC2 scope: tech and fitness only', () => {
  it('tech hero pool has ≥6 distinct variants', () => {
    // Arrange
    const pool = CATEGORY_HERO_VARIANTS['tech'] ?? []

    // Assert
    expect(new Set(pool).size).toBeGreaterThanOrEqual(6)
  })

  it('fitness hero pool has ≥6 distinct variants', () => {
    // Arrange
    const pool = CATEGORY_HERO_VARIANTS['fitness'] ?? []

    // Assert
    expect(new Set(pool).size).toBeGreaterThanOrEqual(6)
  })

  it('all composer tech/fitness hero pool values exist in hero block enum', () => {
    for (const cat of ['tech', 'fitness'] as const) {
      for (const v of CATEGORY_HERO_VARIANTS[cat] ?? []) {
        expect(
          HERO_ENUM,
          `composer ${cat} pool contains unknown variant "${v}"`,
        ).toContain(v)
      }
    }
  })

  it('openai CATEGORY_VARIANT_WEIGHTS matches composer pools for tech and fitness hero (RC2 sync guard)', () => {
    for (const cat of ['tech', 'fitness'] as const) {
      const composerPool = new Set(CATEGORY_HERO_VARIANTS[cat])
      const aiPool = new Set(CATEGORY_VARIANT_WEIGHTS[cat]?.['hero'])
      expect(composerPool).toEqual(aiPool)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Block C — RC2/RC4 variety: ≥3 distinct hero variants across 10 seeds
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266-12] Hero variety across 10 seeds (RC2/RC4)', () => {
  it('tech hero: ≥3 distinct variants across seeds 1–10', () => {
    // Arrange + Act
    const seen = new Set(
      Array.from({ length: 10 }, (_, i) => selectVariant('hero', i + 1, 'tech')),
    )

    // Assert
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })

  it('fitness hero: ≥3 distinct variants across seeds 1–10', () => {
    // Arrange + Act
    const seen = new Set(
      Array.from({ length: 10 }, (_, i) => selectVariant('hero', i + 1, 'fitness')),
    )

    // Assert
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Block D — RC3 presets: batch3 distribution ≤35%; gradient/parallax/slideshow present
// Homepage heroes are the primary UX signal; inner pages legitimately use
// minimal/centered more often — distribution is checked on homepages (strict)
// and all blocks (relaxed to 40%, inner-page skew expected).
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266-13] batch3 preset hero distribution (RC3)', () => {
  const homepageHeroVariants = BATCH3_PRESETS.flatMap((preset) =>
    preset.pages
      .filter((page) => page.isHomepage)
      .flatMap((page) =>
        page.blocks
          .filter((b) => b.blockType === 'hero')
          .map((b) => b.variant ?? 'undefined'),
      ),
  )

  const allHeroVariants = BATCH3_PRESETS.flatMap((preset) =>
    preset.pages.flatMap((page) =>
      page.blocks
        .filter((b) => b.blockType === 'hero')
        .map((b) => b.variant ?? 'undefined'),
    ),
  )

  it('no single hero variant exceeds 25% share across batch3 homepage heroes', () => {
    // Arrange
    const total = homepageHeroVariants.length
    const counts: Record<string, number> = {}
    for (const v of homepageHeroVariants) {
      counts[v] = (counts[v] ?? 0) + 1
    }

    // Assert — tight bound on homepages (the user-visible UX signal)
    for (const [variant, count] of Object.entries(counts)) {
      const share = count / total
      expect(
        share,
        `homepage hero variant "${variant}" has ${(share * 100).toFixed(1)}% share (limit 25%)`,
      ).toBeLessThanOrEqual(0.25)
    }
  })

  it('no single hero variant exceeds 40% share across all batch3 hero blocks', () => {
    // Arrange — relaxed bound: inner pages legitimately use minimal/centered more
    const total = allHeroVariants.length
    const counts: Record<string, number> = {}
    for (const v of allHeroVariants) {
      counts[v] = (counts[v] ?? 0) + 1
    }

    // Assert
    for (const [variant, count] of Object.entries(counts)) {
      const share = count / total
      expect(
        share,
        `variant "${variant}" has ${(share * 100).toFixed(1)}% share (limit 40%)`,
      ).toBeLessThanOrEqual(0.40)
    }
  })

  it('gradient, parallax, and slideshow each appear at least once in batch3 hero blocks', () => {
    // Arrange
    const variantSet = new Set(allHeroVariants)

    // Assert
    expect(variantSet).toContain('gradient')
    expect(variantSet).toContain('parallax')
    expect(variantSet).toContain('slideshow')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Block E — Regression: all pool values valid; no banned variant in any pool
// ─────────────────────────────────────────────────────────────────────────────

describe('[TC-1266-14] Regression — hero pool validity across all categories', () => {
  it('every value in every hero category pool exists in the hero block enum', () => {
    for (const [cat, pool] of Object.entries(CATEGORY_HERO_VARIANTS)) {
      for (const v of pool) {
        expect(
          HERO_ENUM,
          `category "${cat}" pool contains unknown variant "${v}"`,
        ).toContain(v)
      }
    }
  })

  it('no hero category pool contains a banned variant', () => {
    for (const [cat, pool] of Object.entries(CATEGORY_HERO_VARIANTS)) {
      for (const v of pool) {
        expect(
          BANNED,
          `category "${cat}" pool contains banned variant "${v}"`,
        ).not.toContain(v)
      }
    }
  })
})

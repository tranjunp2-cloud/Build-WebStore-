/**
 * Matrix builder — enumerates the cartesian product (category × variant × seed)
 * and pulls expected invariants from CATEGORY_REQUIREMENTS (single source of truth
 * since CATEGORY_DNA removal in commit bbbd0198 plan 2253 P3). Requirements carries
 * mandatoryBlocks + minBlocks the harness guards need.
 */

import {
  TEMPLATE_PRESETS,
  TEMPLATE_DEFINITIONS,
} from '@/lib/ai/template-definitions'
import { CATEGORY_REQUIREMENTS } from '@/lib/ai/category-requirements'
import type { Fixture, HarnessMode } from './types'

export type BuildMatrixOpts = {
  mode: HarnessMode
  categories?: string[]
  variants?: Array<'starter' | 'professional' | 'premium'>
  seedsPerCell?: number
}

const ALL_CATEGORIES = Object.keys(CATEGORY_REQUIREMENTS)
const ALL_VARIANTS: Array<'starter' | 'professional' | 'premium'> = [
  'starter',
  'professional',
  'premium',
]

/** Deterministic seed from string — same inputs always produce same seed. */
function seedFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Build the fixture matrix.
 *
 * Default (mode=full): 14 categories × 3 variants × 5 seeds = 210 fixtures
 * Quick: restaurant + beauty + tech × premium × 1 seed = 3 fixtures
 *
 * Mixes BLUEPRINT path (composeFromBlueprint with TEMPLATE_PRESETS) +
 * LEGACY path (composeTemplate with ComposerInput) — both produce TemplateSeed
 * with the same shape, but route through different code paths.
 */
export function buildMatrix(opts: BuildMatrixOpts): Fixture[] {
  const { mode } = opts

  const categories =
    opts.categories ??
    (mode === 'quick' ? ['restaurant', 'beauty', 'tech'] : ALL_CATEGORIES)

  const variants =
    opts.variants ?? (mode === 'quick' ? ['premium'] : ALL_VARIANTS)

  const seedsPerCell =
    opts.seedsPerCell ?? (mode === 'quick' ? 1 : 5)

  const fixtures: Fixture[] = []

  for (const category of categories) {
    const req = CATEGORY_REQUIREMENTS[category]
    if (!req) {
      console.warn(`[harness] skipping unknown category: ${category}`)
      continue
    }

    const expectedSignatureBlocks = [...req.mandatoryBlocks]
    const expectedMinBlocks = Math.max(6, req.minBlocks - 3)
    const expectedMaxBlocks = Math.max(16, req.minBlocks + 4)

    // --- Blueprint path: pick all presets matching this category ---
    const presetsInCat = TEMPLATE_PRESETS
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.category === category)

    for (const { p: preset, idx: presetIndex } of presetsInCat) {
      for (let s = 0; s < seedsPerCell; s++) {
        const id = `${category}-blueprint-${preset.id}-seed${s}`
        const seed = seedFromString(id)
        fixtures.push({
          id,
          category,
          variant: 'premium', // all blueprints are premium
          businessIndex: preset.businessIndex,
          compositionSeed: seed,
          source: 'blueprint',
          presetIndex,
          expectedSignatureBlocks,
          expectedMinBlocks,
          expectedMaxBlocks,
        })
      }
    }

    // --- Legacy path: only when a TEMPLATE_DEFINITIONS entry actually exists ---
    // Avoid generating fixtures that cannot compose (no false-positive failures).
    for (const variant of variants) {
      if (variant === 'premium' && presetsInCat.length > 0) continue // skip — blueprint already covers premium
      const legacyDef = TEMPLATE_DEFINITIONS.find(
        (d) => d.category === category && d.variant === variant,
      )
      if (!legacyDef) continue // no legacy coverage for this cell — skip cleanly

      for (let s = 0; s < seedsPerCell; s++) {
        const id = `${category}-legacy-${variant}-seed${s}`
        const seed = seedFromString(id)
        fixtures.push({
          id,
          category,
          variant,
          businessIndex: legacyDef.businessIndex,
          compositionSeed: seed,
          source: 'legacy',
          expectedSignatureBlocks,
          expectedMinBlocks,
          expectedMaxBlocks,
        })
      }
    }
  }

  return fixtures
}

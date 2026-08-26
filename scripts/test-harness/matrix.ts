/**
 * Matrix builder — enumerates blueprint fixtures only (category × preset × seed).
 * Blueprint = the path real users hit: composeFromBlueprint(TEMPLATE_PRESETS).
 * Legacy fixtures (starter/professional via TEMPLATE_DEFINITIONS) are excluded —
 * users no longer reach that path (GEN_MODE=template-first default since 2026-04-16).
 */

import {
  TEMPLATE_PRESETS,
} from '@/lib/ai/template-definitions'
import { CATEGORY_REQUIREMENTS } from '@/lib/ai/category-requirements'
import type { Fixture, HarnessMode } from './types'

export type BuildMatrixOpts = {
  /** @deprecated variants no longer used — all fixtures are blueprint/premium */
  mode: HarnessMode
  categories?: string[]
  variants?: Array<'starter' | 'professional' | 'premium'>
  seedsPerCell?: number
}

const ALL_CATEGORIES = Object.keys(CATEGORY_REQUIREMENTS)

/** Deterministic seed from string — same inputs always produce same seed. */
function seedFromString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Build the fixture matrix — blueprint fixtures only.
 *
 * Default (mode=full): 14 categories × N presets × 5 seeds
 * Quick: restaurant + beauty + tech × 1 preset × 1 seed = 3 fixtures
 *
 * Only runs BLUEPRINT path (composeFromBlueprint + TEMPLATE_PRESETS) —
 * mirrors what real users hit via GEN_MODE=template-first (default since 2026-04-16).
 */
export function buildMatrix(opts: BuildMatrixOpts): Fixture[] {
  const { mode } = opts

  const categories =
    opts.categories ??
    (mode === 'quick' ? ['restaurant', 'beauty', 'tech'] : ALL_CATEGORIES)

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

  }

  return fixtures
}

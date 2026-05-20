/**
 * Cross-fixture variety metrics — aggregate per-category data across all
 * seeds of the same category. WARN (not FAIL) because variety is aspirational.
 * Thresholds from PRD F01V §5.
 */

import type { HarnessResult, StructuralReport } from '../types'

const HERO_MIN_PER_CATEGORY = 3 // PRD says >=5/10 for 10 seeds; we use 5 default
const FEATURE_MIN_PER_CATEGORY = 2
const FOOTER_MIN_PER_CATEGORY = 2

export type VarietyMetrics = StructuralReport['varietyMetrics']
export type VarietyWarning = { category: string; metric: string; actual: number; expected: number }

export function computeVarietyMetrics(
  results: HarnessResult[],
): { metrics: VarietyMetrics; warnings: VarietyWarning[] } {
  const byCategory: VarietyMetrics['byCategory'] = {}
  const warnings: VarietyWarning[] = []

  // Group by category
  const groups: Record<string, HarnessResult[]> = {}
  for (const r of results) {
    if (r.composerError) continue
    ;(groups[r.fixture.category] ??= []).push(r)
  }

  for (const [category, rs] of Object.entries(groups)) {
    const heroVariants = new Set<string>()
    const featureVariants = new Set<string>()
    const footerVariants = new Set<string>()
    const orderingSigs = new Set<string>()

    for (const r of rs) {
      for (const b of r.blocks) {
        if (b.blockType === 'hero' && b.variant) heroVariants.add(b.variant)
        if (b.blockType === 'features' && b.variant) featureVariants.add(b.variant)
        if (b.blockType === 'footer' && b.variant) footerVariants.add(b.variant)
      }
      orderingSigs.add(r.blocks.map((b) => b.blockType).join('>'))
    }

    byCategory[category] = {
      heroVariants: [...heroVariants],
      featureVariants: [...featureVariants],
      footerVariants: [...footerVariants],
      uniqueOrderings: orderingSigs.size,
    }

    if (heroVariants.size < HERO_MIN_PER_CATEGORY && rs.length >= 3) {
      warnings.push({ category, metric: 'hero-variants', actual: heroVariants.size, expected: HERO_MIN_PER_CATEGORY })
    }
    if (featureVariants.size < FEATURE_MIN_PER_CATEGORY && rs.length >= 3) {
      warnings.push({ category, metric: 'feature-variants', actual: featureVariants.size, expected: FEATURE_MIN_PER_CATEGORY })
    }
    if (footerVariants.size < FOOTER_MIN_PER_CATEGORY && rs.length >= 3) {
      warnings.push({ category, metric: 'footer-variants', actual: footerVariants.size, expected: FOOTER_MIN_PER_CATEGORY })
    }
  }

  return { metrics: { byCategory }, warnings }
}

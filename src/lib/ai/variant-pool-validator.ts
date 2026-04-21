/**
 * Variant pool validator — ensures every `*_VARIANT_BY_CATEGORY` pool value
 * exists in the target block's Zod/meta variant enum. Mismatched values
 * silently fall through to the block's default variant at render time,
 * hiding the bug from QA.
 *
 * Called from unit test to gate CI. Not imported in runtime path.
 *
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-01-A1-variant-wiring-validation.md
 */

import { aboutMeta } from '@/blocks/about/config'
import { ctaMeta } from '@/blocks/cta/config'
import { faqMeta } from '@/blocks/faq/config'
import { featuresMeta } from '@/blocks/features/config'
import { galleryMeta } from '@/blocks/gallery/config'
import { newsletterMeta } from '@/blocks/newsletter/config'
import { pricingMeta } from '@/blocks/pricing/config'
import { serviceCardsMeta } from '@/blocks/service-cards/config'
import { statsMeta } from '@/blocks/stats/config'
import { teamMeta } from '@/blocks/team/config'
import { testimonialsMeta } from '@/blocks/testimonials/config'

import {
  ABOUT_VARIANT_BY_CATEGORY,
  CTA_VARIANT_BY_CATEGORY,
  FAQ_VARIANT_BY_CATEGORY,
  FEATURES_VARIANT_BY_CATEGORY,
  GALLERY_VARIANT_BY_CATEGORY,
  NEWSLETTER_VARIANT_BY_CATEGORY,
  PRICING_VARIANT_BY_CATEGORY,
  SERVICE_CARDS_VARIANT_BY_CATEGORY,
  STATS_VARIANT_BY_CATEGORY,
  TEAM_VARIANT_BY_CATEGORY,
  TESTIMONIALS_VARIANT_BY_CATEGORY,
} from './category-requirements'

export type PoolValidationError = {
  blockType: string
  category: string
  variant: string
  validVariants: readonly string[]
}

type PoolEntry = {
  blockType: string
  pool: Readonly<Record<string, string[]>>
  validVariants: readonly string[]
}

const POOLS: readonly PoolEntry[] = [
  { blockType: 'features', pool: FEATURES_VARIANT_BY_CATEGORY, validVariants: featuresMeta.variants },
  { blockType: 'testimonials', pool: TESTIMONIALS_VARIANT_BY_CATEGORY, validVariants: testimonialsMeta.variants },
  { blockType: 'about', pool: ABOUT_VARIANT_BY_CATEGORY, validVariants: aboutMeta.variants },
  { blockType: 'cta', pool: CTA_VARIANT_BY_CATEGORY, validVariants: ctaMeta.variants },
  { blockType: 'stats', pool: STATS_VARIANT_BY_CATEGORY, validVariants: statsMeta.variants },
  { blockType: 'newsletter', pool: NEWSLETTER_VARIANT_BY_CATEGORY, validVariants: newsletterMeta.variants },
  { blockType: 'team', pool: TEAM_VARIANT_BY_CATEGORY, validVariants: teamMeta.variants },
  { blockType: 'faq', pool: FAQ_VARIANT_BY_CATEGORY, validVariants: faqMeta.variants },
  { blockType: 'gallery', pool: GALLERY_VARIANT_BY_CATEGORY, validVariants: galleryMeta.variants },
  { blockType: 'pricing', pool: PRICING_VARIANT_BY_CATEGORY, validVariants: pricingMeta.variants },
  { blockType: 'service-cards', pool: SERVICE_CARDS_VARIANT_BY_CATEGORY, validVariants: serviceCardsMeta.variants },
]

/**
 * Scan all 11 category→variant pools. Returns a flat list of every value
 * that does not exist in its block's declared variant enum.
 */
export function validateAllPools(): PoolValidationError[] {
  const errors: PoolValidationError[] = []
  for (const { blockType, pool, validVariants } of POOLS) {
    const valid = new Set(validVariants)
    for (const [category, variants] of Object.entries(pool)) {
      for (const variant of variants) {
        if (!valid.has(variant)) {
          errors.push({ blockType, category, variant, validVariants })
        }
      }
    }
  }
  return errors
}

/** Quick summary of pool coverage — for CI output + debug. */
export function poolCoverageSummary(): Array<{ blockType: string; poolSize: number; enumSize: number }> {
  return POOLS.map(({ blockType, pool, validVariants }) => {
    const unique = new Set<string>()
    for (const variants of Object.values(pool)) {
      for (const v of variants) unique.add(v)
    }
    return { blockType, poolSize: unique.size, enumSize: validVariants.length }
  })
}

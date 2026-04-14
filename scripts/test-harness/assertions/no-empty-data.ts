/**
 * Guard: blocks must have enough content for their variant to render meaningfully.
 *
 * Minimum content rules (aligned with enforceMinContent in openai-generator.ts):
 *   carousel/masonry variants: >= 3 items
 *   grid-4 variants:           >= 4 items
 *   grid-3 variants:           >= 3 items
 *   testimonials cards/grid:   >= 3 items
 *
 * We inspect common content array fields: items, features, testimonials,
 * services, entries, cards, products, images, categories, faqs.
 */

import type { HarnessResult, GuardReport, HarnessBlock } from '../types'

const CONTENT_FIELDS = [
  'items',
  'features',
  'testimonials',
  'services',
  'entries',
  'cards',
  'products',
  'images',
  'gallery',
  'categories',
  'faqs',
  'questions',
  'team',
  'members',
  'properties',
  'courses',
  'classes',
  'plans',
  'tiers',
]

function countContent(block: HarnessBlock): number {
  let max = 0
  for (const field of CONTENT_FIELDS) {
    const v = block.data[field]
    if (Array.isArray(v) && v.length > max) max = v.length
  }
  return max
}

type MinRule = { variantMatch: RegExp; minCount: number }

const RULES: MinRule[] = [
  { variantMatch: /grid-?4|grid4/i, minCount: 4 },
  { variantMatch: /masonry/i, minCount: 4 },
  { variantMatch: /grid-?3|grid3|cards?$/i, minCount: 3 },
  { variantMatch: /carousel|slider/i, minCount: 3 },
]

function requiredMinFor(block: HarnessBlock): number {
  if (!block.variant) return 0
  for (const rule of RULES) {
    if (rule.variantMatch.test(block.variant)) return rule.minCount
  }
  return 0
}

// Blocks we don't check (structural / no content array)
const SKIP_BLOCKS = new Set([
  'navigation',
  'footer',
  'hero',
  'cta',
  'newsletter',
  'contact',
  'about',
  'custom-html',
  'announcement-bar',
  'breadcrumb',
  'booking-widget',
  'google-maps',
  'video-background',
  'video',
  'countdown-timer',
])

export function noEmptyDataGuard(r: HarnessResult): GuardReport {
  const violations: Array<{
    blockType: string
    variant?: string
    expected: number
    actual: number
  }> = []

  for (const block of r.blocks) {
    if (SKIP_BLOCKS.has(block.blockType)) continue
    const expected = requiredMinFor(block)
    if (expected === 0) continue
    const actual = countContent(block)
    if (actual < expected) {
      violations.push({
        blockType: block.blockType,
        variant: block.variant,
        expected,
        actual,
      })
    }
  }

  if (violations.length === 0) {
    return { name: 'no-empty-data', status: 'pass' }
  }

  return {
    name: 'no-empty-data',
    status: 'fail',
    reason: `${violations.length} block(s) with insufficient content for variant: ${violations
      .map((v) => `${v.blockType}:${v.variant}=${v.actual}/${v.expected}`)
      .join(', ')}`,
    data: { violations },
  }
}

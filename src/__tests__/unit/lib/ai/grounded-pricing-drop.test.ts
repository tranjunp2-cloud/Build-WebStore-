/**
 * TC-AIAUD-145 / 146 / 148 - generation never ships a pricing section without the merchant's own priced
 * products, and the invitation card is never merged next to real reviews (#2103 A1, code-review fixes).
 */
import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'
import { runWithGenerationFacts } from '@/lib/ai/generation-facts-scope'
import { enforceGroundedBlocks, groundedTestimonials, isPlanlessPricing } from '@/lib/ai/grounded-blocks'
import { TESTIMONIAL_INVITE_TITLE } from '@/lib/ai/generation-facts'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

type Block = Record<string, unknown>
type Page = { blocks?: Block[]; layout?: Block[] }

const allBlocks = (result: { pages?: unknown; blocks: unknown }): Block[] => {
  const pages = (result.pages ?? []) as Page[]
  return pages.length > 0 ? pages.flatMap((p) => p.blocks ?? p.layout ?? []) : (result.blocks as Block[])
}

function generate(info: BusinessInfoInput, seed = 7) {
  const facts = buildGenerationFacts({ businessInfo: info })
  return runWithGenerationFacts(facts, () => composeFallbackResult(`${info.businessName} ${info.industry}`, seed, 'en', info))
}

// "tech" has pricing in its required recipe blocks; no price anywhere in the input
const NO_PRICES: BusinessInfoInput = {
  businessName: 'Nimbus Apps',
  industry: 'tech',
  products: 'Inventory app, booking widget',
  shortDescription: 'Software for small shops',
}
const WITH_PRICES: BusinessInfoInput = { ...NO_PRICES, products: 'Inventory app RM99, booking widget RM49' }

describe('[TC-AIAUD-145] generation drops pricing when there are no priced products', () => {
  it('enforceGroundedBlocks removes pricing and pricing-table blocks that end up without plans', () => {
    const facts = buildGenerationFacts({ businessInfo: NO_PRICES })
    const out = enforceGroundedBlocks(
      [
        { blockType: 'hero' },
        { blockType: 'pricing', plans: [{ name: 'Gold', price: 'RM 999' }] },
        { blockType: 'pricing-table', plans: [] },
        { blockType: 'cta' },
      ],
      facts,
      'en',
    )
    expect(out.map((b) => b.blockType)).toEqual(['hero', 'cta'])
  })

  it('isPlanlessPricing only flags pricing blocks without plans', () => {
    expect(isPlanlessPricing({ blockType: 'pricing', plans: [] })).toBe(true)
    expect(isPlanlessPricing({ blockType: 'pricing-table' })).toBe(true)
    expect(isPlanlessPricing({ blockType: 'pricing', plans: [{ name: 'x', price: 'RM 1' }] })).toBe(false)
    expect(isPlanlessPricing({ blockType: 'faq', items: [] })).toBe(false)
    expect(isPlanlessPricing(null)).toBe(false)
  })

  it.each([1, 7, 23, 99])('composed site (seed %i) has no pricing block, and no invented plan text', (seed) => {
    const blocks = allBlocks(generate(NO_PRICES, seed))
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.filter((b) => b.blockType === 'pricing' || b.blockType === 'pricing-table')).toEqual([])
    expect(JSON.stringify(blocks)).not.toMatch(/Starter|Enterprise|RM 299/)
  })
})

describe('[TC-AIAUD-146] pricing is kept when the merchant listed prices', () => {
  it('every composed pricing block carries only the merchant products and prices', () => {
    const facts = buildGenerationFacts({ businessInfo: WITH_PRICES })
    const out = enforceGroundedBlocks([{ blockType: 'pricing', plans: [] }], facts, 'en')
    expect(out).toHaveLength(1)
    const plans = out[0]!.plans as Array<{ name: string; price: string }>
    expect(plans.map((p) => `${p.name}:${p.price}`)).toEqual(['Inventory app:RM 99', 'booking widget:RM 49'])
  })

  it('a composed site with priced products never has an empty pricing block', () => {
    for (const seed of [1, 7, 23, 99]) {
      for (const b of allBlocks(generate(WITH_PRICES, seed)).filter((x) => x.blockType === 'pricing')) {
        expect((b.plans as unknown[]).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('[TC-AIAUD-148] the invitation is never merged with real reviews', () => {
  it('groundedTestimonials returns real reviews only when the merchant has some', () => {
    const facts = buildGenerationFacts({ businessInfo: NO_PRICES })
    expect(groundedTestimonials(facts).map((t) => t.title)).toEqual([TESTIMONIAL_INVITE_TITLE])
    const withReviews = { ...facts, reviews: [{ quote: 'Great app', name: 'Aina' }] }
    const items = groundedTestimonials(withReviews)
    expect(items).toEqual([{ quote: 'Great app', name: 'Aina' }])
    expect(items.some((t) => t.title === TESTIMONIAL_INVITE_TITLE)).toBe(false)
  })

  it('enforceGroundedBlocks drops a stored invitation next to real quotes', () => {
    const base = buildGenerationFacts({ businessInfo: NO_PRICES })
    const facts = { ...base, reviews: [{ quote: 'Great app', name: 'Aina' }] }
    const [block] = enforceGroundedBlocks(
      [{
        blockType: 'testimonials',
        testimonials: [
          { quote: 'Be the first to review Nimbus Apps', name: 'Nimbus Apps', title: TESTIMONIAL_INVITE_TITLE },
          { quote: 'Great app', name: 'Aina' },
        ],
      }],
      facts,
      'en',
    )
    expect((block!.testimonials as Array<{ title?: string }>).some((t) => t.title === TESTIMONIAL_INVITE_TITLE)).toBe(false)
    expect(block!.testimonials).toHaveLength(1)
  })
})

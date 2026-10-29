/**
 * TC-AIAUD-010..012, 019..026 — generation with only a name + products invents nothing (#2103 A1/A2).
 *
 * Imports the real composer / generator; no mocks of the content under test. The library itself is
 * grepped too, so a claim cannot come back through a content pack.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'
import { runWithGenerationFacts } from '@/lib/ai/generation-facts-scope'
import { applyProductPricesToMenus } from '@/lib/ai/grounded-blocks'
import { categoryMap } from '@/lib/ai/content'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

const FORBIDDEN =
  /jakim|halal|grabfood|grab food|foodpanda|shopeefood|\d+\s?% off|award[- ]winning|years? experience|since 19\d\d|maybank|cimb|petronas|dermatolog|\bSLA\b|uptime|MBBS|Le Cordon Bleu/i
const LIBRARY_REVIEWERS = ['Uncle Chong', 'Aisyah Razali', 'Puan Zainab', 'Joanne Yap', 'Siti Aminah', 'Michelle Tan']

type Block = Record<string, unknown>
type Page = { slug: string; blocks?: Block[]; layout?: Block[] }

const allBlocks = (result: { pages?: unknown; blocks: unknown }): Block[] => {
  const pages = (result.pages ?? []) as Page[]
  return pages.length > 0 ? pages.flatMap((p) => p.blocks ?? p.layout ?? []) : (result.blocks as Block[])
}

const BEAUTY: BusinessInfoInput = {
  businessName: 'Glow by Aina',
  industry: 'beauty',
  products: 'Hydrating facial, acne treatment, bridal makeup',
  shortDescription: 'Home-based facial and makeup studio',
}
const FNB: BusinessInfoInput = {
  businessName: 'Dapur Kak Yah',
  industry: 'fnb',
  products: 'Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120',
  shortDescription: 'Home bakery in Klang',
}

function generate(info: BusinessInfoInput, language: 'en' | 'ms' = 'en') {
  const facts = buildGenerationFacts({ businessInfo: info })
  return runWithGenerationFacts(facts, () => composeFallbackResult(`${info.businessName} ${info.industry}`, 7, language, info))
}

describe.each([['beauty', BEAUTY], ['F&B', FNB]])('%s generation from name + products only', (_label, info) => {
  const result = generate(info)
  const blocks = allBlocks(result)

  it('TC-AIAUD-019/020: contains no invented certifications, delivery partners, discounts, credentials or brands', () => {
    const text = JSON.stringify(result)
    expect(text.match(FORBIDDEN)?.[0]).toBeUndefined()
    for (const name of LIBRARY_REVIEWERS) expect(text).not.toContain(name)
  })

  it('TC-AIAUD-021: every testimonials block is ONE invitation card — no person, no rating', () => {
    const blocksOfType = blocks.filter((b) => b.blockType === 'testimonials')
    expect(blocksOfType.length).toBeGreaterThan(0)
    for (const block of blocksOfType) {
      const items = block.testimonials as Array<Record<string, unknown>>
      expect(items).toHaveLength(1)
      expect(items[0]!.quote).toBe(`Be the first to review ${info.businessName}`)
      expect(items[0]!.rating).toBeUndefined()
      expect(items[0]!.title).toBe('Invitation (replace with a real review)')
    }
  })

  it('TC-AIAUD-023/024: stats and logo-cloud carry no fake numbers or real brands; team is the brand only', () => {
    for (const block of blocks.filter((b) => b.blockType === 'stats')) {
      // 3 products listed + nothing else = a single real fact → no numbers
      expect(block.stats).toEqual([])
    }
    for (const block of blocks.filter((b) => b.blockType === 'logo-cloud')) expect(block.logos).toEqual([])
    for (const block of blocks.filter((b) => b.blockType === 'team')) {
      expect(block.members).toEqual([{ name: `The ${info.businessName} team`, role: 'Founder' }])
    }
  })

  it('TC-AIAUD-025: FAQ (where present) only answers from facts', () => {
    for (const block of blocks.filter((b) => b.blockType === 'faq')) {
      const questions = ((block.items ?? block.faqs ?? []) as Array<{ question: string }>).map((i) => i.question)
      for (const q of questions) expect(q).toMatch(/contact|offer|order|areas|located/i)
    }
  })
})

describe('TC-AIAUD-010..012 — menu prices come from the merchant, never the library (#2103 A2)', () => {
  const menuOf = (info: BusinessInfoInput) => {
    const block = allBlocks(generate(info)).find((b) => b.blockType === 'menu-food') as Block | undefined
    return ((block?.categories ?? []) as Array<{ items: Array<{ name: string; price?: string }> }>).flatMap((c) => c.items)
  }

  it('TC-AIAUD-010: the issue input yields menu prices 65 / 48 / 120', () => {
    const items = menuOf({ ...FNB, industry: 'restaurant' })
    expect(items.map((i) => [i.name, i.price])).toEqual([
      ['Kek lapis', '65'],
      ['kuih raya box', '48'],
      ['birthday', '120'],
    ])
  })

  it('TC-AIAUD-011: an item with no merchant price stays blank, then takes the created product price', () => {
    const info = { ...FNB, industry: 'restaurant', products: 'Roti canai, teh tarik RM3.5' }
    const items = menuOf(info)
    expect(items.map((i) => i.price)).toEqual(['', '3.50'])
    const layout = allBlocks(generate(info))
    const priced = applyProductPricesToMenus(layout, [{ name: 'roti canai', price: 2 }, { name: 'Teh Tarik', price: 99 }])
    const menu = priced.find((b) => b.blockType === 'menu-food') as Block
    // the input blocks are not mutated (library content is shared between generations)
    expect(JSON.stringify(layout)).not.toContain('"price":"2"')
    const after = (menu.categories as Array<{ items: Array<{ price?: string }> }>).flatMap((c) => c.items)
    expect(after.map((i) => i.price)).toEqual(['2', '3.50']) // merchant price is never overwritten
  })

  it('TC-AIAUD-012: library menu items (no products listed) carry no price, currency or tag', () => {
    const items = menuOf({ ...FNB, industry: 'restaurant', products: '' })
    for (const item of items) {
      expect(item.price ?? '', JSON.stringify(item)).toBe('')
      expect(item).not.toHaveProperty('tag')
    }
  })
})

describe('TC-AIAUD-022 — real reviews from a site import are used verbatim', () => {
  it('shows the imported quotes and names, nothing else', () => {
    const facts = buildGenerationFacts({
      businessInfo: BEAUTY,
      contentBrief: { referenceContent: { testimonials: [{ quote: 'Skin feels amazing', name: 'Nur', role: 'Client' }] } },
    })
    const result = runWithGenerationFacts(facts, () => composeFallbackResult('beauty', 3, 'en', BEAUTY))
    const block = allBlocks(result).find((b) => b.blockType === 'testimonials') as Block
    expect(block.testimonials).toMatchObject([{ quote: 'Skin feels amazing', name: 'Nur', title: 'Client' }])
  })
})

describe('TC-AIAUD-023 — year started + products listed make real stats', () => {
  it('"Since 2015" and the product count appear; nothing else', () => {
    const info = { ...FNB, industry: 'restaurant', shopFacts: 'Started in 2015' }
    const facts = buildGenerationFacts({ businessInfo: info })
    const result = runWithGenerationFacts(facts, () => composeFallbackResult('restaurant', 3, 'en', info))
    const stats = allBlocks(result).filter((b) => b.blockType === 'stats')
    expect(stats.length).toBeGreaterThan(0)
    for (const block of stats) {
      expect(block.stats).toEqual([{ value: '2015', label: 'Year started' }, { value: '3', label: 'Products' }])
    }
  })
})

describe('TC-AIAUD-019 — the real generator entry point (no AI actor → rule-based path) keeps FACTS in scope', () => {
  it('generateSiteWithAI output for a beauty shop is claim-free', async () => {
    const facts = buildGenerationFacts({ businessInfo: BEAUTY })
    const out = await generateSiteWithAI(BEAUTY, undefined, 'en', undefined, undefined, undefined, { facts })
    const text = JSON.stringify(out.result)
    expect(text.match(FORBIDDEN)?.[0]).toBeUndefined()
    const testimonials = allBlocks(out.result).filter((b) => b.blockType === 'testimonials')
    expect(testimonials.length).toBeGreaterThan(0)
    for (const b of testimonials) expect(b.testimonials as unknown[]).toHaveLength(1)
  })
})

describe('TC-AIAUD-026 — the content library itself holds no invented claims', () => {
  const dir = path.join(process.cwd(), 'src/lib/ai/content')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'sample-products.ts')

  it.each(files)('%s has no certification / delivery-partner / discount / award wording', (file) => {
    const text = readFileSync(path.join(dir, file), 'utf8')
    expect(text.match(/jakim|halal|grabfood|foodpanda|shopeefood|\d+\s?% off|award[- ]winning|\bcertified\b/i)?.[0]).toBeUndefined()
  })

  it('no category pack ships reviewers, FAQ answers or partner logos', () => {
    for (const pack of Object.values(categoryMap)) {
      expect(pack.testimonials).toEqual([])
      expect(pack.faqItems).toEqual([])
      expect((pack as { logos?: unknown }).logos).toBeUndefined()
    }
    expect(() => readFileSync(path.join(dir, 'client-logos-library.ts'))).toThrow()
  })
})

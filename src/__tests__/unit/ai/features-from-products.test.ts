/**
 * Unit tests for buildFeatures product-derived cards via composeFallbackResult.
 *
 * Coverage: TC-F01-W.03 — when biz.products.length >= 2, features block
 * renders user products as cards; otherwise falls back to canned content.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'
import { runWithGenerationFacts } from '@/lib/ai/generation-facts-scope'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

type FeatureCard = { icon: string; title: string; description: string }

function findFeaturesBlock(result: GenerationResult): Record<string, unknown> | undefined {
  type Page = { blocks?: Array<Record<string, unknown>>; layout?: Array<Record<string, unknown>> }
  const pages = (result.pages ?? []) as unknown as Page[]
  for (const page of pages) {
    const blocks = page.blocks ?? page.layout ?? []
    const hit = blocks.find((b) => b.blockType === 'features')
    if (hit) return hit
  }
  const top = (result.blocks ?? []) as unknown as Array<Record<string, unknown>>
  return top.find((b) => b.blockType === 'features')
}

describe('TC-F01-W.03 — features from user products', () => {
  it('emits product-derived cards when products.length >= 2 (title mentions product)', () => {
    const info: BusinessInfoInput = {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen, sushi, gyoza',
      shortDescription: 'Authentic Japanese ramen in Kuala Lumpur.',
    }
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const features = findFeaturesBlock(result)
    expect(features).toBeDefined()

    const cards = features?.features as FeatureCard[]
    expect(Array.isArray(cards)).toBe(true)
    expect(cards.length).toBeGreaterThanOrEqual(2)

    // Each card title must MENTION the user product (case-insensitive substring).
    // Spec example: "Ramen Specialties / Fresh Sushi / Handmade Gyoza".
    const titlesLower = cards.map((c) => c.title.toLowerCase())
    expect(titlesLower.some((t) => t.includes('ramen'))).toBe(true)
    expect(titlesLower.some((t) => t.includes('sushi'))).toBe(true)
    expect(titlesLower.some((t) => t.includes('gyoza'))).toBe(true)
  })

  it('titles are the merchant product names themselves — no template claims like "Handmade"/"Signature" (#2103 A1)', () => {
    const info: BusinessInfoInput = {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen, sushi, gyoza',
      shortDescription: 'Japanese classics.',
    }
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards.slice(0, 3).map((c) => c.title)).toEqual(['Ramen', 'Sushi', 'Gyoza'])
  })

  it('capitalizes product name inside title template', () => {
    const info: BusinessInfoInput = {
      businessName: 'Laksa House',
      industry: 'restaurant',
      products: 'laksa, nasi lemak, teh tarik',
      shortDescription: 'Malaysian classics.',
    }
    const result = composeFallbackResult('malaysian restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards[0]!.title).toContain('Laksa')
    expect(cards[0]!.title).not.toBe('laksa') // capitalized
    expect(cards[1]!.title).toContain('Nasi lemak')
  })

  it('description is the merchant price when typed, else where to find it (no ingredient claims)', () => {
    const info: BusinessInfoInput = {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen RM18, sushi',
      shortDescription: 'Japanese food.',
    }
    const facts = buildGenerationFacts({ businessInfo: info })
    const result = runWithGenerationFacts(facts, () => composeFallbackResult('ramen restaurant', 42, 'en', info))
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards[0]!.description).toBe('RM 18')
    expect(cards[1]!.description).toBe('Available at Ramen Ichiban.')
    expect(JSON.stringify(cards)).not.toMatch(/ingredients|locally sourced|signature/i)
  })

  it('falls back to the claim-free trio when products < 2', () => {
    const info: BusinessInfoInput = {
      businessName: 'Solo Kitchen',
      industry: 'restaurant',
      products: 'coffee', // 1 item only
      shortDescription: 'Small kitchen.',
    }
    const result = composeFallbackResult('restaurant', 42, 'en', info)
    const features = findFeaturesBlock(result)
    expect(features).toBeDefined()
    const titles = ((features?.features as FeatureCard[]) ?? []).map((c) => c.title)
    expect(titles).toEqual(['Tell us what you need', 'Easy to reach', 'Made around you'])
  })

  it('falls back to the claim-free trio when products empty', () => {
    const info: BusinessInfoInput = {
      businessName: 'Empty Inputs',
      industry: 'restaurant',
      products: '',
      shortDescription: 'Nothing here.',
    }
    const result = composeFallbackResult('restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards.map((c) => c.title)).toEqual(['Tell us what you need', 'Easy to reach', 'Made around you'])
    expect(JSON.stringify(cards)).not.toMatch(/halal|jakim|delivery/i)
  })

  it('icons rotate from category-specific pool', () => {
    const info: BusinessInfoInput = {
      businessName: 'Laksa House',
      industry: 'restaurant',
      products: 'laksa, rendang, satay',
      shortDescription: 'Malaysian classics.',
    }
    const result = composeFallbackResult('malaysian restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    // Restaurant icons: Utensils, ChefHat, Flame, Soup, Pizza, Coffee
    const restaurantIcons = ['Utensils', 'ChefHat', 'Flame', 'Soup', 'Pizza', 'Coffee']
    for (const card of cards) {
      expect(restaurantIcons).toContain(card.icon)
    }
  })

  it('works across multiple categories', () => {
    // Ecommerce
    const ec = composeFallbackResult('fashion store', 42, 'en', {
      businessName: 'Chic Boutique',
      industry: 'ecommerce',
      products: 'dresses, bags, shoes',
      shortDescription: 'Fashion store.',
    })
    const ecCards = (findFeaturesBlock(ec)?.features as FeatureCard[]) ?? []
    const ecTitles = ecCards.map((c) => c.title.toLowerCase())
    expect(ecTitles.some((t) => t.includes('dresses'))).toBe(true)

    // Beauty
    const bt = composeFallbackResult('beauty salon', 42, 'en', {
      businessName: 'Glow Studio',
      industry: 'beauty',
      products: 'facials, nails, lashes',
      shortDescription: 'Beauty studio.',
    })
    const btCards = (findFeaturesBlock(bt)?.features as FeatureCard[]) ?? []
    const btTitles = btCards.map((c) => c.title.toLowerCase())
    expect(btTitles.some((t) => t.includes('facials'))).toBe(true)
  })
})

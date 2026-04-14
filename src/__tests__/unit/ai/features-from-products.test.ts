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
  it('emits product-derived cards when products.length >= 2', () => {
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

    const titles = cards.map((c) => c.title.toLowerCase())
    expect(titles).toContain('ramen')
    expect(titles).toContain('sushi')
  })

  it('capitalizes product titles', () => {
    const info: BusinessInfoInput = {
      businessName: 'Laksa House',
      industry: 'restaurant',
      products: 'laksa, nasi lemak, teh tarik',
      shortDescription: 'Malaysian classics.',
    }
    const result = composeFallbackResult('malaysian restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards[0]!.title).toBe('Laksa')
    expect(cards[1]!.title).toBe('Nasi lemak')
  })

  it('description uses category-tuned template with product name', () => {
    const info: BusinessInfoInput = {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen, sushi',
      shortDescription: 'Japanese food.',
    }
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards[0]!.description.toLowerCase()).toContain('ramen')
    // restaurant template has "from scratch with locally sourced ingredients"
    expect(cards[0]!.description.toLowerCase()).toContain('ingredients')
  })

  it('falls back to canned when products < 2', () => {
    const info: BusinessInfoInput = {
      businessName: 'Solo Kitchen',
      industry: 'restaurant',
      products: 'coffee', // 1 item only
      shortDescription: 'Small kitchen.',
    }
    // Use "restaurant" prompt to land on the restaurant blueprint (has features block)
    const result = composeFallbackResult('restaurant', 42, 'en', info)
    const features = findFeaturesBlock(result)
    expect(features).toBeDefined()
    const cards = (features?.features as FeatureCard[]) ?? []
    // Canned restaurant features: Authentic Recipes, Halal Certified, Fast Delivery
    const titles = cards.map((c) => c.title)
    const hasCanned = titles.some((t) =>
      ['Authentic Recipes', 'Halal Certified', 'Fast Delivery'].includes(t),
    )
    expect(hasCanned).toBe(true)
  })

  it('falls back to canned when products empty', () => {
    const info: BusinessInfoInput = {
      businessName: 'Empty Inputs',
      industry: 'restaurant',
      products: '',
      shortDescription: 'Nothing here.',
    }
    const result = composeFallbackResult('restaurant', 42, 'en', info)
    const cards = (findFeaturesBlock(result)?.features as FeatureCard[]) ?? []
    expect(cards.length).toBeGreaterThan(0)
    const titles = cards.map((c) => c.title)
    expect(titles).toContain('Authentic Recipes')
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
    expect(ecCards.map((c) => c.title.toLowerCase())).toContain('dresses')

    // Beauty
    const bt = composeFallbackResult('beauty salon', 42, 'en', {
      businessName: 'Glow Studio',
      industry: 'beauty',
      products: 'facials, nails, lashes',
      shortDescription: 'Beauty studio.',
    })
    const btCards = (findFeaturesBlock(bt)?.features as FeatureCard[]) ?? []
    expect(btCards.map((c) => c.title.toLowerCase())).toContain('facials')
  })
})

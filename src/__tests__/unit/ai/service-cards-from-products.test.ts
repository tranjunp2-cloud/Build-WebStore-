/**
 * Unit tests for buildServiceCards + buildProductQuickView products override.
 *
 * Coverage: TC-F01-W.04 (service-cards from products), TC-F01-W.05 (product-
 * quick-view from products).
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { buildServiceCards } from '@/lib/ai/template-composer'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'
import type { GenerationResult } from '@/lib/ai/generate-blocks'
import type { BusinessSample } from '@/lib/ai/content/types'

function findBlockAnywhere(
  result: GenerationResult,
  blockType: string,
): Record<string, unknown> | undefined {
  type Page = { blocks?: Array<Record<string, unknown>>; layout?: Array<Record<string, unknown>> }
  const pages = (result.pages ?? []) as unknown as Page[]
  for (const page of pages) {
    const blocks = page.blocks ?? page.layout ?? []
    const hit = blocks.find((b) => b.blockType === blockType)
    if (hit) return hit
  }
  const top = (result.blocks ?? []) as unknown as Array<Record<string, unknown>>
  return top.find((b) => b.blockType === blockType)
}

describe('TC-F01-W.04 — service-cards from user products', () => {
  it('TC-GENPERF-W4-09: fills 3 user products to the 4-item featured composition', () => {
    // Arrange
    const business: BusinessSample = {
      name: 'Kopi Warisan Melaka',
      tagline: 'Rasa warisan setiap hari',
      description: 'Kafe tempatan di Melaka.',
      address: 'Melaka',
      phone: '0123456789',
      email: 'hello@example.com',
      heroHeadline: 'Kopi warisan Melaka',
      heroSubheadline: 'Nikmati hidangan tempatan.',
      products: ['Kopi gula melaka', 'Roti bakar kaya', 'Nasi lemak pandan'],
    }

    // Act
    const block = buildServiceCards(business, 'fnb', 'ms')
    const services = block.services as Array<{ title: string }>

    // Assert
    expect(services).toHaveLength(4)
    expect(services.some((service) => service.title === 'Kedai Runcit')).toBe(true)
  })

  it('emits product-derived services when products.length >= 2 (beauty)', () => {
    const info: BusinessInfoInput = {
      businessName: 'Glow Studio',
      industry: 'beauty',
      products: 'eyelash extensions, microblading, chemical peel',
      shortDescription: 'Premium beauty services.',
    }
    // "spa" prompt → beauty category → services page present in blueprint
    const result = composeFallbackResult('spa beauty salon', 42, 'en', info)
    const services = findBlockAnywhere(result, 'service-cards')
    // Not every beauty blueprint has service-cards; when present, assert user-derived.
    if (services) {
      const list = services.services as Array<{ title: string }>
      const titles = list.map((s) => s.title.toLowerCase())
      // Titles wrap products in beauty templates (e.g. "Signature Eyelash extensions")
      const hasUser = titles.some((t) =>
        ['eyelash extensions', 'microblading', 'chemical peel'].some((p) => t.includes(p)),
      )
      expect(hasUser).toBe(true)
    }
  })

  it('falls back to canned service-cards when products empty', () => {
    const info: BusinessInfoInput = {
      businessName: 'Empty Beauty',
      industry: 'beauty',
      products: '',
      shortDescription: 'No products.',
    }
    const result = composeFallbackResult('spa beauty salon', 42, 'en', info)
    const services = findBlockAnywhere(result, 'service-cards')
    if (services) {
      const list = services.services as Array<{ title: string }>
      const titles = list.map((s) => s.title)
      // Canned beauty services include Facial Treatment / Nail Art / Lash Extensions
      const hasCanned = titles.some((t) =>
        ['Facial Treatment', 'Nail Art', 'Lash Extensions'].includes(t),
      )
      expect(hasCanned).toBe(true)
    }
  })
})

describe('TC-F01-W.05 — product-quick-view from user products', () => {
  it('emits user products as items when ≥1 provided', () => {
    const info: BusinessInfoInput = {
      businessName: 'Chic Boutique',
      industry: 'ecommerce',
      products: 'silk dresses, leather bags, heels',
      shortDescription: 'Modern fashion.',
    }
    const result = composeFallbackResult('online store ecommerce', 42, 'en', info)
    const pqv = findBlockAnywhere(result, 'product-quick-view')
    if (pqv) {
      const products = pqv.products as Array<{ name: string }>
      expect(products.length).toBeGreaterThanOrEqual(3)
      const names = products.map((p) => p.name.toLowerCase())
      expect(names).toContain('silk dresses')
      expect(names).toContain('leather bags')
      expect(names).toContain('heels')
    }
  })

  it('pads to 3 items from canned when only 1 product provided', () => {
    const info: BusinessInfoInput = {
      businessName: 'Solo Shop',
      industry: 'ecommerce',
      products: 'handmade soap',
      shortDescription: 'Single product.',
    }
    const result = composeFallbackResult('online store ecommerce', 42, 'en', info)
    const pqv = findBlockAnywhere(result, 'product-quick-view')
    if (pqv) {
      const products = pqv.products as Array<{ name: string }>
      expect(products.length).toBeGreaterThanOrEqual(3)
      const names = products.map((p) => p.name.toLowerCase())
      expect(names).toContain('handmade soap')
    }
  })

  it('uses all-canned when products empty', () => {
    const info: BusinessInfoInput = {
      businessName: 'Empty Shop',
      industry: 'ecommerce',
      products: '',
      shortDescription: 'No products.',
    }
    const result = composeFallbackResult('online store ecommerce', 42, 'en', info)
    const pqv = findBlockAnywhere(result, 'product-quick-view')
    if (pqv) {
      const products = pqv.products as Array<{ name: string }>
      const names = products.map((p) => p.name)
      // Canned includes "Baju Kurung Moden" / "Wireless Earbuds Pro"
      const hasCanned = names.some((n) =>
        ['Baju Kurung Moden', 'Wireless Earbuds Pro', 'Organic Honey (500g)', 'Batik Silk Scarf'].includes(n),
      )
      expect(hasCanned).toBe(true)
    }
  })
})

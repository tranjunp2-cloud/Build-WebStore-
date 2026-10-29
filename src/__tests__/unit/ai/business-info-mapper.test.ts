/**
 * Unit tests for business-info-mapper.
 *
 * Coverage: TC-F01-W.01 (mapper shape + parsing + normalization).
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import {
  mapBusinessInfo,
  parseProductsString,
  parseProducts,
  MAX_LISTED_PRODUCTS,
  dedupeNonEmpty,
  normalizePhone,
  normalizeEmail,
} from '@/lib/ai/business-info-mapper'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function baseInput(overrides: Partial<BusinessInfoInput> = {}): BusinessInfoInput {
  return {
    businessName: 'Ramen Ichiban',
    industry: 'restaurant',
    products: 'ramen, sushi, gyoza',
    shortDescription: 'Authentic Japanese ramen shop in KL.',
    ...overrides,
  }
}

describe('TC-F01-W.01 — mapBusinessInfo', () => {
  describe('parseProductsString', () => {
    it('splits comma-separated products', () => {
      expect(parseProductsString('ramen, sushi, gyoza')).toEqual(['ramen', 'sushi', 'gyoza'])
    })

    it('handles semicolons and newlines', () => {
      expect(parseProductsString('ramen; sushi\ngyoza')).toEqual(['ramen', 'sushi', 'gyoza'])
    })

    it('drops empty entries and trims whitespace', () => {
      expect(parseProductsString('ramen,  ,sushi,  gyoza  ')).toEqual(['ramen', 'sushi', 'gyoza'])
    })

    it('returns empty array for undefined/null/empty', () => {
      expect(parseProductsString(undefined)).toEqual([])
      expect(parseProductsString(null)).toEqual([])
      expect(parseProductsString('')).toEqual([])
      expect(parseProductsString('   ')).toEqual([])
    })
  })

  describe('dedupeNonEmpty', () => {
    it('dedupes case-insensitively, preserves first-seen casing', () => {
      expect(dedupeNonEmpty(['Ramen', 'ramen', 'SUSHI', 'sushi'])).toEqual(['Ramen', 'SUSHI'])
    })

    it('caps at 6 items', () => {
      const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      expect(dedupeNonEmpty(input)).toHaveLength(6)
      expect(dedupeNonEmpty(input)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    })

    it('drops blank entries', () => {
      expect(dedupeNonEmpty(['ramen', '', '  ', 'sushi'])).toEqual(['ramen', 'sushi'])
    })
  })

  describe('normalizePhone', () => {
    it('trims + collapses whitespace', () => {
      expect(normalizePhone('  +60  12 345  6789  ')).toBe('+60 12 345 6789')
    })

    it('returns undefined for empty or too-short input', () => {
      expect(normalizePhone(undefined)).toBeUndefined()
      expect(normalizePhone('')).toBeUndefined()
      expect(normalizePhone('12')).toBeUndefined()
    })
  })

  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(normalizeEmail('  HELLO@Example.COM  ')).toBe('hello@example.com')
    })

    it('returns undefined without @', () => {
      expect(normalizeEmail('not-an-email')).toBeUndefined()
      expect(normalizeEmail('')).toBeUndefined()
      expect(normalizeEmail(undefined)).toBeUndefined()
    })
  })

  describe('mapBusinessInfo — full shape', () => {
    it('maps all user-supplied fields', () => {
      const result = mapBusinessInfo(
        baseInput({
          phone: '+60 12-345 6789',
          email: 'HELLO@ramen.my',
          address: '123 Jalan Bukit Bintang, KL',
          tagline: 'Tokyo flavor in every bowl',
        }),
      )

      expect(result).toEqual({
        name: 'Ramen Ichiban',
        description: 'Authentic Japanese ramen shop in KL.',
        heroHeadline: 'Ramen Ichiban',
        heroSubheadline: 'Authentic Japanese ramen shop in KL.',
        tagline: 'Tokyo flavor in every bowl',
        phone: '+60 12-345 6789',
        email: 'hello@ramen.my',
        address: '123 Jalan Bukit Bintang, KL',
        products: ['ramen', 'sushi', 'gyoza'],
      })
    })

    it('derives tagline from description when explicit tagline missing', () => {
      const result = mapBusinessInfo(baseInput({ shortDescription: 'Short desc' }))
      expect(result.tagline).toBe('Short desc')
    })

    it('truncates long description to 117 chars + ellipsis when deriving tagline', () => {
      const long = 'x'.repeat(200)
      const result = mapBusinessInfo(baseInput({ shortDescription: long }))
      expect(result.tagline).toHaveLength(120)
      expect(result.tagline?.endsWith('...')).toBe(true)
    })

    it('omits undefined fields so canned fallback wins', () => {
      const result = mapBusinessInfo({
        businessName: 'Solo',
        industry: 'tech',
        products: '',
        shortDescription: '',
      })

      expect(result).toEqual({ name: 'Solo', heroHeadline: 'Solo' })
      expect('phone' in result).toBe(false)
      expect('email' in result).toBe(false)
      expect('address' in result).toBe(false)
      expect('products' in result).toBe(false)
      expect('description' in result).toBe(false)
      expect('tagline' in result).toBe(false)
      expect('heroSubheadline' in result).toBe(false)
    })

    it('omits empty products gracefully', () => {
      const result = mapBusinessInfo(baseInput({ products: '   ,  ,  ' }))
      expect(result.products).toBeUndefined()
    })

    it('dedupes and caps products', () => {
      const result = mapBusinessInfo(
        baseInput({ products: 'ramen, ramen, sushi, sushi, gyoza, udon, soba, tempura, takoyaki' }),
      )
      expect(result.products).toEqual(['ramen', 'sushi', 'gyoza', 'udon', 'soba', 'tempura'])
    })

    it('preserves canned fields by not emitting empty strings', () => {
      const result = mapBusinessInfo(
        baseInput({ phone: '', email: '   ', address: '', tagline: '' }),
      )
      expect(result.phone).toBeUndefined()
      expect(result.email).toBeUndefined()
      expect(result.address).toBeUndefined()
    })
  })
})


// ── #2103 A2 — paren-aware product list with prices ───────────────────────────
const ISSUE_INPUT = 'Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120'

describe('TC-AIAUD-006..009 — parseProducts (#2103 A2)', () => {
  it('TC-AIAUD-006: the issue input parses to 3 products with prices 65 / 48 / 120', () => {
    // Arrange / Act
    const products = parseProducts(ISSUE_INPUT)
    // Assert — commas inside (...) do not split; first price in parens is the default
    expect(products).toEqual([
      { name: 'Kek lapis', price: 65 },
      { name: 'kuih raya box', price: 48 },
      { name: 'birthday', price: 120, startingPrice: true },
    ])
  })

  it('TC-AIAUD-007: parseProductsString returns clean names only (no prices, no paren price groups)', () => {
    expect(parseProductsString(ISSUE_INPUT)).toEqual(['Kek lapis', 'kuih raya box', 'birthday'])
    // non-price parens stay part of the name
    expect(parseProductsString('Nasi lemak (large), teh tarik')).toEqual(['Nasi lemak (large)', 'teh tarik'])
  })

  it('TC-AIAUD-008: thousands separators, decimals, "-" and "@" separators and newlines', () => {
    expect(parseProducts('Sofa RM1,200; Cushion @ RM12.50\nLamp - RM 30')).toEqual([
      { name: 'Sofa', price: 1200 },
      { name: 'Cushion', price: 12.5 },
      { name: 'Lamp', price: 30 },
    ])
  })

  it('TC-AIAUD-009: no price → name only; duplicates dropped; capped at 20', () => {
    expect(parseProducts('ramen, Ramen, sushi')).toEqual([{ name: 'ramen' }, { name: 'sushi' }])
    const many = Array.from({ length: 30 }, (_, i) => `item ${i + 1}`).join(', ')
    expect(parseProducts(many)).toHaveLength(MAX_LISTED_PRODUCTS)
    expect(parseProducts('')).toEqual([])
    expect(parseProducts(undefined)).toEqual([])
  })
})

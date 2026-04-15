/**
 * Unit tests for deriveKeywords product injection + translation.
 *
 * Coverage:
 *   - TC-F01-W.06: ramen (English pass-through) → query contains "ramen"
 *   - TC-F01-W.06b: nasi lemak (Malay → English) → query contains "malaysian coconut rice"
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { deriveKeywords } from '@/lib/ai/image-keywords'

describe('TC-F01-W.06 — deriveKeywords products injection', () => {
  it('puts user product first when provided (English)', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['ramen', 'sushi'],
    })
    expect(keywords[0]).toBe('ramen')
    expect(keywords.join(' ')).toContain('ramen')
  })

  it('works for beauty category with English product', () => {
    const keywords = deriveKeywords('beauty', 'service-cards', {
      industry: 'beauty',
      products: ['microblading', 'facial'],
    })
    expect(keywords[0]).toBe('microblading')
  })

  it('falls back to category base when products empty', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: [],
    })
    expect(keywords[0]).not.toBe('')
    // base list for restaurant: restaurant interior / food plating / fine dining / asian cuisine
    const base = keywords[0]!
    expect(['restaurant interior', 'food plating', 'fine dining', 'asian cuisine']).toContain(base)
  })

  it('falls back to category base when products undefined', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
    })
    const base = keywords[0]!
    expect(['restaurant interior', 'food plating', 'fine dining', 'asian cuisine']).toContain(base)
  })
})

describe('TC-F01-W.06b — deriveKeywords Malay/Vietnamese product translation', () => {
  it('translates "nasi lemak" → "malaysian coconut rice"', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['nasi lemak', 'teh tarik'],
    })
    expect(keywords[0]).toBe('malaysian coconut rice')
    expect(keywords.join(' ')).toContain('malaysian coconut rice')
  })

  it('translates "phở" → "vietnamese pho noodle soup"', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['phở'],
    })
    expect(keywords[0]).toBe('vietnamese pho noodle soup')
  })

  it('translates "batik" → "batik fabric pattern" (retail)', () => {
    const keywords = deriveKeywords('ecommerce', 'product-card', {
      industry: 'ecommerce',
      products: ['batik'],
    })
    expect(keywords[0]).toBe('batik fabric pattern')
  })

  it('passes through unknown non-English terms', () => {
    const unknownTerm = 'cơm chiên dương châu'
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: [unknownTerm],
    })
    expect(keywords[0]).toBe(unknownTerm)
  })
})

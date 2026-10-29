/**
 * End-to-end fixture test for Phase 01 — User Data Threading.
 *
 * Walks the full fallback pipeline with concrete user input and asserts that
 * phone, email, products, and translated Unsplash keywords all land where
 * they should. Two fixtures: English (ramen) + Malay (nasi lemak).
 *
 * Coverage: TC-F01-W.08
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { deriveKeywords } from '@/lib/ai/image-keywords'
import { buildUserPrompt } from '@/lib/ai/system-prompt'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

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

describe('TC-F01-W.08 — user data threading e2e fixture', () => {
  describe('Ramen shop (English products + MY phone)', () => {
    const ramenInput: BusinessInfoInput = {
      businessName: 'Ramen Ichiban',
      industry: 'restaurant',
      products: 'ramen, sushi, gyoza',
      shortDescription: 'Authentic Japanese ramen and sushi in Kuala Lumpur.',
      phone: '+60 12-345 6789',
      email: 'hello@ramenichiban.my',
      address: '123 Jalan Bukit Bintang, 55100 KL',
      tagline: 'Tokyo flavor in every bowl',
    }

    it('composer emits features referencing user products', () => {
      const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInput)
      const features = findBlockAnywhere(result, 'features')
      expect(features).toBeDefined()
      const cards = features!.features as Array<{ title: string }>
      const titles = cards.map((c) => c.title.toLowerCase())
      // Titles wrap products in category-tuned templates:
      // "Ramen Specialties / Fresh Sushi / Handmade Gyoza"
      expect(titles.some((t) => t.includes('ramen'))).toBe(true)
      expect(titles.some((t) => t.includes('sushi'))).toBe(true)
      expect(titles.some((t) => t.includes('gyoza'))).toBe(true)
    })

    it('composer contact block has user phone + email + address verbatim', () => {
      const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInput)
      const contact = findBlockAnywhere(result, 'contact')
      expect(contact).toBeDefined()
      expect(contact!.phone).toBe('+60 12-345 6789')
      expect(contact!.email).toBe('hello@ramenichiban.my')
      expect(contact!.address).toBe('123 Jalan Bukit Bintang, 55100 KL')
    })

    it('siteName uses user-supplied business name', () => {
      const result = composeFallbackResult('ramen restaurant', 42, 'en', ramenInput)
      expect(result.siteName).toBe('Ramen Ichiban')
    })

    it('Unsplash keywords for hero block primary-inject "ramen"', () => {
      const keywords = deriveKeywords('restaurant', 'hero', {
        industry: 'restaurant',
        products: ['ramen', 'sushi', 'gyoza'],
      })
      expect(keywords[0]).toBe('ramen')
      expect(keywords.join(' ')).toContain('ramen')
    })

    it('AI happy-path prompt includes all user fields', () => {
      const prompt = buildUserPrompt(ramenInput, undefined, 'en')
      expect(prompt).toContain('Ramen Ichiban')
      expect(prompt).toContain('ramen, sushi, gyoza')
      expect(prompt).toContain('+60 12-345 6789')
      expect(prompt).toContain('hello@ramenichiban.my')
      expect(prompt).toContain('123 Jalan Bukit Bintang')
      expect(prompt).toContain('Tokyo flavor in every bowl')
    })
  })

  describe('Nasi Lemak shop (Malay products → translated Unsplash query)', () => {
    const nasiLemakInput: BusinessInfoInput = {
      businessName: 'Warung Mak Cik',
      industry: 'restaurant',
      products: 'nasi lemak, teh tarik, roti canai',
      shortDescription: 'Traditional Malaysian breakfast since 1985.',
      phone: '+60 11-222 3333',
      email: 'hi@warungmakcik.my',
    }

    it('Unsplash primary query translates "nasi lemak" → "malaysian coconut rice"', () => {
      const keywords = deriveKeywords('restaurant', 'hero', {
        industry: 'restaurant',
        products: ['nasi lemak', 'teh tarik', 'roti canai'],
      })
      expect(keywords[0]).toBe('malaysian coconut rice')
      expect(keywords.join(' ')).toContain('malaysian coconut rice')
    })

    it('composer preserves original Malay product names in features block', () => {
      // Composer SHOWS user the original term — translation is Unsplash-only.
      const result = composeFallbackResult('malaysian restaurant', 42, 'en', nasiLemakInput)
      const features = findBlockAnywhere(result, 'features')
      expect(features).toBeDefined()
      const cards = features!.features as Array<{ title: string }>
      const titles = cards.map((c) => c.title.toLowerCase())
      // Titles wrap Malay products in templates (e.g. "Nasi lemak Specialties").
      expect(titles.some((t) => t.includes('nasi lemak'))).toBe(true)
      expect(titles.some((t) => t.includes('teh tarik'))).toBe(true)
    })

    it('contact block has MY phone + email verbatim', () => {
      const result = composeFallbackResult('malaysian restaurant', 42, 'en', nasiLemakInput)
      const contact = findBlockAnywhere(result, 'contact')
      expect(contact!.phone).toBe('+60 11-222 3333')
      expect(contact!.email).toBe('hi@warungmakcik.my')
    })
  })

  describe('Empty input regression (no user data → canned content)', () => {
    const emptyInput: BusinessInfoInput = {
      businessName: 'Generic Restaurant',
      industry: 'restaurant',
      products: '',
      shortDescription: '',
    }

    it('still produces a valid site with canned content', () => {
      const result = composeFallbackResult('restaurant', 42, 'en', emptyInput)
      expect(result.siteName).toBe('Generic Restaurant')
      expect(result.pages.length).toBeGreaterThan(0)
      // Features block falls back to the claim-free trio (#2103 A1) — never "Halal Certified" & co.
      const features = findBlockAnywhere(result, 'features')
      if (features) {
        const cards = features.features as Array<{ title: string }>
        const titles = cards.map((c) => c.title)
        expect(titles).toEqual(['Tell us what you need', 'Easy to reach', 'Made around you'])
      }
    })

    it('Unsplash falls back to category base keywords when products empty', () => {
      const keywords = deriveKeywords('restaurant', 'hero', { industry: 'restaurant', products: [] })
      const base = keywords[0]!
      expect(['restaurant interior', 'food plating', 'fine dining', 'asian cuisine']).toContain(base)
    })
  })
})

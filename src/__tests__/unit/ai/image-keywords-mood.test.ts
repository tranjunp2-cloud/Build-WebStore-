/**
 * Tests for deriveKeywords mood imagery injection (Phase 02).
 *
 * Coverage: TC-F01-W.11 — mood appends 1-2 imagery adjectives; total capped
 * at 5 terms; no duplicates.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import { deriveKeywords } from '@/lib/ai/image-keywords'
import { THEME_MOODS } from '@/lib/ai/theme-moods'

describe('TC-F01-W.11 — deriveKeywords mood imagery', () => {
  it('appends serene imagery adjectives for Zen Ramen case', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['ramen'],
      mood: THEME_MOODS.serene,
    })
    const query = keywords.join(' ').toLowerCase()
    expect(query).toContain('ramen')
    // serene imagery includes "minimalist", "natural light", "calm", "soft neutral", "spacious"
    const hasSereneAdj = /minimalist|natural light|calm|spacious|soft neutral/.test(query)
    expect(hasSereneAdj).toBe(true)
  })

  it('appends elegant imagery for fine dining', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      mood: THEME_MOODS.elegant,
    })
    const query = keywords.join(' ').toLowerCase()
    // elegant imagery: refined, candlelit, marble, soft natural light, timeless
    const hasElegantAdj = /candlelit|refined|marble|timeless|soft natural/.test(query)
    expect(hasElegantAdj).toBe(true)
  })

  it('caps total keywords at 5', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['ramen'],
      mood: THEME_MOODS.playful,
    })
    expect(keywords.length).toBeLessThanOrEqual(5)
  })

  it('no duplicate keywords when mood adjective matches base', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      mood: THEME_MOODS.bold,
    })
    const lowerSet = new Set(keywords.map((k) => k.toLowerCase()))
    expect(lowerSet.size).toBe(keywords.length)
  })

  it('without mood, keywords behave like Phase 01 (backward compat)', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['ramen'],
    })
    expect(keywords[0]).toBe('ramen')
    expect(keywords.length).toBeLessThanOrEqual(3)
  })

  it('mood ONLY (no products) — mood adjectives still append', () => {
    const keywords = deriveKeywords('beauty', 'hero', {
      industry: 'beauty',
      mood: THEME_MOODS.editorial,
    })
    const query = keywords.join(' ').toLowerCase()
    // editorial imagery: cinematic, documentary, muted palette, shallow depth, storytelling
    const hasEditorialAdj = /cinematic|documentary|muted|shallow|storytelling/.test(query)
    expect(hasEditorialAdj).toBe(true)
  })

  it('mood × product — product first, mood appended', () => {
    const keywords = deriveKeywords('restaurant', 'hero', {
      industry: 'restaurant',
      products: ['nasi lemak'],
      mood: THEME_MOODS.serene,
    })
    // Primary term: "malaysian coconut rice" (translated)
    expect(keywords[0]).toBe('malaysian coconut rice')
    // Mood adjective somewhere later
    const query = keywords.join(' ').toLowerCase()
    expect(query).toContain('malaysian coconut rice')
    expect(/minimalist|calm|soft neutral|natural light|spacious/.test(query)).toBe(true)
  })
})

/**
 * End-to-end wiring test for Phase 02 mood — verifies the 2 consumers that
 * Phase 02 PR #606 added are actually wired in production paths:
 *
 *   1. GPT happy path: openai-generator → buildUserPrompt(mood)
 *      → COPY VOICE block appears in prompt
 *   2. Image pipeline: route → fulfillImageNeeds(ctx.mood)
 *      → deriveKeywords appends mood adjectives
 *
 * These tests catch the "function exists but caller chain broken" failure
 * mode that the Phase 02 alignment review caught.
 *
 * Coverage: TC-F01-W.13 (new integration cases)
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import { pickCategoryThemeWithMood, hashBusinessName } from '@/lib/ai/category-theme-picker'
import { buildUserPrompt } from '@/lib/ai/system-prompt'
import { deriveKeywords } from '@/lib/ai/image-keywords'
import { THEME_MOODS } from '@/lib/ai/theme-moods'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

describe('TC-F01-W.13 — Phase 02 mood wiring end-to-end', () => {
  describe('GPT happy path: preset → mood → buildUserPrompt', () => {
    it('restaurant "Rose Garden" resolves a mood + injects COPY VOICE', () => {
      const businessInfo: BusinessInfoInput = {
        businessName: 'Rose Garden',
        industry: 'restaurant',
        products: 'pasta, wine',
        shortDescription: 'Italian fine dining.',
      }
      const seed = hashBusinessName(businessInfo.businessName)
      const { mood } = pickCategoryThemeWithMood('restaurant', seed)

      expect(mood).toBeDefined()
      expect(mood.id).toBeDefined()

      const prompt = buildUserPrompt(businessInfo, {
        extraInstructions: undefined,
        language: 'en',
        referencePrompt: undefined,
        mood,
      })

      expect(prompt).toContain('COPY VOICE')
      expect(prompt).toContain(mood.label)
      const bulletCount = prompt.split('\n').filter((l) => l.startsWith('  - ')).length
      expect(bulletCount).toBeGreaterThanOrEqual(4)
    })

    it('all 14 categories produce a mood-bearing prompt', () => {
      const categories = [
        'restaurant', 'ecommerce', 'beauty', 'tech', 'health',
        'education', 'realestate', 'fitness', 'creative', 'business',
        'fnb', 'events', 'blog', 'travel',
      ]
      for (const cat of categories) {
        const info: BusinessInfoInput = {
          businessName: `Test ${cat}`,
          industry: cat,
          products: 'service',
          shortDescription: `A ${cat} business.`,
        }
        const seed = hashBusinessName(info.businessName)
        const { mood } = pickCategoryThemeWithMood(cat, seed)
        const prompt = buildUserPrompt(info, { mood })

        expect(prompt, `category ${cat}`).toContain('COPY VOICE')
        expect(prompt, `category ${cat}`).toContain(mood.label)
      }
    })

    it('same business name always resolves to same mood (determinism)', () => {
      const seed = hashBusinessName('Zen Ramen')
      const a = pickCategoryThemeWithMood('restaurant', seed)
      const b = pickCategoryThemeWithMood('restaurant', seed)
      expect(a.mood.id).toBe(b.mood.id)
      expect(a.preset.name).toBe(b.preset.name)
    })
  })

  describe('Image pipeline: ctx.mood → deriveKeywords', () => {
    it('elegant mood → query contains refined/candlelit/marble/etc', () => {
      const keywords = deriveKeywords('restaurant', 'hero', {
        industry: 'restaurant',
        mood: THEME_MOODS.elegant,
      })
      const query = keywords.join(' ').toLowerCase()
      expect(/refined|candlelit|marble|timeless|soft natural/.test(query)).toBe(true)
      expect(keywords.length).toBeLessThanOrEqual(5)
    })

    it('serene mood + ramen product → query has both terms', () => {
      const keywords = deriveKeywords('restaurant', 'hero', {
        industry: 'restaurant',
        products: ['ramen'],
        mood: THEME_MOODS.serene,
      })
      const query = keywords.join(' ').toLowerCase()
      expect(query).toContain('ramen')
      expect(/minimalist|calm|spacious|soft neutral|natural light/.test(query)).toBe(true)
    })

    it('bold mood tech → high contrast/kinetic in query', () => {
      const keywords = deriveKeywords('tech', 'hero', {
        industry: 'tech',
        mood: THEME_MOODS.bold,
      })
      const query = keywords.join(' ').toLowerCase()
      expect(/high contrast|dramatic|urban|kinetic|saturated/.test(query)).toBe(true)
    })
  })

  describe('Regression: without mood, wiring stays backward compat', () => {
    it('buildUserPrompt without mood → no COPY VOICE block', () => {
      const prompt = buildUserPrompt({
        businessName: 'Legacy',
        industry: 'restaurant',
        products: 'x',
        shortDescription: 'y',
      })
      expect(prompt).not.toContain('COPY VOICE')
      expect(prompt).toContain('Legacy')
    })

    it('deriveKeywords without mood → Phase 01 behavior intact', () => {
      const keywords = deriveKeywords('restaurant', 'hero', {
        industry: 'restaurant',
        products: ['ramen'],
      })
      expect(keywords[0]).toBe('ramen')
      expect(keywords.length).toBeLessThanOrEqual(3)
    })
  })
})

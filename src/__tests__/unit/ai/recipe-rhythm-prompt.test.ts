/**
 * Tests for buildUserPrompt RHYTHM injection (Phase 04).
 *
 * Coverage: TC-F01-W.19 — when recipe is supplied, prompt contains a
 * RHYTHM section with label, sequence, required blocks, rationale.
 * Replaces the legacy "Suggested block composition" generated from
 * CATEGORY_SIGNATURE_BLOCKS.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-04-layout-recipes.md
 */

import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from '@/lib/ai/system-prompt'
import { CATEGORY_RECIPES, pickRecipe, ALL_RECIPE_CATEGORIES } from '@/lib/ai/category-recipes'
import { THEME_MOODS } from '@/lib/ai/theme-moods'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function baseInfo(overrides: Partial<BusinessInfoInput> = {}): BusinessInfoInput {
  return {
    businessName: 'Ramen Ichiban',
    industry: 'restaurant',
    products: 'ramen, sushi, gyoza',
    shortDescription: 'Authentic Japanese ramen shop.',
    ...overrides,
  }
}

describe('TC-F01-W.19 — RHYTHM section injection', () => {
  it('injects RHYTHM header when recipe provided', () => {
    const recipe = CATEGORY_RECIPES.restaurant[0]!
    const prompt = buildUserPrompt(baseInfo(), { recipe })
    expect(prompt).toContain('RHYTHM:')
    expect(prompt).toContain(recipe.label)
    expect(prompt).toContain(recipe.rhythm)
  })

  it('prompt includes block sequence with arrow separators', () => {
    const recipe = CATEGORY_RECIPES.restaurant[1]! // rest-menu
    const prompt = buildUserPrompt(baseInfo(), { recipe })
    const expectedSequence = recipe.blocks.join(' → ')
    expect(prompt).toContain(expectedSequence)
  })

  it('lists required blocks explicitly', () => {
    const recipe = CATEGORY_RECIPES.beauty[0]!
    const prompt = buildUserPrompt(baseInfo({ industry: 'beauty' }), { recipe })
    for (const required of recipe.required) {
      expect(prompt).toContain(required)
    }
    expect(prompt).toMatch(/Required blocks/i)
  })

  it('includes rationale + hard-order instruction', () => {
    const recipe = CATEGORY_RECIPES.tech[2]! // tech-demo
    const prompt = buildUserPrompt(baseInfo({ industry: 'tech' }), { recipe })
    expect(prompt).toContain(recipe.description)
    expect(prompt).toMatch(/exact order/i)
  })

  it.each(ALL_RECIPE_CATEGORIES)('category "%s" produces RHYTHM section for all 3 recipes', (cat) => {
    for (const recipe of CATEGORY_RECIPES[cat]) {
      const prompt = buildUserPrompt(baseInfo({ industry: cat }), { recipe })
      expect(prompt).toContain('RHYTHM:')
      expect(prompt).toContain(recipe.label)
    }
  })

  it('recipe + mood together — both RHYTHM and COPY VOICE present', () => {
    const prompt = buildUserPrompt(baseInfo(), {
      recipe: CATEGORY_RECIPES.restaurant[0]!,
      mood: THEME_MOODS.elegant,
    })
    expect(prompt).toContain('COPY VOICE')
    expect(prompt).toContain('RHYTHM:')
    expect(prompt).toContain('Elegant')
  })

  it('without recipe, legacy composition hint path still works', () => {
    const prompt = buildUserPrompt(baseInfo())
    expect(prompt).not.toContain('RHYTHM:')
    // Legacy category hint may or may not fire depending on the industry match
    expect(prompt).toContain('Ramen Ichiban')
  })

  it('pickRecipe + buildUserPrompt end-to-end', () => {
    // Mimics what openai-generator does: picks recipe then builds prompt
    const info = baseInfo()
    const recipe = pickRecipe('restaurant', 42)
    const prompt = buildUserPrompt(info, { recipe })
    expect(prompt).toContain('RHYTHM:')
    expect(prompt).toContain(recipe.blocks[0]!) // hero
    expect(prompt).toContain(recipe.blocks[recipe.blocks.length - 1]!) // footer
  })

  it('different seeds produce different RHYTHM sections', () => {
    const info = baseInfo()
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const recipe = pickRecipe('restaurant', seed)
      const prompt = buildUserPrompt(info, { recipe })
      // Extract the label
      const match = prompt.match(/RHYTHM: ([^\n]+)/)
      if (match) seen.add(match[1]!)
    }
    // Should see all 3 recipes across 30 seeds
    expect(seen.size).toBe(3)
  })
})

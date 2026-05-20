/**
 * Coverage + invariant tests for category-recipes.ts.
 *
 * Coverage: TC-F01-W.18 (shape + non-empty + registry) — blocks CI merge
 * on any typo in a recipe blocks[] entry.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-04-layout-recipes.md
 */

import { describe, it, expect } from 'vitest'
import {
  CATEGORY_RECIPES,
  ALL_RECIPE_CATEGORIES,
  SUPPORTED_BLOCK_IDS,
  EXPECTED_RECIPE_COUNT,
  pickRecipe,
  getRecipesForCategory,
  isSupportedBlockId,
  type CategoryRecipe,
  type RecipeRhythm,
} from '@/lib/ai/category-recipes'

const VALID_RHYTHMS: RecipeRhythm[] = [
  'story-first',
  'menu-first',
  'gallery-first',
  'services-first',
  'portfolio-first',
  'team-first',
  'features-first',
  'social-proof-first',
  'demo-first',
]

describe('TC-F01-W.18 — category recipes coverage', () => {
  it('has exactly 14 categories', () => {
    expect(ALL_RECIPE_CATEGORIES).toHaveLength(14)
    expect(Object.keys(CATEGORY_RECIPES)).toHaveLength(14)
  })

  it('has exactly 42 recipes total (14 × 3)', () => {
    let count = 0
    for (const cat of ALL_RECIPE_CATEGORIES) {
      count += CATEGORY_RECIPES[cat].length
    }
    expect(count).toBe(42)
    expect(count).toBe(EXPECTED_RECIPE_COUNT)
  })

  it.each(ALL_RECIPE_CATEGORIES)('category "%s" has exactly 3 recipes', (cat) => {
    expect(CATEGORY_RECIPES[cat]).toHaveLength(3)
  })

  // Flatten into per-recipe tests so a typo shows which recipe fails.
  for (const category of ALL_RECIPE_CATEGORIES) {
    for (const recipe of CATEGORY_RECIPES[category]) {
      describe(`${category} × ${recipe.id}`, () => {
        it('has a valid rhythm enum', () => {
          expect(VALID_RHYTHMS).toContain(recipe.rhythm)
        })

        it('id is non-empty + lowercase + kebab-case', () => {
          expect(recipe.id).toMatch(/^[a-z][a-z0-9-]+$/)
        })

        it('label is non-empty', () => {
          expect(recipe.label.length).toBeGreaterThan(0)
        })

        it('description is meaningful (≥ 20 chars)', () => {
          expect(recipe.description.length).toBeGreaterThanOrEqual(20)
        })

        it('blocks array starts with hero and ends with footer', () => {
          expect(recipe.blocks[0]).toBe('hero')
          expect(recipe.blocks[recipe.blocks.length - 1]).toBe('footer')
        })

        it('blocks array has ≥ 5 entries', () => {
          expect(recipe.blocks.length).toBeGreaterThanOrEqual(5)
        })

        it('every blocks[] entry is a supported block id', () => {
          for (const blockId of recipe.blocks) {
            expect(
              SUPPORTED_BLOCK_IDS.has(blockId),
              `${recipe.id} references unknown block id "${blockId}"`,
            ).toBe(true)
          }
        })

        it('required is a subset of blocks and includes hero', () => {
          expect(recipe.required).toContain('hero')
          for (const req of recipe.required) {
            expect(recipe.blocks).toContain(req)
          }
        })

        it('middleShuffleRange is within bounds and excludes hero/footer', () => {
          const [start, end] = recipe.middleShuffleRange
          expect(start).toBeGreaterThanOrEqual(1) // never shuffle hero (0)
          expect(end).toBeLessThanOrEqual(recipe.blocks.length - 2) // never shuffle footer
          expect(end).toBeGreaterThanOrEqual(start)
        })
      })
    }
  }

  it('recipe ids are unique within a category', () => {
    for (const cat of ALL_RECIPE_CATEGORIES) {
      const ids = CATEGORY_RECIPES[cat].map((r) => r.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    }
  })

  it('every category has at least 2 distinct rhythms (variety)', () => {
    for (const cat of ALL_RECIPE_CATEGORIES) {
      const rhythms = new Set(CATEGORY_RECIPES[cat].map((r) => r.rhythm))
      expect(
        rhythms.size,
        `category "${cat}" has only ${rhythms.size} rhythm(s) — should be ≥ 2`,
      ).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('pickRecipe helper', () => {
  it('returns a recipe for a known category', () => {
    const recipe = pickRecipe('restaurant', 42)
    expect(recipe).toBeDefined()
    expect(recipe.blocks).toBeDefined()
  })

  it('same (category, seed) always returns same recipe (determinism)', () => {
    const a = pickRecipe('tech', 100)
    const b = pickRecipe('tech', 100)
    const c = pickRecipe('tech', 100)
    expect(a.id).toBe(b.id)
    expect(b.id).toBe(c.id)
  })

  it('different seeds rotate across all 3 recipes', () => {
    const picks = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      picks.add(pickRecipe('restaurant', seed).id)
    }
    expect(picks.size).toBe(3) // all 3 recipes should appear
  })

  it('unknown category falls back to business', () => {
    const recipe = pickRecipe('spaceship-repair', 0)
    expect(CATEGORY_RECIPES.business.map((r) => r.id)).toContain(recipe.id)
  })

  it('negative seeds are handled', () => {
    const recipe = pickRecipe('beauty', -42)
    expect(recipe).toBeDefined()
    expect(CATEGORY_RECIPES.beauty.map((r) => r.id)).toContain(recipe.id)
  })
})

describe('getRecipesForCategory helper', () => {
  it('returns 3 recipes for known category', () => {
    expect(getRecipesForCategory('restaurant')).toHaveLength(3)
  })

  it('falls back to business recipes for unknown', () => {
    expect(getRecipesForCategory('fake-cat')).toBe(CATEGORY_RECIPES.business)
  })
})

describe('isSupportedBlockId', () => {
  it('returns true for registered block types', () => {
    expect(isSupportedBlockId('hero')).toBe(true)
    expect(isSupportedBlockId('features')).toBe(true)
    expect(isSupportedBlockId('property-card')).toBe(false) // GH-1024 — hidden
  })

  it('returns false for unknown block types', () => {
    expect(isSupportedBlockId('fake-block')).toBe(false)
    expect(isSupportedBlockId('')).toBe(false)
  })
})

describe('rhythm distribution sanity', () => {
  it('across all 42 recipes, at least 6 different rhythms appear', () => {
    const allRhythms = new Set<RecipeRhythm>()
    for (const cat of ALL_RECIPE_CATEGORIES) {
      for (const recipe of CATEGORY_RECIPES[cat]) {
        allRhythms.add(recipe.rhythm)
      }
    }
    expect(allRhythms.size).toBeGreaterThanOrEqual(6)
  })

  it('no rhythm dominates more than 40% of recipes', () => {
    const counts: Record<string, number> = {}
    let total = 0
    for (const cat of ALL_RECIPE_CATEGORIES) {
      for (const recipe of CATEGORY_RECIPES[cat]) {
        counts[recipe.rhythm] = (counts[recipe.rhythm] ?? 0) + 1
        total++
      }
    }
    const maxCount = Math.max(...Object.values(counts))
    expect(maxCount / total).toBeLessThanOrEqual(0.4)
  })
})

/**
 * Unit Tests: AI Variety — Template Composer (Phase 05)
 * TC-IDs: TC-F01-V.22 → TC-F01-V.28
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { composeTemplate } from '@/lib/ai/template-composer'
import type { ComposerInput } from '@/lib/ai/template-composer'
import { RESTAURANT_PRESETS, BUSINESS_PRESETS } from '@/lib/ai/theme-presets'

// ── TC-F01-V.22: Different seeds → different hero variants ──────────────

describe('TC-F01-V.22: composeTemplate — seed-based variety', () => {
  it('should produce different variants with different compositionSeeds', () => {
    const inputA: ComposerInput = {
      category: 'restaurant',
      businessIndex: 0,
      variant: 'professional',
      themePreset: RESTAURANT_PRESETS[0]!,
      compositionSeed: 100,
    }
    const inputB: ComposerInput = {
      ...inputA,
      compositionSeed: 99999,
    }

    const resultA = composeTemplate(inputA)
    const resultB = composeTemplate(inputB)

    const heroA = resultA.pages[0]!.layout.find((b: any) => b.blockType === 'hero')
    const heroB = resultB.pages[0]!.layout.find((b: any) => b.blockType === 'hero')

    // At least hero variants OR block order should differ
    const variantsA = resultA.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`).join(',')
    const variantsB = resultB.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`).join(',')

    expect(variantsA !== variantsB || heroA?.variant !== heroB?.variant).toBe(true)
  })
})

// ── TC-F01-V.23: Same input → same output (reproducibility) ────────────

describe('TC-F01-V.23: composeTemplate — reproducibility', () => {
  it('should produce identical output for same compositionSeed', () => {
    const input: ComposerInput = {
      category: 'business',
      businessIndex: 1,
      variant: 'professional',
      themePreset: BUSINESS_PRESETS[1]!,
      compositionSeed: 42,
    }

    const r1 = composeTemplate(input)
    const r2 = composeTemplate(input)

    const blocks1 = r1.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`)
    const blocks2 = r2.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`)

    expect(blocks1).toEqual(blocks2)
  })
})

// ── TC-F01-V.24: No compositionSeed → backward compatible ──────────────

describe('TC-F01-V.24: composeTemplate — backward compat without seed', () => {
  it('should work without compositionSeed (legacy behavior)', () => {
    const input: ComposerInput = {
      category: 'restaurant',
      businessIndex: 0,
      variant: 'professional',
      themePreset: RESTAURANT_PRESETS[0]!,
      // NO compositionSeed
    }

    const result = composeTemplate(input)

    expect(result.pages.length).toBeGreaterThanOrEqual(1)
    expect(result.name).toBeTruthy()
    expect(result.category).toBe('restaurant')

    const homepage = result.pages[0]!
    const blockTypes = homepage.layout.map((b: any) => b.blockType)
    expect(blockTypes[0]).toBe('navigation')
    expect(blockTypes[blockTypes.length - 1]).toBe('footer')
  })

  it('should produce same output when called twice without seed', () => {
    const input: ComposerInput = {
      category: 'business',
      businessIndex: 0,
      variant: 'professional',
      themePreset: BUSINESS_PRESETS[0]!,
    }

    const r1 = composeTemplate(input)
    const r2 = composeTemplate(input)

    const blocks1 = r1.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`)
    const blocks2 = r2.pages[0]!.layout.map((b: any) => `${b.blockType}:${b.variant}`)

    expect(blocks1).toEqual(blocks2)
  })
})

// ── TC-F01-V.25: All blocks have variant field ──────────────────────────

describe('TC-F01-V.25: composeTemplate — all blocks have variant', () => {
  it('every block in homepage should have a variant string', () => {
    const input: ComposerInput = {
      category: 'restaurant',
      businessIndex: 0,
      variant: 'premium',
      themePreset: RESTAURANT_PRESETS[0]!,
      compositionSeed: 777,
    }

    const result = composeTemplate(input)
    const homepage = result.pages[0]!

    for (const block of homepage.layout) {
      const b = block as Record<string, unknown>
      if (b.blockType !== 'about') { // about uses 'layout' field instead of 'variant' in some cases
        expect(typeof b.variant).toBe('string')
        expect((b.variant as string).length).toBeGreaterThan(0)
      }
    }
  })
})

// ── TC-F01-V.26: businessIndex out of range → return null (Plan 260415 fix-500) ──

describe('TC-F01-V.26: composeTemplate — businessIndex out of range', () => {
  it('should return null so fallback chain degrades gracefully', () => {
    const input: ComposerInput = {
      category: 'restaurant',
      businessIndex: 999,
      variant: 'professional',
      themePreset: RESTAURANT_PRESETS[0]!,
    }

    expect(composeTemplate(input)).toBeNull()
  })
})

// ── TC-F01-V.27: Navigation first, footer last ─────────────────────────

describe('TC-F01-V.27: composeTemplate — structure invariants', () => {
  it('should always have navigation first and footer last', () => {
    const seeds = [0, 42, 100, 999, 12345]
    for (const seed of seeds) {
      const input: ComposerInput = {
        category: 'restaurant',
        businessIndex: 0,
        variant: 'professional',
        themePreset: RESTAURANT_PRESETS[0]!,
        compositionSeed: seed,
      }
      const result = composeTemplate(input)
      const blocks = result.pages[0]!.layout as Array<Record<string, unknown>>
      expect(blocks[0]!.blockType).toBe('navigation')
      expect(blocks[blocks.length - 1]!.blockType).toBe('footer')
    }
  })
})

// ── TC-F01-V.28: Features before stats ordering ────────────────────────

describe('TC-F01-V.28: composeTemplate — ordering constraints', () => {
  it('features should appear before stats when both present', () => {
    for (let seed = 0; seed < 10; seed++) {
      const input: ComposerInput = {
        category: 'business',
        businessIndex: 0,
        variant: 'professional',
        themePreset: BUSINESS_PRESETS[0]!,
        compositionSeed: seed * 1000,
      }
      const result = composeTemplate(input)
      const types = result.pages[0]!.layout.map((b: any) => b.blockType)
      const featIdx = types.indexOf('features')
      const statsIdx = types.indexOf('stats')
      if (featIdx >= 0 && statsIdx >= 0) {
        expect(featIdx).toBeLessThan(statsIdx)
      }
    }
  })
})

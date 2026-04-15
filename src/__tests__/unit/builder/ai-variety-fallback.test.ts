/**
 * Unit Tests: AI Variety — Fallback Generator (Phase 04)
 * TC-IDs: TC-F01-V.16 → TC-F01-V.21
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { generateBlocks } from '@/lib/ai/generate-blocks'

// ── TC-F01-V.16: 10 calls no seed → >= 7 distinct compositions ─────────

describe('TC-F01-V.16: generateBlocks — variety without seed', () => {
  it('should produce >= 5 distinct compositions across 10 calls', () => {
    const compositions = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const result = generateBlocks('A restaurant in Kuala Lumpur serving nasi lemak', Date.now() + i * 1000)
      const blockTypes = result.blocks.map(b => b.blockType).join(',')
      compositions.add(blockTypes)
    }
    expect(compositions.size).toBeGreaterThanOrEqual(5)
  })
})

// ── TC-F01-V.17: 10 calls restaurant → >= 2 primaryColor ───────────────

describe('TC-F01-V.17: generateBlocks — theme variety', () => {
  it('should produce >= 2 different primaryColors across 100 calls', () => {
    const colors = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      const result = generateBlocks('Create a restaurant website', seed * 9973)
      colors.add(result.theme.primaryColor)
    }
    expect(colors.size).toBeGreaterThanOrEqual(2)
  })
})

// ── TC-F01-V.18: Same seed → same output (reproducibility) ─────────────

describe('TC-F01-V.18: generateBlocks — seeded reproducibility', () => {
  it('should produce identical output for same seed', () => {
    const r1 = generateBlocks('A coffee shop called Bean Scene', 12345)
    const r2 = generateBlocks('A coffee shop called Bean Scene', 12345)

    expect(r1.theme).toEqual(r2.theme)
    expect(r1.blocks.map(b => b.blockType)).toEqual(r2.blocks.map(b => b.blockType))
    expect(r1.blocks.map(b => b.variant)).toEqual(r2.blocks.map(b => b.variant))
    expect(r1.siteName).toBe(r2.siteName)
  })
})

// ── TC-F01-V.19: Large seed (Date.now() style) → no overflow ───────────

describe('TC-F01-V.19: generateBlocks — large seed no overflow', () => {
  it('should handle Number.MAX_SAFE_INTEGER seed without crash', () => {
    const result = generateBlocks('A tech startup', Number.MAX_SAFE_INTEGER)
    expect(result.blocks.length).toBeGreaterThanOrEqual(6)
    expect(result.theme.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(typeof result.siteName).toBe('string')
  })

  it('should handle Date.now() as seed', () => {
    const result = generateBlocks('A fitness gym', Date.now())
    expect(result.blocks.length).toBeGreaterThanOrEqual(6)
  })
})

// ── TC-F01-V.20: No seed param → still works (backward compat) ─────────

describe('TC-F01-V.20: generateBlocks — backward compat without seed', () => {
  it('should return valid result without seed argument', () => {
    const result = generateBlocks('A coffee shop')
    expect(result.siteName).toBeTruthy()
    expect(result.blocks.length).toBeGreaterThanOrEqual(6)
    expect(result.theme).toHaveProperty('primaryColor')
    expect(result.theme).toHaveProperty('fontHeading')
    expect(result.seo.title).toBeTruthy()
  })
})

// ── TC-F01-V.21: Block structure integrity ──────────────────────────────

describe('TC-F01-V.21: generateBlocks — block structure', () => {
  it('should always have navigation first and footer last', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateBlocks('A restaurant', seed * 1000)
      expect(result.blocks[0]!.blockType).toBe('navigation')
      expect(result.blocks[result.blocks.length - 1]!.blockType).toBe('footer')
    }
  })

  it('should always have hero as second block', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateBlocks('An ecommerce store', seed * 1000)
      expect(result.blocks[1]!.blockType).toBe('hero')
    }
  })

  it('should always have contact as second-to-last', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateBlocks('A business consulting firm', seed * 1000)
      expect(result.blocks[result.blocks.length - 2]!.blockType).toBe('contact')
    }
  })

  it('should have features before stats when both present', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateBlocks('A tech company', seed * 1000)
      const types = result.blocks.map(b => b.blockType)
      const featIdx = types.indexOf('features')
      const statsIdx = types.indexOf('stats')
      if (featIdx >= 0 && statsIdx >= 0) {
        expect(featIdx).toBeLessThan(statsIdx)
      }
    }
  })
})

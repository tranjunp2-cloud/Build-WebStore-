import { describe, it, expect } from 'vitest'

import { TEMPLATE_DEFINITIONS } from '@/lib/ai/template-definitions'
import { categoryMap } from '@/lib/ai/content'

// ── TC-S3-010: Template definitions — ~48 entries across 11 categories ───

const ALL_CATEGORIES = [
  'restaurant', 'ecommerce', 'beauty', 'tech', 'health',
  'education', 'realestate', 'fitness', 'creative', 'business', 'fnb',
]

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

describe('[TC-S3-010] TEMPLATE_DEFINITIONS structure', () => {
  it('has approximately 48 entries (between 44 and 52)', () => {
    // Assert
    expect(TEMPLATE_DEFINITIONS.length).toBeGreaterThanOrEqual(44)
    expect(TEMPLATE_DEFINITIONS.length).toBeLessThanOrEqual(52)
  })

  it('all 11 categories are represented', () => {
    // Arrange
    const categories = new Set(TEMPLATE_DEFINITIONS.map((d) => d.category))

    // Assert
    for (const cat of ALL_CATEGORIES) {
      expect(categories.has(cat)).toBe(true)
    }
  })
})

describe('[TC-S3-010] Each definition has valid fields', () => {
  it('all definitions have valid category', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Assert
      expect(ALL_CATEGORIES).toContain(def.category)
    }
  })

  it('all definitions have valid businessIndex within range', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Arrange
      const content = categoryMap[def.category]

      // Assert
      expect(content).toBeDefined()
      expect(def.businessIndex).toBeGreaterThanOrEqual(0)
      expect(def.businessIndex).toBeLessThan(content!.businesses.length)
    }
  })

  it('all definitions have valid variant (starter/professional/premium)', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Assert
      expect(['starter', 'professional', 'premium']).toContain(def.variant)
    }
  })

  it('all definitions have themePreset with valid hex primaryColor', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Assert
      expect(def.themePreset).toBeDefined()
      expect(def.themePreset.primaryColor).toMatch(HEX_COLOR_REGEX)
    }
  })

  it('all definitions have themePreset with valid hex secondaryColor', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Assert
      expect(def.themePreset.secondaryColor).toMatch(HEX_COLOR_REGEX)
    }
  })

  it('all definitions have themePreset with valid hex accentColor', () => {
    for (const def of TEMPLATE_DEFINITIONS) {
      // Assert
      expect(def.themePreset.accentColor).toMatch(HEX_COLOR_REGEX)
    }
  })
})

describe('[TC-S3-010] Distribution across tiers', () => {
  it('has approximately 11 starter templates', () => {
    // Arrange
    const starters = TEMPLATE_DEFINITIONS.filter((d) => d.variant === 'starter')

    // Assert
    expect(starters.length).toBeGreaterThanOrEqual(9)
    expect(starters.length).toBeLessThanOrEqual(13)
  })

  it('has approximately 22 professional templates', () => {
    // Arrange
    const pros = TEMPLATE_DEFINITIONS.filter((d) => d.variant === 'professional')

    // Assert
    expect(pros.length).toBeGreaterThanOrEqual(18)
    expect(pros.length).toBeLessThanOrEqual(26)
  })

  it('has approximately 15 premium templates', () => {
    // Arrange
    const premiums = TEMPLATE_DEFINITIONS.filter((d) => d.variant === 'premium')

    // Assert
    expect(premiums.length).toBeGreaterThanOrEqual(11)
    expect(premiums.length).toBeLessThanOrEqual(19)
  })

  it('each category has at least 1 starter', () => {
    for (const cat of ALL_CATEGORIES) {
      // Arrange
      const starters = TEMPLATE_DEFINITIONS.filter(
        (d) => d.category === cat && d.variant === 'starter'
      )

      // Assert
      expect(starters.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('each category has at least 2 professional', () => {
    for (const cat of ALL_CATEGORIES) {
      // Arrange
      const pros = TEMPLATE_DEFINITIONS.filter(
        (d) => d.category === cat && d.variant === 'professional'
      )

      // Assert
      expect(pros.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('each category has at least 1 premium', () => {
    for (const cat of ALL_CATEGORIES) {
      // Arrange
      const premiums = TEMPLATE_DEFINITIONS.filter(
        (d) => d.category === cat && d.variant === 'premium'
      )

      // Assert
      expect(premiums.length).toBeGreaterThanOrEqual(1)
    }
  })
})

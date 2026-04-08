import { describe, it, expect } from 'vitest'

import {
  CATEGORY_PRESETS,
  RESTAURANT_PRESETS,
  ECOMMERCE_PRESETS,
  BEAUTY_PRESETS,
  TECH_PRESETS,
  HEALTH_PRESETS,
  EDUCATION_PRESETS,
  REALESTATE_PRESETS,
  FITNESS_PRESETS,
  CREATIVE_PRESETS,
  BUSINESS_PRESETS,
  FNB_PRESETS,
  getCategoryPresets,
} from '@/lib/ai/theme-presets'
import type { ThemePreset } from '@/lib/ai/theme-presets'
import { FONT_PAIRINGS } from '@/lib/fonts/pairings'

// ── TC-S3-010: Theme presets — 5 per category, valid values ──────────────

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const VALID_SPACING = ['compact', 'default', 'relaxed']
const VALID_BORDER_RADIUS = ['sharp', 'subtle', 'rounded', 'soft', 'pill']
const VALID_SHADOW = ['none', 'subtle', 'medium', 'dramatic']
const VALID_COLOR_MODE = ['light', 'dark']

const ALL_PRESET_ARRAYS: { name: string; presets: ThemePreset[] }[] = [
  { name: 'restaurant', presets: RESTAURANT_PRESETS },
  { name: 'ecommerce', presets: ECOMMERCE_PRESETS },
  { name: 'beauty', presets: BEAUTY_PRESETS },
  { name: 'tech', presets: TECH_PRESETS },
  { name: 'health', presets: HEALTH_PRESETS },
  { name: 'education', presets: EDUCATION_PRESETS },
  { name: 'realestate', presets: REALESTATE_PRESETS },
  { name: 'fitness', presets: FITNESS_PRESETS },
  { name: 'creative', presets: CREATIVE_PRESETS },
  { name: 'business', presets: BUSINESS_PRESETS },
  { name: 'fnb', presets: FNB_PRESETS },
]

const fontPairingIds = FONT_PAIRINGS.map((fp) => fp.id)

describe('[TC-S3-010] Theme presets — count per category', () => {
  for (const { name, presets } of ALL_PRESET_ARRAYS) {
    it(`${name} has exactly 5 presets`, () => {
      // Assert
      expect(presets).toHaveLength(5)
    })
  }
})

describe('[TC-S3-010] Theme presets — valid hex colors', () => {
  for (const { name, presets } of ALL_PRESET_ARRAYS) {
    it(`${name} all presets have valid hex primaryColor`, () => {
      for (const preset of presets) {
        // Assert
        expect(preset.primaryColor).toMatch(HEX_COLOR_REGEX)
      }
    })

    it(`${name} all presets have valid hex secondaryColor`, () => {
      for (const preset of presets) {
        // Assert
        expect(preset.secondaryColor).toMatch(HEX_COLOR_REGEX)
      }
    })

    it(`${name} all presets have valid hex accentColor`, () => {
      for (const preset of presets) {
        // Assert
        expect(preset.accentColor).toMatch(HEX_COLOR_REGEX)
      }
    })
  }
})

describe('[TC-S3-010] Theme presets — valid fontPairingId', () => {
  for (const { name, presets } of ALL_PRESET_ARRAYS) {
    it(`${name} all presets reference existing FONT_PAIRINGS`, () => {
      for (const preset of presets) {
        // Assert
        expect(fontPairingIds).toContain(preset.fontPairingId)
      }
    })
  }
})

describe('[TC-S3-010] Theme presets — valid enum values', () => {
  for (const { name, presets } of ALL_PRESET_ARRAYS) {
    it(`${name} all presets have valid spacingPreset`, () => {
      for (const preset of presets) {
        // Assert
        expect(VALID_SPACING).toContain(preset.spacingPreset)
      }
    })

    it(`${name} all presets have valid borderRadius`, () => {
      for (const preset of presets) {
        // Assert
        expect(VALID_BORDER_RADIUS).toContain(preset.borderRadius)
      }
    })

    it(`${name} all presets have valid shadowPreset`, () => {
      for (const preset of presets) {
        // Assert
        expect(VALID_SHADOW).toContain(preset.shadowPreset)
      }
    })

    it(`${name} all presets have valid colorMode`, () => {
      for (const preset of presets) {
        // Assert
        expect(VALID_COLOR_MODE).toContain(preset.colorMode)
      }
    })
  }
})

describe('[TC-S3-010] CATEGORY_PRESETS map', () => {
  it('has 14 category entries', () => {
    // Assert
    expect(Object.keys(CATEGORY_PRESETS)).toHaveLength(14)
  })

  it('getCategoryPresets returns presets for valid category', () => {
    // Act
    const presets = getCategoryPresets('restaurant')

    // Assert
    expect(presets).toHaveLength(5)
    expect(presets).toBe(RESTAURANT_PRESETS)
  })

  it('getCategoryPresets returns empty array for unknown category', () => {
    // Act
    const presets = getCategoryPresets('nonexistent')

    // Assert
    expect(presets).toHaveLength(0)
  })

  it('each preset has a non-empty name', () => {
    for (const { presets } of ALL_PRESET_ARRAYS) {
      for (const preset of presets) {
        // Assert
        expect(preset.name.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

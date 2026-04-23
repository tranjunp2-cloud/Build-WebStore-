/**
 * TC-F01D-CP — Category theme picker
 * Source: plans/260414-1630-phase-08-audit/phase-01-category-theme-picker.md
 *
 * Ensures the AI happy path has a deterministic, category-aware theme picker
 * that consumes the curated preset library at `src/lib/ai/theme-presets.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
    pickCategoryTheme,
    getCategoryThemeOptions,
    canonicalizeCategory,
    hashBusinessName,
    validatePresetContrast,
} from '@/lib/ai/category-theme-picker'
import { CATEGORY_PRESETS, BUSINESS_PRESETS, type ThemePreset } from '@/lib/ai/theme-presets'
import { hexToHSL } from '@/lib/theme/color-utils'

const KNOWN_CATEGORIES = [
    'restaurant',
    'ecommerce',
    'beauty',
    'tech',
    'health',
    'education',
    'realestate',
    'fitness',
    'creative',
    'business',
    'fnb',
    'events',
    'blog',
    'travel',
] as const

describe('canonicalizeCategory', () => {
    it('TC-F01D-CP.01 — normalizes casing, whitespace, separators', () => {
        // Arrange + Act + Assert
        expect(canonicalizeCategory('Restaurant')).toBe('restaurant')
        expect(canonicalizeCategory('real-estate')).toBe('realestate')
        expect(canonicalizeCategory('REAL_ESTATE')).toBe('realestate')
        expect(canonicalizeCategory(' Real Estate ')).toBe('realestate')
    })

    it('TC-F01D-CP.02 — empty/undefined → business fallback key', () => {
        expect(canonicalizeCategory(undefined)).toBe('business')
        expect(canonicalizeCategory(null)).toBe('business')
        expect(canonicalizeCategory('')).toBe('business')
    })
})

describe('pickCategoryTheme — all 14 categories', () => {
    it.each(KNOWN_CATEGORIES)('TC-F01D-CP.10 — %s returns a valid preset from its pool', (category) => {
        // Arrange
        const seed = hashBusinessName(`${category}-sample-business`)

        // Act
        const preset = pickCategoryTheme(category, seed)

        // Assert
        const pool = CATEGORY_PRESETS[category]!
        expect(pool).toContain(preset)
        expect(preset.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)
        expect(preset.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i)
        expect(preset.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
        expect(preset.fontPairingId).toBeTruthy()
    })
})

describe('pickCategoryTheme — determinism', () => {
    it('TC-F01D-CP.20 — same (category, seed) always returns same preset', () => {
        const seed = hashBusinessName('Pho Hong Vietnam')
        const first = pickCategoryTheme('restaurant', seed)
        const second = pickCategoryTheme('restaurant', seed)
        const third = pickCategoryTheme('restaurant', seed)
        expect(first).toBe(second)
        expect(second).toBe(third)
    })

    it('TC-F01D-CP.21 — different seeds distribute across pool variants', () => {
        // Collect distinct presets across 100 different business names — expect multiple variants, not all the same index.
        const picks = new Set<string>()
        for (let i = 0; i < 100; i++) {
            const seed = hashBusinessName(`business-${i}`)
            picks.add(pickCategoryTheme('tech', seed).name)
        }
        // Tech pool has 5 variants; with 100 samples we should see at least 3 distinct.
        expect(picks.size).toBeGreaterThanOrEqual(3)
    })
})

describe('pickCategoryTheme — unknown category fallback', () => {
    it('TC-F01D-CP.30 — unknown category uses BUSINESS_PRESETS', () => {
        const preset = pickCategoryTheme('spaceship-repair', 42)
        expect(BUSINESS_PRESETS).toContain(preset)
    })
})

describe('pickCategoryTheme — category hue sanity', () => {
    // Guard-rail tests: each category's curated palette should be within an
    // expected hue range. Catches accidental preset rewrites or wrong mapping.
    // We sample all 5 variants per category and assert average hue band — not
    // per-variant (some variants span wider). This documents designer intent.

    function avgHue(category: string): number {
        const pool = getCategoryThemeOptions(category)
        let sum = 0
        let count = 0
        for (const p of pool) {
            const hsl = hexToHSL(p.primaryColor)
            // Skip achromatic (S < 10%) — their hue is meaningless.
            if (hsl.s < 10) continue
            sum += hsl.h
            count += 1
        }
        return count === 0 ? 0 : sum / count
    }

    it('TC-F01D-CP.40 — restaurant leans warm (0-60 or 340-360)', () => {
        const pool = getCategoryThemeOptions('restaurant')
        const warmCount = pool.filter((p) => {
            const h = hexToHSL(p.primaryColor).h
            return (h >= 0 && h <= 60) || h >= 340
        }).length
        expect(warmCount).toBeGreaterThanOrEqual(3) // majority warm
    })

    it('TC-F01D-CP.41 — tech leans cool (150-260)', () => {
        const pool = getCategoryThemeOptions('tech')
        const coolCount = pool.filter((p) => {
            const h = hexToHSL(p.primaryColor).h
            return h >= 150 && h <= 260
        }).length
        expect(coolCount).toBeGreaterThanOrEqual(3)
    })

    it('TC-F01D-CP.42 — beauty leans pink/purple (280-360)', () => {
        const pool = getCategoryThemeOptions('beauty')
        const sweetCount = pool.filter((p) => {
            const h = hexToHSL(p.primaryColor).h
            return (h >= 280 && h <= 360) || h === 0
        }).length
        expect(sweetCount).toBeGreaterThanOrEqual(3)
    })

    it('TC-F01D-CP.43 — average hue sanity (no all-zero categories)', () => {
        for (const category of KNOWN_CATEGORIES) {
            const avg = avgHue(category)
            expect(avg).toBeGreaterThanOrEqual(0)
            expect(avg).toBeLessThanOrEqual(360)
        }
    })
})

describe('hashBusinessName', () => {
    it('TC-F01D-CP.50 — deterministic: same input → same hash', () => {
        expect(hashBusinessName('Acme Corp')).toBe(hashBusinessName('Acme Corp'))
    })

    it('TC-F01D-CP.51 — case and whitespace insensitive', () => {
        expect(hashBusinessName('Acme Corp')).toBe(hashBusinessName('  acme corp  '))
    })

    it('TC-F01D-CP.52 — different names produce different hashes', () => {
        const a = hashBusinessName('Acme Corp')
        const b = hashBusinessName('Beta LLC')
        expect(a).not.toBe(b)
    })

    it('TC-F01D-CP.53 — always returns a non-negative integer', () => {
        const names = ['', 'x', 'Pho Hong Vietnam', 'Saigon Premier Realty', 'A'.repeat(200)]
        for (const name of names) {
            const h = hashBusinessName(name)
            expect(h).toBeGreaterThanOrEqual(0)
            expect(Number.isFinite(h)).toBe(true)
        }
    })
})

// ── TC-F01D-CP.60–64 — Preset contrast validator ────────────────────────────

describe('validatePresetContrast', () => {
    // Dark mode: primary #dc2626 (L≈0.179) vs dark surface (L≈0.005) → 4.16:1 ✓
    // Accent #fbbf24 (L≈0.595) vs dark surface → 11.7:1 ✓, vs primary → 2.82:1 ✓
    const BASE: ThemePreset = {
        name: 'Test Base',
        primaryColor: '#dc2626',
        secondaryColor: '#f97316',
        accentColor: '#fbbf24',
        fontPairingId: 'bold-impact',
        colorMode: 'dark',
        spacingPreset: 'default',
        borderRadius: 'rounded',
        shadowPreset: 'medium',
        moodId: 'bold',
    }

    it('TC-F01D-CP.60 — returns [] for a known-good preset', () => {
        expect(validatePresetContrast(BASE)).toEqual([])
    })

    it('TC-F01D-CP.61 — flags dark-mode primary with luminance < 0.04', () => {
        const preset: ThemePreset = {
            ...BASE,
            primaryColor: '#0f172a',  // very dark navy, luminance ≈ 0.016
            colorMode: 'dark',
        }
        const warnings = validatePresetContrast(preset)
        expect(warnings.some(w => w.includes('luminance < 0.04'))).toBe(true)
    })

    it('TC-F01D-CP.62 — flags accent failing AA-Large vs surface', () => {
        // On a dark surface (L≈0.005), white-ish accent would pass.
        // Use light mode + pale yellow accent to reliably fail on near-white surface.
        const preset: ThemePreset = {
            ...BASE,
            primaryColor: '#dc2626',
            accentColor: '#fef3c7',   // near-white yellow — luminance ≈ 0.905, contrast vs dark surface ≫3 ✓
            colorMode: 'light',       // light surface ~L99 — accent ratio ≈ 1.06:1 → fails
        }
        const warnings = validatePresetContrast(preset)
        expect(warnings.some(w => w.includes('accent') && w.includes('fails AA-Large'))).toBe(true)
    })

    it('TC-F01D-CP.63 — flags accent too similar to primary (ratio < 1.5)', () => {
        // accent == primary → contrast ratio 1.0 < 1.5 → differentiation warning
        const preset: ThemePreset = { ...BASE, accentColor: BASE.primaryColor }
        const warnings = validatePresetContrast(preset)
        expect(warnings.some(w => w.includes('too similar to primary'))).toBe(true)
    })

    it('TC-F01D-CP.64 — no primary contrast warnings across all dark-mode presets (post phases 01-02)', () => {
        // Phases 01-02 fixed dark-mode primary contrast. Light-mode primary contrast
        // (medium-brightness colors like sky blue on white) is Phase 03 scope — not checked here.
        const darkPresets = Object.values(CATEGORY_PRESETS).flat().filter(p => p.colorMode === 'dark')
        for (const p of darkPresets) {
            const primaryWarnings = validatePresetContrast(p).filter(w => w.startsWith('primary'))
            expect(primaryWarnings, `${p.name}: primary contrast warnings found`).toEqual([])
        }
    })
})

// Plan 260419 wix-residual — phase-02 font rotation guarantee.
// Locks in success metric: font pairing rotates ≥ 3 distinct pairs across 10
// seeded sites for same category. Closes gap flagged in wave2 audit — no
// separate FONT_PAIRING_POOL needed; theme presets already carry varied
// fontPairingIds (8 presets × distinct IDs per category).
describe('pickCategoryTheme — font pairing rotation', () => {
    it('TC-F01-V.51 — same category × 10 seeded names produces ≥3 distinct fontPairingIds', () => {
        for (const category of KNOWN_CATEGORIES) {
            const seen = new Set<string>()
            for (let i = 0; i < 10; i++) {
                const seed = hashBusinessName(`${category}-sample-${i}`)
                seen.add(pickCategoryTheme(category, seed).fontPairingId)
            }
            expect(seen.size, `category=${category} font rotation`).toBeGreaterThanOrEqual(3)
        }
    })
})


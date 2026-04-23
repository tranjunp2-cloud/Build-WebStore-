/**
 * Unit Tests: Color Utils (Phase 03)
 * TC-IDs: TC-F01D-03.05 → TC-F01D-03.09
 * Convention: docs/TEST_CONVENTION.md
 * PRD: docs/prd/F01-design-quality.md (FR-08)
 */

import { describe, it, expect } from 'vitest'
import {
    isValidHex,
    hexToRGBString,
    tintNeutral,
    brandTintedDark,
    brandTintedLight,
    checkContrast,
    generatePalette,
    validateThemeColors,
    type SemanticPalette,
    type ContrastResult,
} from '@/lib/theme/color-utils'
import { hexToHSL } from '@/lib/theme/resolve'

describe('isValidHex', () => {
    it('accepts #rrggbb format', () => {
        expect(isValidHex('#0ea5e9')).toBe(true)
        expect(isValidHex('#000000')).toBe(true)
        expect(isValidHex('#FFFFFF')).toBe(true)
    })

    it('rejects invalid formats', () => {
        expect(isValidHex('0ea5e9')).toBe(false)       // no #
        expect(isValidHex('#0ea5e')).toBe(false)       // 5 chars
        expect(isValidHex('#0ea5e99')).toBe(false)     // 7 chars
        expect(isValidHex('#ggggg9')).toBe(false)      // non-hex chars
        expect(isValidHex('not-a-color')).toBe(false)
        expect(isValidHex('')).toBe(false)
    })
})

describe('hexToRGBString', () => {
    it('converts sky blue to comma-separated RGB', () => {
        expect(hexToRGBString('#0ea5e9')).toBe('14, 165, 233')
    })

    it('returns 0, 0, 0 for invalid hex', () => {
        expect(hexToRGBString('invalid')).toBe('0, 0, 0')
    })

    it('handles black and white', () => {
        expect(hexToRGBString('#000000')).toBe('0, 0, 0')
        expect(hexToRGBString('#ffffff')).toBe('255, 255, 255')
    })
})

describe('tintNeutral', () => {
    it('preserves brand hue with low saturation', () => {
        const result = tintNeutral('#0ea5e9', 95)
        // Should be near-white (lightness ~95) but with sky-blue hue hint
        const { s, l } = hexToHSL(result)
        expect(s).toBeLessThanOrEqual(10)  // low saturation
        expect(l).toBeGreaterThanOrEqual(90)  // near-white
        expect(l).toBeLessThanOrEqual(100)
    })

    it('preserves hue across light/dark lightness', () => {
        // At extreme lightness (95, 8) + low saturation (6%), HSL round-trip
        // loses precision — use a mid-saturation brand so round-trip is stable.
        const brand = '#0ea5e9'
        const brandHue = hexToHSL(brand).h
        const light = tintNeutral(brand, 80)
        const dark = tintNeutral(brand, 20)
        // Precision -1 = within ±5 degrees (HSL round-trip tolerance at low saturation)
        expect(hexToHSL(light).h).toBeCloseTo(brandHue, -1)
        expect(hexToHSL(dark).h).toBeCloseTo(brandHue, -1)
    })

    it('clamps lightness to valid range', () => {
        const result = tintNeutral('#0ea5e9', 150)
        const { l } = hexToHSL(result)
        expect(l).toBeLessThanOrEqual(100)
    })

    it('returns safe fallback for invalid hex', () => {
        expect(tintNeutral('not-hex', 50)).toBe('#f5f5f5')
    })
})

describe('brandTintedDark / brandTintedLight', () => {
    it('brandTintedDark never returns pure #000000', () => {
        const result = brandTintedDark('#0ea5e9')
        expect(result).not.toBe('#000000')
        const { l } = hexToHSL(result)
        expect(l).toBeGreaterThan(0)
        expect(l).toBeLessThan(20)
    })

    it('brandTintedLight never returns pure #ffffff', () => {
        const result = brandTintedLight('#0ea5e9')
        expect(result).not.toBe('#ffffff')
        const { l } = hexToHSL(result)
        expect(l).toBeGreaterThan(90)
        expect(l).toBeLessThan(100)
    })

    it('both preserve some saturation (not pure gray)', () => {
        // Contract: tinted dark/light should have non-zero saturation so the
        // result reads as brand-tinted, not pure gray. Exact hue preservation
        // is lossy at extreme lightness + low saturation — we only assert the
        // output is NOT fully desaturated.
        const brand = '#d946ef'  // magenta
        expect(hexToHSL(brandTintedDark(brand)).s).toBeGreaterThan(0)
        expect(hexToHSL(brandTintedLight(brand)).s).toBeGreaterThan(0)
    })

    it('safe fallback for invalid input', () => {
        expect(brandTintedDark('invalid')).toBe('#0f0f14')
        expect(brandTintedLight('invalid')).toBe('#fafafa')
    })
})

describe('checkContrast', () => {
    it('pure black on white returns ratio 21', () => {
        const result = checkContrast('#000000', '#ffffff')
        expect(result.ratio).toBe(21)
        expect(result.passAA).toBe(true)
        expect(result.passAALarge).toBe(true)
        expect(result.passAAA).toBe(true)
    })

    it('same color returns ratio 1', () => {
        const result = checkContrast('#888888', '#888888')
        expect(result.ratio).toBe(1)
        expect(result.passAA).toBe(false)
        expect(result.passAALarge).toBe(false)
    })

    it('is commutative (fg/bg order does not matter)', () => {
        const a = checkContrast('#000000', '#ffffff')
        const b = checkContrast('#ffffff', '#000000')
        expect(a.ratio).toBe(b.ratio)
    })

    it('passes AA at 4.5:1 boundary', () => {
        // #767676 on white = ~4.54:1
        const result = checkContrast('#767676', '#ffffff')
        expect(result.ratio).toBeGreaterThanOrEqual(4.5)
        expect(result.passAA).toBe(true)
    })

    it('passes AA Large at 3:1 but fails AA', () => {
        // #949494 on white = ~3.03:1 (pass large, fail normal)
        const result = checkContrast('#949494', '#ffffff')
        expect(result.ratio).toBeGreaterThanOrEqual(3)
        expect(result.ratio).toBeLessThan(4.5)
        expect(result.passAA).toBe(false)
        expect(result.passAALarge).toBe(true)
    })

    it('safe fallback for invalid hex', () => {
        const result = checkContrast('not-hex', '#ffffff')
        expect(result.ratio).toBe(1)
        expect(result.passAA).toBe(false)
    })
})

describe('generatePalette', () => {
    it('light mode produces full SemanticPalette shape', () => {
        const palette: SemanticPalette = generatePalette('#0ea5e9', 'light')
        expect(palette.accent).toBe('#0ea5e9')
        expect(palette.accentHover).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.accentRgb).toBe('14, 165, 233')
        expect(palette.surface.primary).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.surface.secondary).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.surface.card).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.text.primary).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.text.secondary).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.text.inverse).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.text.muted).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.border).toMatch(/^#[0-9a-f]{6}$/)
        expect(palette.divider).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('dark mode produces distinct surface values from light mode', () => {
        const light = generatePalette('#0ea5e9', 'light')
        const dark = generatePalette('#0ea5e9', 'dark')
        expect(light.surface.primary).not.toBe(dark.surface.primary)
        expect(light.text.primary).not.toBe(dark.text.primary)
    })

    it('light mode text-primary passes WCAG AA against surface-primary', () => {
        const palette = generatePalette('#0ea5e9', 'light')
        const contrast = checkContrast(palette.text.primary, palette.surface.primary)
        expect(contrast.passAA).toBe(true)
    })

    it('dark mode text-primary passes WCAG AA against surface-primary', () => {
        const palette = generatePalette('#0ea5e9', 'dark')
        const contrast = checkContrast(palette.text.primary, palette.surface.primary)
        expect(contrast.passAA).toBe(true)
    })

    it('accent preserves input brand color exactly', () => {
        const palette = generatePalette('#d946ef', 'light')
        expect(palette.accent).toBe('#d946ef')
    })

    it('invalid brand hex falls back to default sky blue', () => {
        const palette = generatePalette('not-hex', 'light')
        expect(palette.accent).toBe('#0ea5e9')
    })

    it('light mode surface-primary is lighter than surface-card (60-30-10 hierarchy)', () => {
        const palette = generatePalette('#0ea5e9', 'light')
        const primaryL = hexToHSL(palette.surface.primary).l
        const cardL = hexToHSL(palette.surface.card).l
        expect(primaryL).toBeGreaterThan(cardL)
    })

    it('dark mode surface-primary is darker than surface-card (60-30-10 hierarchy)', () => {
        const palette = generatePalette('#0ea5e9', 'dark')
        const primaryL = hexToHSL(palette.surface.primary).l
        const cardL = hexToHSL(palette.surface.card).l
        expect(primaryL).toBeLessThan(cardL)
    })

    it('surfaces have brand-tinted hue (not pure gray)', () => {
        // Verify saturation > 0 instead of exact hue match —
        // at light 99 + sat 6, HSL round-trip drops hue precision.
        const palette = generatePalette('#0ea5e9', 'light')
        const surfaceHSL = hexToHSL(palette.surface.card)  // card has more room
        expect(surfaceHSL.s).toBeGreaterThan(0)  // not pure gray
    })

    it('text-primary is never pure black in light mode', () => {
        const palette = generatePalette('#0ea5e9', 'light')
        expect(palette.text.primary).not.toBe('#000000')
    })

    it('text-primary is never pure white in dark mode', () => {
        const palette = generatePalette('#0ea5e9', 'dark')
        expect(palette.text.primary).not.toBe('#ffffff')
    })
})

// TC-F01D-03.10 → TC-F01D-03.13 — dark-mode contrast regression guards
describe('generatePalette — dark mode contrast (TC-F01D-03.10–03.13)', () => {
    // #6366f1 (H=239 indigo) is the worst-case hue for divider contrast — included as regression guard
    const BRAND_HUES = ['#dc2626', '#16a34a', '#0ea5e9', '#eab308', '#d946ef', '#6366f1']

    it('TC-F01D-03.10 — dark divider passes WCAG AA-Large vs surface.primary (all hues)', () => {
        BRAND_HUES.forEach(brand => {
            const p = generatePalette(brand, 'dark')
            const result = checkContrast(p.divider, p.surface.primary)
            expect(result.passAALarge).toBe(true)
        })
    })

    it('TC-F01D-03.11 — dark border passes WCAG AA-Large vs surface.primary (all hues)', () => {
        BRAND_HUES.forEach(brand => {
            const p = generatePalette(brand, 'dark')
            const result = checkContrast(p.border, p.surface.primary)
            expect(result.passAALarge).toBe(true)
        })
    })

    it('TC-F01D-03.12 — dark border is lighter than divider (visual hierarchy)', () => {
        BRAND_HUES.forEach(brand => {
            const p = generatePalette(brand, 'dark')
            const dividerL = hexToHSL(p.divider).l
            const borderL = hexToHSL(p.border).l
            expect(borderL).toBeGreaterThan(dividerL)
        })
    })

    it('TC-F01D-03.13 — light mode divider is lighter than dark mode divider (no light/dark swap)', () => {
        // Non-regression: dark-mode fix must not accidentally affect light mode branch.
        // Light divider (L=90) always lighter than dark divider (L=40) → different branches intact.
        BRAND_HUES.forEach(brand => {
            const light = generatePalette(brand, 'light')
            const dark  = generatePalette(brand, 'dark')
            const lightDividerL = hexToHSL(light.divider).l
            const darkDividerL  = hexToHSL(dark.divider).l
            expect(lightDividerL).toBeGreaterThan(darkDividerL)
        })
    })
})

describe('validateThemeColors', () => {
    it('flags pure black text', () => {
        const warnings = validateThemeColors({ textColor: '#000000', backgroundColor: '#ffffff' })
        expect(warnings.some(w => w.includes('pure black text'))).toBe(true)
    })

    it('flags pure black background', () => {
        const warnings = validateThemeColors({ textColor: '#fafafa', backgroundColor: '#000000' })
        expect(warnings.some(w => w.includes('pure black background'))).toBe(true)
    })

    it('flags low-contrast combinations', () => {
        const warnings = validateThemeColors({ textColor: '#aaaaaa', backgroundColor: '#ffffff' })
        expect(warnings.some(w => w.includes('fails WCAG AA'))).toBe(true)
    })

    it('returns empty array for safe combinations', () => {
        const warnings = validateThemeColors({
            textColor: '#0f0f14',
            backgroundColor: '#fafafa',
            primaryColor: '#0ea5e9',
        })
        expect(warnings).toEqual([])
    })

    it('flags white on white', () => {
        const warnings = validateThemeColors({ textColor: '#ffffff', backgroundColor: '#ffffff' })
        expect(warnings.some(w => w.includes('white on white'))).toBe(true)
    })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    resolveTheme,
    generateThemeCSS,
    hexToHSL,
    hslToHex,
    lightenHex,
    SPACING_PRESETS,
    RADIUS_PRESETS,
    SHADOW_PRESETS,
} from '@/lib/theme/resolve'
import { ThemeConfigSchema } from '@/blocks/types'

// ── TC-S1-005: resolveTheme() backward compat — v1 site (dark mode) ────────
describe('[TC-S1-005] resolveTheme() backward compat — legacy v1 site (dark mode)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('derives all missing tokens from primaryColor + secondaryColor + dark mode', () => {
        // Arrange
        const v1Config = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            colorMode: 'dark' as const,
        }

        // Act
        const result = resolveTheme(v1Config)

        // Assert — derived tokens for dark mode
        expect(result.primaryColor).toBe('#0ea5e9')
        expect(result.secondaryColor).toBe('#d946ef')
        expect(result.accentColor).toBe(lightenHex('#0ea5e9', 15))
        expect(result.surfaceColor).toBe('#111111')
        expect(result.textColor).toBe('#fafafa')
        expect(result.mutedColor).toBe('#a1a1aa')
        expect(result.spacingPreset).toBe('default')
        expect(result.borderRadius).toBe('rounded')
        expect(result.shadowPreset).toBe('subtle')
        expect(result.colorMode).toBe('dark')
        expect(result.backgroundColor).toBe('#09090b')
    })

    it('result passes ThemeConfigSchema Zod validation', () => {
        // Arrange
        const v1Config = { primaryColor: '#0ea5e9', secondaryColor: '#d946ef', colorMode: 'dark' as const }

        // Act
        const result = resolveTheme(v1Config)
        const validation = ThemeConfigSchema.safeParse(result)

        // Assert
        expect(validation.success).toBe(true)
    })
})

// ── TC-S1-006: resolveTheme() backward compat — v1 site (light mode) ───────
describe('[TC-S1-006] resolveTheme() backward compat — v1 site (light mode)', () => {
    it('derives light-mode surface/text/muted colors', () => {
        // Arrange
        const v1Config = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            colorMode: 'light' as const,
        }

        // Act
        const result = resolveTheme(v1Config)

        // Assert — light mode specific derivations
        expect(result.surfaceColor).toBe('#f8f8f8')
        expect(result.textColor).toBe('#09090b')
        expect(result.mutedColor).toBe('#71717a')
        expect(result.backgroundColor).toBe('#ffffff')
    })
})

// ── TC-S1-007: resolveTheme() with completely empty input ───────────────────
describe('[TC-S1-007] resolveTheme() with completely empty input', () => {
    it('returns complete ThemeConfig with all defaults, no undefined/NaN', () => {
        // Act
        const result = resolveTheme({})

        // Assert — all fields present and valid
        expect(result.primaryColor).toBe('#0ea5e9')
        expect(result.secondaryColor).toBe('#d946ef')
        expect(result.accentColor).toBeTruthy()
        expect(result.surfaceColor).toBeTruthy()
        expect(result.textColor).toBeTruthy()
        expect(result.mutedColor).toBeTruthy()
        expect(result.fontHeading).toBeTruthy()
        expect(result.fontBody).toBeTruthy()
        expect(result.spacingPreset).toBe('default')
        expect(result.borderRadius).toBe('rounded')
        expect(result.shadowPreset).toBe('subtle')
        expect(result.colorMode).toBe('dark')
        expect(result.backgroundColor).toBeTruthy()

        // No undefined or NaN
        const values = Object.values(result)
        values.forEach((val) => {
            if (typeof val === 'string') {
                expect(val).not.toBe('NaN')
                expect(val).not.toBe('undefined')
            }
            expect(val).not.toBeUndefined()
        })
    })

    it('empty input result passes Zod validation', () => {
        // Act
        const result = resolveTheme({})
        const validation = ThemeConfigSchema.safeParse(result)

        // Assert
        expect(validation.success).toBe(true)
    })
})

// ── TC-S1-008: accentColor derived from primaryColor (lighten 15%) ──────────
describe('[TC-S1-008] resolveTheme() accentColor derivation', () => {
    it('derives accentColor by lightening primaryColor 15%', () => {
        // Arrange
        const config = { primaryColor: '#0ea5e9' }

        // Act
        const result = resolveTheme(config)

        // Assert
        const expected = lightenHex('#0ea5e9', 15)
        expect(result.accentColor).toBe(expected)
    })

    it('preserves explicit accentColor when provided', () => {
        // Arrange
        const config = { primaryColor: '#0ea5e9', accentColor: '#ff0000' }

        // Act
        const result = resolveTheme(config)

        // Assert
        expect(result.accentColor).toBe('#ff0000')
    })
})

// ── TC-S1-009: Legacy fonts preserved when no fontPairingId ─────────────────
describe('[TC-S1-009] resolveTheme() legacy fonts preserved when no fontPairingId', () => {
    it('preserves fontHeading and fontBody when fontPairingId not set', () => {
        // Arrange
        const config = {
            primaryColor: '#0ea5e9',
            fontHeading: 'Outfit',
            fontBody: 'Inter',
        }

        // Act
        const result = resolveTheme(config)

        // Assert
        expect(result.fontHeading).toBe('Outfit')
        expect(result.fontBody).toBe('Inter')
        expect(result.fontPairingId).toBeNull()
    })
})

// ── TC-S1-010: fontPairingId resolves to correct fonts ──────────────────────
describe('[TC-S1-010] resolveTheme() fontPairingId resolves to correct fonts', () => {
    it('editorial pairing resolves to Playfair Display + Lora', () => {
        // Arrange
        const config = { fontPairingId: 'editorial' }

        // Act
        const result = resolveTheme(config)

        // Assert
        expect(result.fontHeading).toBe('Playfair Display')
        expect(result.fontBody).toBe('Lora')
    })

    it('fontPairingId=null uses default fonts (Outfit + Inter)', () => {
        // Arrange
        const config = { fontPairingId: null }

        // Act
        const result = resolveTheme(config)

        // Assert
        expect(result.fontHeading).toBe('Outfit')
        expect(result.fontBody).toBe('Inter')
    })

    it('unknown fontPairingId falls back to default fonts', () => {
        // Arrange
        const config = { fontPairingId: 'nonexistent-pairing-xyz' }

        // Act
        const result = resolveTheme(config)

        // Assert
        expect(result.fontHeading).toBe('Outfit')
        expect(result.fontBody).toBe('Inter')
    })
})

// ── generateThemeCSS — produces all 24 CSS variables ────────────────────────
describe('[TC-S1-003] generateThemeCSS() produces all CSS variables', () => {
    it('generates all 24 CSS custom properties', () => {
        // Arrange
        const theme = resolveTheme({
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            colorMode: 'dark',
        })

        // Act
        const css = generateThemeCSS(theme)

        // Assert — 7 color vars
        expect(css).toContain('--brand-primary: #0ea5e9')
        expect(css).toContain('--brand-secondary: #d946ef')
        expect(css).toContain('--brand-accent:')
        expect(css).toContain('--surface:')
        expect(css).toContain('--text:')
        expect(css).toContain('--muted:')
        expect(css).toContain('--background:')

        // RGB variants
        expect(css).toContain('--brand-primary-rgb:')
        expect(css).toContain('--brand-secondary-rgb:')
        expect(css).toContain('--brand-accent-rgb:')

        // Typography
        expect(css).toContain('--font-heading:')
        expect(css).toContain('--font-body:')

        // Spacing (7 vars)
        expect(css).toContain('--space-xs:')
        expect(css).toContain('--space-sm:')
        expect(css).toContain('--space-md:')
        expect(css).toContain('--space-lg:')
        expect(css).toContain('--space-xl:')
        expect(css).toContain('--space-2xl:')
        expect(css).toContain('--section-padding:')

        // Shape (7 vars)
        expect(css).toContain('--radius-sm:')
        expect(css).toContain('--radius-md:')
        expect(css).toContain('--radius-lg:')
        expect(css).toContain('--radius-full:')
        expect(css).toContain('--shadow-sm:')
        expect(css).toContain('--shadow-md:')
        expect(css).toContain('--shadow-lg:')
    })

    it('uses correct spacing values for default preset', () => {
        // Arrange
        const theme = resolveTheme({ spacingPreset: 'default' })

        // Act
        const css = generateThemeCSS(theme)

        // Assert
        expect(css).toContain(`--space-xs: ${SPACING_PRESETS.default.xs}`)
        expect(css).toContain(`--space-md: ${SPACING_PRESETS.default.md}`)
        expect(css).toContain(`--section-padding: ${SPACING_PRESETS.default.section}`)
    })

    it('uses correct spacing values for compact preset', () => {
        // Arrange
        const theme = resolveTheme({ spacingPreset: 'compact' })

        // Act
        const css = generateThemeCSS(theme)

        // Assert
        expect(css).toContain(`--section-padding: ${SPACING_PRESETS.compact.section}`)
    })

    it('uses correct radius values for rounded preset', () => {
        // Arrange
        const theme = resolveTheme({ borderRadius: 'rounded' })

        // Act
        const css = generateThemeCSS(theme)

        // Assert
        expect(css).toContain(`--radius-sm: ${RADIUS_PRESETS.rounded.sm}`)
        expect(css).toContain(`--radius-md: ${RADIUS_PRESETS.rounded.md}`)
        expect(css).toContain(`--radius-lg: ${RADIUS_PRESETS.rounded.lg}`)
    })

    it('uses correct shadow values for subtle preset', () => {
        // Arrange
        const theme = resolveTheme({ shadowPreset: 'subtle' })

        // Act
        const css = generateThemeCSS(theme)

        // Assert
        expect(css).toContain(`--shadow-sm: ${SHADOW_PRESETS.subtle.sm}`)
        expect(css).toContain(`--shadow-md: ${SHADOW_PRESETS.subtle.md}`)
        expect(css).toContain(`--shadow-lg: ${SHADOW_PRESETS.subtle.lg}`)
    })

    it('wraps output in :root selector', () => {
        // Arrange
        const theme = resolveTheme({})

        // Act
        const css = generateThemeCSS(theme)

        // Assert
        expect(css).toMatch(/^:root\s*\{/)
        expect(css).toContain('}')
    })
})

// ── TC-S1-014: Spacing preset visual difference ───────────────────────────────
describe('[TC-S1-014] SPACING_PRESETS structure and visual difference', () => {
    it('compact, default, relaxed all have the 7 required size keys', () => {
        const required = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'section']
        for (const preset of ['compact', 'default', 'relaxed'] as const) {
            expect(Object.keys(SPACING_PRESETS[preset])).toEqual(expect.arrayContaining(required))
        }
    })

    it('compact section=3rem is smaller than default section=5rem', () => {
        expect(SPACING_PRESETS.compact.section).toBe('3rem')
        expect(SPACING_PRESETS.default.section).toBe('5rem')
    })

    it('relaxed section=7rem is larger than default section=5rem', () => {
        expect(SPACING_PRESETS.relaxed.section).toBe('7rem')
        expect(SPACING_PRESETS.default.section).toBe('5rem')
    })

    it('generateThemeCSS reflects compact section-padding=3rem', () => {
        const css = generateThemeCSS(resolveTheme({ spacingPreset: 'compact' }))
        expect(css).toContain('--section-padding: 3rem')
    })

    it('generateThemeCSS reflects relaxed section-padding=7rem', () => {
        const css = generateThemeCSS(resolveTheme({ spacingPreset: 'relaxed' }))
        expect(css).toContain('--section-padding: 7rem')
    })
})

// ── TC-S1-015: Border radius preset visual difference ─────────────────────────
describe('[TC-S1-015] RADIUS_PRESETS structure and visual difference', () => {
    it('all 5 presets have the 4 required size keys', () => {
        const required = ['sm', 'md', 'lg', 'full']
        for (const preset of ['sharp', 'subtle', 'rounded', 'soft', 'pill'] as const) {
            expect(Object.keys(RADIUS_PRESETS[preset])).toEqual(expect.arrayContaining(required))
        }
    })

    it('sharp preset is all zeros', () => {
        const { sm, md, lg, full } = RADIUS_PRESETS.sharp
        expect(sm).toBe('0')
        expect(md).toBe('0')
        expect(lg).toBe('0')
        expect(full).toBe('0')
    })

    it('pill preset is all 9999px', () => {
        const { sm, md, lg, full } = RADIUS_PRESETS.pill
        expect(sm).toBe('9999px')
        expect(md).toBe('9999px')
        expect(lg).toBe('9999px')
        expect(full).toBe('9999px')
    })

    it('generateThemeCSS reflects sharp radius — radius-sm is 0', () => {
        const css = generateThemeCSS(resolveTheme({ borderRadius: 'sharp' }))
        expect(css).toContain('--radius-sm: 0')
    })
})

// ── TC-S1-016: Shadow preset applied ─────────────────────────────────────────
describe('[TC-S1-016] SHADOW_PRESETS structure and application', () => {
    it('all 4 presets have the 3 required size keys', () => {
        const required = ['sm', 'md', 'lg']
        for (const preset of ['none', 'subtle', 'medium', 'dramatic'] as const) {
            expect(Object.keys(SHADOW_PRESETS[preset])).toEqual(expect.arrayContaining(required))
        }
    })

    it('none preset is all "none"', () => {
        expect(SHADOW_PRESETS.none.sm).toBe('none')
        expect(SHADOW_PRESETS.none.md).toBe('none')
        expect(SHADOW_PRESETS.none.lg).toBe('none')
    })

    it('dramatic has stronger opacity than subtle', () => {
        // dramatic lg uses rgba(0,0,0,0.3), subtle lg uses rgba(0,0,0,0.1)
        expect(SHADOW_PRESETS.dramatic.lg).toContain('0.3')
        expect(SHADOW_PRESETS.subtle.lg).toContain('0.1')
    })

    it('generateThemeCSS reflects none shadow — shadow-sm is none', () => {
        const css = generateThemeCSS(resolveTheme({ shadowPreset: 'none' }))
        expect(css).toContain('--shadow-sm: none')
    })
})

// ── generateThemeCSS additional edge cases ────────────────────────────────────
describe('generateThemeCSS — additional edge cases', () => {
    it('correctly renders RGB breakdown for #0ea5e9 as 14, 165, 233', () => {
        // #0e=14, #a5=165, #e9=233
        const theme = resolveTheme({ primaryColor: '#0ea5e9' })
        const css = generateThemeCSS(theme)
        expect(css).toContain('--brand-primary-rgb: 14, 165, 233')
    })

    it('invalid accentColor falls back to "0, 0, 0" in RGB variant', () => {
        // hexToRGB inside generateThemeCSS returns "0, 0, 0" for non-6-char hex
        const theme = resolveTheme({})
        const css = generateThemeCSS({ ...theme, accentColor: 'invalid' })
        expect(css).toContain('--brand-accent-rgb: 0, 0, 0')
    })

    it('font names are wrapped in single quotes in CSS output', () => {
        const theme = resolveTheme({ fontPairingId: 'editorial' })
        const css = generateThemeCSS(theme)
        expect(css).toContain("--font-heading: 'Playfair Display'")
        expect(css).toContain("--font-body: 'Lora'")
    })

    it('output count contains at least 26 CSS variable declarations', () => {
        const css = generateThemeCSS(resolveTheme({}))
        const count = (css.match(/--[a-z]/g) || []).length
        // 7 colors + 3 rgb + 2 fonts + 7 spacing + 4 radius + 3 shadow = 26
        expect(count).toBeGreaterThanOrEqual(26)
    })
})

// ── resolveTheme — XSS via Zod validation boundary ───────────────────────────
describe('[TC-S1-008] XSS prevention via ThemeConfigSchema', () => {
    it('ThemeConfigSchema rejects script tag in primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '<script>alert(1)</script>' })
        expect(result.success).toBe(false)
    })

    it('ThemeConfigSchema rejects CSS injection in primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '#fff; --evil: url(//evil.com)' })
        expect(result.success).toBe(false)
    })

    it('ThemeConfigSchema rejects "transparent" as primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: 'transparent' })
        expect(result.success).toBe(false)
    })

    it('ThemeConfigSchema rejects empty string primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '' })
        expect(result.success).toBe(false)
    })

    it('ThemeConfigSchema rejects 3-digit shorthand #FFF', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '#FFF' })
        expect(result.success).toBe(false)
    })
})

// ── hslToHex — out-of-range and round-trip ────────────────────────────────────
describe('hslToHex — out-of-range values and round-trip', () => {
    it('hue=370 wraps same as hue=10', () => {
        expect(hslToHex(370, 50, 50)).toBe(hslToHex(10, 50, 50))
    })

    it('hue=720 wraps same as hue=0', () => {
        expect(hslToHex(720, 0, 50)).toBe(hslToHex(0, 0, 50))
    })

    it('saturation=200 clamps to same as saturation=100', () => {
        expect(hslToHex(0, 200, 50)).toBe(hslToHex(0, 100, 50))
    })

    it('lightness=200 clamps to same as lightness=100 (#ffffff)', () => {
        expect(hslToHex(0, 0, 200)).toBe('#ffffff')
    })

    it('saturation=-50 clamps to same as saturation=0', () => {
        expect(hslToHex(120, -50, 50)).toBe(hslToHex(120, 0, 50))
    })

    it('round-trip hexToHSL → hslToHex produces valid 6-char hex', () => {
        const original = '#7c3aed'
        const { h, s, l } = hexToHSL(original)
        const roundTrip = hslToHex(h, s, l)
        expect(roundTrip).toMatch(/^#[0-9a-f]{6}$/)
    })
})

// ── resolveTheme — additional font pairing coverage ───────────────────────────
describe('resolveTheme — additional font pairings', () => {
    it('startup-vibe pairing resolves to Outfit + DM Sans', () => {
        const theme = resolveTheme({ fontPairingId: 'startup-vibe' })
        expect(theme.fontHeading).toBe('Outfit')
        expect(theme.fontBody).toBe('DM Sans')
    })

    it('fontPairingId is stored as-is on the result', () => {
        const theme = resolveTheme({ fontPairingId: 'editorial' })
        expect(theme.fontPairingId).toBe('editorial')
    })

    it('explicit fontHeading/fontBody override pairing resolution', () => {
        const theme = resolveTheme({
            fontPairingId: 'editorial',
            fontHeading: 'Override Font',
            fontBody: 'Override Body',
        })
        expect(theme.fontHeading).toBe('Override Font')
        expect(theme.fontBody).toBe('Override Body')
    })
})

// ── hexToHSL — additional invalid input coverage ──────────────────────────────
describe('hexToHSL — additional invalid input coverage', () => {
    it('returns fallback for bare color name "red"', () => {
        expect(hexToHSL('red')).toEqual({ h: 0, s: 0, l: 50 })
    })

    it('returns fallback for "transparent"', () => {
        expect(hexToHSL('transparent')).toEqual({ h: 0, s: 0, l: 50 })
    })

    it('handles uppercase hex correctly (case-insensitive)', () => {
        const lower = hexToHSL('#0ea5e9')
        const upper = hexToHSL('#0EA5E9')
        expect(upper.h).toBeCloseTo(lower.h, 3)
        expect(upper.s).toBeCloseTo(lower.s, 3)
        expect(upper.l).toBeCloseTo(lower.l, 3)
    })

    it('exercises green-dominant path (max===g) — pure green #00ff00 hue ~120', () => {
        // Forces the max === g branch in hexToHSL (line 30)
        const result = hexToHSL('#00ff00')
        expect(result.h).toBeCloseTo(120, 0)
        expect(result.s).toBeCloseTo(100, 0)
        expect(result.l).toBeCloseTo(50, 0)
    })

    it('exercises blue-dominant path (max===b) — pure blue #0000ff hue ~240', () => {
        // Forces the max === b branch in hexToHSL (line 31)
        const result = hexToHSL('#0000ff')
        expect(result.h).toBeCloseTo(240, 0)
        expect(result.s).toBeCloseTo(100, 0)
        expect(result.l).toBeCloseTo(50, 0)
    })

    it('exercises red-dominant wraparound path (max===r, g<b) — magenta-ish #ff0080 hue ~330', () => {
        // Forces the (g < b ? 6 : 0) true branch in hexToHSL line 29
        // #ff0080: r=255(max), g=0, b=128 — red dominant AND green < blue → adds 6 for wraparound
        const result = hexToHSL('#ff0080')
        expect(result.h).toBeGreaterThan(300)
        expect(result.h).toBeLessThan(360)
        expect(result.s).toBeCloseTo(100, 0)
    })
})

// ── hexToHSL / hslToHex / lightenHex edge cases ────────────────────────────
describe('Color utility edge cases', () => {
    describe('hexToHSL', () => {
        it('returns default { h:0, s:0, l:50 } for invalid hex', () => {
            // Act & Assert
            expect(hexToHSL('not-a-hex')).toEqual({ h: 0, s: 0, l: 50 })
            expect(hexToHSL('')).toEqual({ h: 0, s: 0, l: 50 })
            expect(hexToHSL('#fff')).toEqual({ h: 0, s: 0, l: 50 }) // 3-char hex not supported
        })

        it('converts pure white correctly', () => {
            // Act
            const result = hexToHSL('#ffffff')

            // Assert
            expect(result.l).toBe(100)
            expect(result.s).toBe(0)
        })

        it('converts pure black correctly', () => {
            // Act
            const result = hexToHSL('#000000')

            // Assert
            expect(result.l).toBe(0)
            expect(result.s).toBe(0)
        })

        it('converts a known color correctly', () => {
            // Act — pure red
            const result = hexToHSL('#ff0000')

            // Assert
            expect(result.h).toBe(0)
            expect(result.s).toBe(100)
            expect(result.l).toBe(50)
        })
    })

    describe('hslToHex', () => {
        it('converts h=0, s=0, l=100 to white (#ffffff)', () => {
            expect(hslToHex(0, 0, 100)).toBe('#ffffff')
        })

        it('converts h=0, s=0, l=0 to black (#000000)', () => {
            expect(hslToHex(0, 0, 0)).toBe('#000000')
        })

        it('handles negative hue by wrapping around', () => {
            // -30 degrees should be equivalent to 330 degrees
            const result = hslToHex(-30, 100, 50)
            const expected = hslToHex(330, 100, 50)
            expect(result).toBe(expected)
        })

        it('clamps saturation and lightness to 0-100 range', () => {
            // Should not throw, should clamp
            const result = hslToHex(0, 150, 150)
            expect(result).toMatch(/^#[0-9a-f]{6}$/)
        })
    })

    describe('lightenHex', () => {
        it('returns original hex for invalid input', () => {
            expect(lightenHex('not-a-hex', 15)).toBe('not-a-hex')
        })

        it('does not exceed lightness of 100', () => {
            // White lightened should stay white
            const result = lightenHex('#ffffff', 50)
            expect(result).toBe('#ffffff')
        })

        it('lightens a color by the specified percentage', () => {
            // Arrange
            const original = '#0ea5e9'
            const originalHSL = hexToHSL(original)

            // Act
            const result = lightenHex(original, 15)
            const resultHSL = hexToHSL(result)

            // Assert — lightness should increase
            expect(resultHSL.l).toBeGreaterThan(originalHSL.l)
        })
    })
})

// ── Pipeline Integration: resolveTheme → generateThemeCSS → Zod valid ───────
describe('[TC-S1-PIPELINE] Full theme pipeline integration', () => {
    it('resolveTheme output always passes ThemeConfigSchema validation', () => {
        // Arrange — various partial inputs
        const partials = [
            {},
            { primaryColor: '#ff0000' },
            { primaryColor: '#0ea5e9', colorMode: 'light' as const },
            { fontPairingId: 'editorial' },
            { spacingPreset: 'compact' as const, borderRadius: 'pill' as const },
            { primaryColor: '#16a34a', secondaryColor: '#facc15', colorMode: 'dark' as const, spacingPreset: 'relaxed' as const },
        ]

        for (const partial of partials) {
            // Act
            const resolved = resolveTheme(partial)
            const zodResult = ThemeConfigSchema.safeParse(resolved)

            // Assert
            expect(zodResult.success).toBe(true)
        }
    })

    it('resolveTheme → generateThemeCSS produces valid CSS for any partial input', () => {
        // Arrange
        const partials = [
            {},
            { primaryColor: '#dc2626', colorMode: 'dark' as const },
            { fontPairingId: 'bold-impact', spacingPreset: 'compact' as const },
        ]

        for (const partial of partials) {
            // Act
            const resolved = resolveTheme(partial)
            const css = generateThemeCSS(resolved)

            // Assert — CSS is well-formed
            expect(css).toMatch(/^:root \{/)
            expect(css).toContain('--brand-primary:')
            expect(css).toContain('--surface:')
            expect(css).toContain('--section-padding:')
            expect(css).toContain('--radius-sm:')
            expect(css).toContain('--shadow-sm:')
            // No undefined or NaN in CSS output
            expect(css).not.toContain('undefined')
            expect(css).not.toContain('NaN')
        }
    })
})

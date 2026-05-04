/**
 * Unit Tests: Typography + Font Pairings (Phase 02)
 * TC-IDs: TC-F01D-02.01 → TC-F01D-02.08
 * Convention: docs/TEST_CONVENTION.md
 * PRD: docs/prd/F01-design-quality.md (FR-03, FR-04, FR-05)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import {
    TYPE_SCALE,
    LINE_HEIGHT,
    FONT_WEIGHT,
    MAX_PROSE,
} from '@/lib/design-tokens'
import { Heading, Body, Caption, Display } from '@/blocks/shared/Typography'
import {
    FONT_PAIRINGS,
    BLOCKED_PAIRINGS,
    isBlockedPairing,
    validateFontPairing,
    validateFontPairingObject,
    getFontPairing,
    FONT_CSS_VAR_MAP,
    fontNameToCSSVar,
} from '@/lib/fonts/pairings'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import type { HeadingLevel } from '@/blocks/shared/Typography'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('Typography tokens (Phase 02)', () => {
    describe('TC-F01D-02.01: TYPE_SCALE modular 1.25 ratio', () => {
        it('exports 8 type levels (display → small)', () => {
            const keys = Object.keys(TYPE_SCALE)
            expect(keys).toEqual(['display', 'h1', 'h2', 'h3', 'h4', 'body', 'bodyLg', 'small'])
        })

        it('body text is text-base (16px) — NEVER below', () => {
            expect(TYPE_SCALE.body).toBe('text-base')
        })

        it('display + h1 are responsive (md: breakpoint)', () => {
            expect(TYPE_SCALE.display).toMatch(/md:/)
            expect(TYPE_SCALE.h1).toMatch(/md:/)
        })

        it('LINE_HEIGHT, FONT_WEIGHT, MAX_PROSE all defined', () => {
            expect(LINE_HEIGHT.display).toBe('leading-[1.1]')
            expect(LINE_HEIGHT.body).toBe('leading-[1.6]')
            expect(FONT_WEIGHT.heading).toBe('font-bold')
            expect(FONT_WEIGHT.body).toBe('font-normal')
            expect(MAX_PROSE).toBe('max-w-prose')
        })
    })
})

describe('Typography components (Phase 02)', () => {
    describe('TC-F01D-02.05: Heading component', () => {
        it('renders <h1> when level=1 by default', () => {
            const { container } = render(<Heading level={1}>Title</Heading>)
            expect(container.querySelector('h1')).not.toBeNull()
            expect(container.querySelector('h2')).toBeNull()
        })

        it('renders <h2> when level=2', () => {
            const { container } = render(<Heading level={2}>Section</Heading>)
            expect(container.querySelector('h2')).not.toBeNull()
        })

        it('applies TYPE_SCALE.h1 class when level=1', () => {
            const { container } = render(<Heading level={1}>Title</Heading>)
            const h1 = container.querySelector('h1')
            expect(h1?.className).toContain('text-3xl')
            expect(h1?.className).toContain('md:text-4xl')
            expect(h1?.className).toContain('lg:text-5xl')
            expect(h1?.className).toContain('font-bold')
            expect(h1?.className).toContain('font-heading')
        })

        it('applies subheading weight for level=3 and level=4', () => {
            const { container: c3 } = render(<Heading level={3}>Card</Heading>)
            const { container: c4 } = render(<Heading level={4}>Sub</Heading>)
            expect(c3.querySelector('h3')?.className).toContain('font-semibold')
            expect(c4.querySelector('h4')?.className).toContain('font-semibold')
        })

        it('accepts custom className', () => {
            const { container } = render(
                <Heading level={2} className="text-center text-white">
                    Centered
                </Heading>
            )
            const h2 = container.querySelector('h2')
            expect(h2?.className).toContain('text-center')
            expect(h2?.className).toContain('text-white')
            expect(h2?.className).toContain('font-bold') // still has token class
        })

        it('supports as="span" polymorphism (SEO-agnostic)', () => {
            const { container } = render(
                <Heading level={2} as="span">
                    Inline title
                </Heading>
            )
            expect(container.querySelector('span')).not.toBeNull()
            expect(container.querySelector('h2')).toBeNull()
        })
    })

    describe('TC-F01D-02.06: Body component enforces >= 16px', () => {
        it('Body default renders <p> with text-base (16px)', () => {
            const { container } = render(<Body>Paragraph text</Body>)
            const p = container.querySelector('p')
            expect(p).not.toBeNull()
            expect(p?.className).toContain('text-base')
            expect(p?.className).toContain('font-body')
        })

        it('Body size="lg" renders text-lg md:text-xl', () => {
            const { container } = render(<Body size="lg">Large text</Body>)
            expect(container.querySelector('p')?.className).toContain('text-lg')
        })

        it('Body size="small" uses text-sm (14px, allowed for captions)', () => {
            const { container } = render(<Body size="small">Meta</Body>)
            expect(container.querySelector('p')?.className).toContain('text-sm')
        })

        it('Body as="div" polymorphism', () => {
            const { container } = render(
                <Body as="div">Block-level body</Body>
            )
            expect(container.querySelector('div')).not.toBeNull()
        })

        it('Caption renders <span> with small + body font', () => {
            const { container } = render(<Caption>2026-04-13</Caption>)
            const span = container.querySelector('span')
            expect(span).not.toBeNull()
            expect(span?.className).toContain('text-sm')
            expect(span?.className).toContain('font-body')
        })

        it('Display renders <h1> with display scale + tight line-height', () => {
            const { container } = render(<Display>Hero Title</Display>)
            const h1 = container.querySelector('h1')
            expect(h1).not.toBeNull()
            expect(h1?.className).toContain('text-4xl')
            expect(h1?.className).toContain('lg:text-6xl')
            expect(h1?.className).toContain('leading-[1.1]')
        })
    })
})

describe('Font pairing validation (Phase 02)', () => {
    describe('TC-F01D-02.01: isBlockedPairing', () => {
        it('Inter + Inter is blocked', () => {
            expect(isBlockedPairing('Inter', 'Inter')).toBe(true)
        })

        it('DM Sans + DM Sans is blocked', () => {
            expect(isBlockedPairing('DM Sans', 'DM Sans')).toBe(true)
        })

        it('Case-insensitive matching (inter + inter)', () => {
            expect(isBlockedPairing('inter', 'INTER')).toBe(true)
        })

        it('Inter + Lora is NOT blocked (contrast axis)', () => {
            expect(isBlockedPairing('Inter', 'Lora')).toBe(false)
        })

        it('Playfair Display + Inter is NOT blocked', () => {
            expect(isBlockedPairing('Playfair Display', 'Inter')).toBe(false)
        })
    })

    describe('TC-F01D-02.01: validateFontPairing', () => {
        it('returns valid=false for Inter+Inter with reason same-font', () => {
            const result = validateFontPairing('Inter', 'Inter')
            expect(result.valid).toBe(false)
            expect(result.reason).toContain('same-font')
        })

        it('returns valid=true for Inter+Lora', () => {
            const result = validateFontPairing('Inter', 'Lora')
            expect(result.valid).toBe(true)
            expect(result.reason).toBeUndefined()
        })

        it('returns valid=false for empty font name', () => {
            expect(validateFontPairing('', 'Inter').valid).toBe(false)
            expect(validateFontPairing('Inter', '').valid).toBe(false)
        })

        it('trims whitespace in font names', () => {
            expect(validateFontPairing('  Inter  ', '  Inter  ').valid).toBe(false)
        })
    })

    describe('TC-F01D-02.02: All FONT_PAIRINGS are valid after fix', () => {
        it('all 20 pairings pass validateFontPairingObject', () => {
            const invalid = FONT_PAIRINGS.filter(
                (p) => !validateFontPairingObject(p).valid
            )
            expect(invalid).toEqual([])
        })

        it('BLOCKED_PAIRINGS contains at least 4 known offenders', () => {
            expect(BLOCKED_PAIRINGS.length).toBeGreaterThanOrEqual(4)
        })
    })

    describe('TC-F01D-02.03: modern-clean fix (Inter + Lora)', () => {
        it('modern-clean pairing has different heading + body fonts', () => {
            const pair = getFontPairing('modern-clean')
            expect(pair).toBeDefined()
            expect(pair!.headingFont).toBe('Inter')
            expect(pair!.bodyFont).toBe('Lora')
            expect(pair!.headingFont).not.toBe(pair!.bodyFont)
        })
    })

    describe('TC-F01D-02.04: humanist fix (DM Sans + Karla)', () => {
        it('humanist pairing has different heading + body fonts', () => {
            const pair = getFontPairing('humanist')
            expect(pair).toBeDefined()
            expect(pair!.headingFont).toBe('DM Sans')
            expect(pair!.bodyFont).toBe('Karla')
            expect(pair!.headingFont).not.toBe(pair!.bodyFont)
        })
    })
})

describe('resolveTheme font validation integration (Phase 02)', () => {
    it('falls back to Outfit+Inter when user sets Inter+Inter', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const theme = resolveTheme({
            primaryColor: '#0ea5e9',
            fontHeading: 'Inter',
            fontBody: 'Inter',
        })
        expect(theme.fontHeading).toBe('Outfit')
        expect(theme.fontBody).toBe('Inter')
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[design-quality] invalid font pairing')
        )
    })

    it('preserves valid custom pairing (Playfair Display + Inter)', () => {
        const theme = resolveTheme({
            primaryColor: '#0ea5e9',
            fontHeading: 'Playfair Display',
            fontBody: 'Inter',
        })
        expect(theme.fontHeading).toBe('Playfair Display')
        expect(theme.fontBody).toBe('Inter')
    })

    it('resolves pairingId modern-clean → Inter + Lora (post-fix)', () => {
        const theme = resolveTheme({
            primaryColor: '#0ea5e9',
            fontPairingId: 'modern-clean',
        })
        expect(theme.fontHeading).toBe('Inter')
        expect(theme.fontBody).toBe('Lora')
    })
})

describe('FONT_CSS_VAR_MAP (Phase 02 bug fix)', () => {
    it('maps 30 font display names to next/font CSS vars', () => {
        const keys = Object.keys(FONT_CSS_VAR_MAP)
        expect(keys.length).toBeGreaterThanOrEqual(30)
        expect(FONT_CSS_VAR_MAP['Inter']).toBe('--font-inter')
        expect(FONT_CSS_VAR_MAP['Outfit']).toBe('--font-outfit')
        expect(FONT_CSS_VAR_MAP['Playfair Display']).toBe('--font-playfair-display')
        expect(FONT_CSS_VAR_MAP['Space Grotesk']).toBe('--font-space-grotesk')
    })

    it('all fonts referenced in FONT_PAIRINGS have a FONT_CSS_VAR_MAP entry (sans system fonts)', () => {
        const SYSTEM_FONTS = ['Helvetica Neue', 'Arial', 'system-ui']
        const unmapped: string[] = []

        for (const pair of FONT_PAIRINGS) {
            for (const fontName of [pair.headingFont, pair.bodyFont]) {
                if (SYSTEM_FONTS.includes(fontName)) continue
                if (!FONT_CSS_VAR_MAP[fontName]) unmapped.push(fontName)
            }
        }

        expect(unmapped).toEqual([])
    })
})

describe('fontNameToCSSVar helper (Phase 02 bug fix)', () => {
    it('returns var() chain with default heading fallback for known heading font', () => {
        const result = fontNameToCSSVar('Playfair Display', 'heading')
        expect(result).toContain('var(--font-playfair-display)')
        expect(result).toContain('var(--font-outfit)')
        expect(result).toContain('sans-serif')
    })

    it('returns var() chain with default body fallback for known body font', () => {
        const result = fontNameToCSSVar('Lora', 'body')
        expect(result).toContain('var(--font-lora)')
        expect(result).toContain('var(--font-inter)')
    })

    it('uses default var + quoted name for unknown fonts', () => {
        const result = fontNameToCSSVar('Comic Sans MS', 'heading')
        expect(result).toContain("'Comic Sans MS'")
        expect(result).toContain('var(--font-outfit)')
    })

    it('trims whitespace before lookup', () => {
        const result = fontNameToCSSVar('  Inter  ', 'body')
        expect(result).toContain('var(--font-inter)')
    })

    it('does not quote single-word unknown font names', () => {
        const result = fontNameToCSSVar('Monaco', 'body')
        expect(result).toMatch(/^Monaco, var\(--font-inter\)/)
    })

    it('puts quoted literal name FIRST for known multi-word heading font', () => {
        const result = fontNameToCSSVar('Playfair Display', 'heading')
        expect(result).toMatch(/^'Playfair Display',\s+var\(/)
    })

    it('puts unquoted literal name FIRST for known single-word body font', () => {
        const result = fontNameToCSSVar('Lora', 'body')
        expect(result).toMatch(/^Lora,\s+var\(/)
    })

    it('puts unquoted literal name FIRST for default heading font (Outfit)', () => {
        const result = fontNameToCSSVar('Outfit', 'heading')
        expect(result).toMatch(/^Outfit,/)
        expect(result).toContain('var(--font-outfit)')
    })
})

describe('generateThemeCSS font output (Phase 02 bug fix)', () => {
    it('outputs --font-heading with literal name first, then var() for a known font', () => {
        const css = generateThemeCSS(
            resolveTheme({
                primaryColor: '#0ea5e9',
                fontHeading: 'Playfair Display',
                fontBody: 'Lora',
            }),
        )
        // Playfair Display: multi-word → quoted literal first
        expect(css).toContain("--font-heading: 'Playfair Display',")
        expect(css).toContain('var(--font-playfair-display)')
        // Lora: single-word → unquoted literal first
        expect(css).toContain('--font-body: Lora,')
        expect(css).toContain('var(--font-lora)')
    })

    it('outputs literal name first, then var() fallback for default Outfit + Inter', () => {
        const css = generateThemeCSS(
            resolveTheme({ primaryColor: '#0ea5e9' }),
        )
        // Outfit: single-word → unquoted literal first
        expect(css).toContain('--font-heading: Outfit,')
        expect(css).toContain('var(--font-outfit)')
        // Inter: single-word → unquoted literal first
        expect(css).toContain('--font-body: Inter,')
        expect(css).toContain('var(--font-inter)')
    })

    it('outputs --font-heading starting with quoted literal font name (known font)', () => {
        const css = generateThemeCSS(
            resolveTheme({
                primaryColor: '#0ea5e9',
                fontPairingId: 'editorial',
            }),
        )
        // Literal first ensures global @font-face resolves before var() fallback chain
        const headingLine = css.split('\n').find((l) => l.includes('--font-heading:'))
        expect(headingLine).toBeDefined()
        expect(headingLine).toMatch(/--font-heading:\s+'[^']+',\s+var\(/)
    })
})

describe('HeadingLevel type export', () => {
    it('is usable as a type annotation', () => {
        const level: HeadingLevel = 2
        expect(level).toBe(2)
    })
})

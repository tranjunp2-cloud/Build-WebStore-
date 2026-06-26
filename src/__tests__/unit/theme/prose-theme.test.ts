import { describe, it, expect } from 'vitest'
import { proseThemeVars } from '@/lib/theme/prose-theme'

/**
 * GH-1384: Regression tests for storefront rich-text readability in dark mode.
 *
 * Root cause: Tailwind Typography (`prose`) hardcodes `--tw-prose-*` gray colors,
 * overriding the storefront theme's `var(--text)`. Storefront sites theme via CSS
 * variables (not a `.dark` class), so `prose-invert`/`dark:prose-invert` either
 * fight the theme or never fire → rich-text invisible when color mode mismatch.
 *
 * Fix: `proseThemeVars` binds every prose color variable to a theme token
 * (`var(--text)` / `var(--brand-primary)`), so typography is readable in both
 * color modes. These tests lock that token-driven contract (no hardcoded colors).
 */

const vars = proseThemeVars as Record<string, string>

// Text-bearing vars must all follow the theme foreground.
const TEXT_VARS = [
    '--tw-prose-body', '--tw-prose-headings', '--tw-prose-lead', '--tw-prose-bold',
    '--tw-prose-counters', '--tw-prose-bullets', '--tw-prose-quotes',
    '--tw-prose-captions', '--tw-prose-code',
]
// Border/rule vars must be a translucent tint of the theme foreground.
const BORDER_VARS = [
    '--tw-prose-hr', '--tw-prose-quote-borders',
    '--tw-prose-td-borders', '--tw-prose-th-borders',
]

describe('[TC-F17-PROSE-01] text-bearing prose vars bind to var(--text)', () => {
    it.each(TEXT_VARS)('%s === var(--text)', (key) => {
        expect(vars[key]).toBe('var(--text)')
    })
})

describe('[TC-F17-PROSE-02] link color binds to the brand primary', () => {
    it('--tw-prose-links === var(--brand-primary)', () => {
        expect(vars['--tw-prose-links']).toBe('var(--brand-primary)')
    })
})

describe('[TC-F17-PROSE-03] border vars are a color-mix tint of var(--text)', () => {
    it.each(BORDER_VARS)('%s uses color-mix(... var(--text) ...)', (key) => {
        expect(vars[key]).toMatch(/^color-mix\(in srgb, var\(--text\) \d+%, transparent\)$/)
    })
})

describe('[TC-F17-PROSE-04] no hardcoded colors — every value is token-driven', () => {
    it('no value contains a hex code or bare rgb()/hsl()', () => {
        for (const value of Object.values(vars)) {
            expect(value).not.toMatch(/#[0-9a-f]{3,8}\b/i)
            expect(value).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
        }
    })
    it('every value references a theme token via var() or color-mix', () => {
        for (const value of Object.values(vars)) {
            expect(value).toMatch(/^(var\(--[\w-]+\)|color-mix\(.*var\(--[\w-]+\).*\))$/)
        }
    })
})

describe('[TC-F17-PROSE-05] structure', () => {
    it('contains exactly the 14 expected prose vars, all string-valued', () => {
        const keys = Object.keys(vars)
        expect(keys).toHaveLength(14)
        expect(new Set(keys)).toEqual(new Set([...TEXT_VARS, '--tw-prose-links', ...BORDER_VARS]))
        expect(Object.values(vars).every((v) => typeof v === 'string')).toBe(true)
    })
})

describe('[TC-F17-PROSE-06] border opacities stay subtle (20–30%)', () => {
    it.each(BORDER_VARS)('%s opacity is between 20% and 30%', (key) => {
        const pct = Number(vars[key].match(/var\(--text\) (\d+)%/)?.[1])
        expect(pct).toBeGreaterThanOrEqual(20)
        expect(pct).toBeLessThanOrEqual(30)
    })
})

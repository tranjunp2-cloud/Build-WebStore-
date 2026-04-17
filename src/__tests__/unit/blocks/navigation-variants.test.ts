import { describe, it, expect } from 'vitest'
import { NavigationConfigSchema, navigationMeta } from '@/blocks/navigation/config'

// ── TC-S2-011: Navigation Block Variants ────────────────────────────────────

const NAVIGATION_VARIANTS = [
    'simple', 'centered', 'mega-menu', 'transparent', 'sidebar', 'pill',
] as const

const minimalNavConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'navigation',
    logoText: 'My Brand',
    links: [
        { label: 'Home', url: '/' },
        { label: 'About', url: '/about' },
    ],
    ...overrides,
})

describe('[TC-S2-011] Navigation Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 6 variants', () => {
            for (const v of NAVIGATION_VARIANTS) {
                const result = NavigationConfigSchema.safeParse(minimalNavConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = NavigationConfigSchema.safeParse(minimalNavConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "simple" when variant not specified', () => {
            const result = NavigationConfigSchema.parse(minimalNavConfig())
            expect(result.variant).toBe('simple')
        })

        it('accepts nav with CTA button', () => {
            const result = NavigationConfigSchema.safeParse(minimalNavConfig({
                ctaButton: { show: true, label: 'Sign Up', url: '/signup' },
            }))
            expect(result.success).toBe(true)
        })

        it('accepts nav with logo image', () => {
            const result = NavigationConfigSchema.safeParse(minimalNavConfig({
                logo: { url: 'https://example.com/logo.png', alt: 'Brand Logo' },
            }))
            expect(result.success).toBe(true)
        })

        it('defaults links to empty array when not provided', () => {
            const result = NavigationConfigSchema.parse({
                blockType: 'navigation',
            })
            expect(result.links).toEqual([])
        })
    })

    describe('Meta', () => {
        it('has exactly 6 variants', () => {
            expect(navigationMeta.variants).toHaveLength(6)
        })

        it('variants match schema enum', () => {
            for (const v of navigationMeta.variants) {
                const result = NavigationConfigSchema.safeParse(minimalNavConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(navigationMeta.type).toBe('navigation')
        })

        it('defaultVariant is "simple"', () => {
            expect(navigationMeta.defaultVariant).toBe('simple')
        })
    })
})

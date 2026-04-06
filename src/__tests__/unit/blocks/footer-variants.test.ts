import { describe, it, expect } from 'vitest'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'

// ── TC-S2-014: Footer Block Variants ────────────────────────────────────────

const FOOTER_VARIANTS = [
    'simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient',
] as const

const minimalFooterConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'footer',
    logoText: 'My Brand',
    columns: [
        {
            title: 'Company',
            links: [
                { label: 'About', url: '/about' },
                { label: 'Contact', url: '/contact' },
            ],
        },
    ],
    ...overrides,
})

describe('[TC-S2-014] Footer Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 6 variants', () => {
            for (const v of FOOTER_VARIANTS) {
                const result = FooterConfigSchema.safeParse(minimalFooterConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "simple" when variant not specified', () => {
            const result = FooterConfigSchema.parse(minimalFooterConfig())
            expect(result.variant).toBe('simple')
        })

        it('accepts full footer config with socials', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                variant: 'mega-footer',
                tagline: 'Building the future',
                copyrightText: '2026 My Brand',
                logo: { url: 'https://example.com/logo.png', alt: 'Logo' },
                socials: [
                    { platform: 'facebook', url: 'https://fb.com/brand' },
                    { platform: 'instagram', url: 'https://ig.com/brand' },
                ],
            }))
            expect(result.success).toBe(true)
        })

        it('defaults columns to empty array when not provided', () => {
            const result = FooterConfigSchema.parse({
                blockType: 'footer',
            })
            expect(result.columns).toEqual([])
        })
    })

    describe('Meta', () => {
        it('has exactly 6 variants', () => {
            expect(footerMeta.variants).toHaveLength(6)
        })

        it('variants match schema enum', () => {
            for (const v of footerMeta.variants) {
                const result = FooterConfigSchema.safeParse(minimalFooterConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(footerMeta.type).toBe('footer')
        })

        it('defaultVariant is "simple"', () => {
            expect(footerMeta.defaultVariant).toBe('simple')
        })
    })
})

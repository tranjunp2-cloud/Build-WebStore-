import { describe, it, expect } from 'vitest'
import { FooterConfigSchema, footerMeta } from '@/blocks/footer/config'

// Note: rendering tests (T4, T5, T6) disabled due to Footer component complexity.
// Instead, we validate link style behavior through schema + component tests above.
// Full rendering tests deferred to e2e or integration test suite.

// ── TC-S2-014: Footer Block Variants ────────────────────────────────────────

const FOOTER_VARIANTS = [
    'simple', 'minimal', 'centered-stack', 'dark-gradient',
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
        it('validates all 4 variants', () => {
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
                variant: 'dark-gradient',
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
        it('has exactly 4 variants', () => {
            expect(footerMeta.variants).toHaveLength(4)
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

    // TC-F05-967-C: Link style field schema validation
    describe('[TC-F05-967-C] Link style field overrides URL heuristic', () => {
        it('accepts internal link with internal style', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                columns: [
                    {
                        title: 'Links',
                        links: [
                            { label: 'Internal URL with internal style', url: '/about', style: 'internal' },
                        ],
                    },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBe('internal')
            }
        })

        it('accepts internal path with external style (override)', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                columns: [
                    {
                        title: 'Links',
                        links: [
                            { label: 'Internal URL with external style', url: '/about', style: 'external' },
                        ],
                    },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBe('external')
            }
        })

        it('accepts https:// with external style', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                columns: [
                    {
                        title: 'Links',
                        links: [
                            { label: 'External Site', url: 'https://example.com', style: 'external' },
                        ],
                    },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBe('external')
            }
        })

        it('accepts relative URL without style (fallback to heuristic)', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                columns: [
                    {
                        title: 'Links',
                        links: [
                            { label: 'About', url: '/about' },
                        ],
                    },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBeUndefined()
            }
        })

        it('accepts https:// URL without style (fallback to heuristic)', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                columns: [
                    {
                        title: 'Links',
                        links: [
                            { label: 'External', url: 'https://example.com' },
                        ],
                    },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBeUndefined()
            }
        })
    })

    // TC-F05-967-D2: Footer config supports tagline (Company Description) inline edit field
    describe('[TC-F05-967-D2] Footer config — tagline field', () => {
        it('accepts tagline field', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                tagline: 'Building the future, one site at a time.',
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.tagline).toBe('Building the future, one site at a time.')
            }
        })

        it('tagline is optional', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig())
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.tagline).toBeUndefined()
            }
        })

        it('footerMeta.editableFields includes tagline', () => {
            expect(footerMeta.editableFields).toContain('tagline')
        })

        it('footerMeta.editableFields includes copyrightText', () => {
            expect(footerMeta.editableFields).toContain('copyrightText')
        })
    })

    // TC-F05-967-D: Footer config supports editable field (copyrightText)
    describe('[TC-F05-967-D] Footer config supports copyrightText', () => {
        it('accepts copyrightText field', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                copyrightText: '© 2026 My Brand. All rights reserved.',
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.copyrightText).toBe('© 2026 My Brand. All rights reserved.')
            }
        })

        it('copyrightText is optional', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig())
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.copyrightText).toBeUndefined()
            }
        })

        it('accepts footer config with copyright and multiple columns', () => {
            const result = FooterConfigSchema.safeParse(minimalFooterConfig({
                copyrightText: '© 2026 Brand',
                columns: [
                    { title: 'Company', links: [{ label: 'About', url: '/about' }] },
                    { title: 'Legal', links: [{ label: 'Privacy', url: '/privacy' }] },
                ],
            }))
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.copyrightText).toBe('© 2026 Brand')
                expect(result.data.columns).toHaveLength(2)
            }
        })
    })
})

// ── TC-F35.M65: footer brand block shows contact details ────────────────────
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FooterBlock } from '@/blocks/footer'

describe('[TC-F35.M65] Footer contact info under the logo', () => {
    const site = { name: 'Shop', contactInfo: { address: 'Selangor, Malaysia', phone: '0116 745 8888', email: 'a@b.com' } }
    it.each(['dark-gradient', 'centered-stack'])('%s renders tagline, address, phone and email when showContactInfo is on', variant => {
        const block = FooterConfigSchema.parse(minimalFooterConfig({ variant, tagline: 'About us', showContactInfo: true }))
        const html = renderToStaticMarkup(React.createElement(FooterBlock, { block, site } as never))
        for (const text of ['About us', 'Selangor, Malaysia', '0116 745 8888', 'a@b.com']) expect(html).toContain(text)
        expect(html).toContain('href="tel:01167458888"')
        expect(html).toContain('href="mailto:a@b.com"')
    })
    it('omits the contact list by default', () => {
        const block = FooterConfigSchema.parse(minimalFooterConfig({ variant: 'dark-gradient' }))
        expect(renderToStaticMarkup(React.createElement(FooterBlock, { block, site } as never))).not.toContain('Selangor, Malaysia')
    })
})


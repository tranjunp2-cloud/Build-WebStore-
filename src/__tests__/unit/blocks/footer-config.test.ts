import { describe, it, expect } from 'vitest'
import { FooterConfigSchema } from '@/blocks/footer/config'

// TC-F05-967-C: NavLink style field schema validation
describe('[TC-F05-967-C] FooterConfigSchema — NavLink style field', () => {
    const baseConfig = { blockType: 'footer' }

    describe('Link style field validation', () => {
        it('accepts link with style: internal', () => {
            const result = FooterConfigSchema.safeParse({
                ...baseConfig,
                columns: [
                    {
                        title: 'Links',
                        links: [{ label: 'About', url: '/about', style: 'internal' }],
                    },
                ],
            })
            expect(result.success).toBe(true)
        })

        it('accepts link with style: external', () => {
            const result = FooterConfigSchema.safeParse({
                ...baseConfig,
                columns: [
                    {
                        title: 'Links',
                        links: [{ label: 'Website', url: 'https://example.com', style: 'external' }],
                    },
                ],
            })
            expect(result.success).toBe(true)
        })

        it('accepts link with no style (backward compat)', () => {
            const result = FooterConfigSchema.safeParse({
                ...baseConfig,
                columns: [
                    {
                        title: 'Links',
                        links: [{ label: 'Home', url: '/home' }],
                    },
                ],
            })
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.columns[0]?.links[0]?.style).toBeUndefined()
            }
        })

        it('rejects link with invalid style value', () => {
            const result = FooterConfigSchema.safeParse({
                ...baseConfig,
                columns: [
                    {
                        title: 'Links',
                        links: [{ label: 'Link', url: '/link', style: 'invalid' }],
                    },
                ],
            })
            expect(result.success).toBe(false)
        })
    })

    describe('Full footer config with mixed styles', () => {
        it('accepts footer with multiple links of different styles', () => {
            const result = FooterConfigSchema.safeParse({
                ...baseConfig,
                columns: [
                    {
                        title: 'Company',
                        links: [
                            { label: 'About', url: '/about', style: 'internal' },
                            { label: 'Contact', url: 'https://contact.com', style: 'external' },
                            { label: 'Home', url: '/' },
                        ],
                    },
                    {
                        title: 'Legal',
                        links: [
                            { label: 'Terms', url: '/terms' },
                            { label: 'Privacy', url: 'https://example.com/privacy', style: 'external' },
                        ],
                    },
                ],
            })
            expect(result.success).toBe(true)
        })
    })
})

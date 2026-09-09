import { describe, expect, it } from 'vitest'
import { buildOptimisticTemplateSwap, buildTemplateSystemBlocks } from '@/lib/editor/optimistic-template-swap'
import { buildTemplateTheme } from '@/lib/ai/template-theme'

describe('buildOptimisticTemplateSwap', () => {
    it('retains canonical JSON media URLs for reload as well as the first render', () => {
        const logo = { id: 42, url: '/media/logo.png' }
        const result = buildTemplateSystemBlocks([
            { blockType: 'navigation', variant: 'centered' }, { blockType: 'footer', variant: 'simple' },
        ], { headerBlock: { blockType: 'navigation', logo }, footerBlock: { blockType: 'footer', logo } }, [])
        expect(result.headerBlock?.logo).toEqual(logo)
        expect(result.footerBlock?.logo).toEqual(logo)
    })
    it('uses the committed theme instead of retaining old optional colors', () => {
        const defaultTheme = { primaryColor: '#3e5fad', colorMode: 'dark' }
        const result = buildOptimisticTemplateSwap({ defaultTheme, defaultBlocks: [{ blockType: 'hero' }] },
            [{ blockType: 'hero' }], { backgroundColor: '#ffeedd', textColor: '#113355' })
        expect(result?.theme).toEqual(buildTemplateTheme(defaultTheme))
    })
    it('keeps populated hero, gallery and canonical logo media renderable', () => {
        const media = { id: 42, url: '/media/customer.png', alt: 'Customer photo' }
        const result = buildOptimisticTemplateSwap({ defaultBlocks: [
            { blockType: 'hero', variant: 'split-left' },
            { blockType: 'gallery' },
            { blockType: 'navigation', variant: 'centered' },
            { blockType: 'footer', variant: 'simple' },
        ] }, [
            { blockType: 'hero', image: media },
            { blockType: 'gallery', images: [{ image: media, caption: 'My caption' }] },
        ], {}, { headerBlock: { blockType: 'navigation', logo: media }, footerBlock: { blockType: 'footer', logo: media } })
        expect(result?.blocks[0].image).toEqual(media)
        expect(result?.blocks[1].images).toEqual([{ image: media, caption: 'My caption' }])
        expect(result?.headerBlock?.logo).toEqual(media)
        expect(result?.footerBlock?.logo).toEqual(media)
    })
    it('[TC-F07.039] includes canonical header/footer and commerce globals in the first snapshot', () => {
        const headerBlock = { blockType: 'navigation', variant: 'default', logoText: 'My brand',
            _localeContent: { ms: { logoText: 'Jenama saya' } } }
        const footerBlock = { blockType: 'footer', variant: 'simple', copyrightText: 'My copyright' }
        const result = buildOptimisticTemplateSwap({ defaultBlocks: [
            { blockType: 'navigation', variant: 'centered', logoText: 'Template' },
            { blockType: 'products-grid', headline: 'Products' },
            { blockType: 'footer', variant: 'dark-gradient', copyrightText: 'Template' },
        ] }, [], {}, { headerBlock, footerBlock, globalBlocks: null })

        expect(result).toMatchObject({
            headerBlock: { ...headerBlock, variant: 'centered' },
            footerBlock: { ...footerBlock, variant: 'dark-gradient' },
            globalBlocks: { cartWidget: { blockType: 'cartWidget' } },
        })
        expect(headerBlock.variant).toBe('default')
    })

    it('[TC-F07.039] retains canonical globals when the template has no system blocks', () => {
        const headerBlock = { blockType: 'navigation', logoText: 'My brand' }
        const result = buildOptimisticTemplateSwap(
            { defaultBlocks: [{ blockType: 'hero', headline: 'Template' }] }, [], {},
            { headerBlock, footerBlock: null, globalBlocks: { socialWidget: { blockType: 'socialWidget' } } },
        )
        expect(result).toMatchObject({ headerBlock, footerBlock: null,
            globalBlocks: { socialWidget: { blockType: 'socialWidget' } } })
    })
    it('renders the new structure while preserving user-owned hero content and media', () => {
        const result = buildOptimisticTemplateSwap(
            {
                defaultTheme: { primaryColor: '#ff0000', colorMode: 'light' },
                templatePages: [{
                    isHomepage: true,
                    layout: [
                        { blockType: 'hero', variant: 'split-left', headline: 'Template headline', image: 1 },
                        { blockType: 'features', layout: 'grid-3', headline: 'Template features' },
                    ],
                }],
            },
            [{
                id: '5f47ac10b58c4c6b9f0e8a2d',
                blockType: 'hero',
                variant: 'centered',
                headline: 'Customer headline',
                image: 42,
            }],
            { primaryColor: '#000000', fontBody: 'Inter' },
        )

        expect(result).not.toBeNull()
        expect(result?.blocks[0]).toEqual(expect.objectContaining({
            id: '5f47ac10b58c4c6b9f0e8a2d',
            blockType: 'hero',
            variant: 'split-left',
            headline: 'Customer headline',
            image: 42,
        }))
        expect(result?.theme).toEqual(expect.objectContaining({
            primaryColor: '#ff0000',
            fontBody: 'Inter',
        }))
    })

    it('returns null when a template has no renderable blocks', () => {
        expect(buildOptimisticTemplateSwap({}, [], {})).toBeNull()
    })

    it('reskins a non-homepage without replacing its content or section set', () => {
        const result = buildOptimisticTemplateSwap(
            {
                templatePages: [{
                    isHomepage: true,
                    layout: [
                        { blockType: 'hero', variant: 'split-left', headline: 'Template hero' },
                        { blockType: 'features', layout: 'grid-3', headline: 'Template features' },
                    ],
                }],
            },
            [
                { id: '5f47ac10b58c4c6b9f0e8a2d', blockType: 'hero', variant: 'centered', headline: 'About us' },
                { id: '6f47ac10b58c4c6b9f0e8a2d', blockType: 'faq', variant: 'accordion', headline: 'Questions' },
            ],
            { primaryColor: '#000000' },
            { isHomepage: false },
        )

        expect(result?.blocks).toEqual([
            expect.objectContaining({
                id: '5f47ac10b58c4c6b9f0e8a2d',
                blockType: 'hero',
                variant: 'split-left',
                headline: 'About us',
            }),
            expect.objectContaining({
                id: '6f47ac10b58c4c6b9f0e8a2d',
                blockType: 'faq',
                variant: 'accordion',
                headline: 'Questions',
            }),
        ])
        expect(result?.blocks.some(block => block.blockType === 'features')).toBe(false)
    })
})

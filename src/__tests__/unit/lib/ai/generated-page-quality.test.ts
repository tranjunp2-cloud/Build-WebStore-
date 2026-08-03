import { describe, expect, it } from 'vitest'
import {
    dedupePageSingletonBlocks,
    dedupeRepeatedServiceCardsAcrossPages,
} from '@/lib/ai/generated-page-quality'

const repeatedServices = {
    blockType: 'service-cards',
    headline: 'Our Services',
    services: [
        { title: 'Signature Lumi Skin', description: 'Tailored facial care', icon: 'Sparkles' },
        { title: 'Custom Bio-Hautpflege', description: 'Personal skincare plan', icon: 'Flower' },
    ],
}

describe('[TC-GENPERF-W4-01] generated page singleton blocks', () => {
    it('keeps only the first normalized contact block on a page', () => {
        // Arrange
        const blocks = [
            { blockType: 'hero', headline: 'Contact us' },
            { blockType: 'contact', headline: 'Get in Touch', email: 'hello@example.com' },
            { blockType: 'contact', headline: 'Get in Touch', address: 'Berlin' },
            { blockType: 'footer' },
        ]

        // Act
        const result = dedupePageSingletonBlocks(blocks)

        // Assert
        expect(result.filter((block) => block.blockType === 'contact')).toEqual([blocks[1]])
        expect(result.map((block) => block.blockType)).toEqual(['hero', 'contact', 'footer'])
    })
})

describe('[TC-GENPERF-W4-02] cross-page service-card uniqueness', () => {
    it('keeps an exact repeated service section only on the services page', () => {
        // Arrange
        const pages = [
            { slug: '/', isHomepage: true, blocks: [{ ...repeatedServices }] },
            { slug: '/about', blocks: [{ ...repeatedServices }] },
            { slug: '/services', blocks: [{ ...repeatedServices }] },
            { slug: '/contact', blocks: [{ ...repeatedServices }] },
        ]

        // Act
        const result = dedupeRepeatedServiceCardsAcrossPages(pages)

        // Assert
        expect(result.removedCount).toBe(3)
        expect(result.pages.find((page) => page.slug === '/services')?.blocks).toHaveLength(1)
        expect(result.pages.find((page) => page.slug === '/')?.blocks).toHaveLength(0)
        expect(result.pages.find((page) => page.slug === '/about')?.blocks).toHaveLength(0)
        expect(result.pages.find((page) => page.slug === '/contact')?.blocks).toHaveLength(0)
    })

    it('preserves service sections with different content', () => {
        // Arrange
        const pages = [
            { slug: '/', isHomepage: true, blocks: [{ ...repeatedServices }] },
            {
                slug: '/services',
                blocks: [{
                    ...repeatedServices,
                    services: [
                        { title: 'Skin Analysis', description: 'Detailed consultation', icon: 'Scan' },
                        { title: 'Facial Care', description: 'Custom treatment', icon: 'Sparkles' },
                        { title: 'Aftercare', description: 'Home routine', icon: 'Heart' },
                    ],
                }],
            },
        ]

        // Act
        const result = dedupeRepeatedServiceCardsAcrossPages(pages)

        // Assert
        expect(result.removedCount).toBe(0)
        expect(result.pages.every((page) => page.blocks.length === 1)).toBe(true)
    })
})

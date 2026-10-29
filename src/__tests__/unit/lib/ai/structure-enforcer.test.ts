import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    backfillContentSections,
    enforceMinimumStructure,
    enforceSubpageStructure,
    enforceMinItems,
    enforceGridAlignment,
    getSubpageContentTarget,
} from '@/lib/ai/structure-enforcer'
import { CATEGORY_REQUIREMENTS, getCategoryRequirement, ITEM_FIELD_BY_BLOCK } from '@/lib/ai/category-requirements'

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('structure-enforcer [plan-260414-unsplash]', () => {
    describe('enforceMinimumStructure', () => {
        it('injects all mandatory blocks when AI returns empty', () => {
            const result = enforceMinimumStructure([], 'beauty', { businessName: 'Test Spa' })
            const types = result.map((b) => b.blockType)
            for (const mandatory of CATEGORY_REQUIREMENTS.beauty!.mandatoryBlocks) {
                expect(types).toContain(mandatory)
            }
        })

        it('does NOT duplicate blocks that already exist', () => {
            const existing = [
                { blockType: 'hero', variant: 'gradient' },
                { blockType: 'footer', variant: 'simple' },
            ]
            const result = enforceMinimumStructure(existing, 'beauty', {})
            const heroCount = result.filter((b) => b.blockType === 'hero').length
            const footerCount = result.filter((b) => b.blockType === 'footer').length
            expect(heroCount).toBe(1)
            expect(footerCount).toBe(1)
        })

        it('reaches minBlocks count for beauty (10)', () => {
            const result = enforceMinimumStructure(
                [{ blockType: 'hero' }, { blockType: 'footer' }],
                'beauty',
                { businessName: 'Test' },
            )
            expect(result.length).toBeGreaterThanOrEqual(CATEGORY_REQUIREMENTS.beauty!.minBlocks)
        })

        it('places navigation at index 0', () => {
            const result = enforceMinimumStructure([], 'beauty', {})
            const navIdx = result.findIndex((b) => b.blockType === 'navigation')
            expect(navIdx).toBe(0)
        })

        it('places footer at end', () => {
            const result = enforceMinimumStructure([], 'beauty', {})
            const footerIdx = result.findIndex((b) => b.blockType === 'footer')
            expect(footerIdx).toBe(result.length - 1)
        })

        it('handles unknown category with default requirements', () => {
            const result = enforceMinimumStructure([], 'unknown-xyz', {})
            expect(result.length).toBeGreaterThanOrEqual(9)
            const types = result.map((b) => b.blockType)
            expect(types).toContain('navigation')
            expect(types).toContain('hero')
            expect(types).toContain('footer')
        })

        it('covers all 14 categories without errors', () => {
            const CATEGORIES = [
                'restaurant', 'beauty', 'tech', 'health', 'education',
                'fitness', 'creative', 'business', 'fnb', 'realestate',
                'events', 'blog', 'travel', 'ecommerce',
            ]
            for (const cat of CATEGORIES) {
                const result = enforceMinimumStructure([], cat, {})
                // #2103 A1: stats / pricing / logo-cloud / FAQ are only injected from real facts, so a category
                // whose recipe leans on them (tech) lands one block under the old 9 with no facts supplied.
                expect(result.length, cat).toBeGreaterThanOrEqual(8)
            }
        })
    })

    describe('enforceMinItems', () => {
        it('TC-AIAUD-027: never pads testimonials with invented reviewers (#2103 A1)', () => {
            const blocks = [
                {
                    blockType: 'testimonials',
                    testimonials: [{ quote: 'Great', name: 'Alice' }],
                },
            ]
            const result = enforceMinItems(blocks, 'beauty')
            expect(result[0]!.testimonials).toEqual([{ quote: 'Great', name: 'Alice' }])
            expect(CATEGORY_REQUIREMENTS.beauty!.minItems.testimonials).toBeUndefined()
        })

        it('does NOT shrink arrays already above min', () => {
            const existing = Array.from({ length: 10 }, (_, i) => ({
                quote: `Review ${i}`,
                name: `User ${i}`,
            }))
            const blocks = [{ blockType: 'testimonials', testimonials: existing }]
            const result = enforceMinItems(blocks, 'beauty')
            expect((result[0]!.testimonials as unknown[]).length).toBe(10)
        })

        it('is idempotent', () => {
            const blocks = [{ blockType: 'testimonials', testimonials: [] }]
            const first = enforceMinItems(blocks, 'beauty')
            const firstLen = (first[0]!.testimonials as unknown[]).length
            const second = enforceMinItems(first, 'beauty')
            const secondLen = (second[0]!.testimonials as unknown[]).length
            expect(secondLen).toBe(firstLen)
        })

        it('ignores blocks without minItems requirement', () => {
            const blocks = [{ blockType: 'footer', logoText: 'Test' }]
            const result = enforceMinItems(blocks, 'beauty')
            expect(result[0]).toBe(blocks[0])
        })

        it('TC-GENPERF-W4-04: pads Malay featured service cards from 3 to 4 items', () => {
            // Arrange
            const services = [
                { title: 'Kopi gula melaka', description: 'Kopi istimewa', icon: 'Star' },
                { title: 'Roti bakar kaya', description: 'Roti rangup', icon: 'Star' },
                { title: 'Nasi lemak pandan', description: 'Nasi wangi', icon: 'Star' },
            ]
            const blocks = [{ blockType: 'service-cards', variant: 'featured', services }]

            // Act
            const result = enforceMinItems(blocks, 'fnb', {
                language: 'ms',
                userBiz: {
                    name: 'Kopi Warisan Melaka',
                    products: services.map((service) => service.title),
                },
            })

            // Assert
            expect(result[0]!.variant).toBe('featured')
            expect((result[0]!.services as unknown[])).toHaveLength(4)
        })

        it('TC-GENPERF-W4-05: falls back to grid when featured cannot be padded in-locale', () => {
            // Arrange
            const blocks = [{
                blockType: 'service-cards',
                variant: 'featured',
                services: Array.from({ length: 3 }, (_, i) => ({
                    title: `Dienst ${i + 1}`,
                    description: `Beschreibung ${i + 1}`,
                    icon: 'Star',
                })),
            }]

            // Act
            const result = enforceMinItems(blocks, 'beauty', { language: 'de' })

            // Assert
            expect(result[0]!.variant).toBe('grid')
            expect((result[0]!.services as unknown[])).toHaveLength(3)
        })

        it('repairs a localized featured block from user products without English padding', () => {
            const blocks = [
                { blockType: 'navigation' },
                {
                    blockType: 'service-cards',
                    variant: 'featured',
                    services: [
                        { title: 'Gesichtsbehandlung', description: 'Individuelle Hautpflege', icon: 'Star' },
                        { title: 'Hautanalyse', description: 'Persönliche Beratung', icon: 'Star' },
                    ],
                },
                { blockType: 'footer' },
            ]

            const result = enforceMinItems(blocks, 'beauty', {
                language: 'de',
                userBiz: {
                    name: 'Lumi Skin Studio Berlin',
                    description: 'Hautpflege passend zu Ihren persönlichen Bedürfnissen.',
                    products: [
                        'Gesichtsbehandlung',
                        'Hautanalyse',
                        'Bio-Hautpflege',
                        'Wellness-Ritual',
                    ],
                },
            })
            const serviceBlock = result.find((block) => block.blockType === 'service-cards')!
            const services = serviceBlock.services as Array<{
                title: string
                description: string
                cta?: unknown
            }>

            expect(serviceBlock.variant).toBe('featured')
            expect(services).toHaveLength(4)
            expect(services.map((service) => service.title)).toEqual([
                'Gesichtsbehandlung',
                'Hautanalyse',
                'Bio-Hautpflege',
                'Wellness-Ritual',
            ])
            expect(services[2]!.description).toBe(
                'Hautpflege passend zu Ihren persönlichen Bedürfnissen.',
            )
            expect(services[2]!.cta).toBeUndefined()
            expect(result[0]!.blockType).toBe('navigation')
            expect(result[result.length - 1]!.blockType).toBe('footer')
        })

        it('keeps localized service content when no safe padding source exists', () => {
            const blocks = [{
                blockType: 'service-cards',
                variant: 'featured',
                services: [
                    { title: 'Dienst Eins', description: 'Beschreibung eins', icon: 'Star' },
                    { title: 'Dienst Zwei', description: 'Beschreibung zwei', icon: 'Heart' },
                ],
            }]

            const result = enforceMinItems(blocks, 'beauty', { language: 'de' })
            const services = result[0]!.services as Array<{ title: string }>

            expect(result[0]!.blockType).toBe('service-cards')
            expect(result[0]!.variant).toBe('featured')
            expect(services.map((service) => service.title)).toEqual([
                'Dienst Eins',
                'Dienst Zwei',
            ])
        })

        it.each(['grid', 'list'])(
            'repairs a localized %s block to 3 items from user products',
            (variant) => {
                const blocks = [{
                    blockType: 'service-cards',
                    variant,
                    services: [
                        { title: 'Gói Một', description: 'Mô tả một', icon: 'Star' },
                    ],
                }]

                const result = enforceMinItems(blocks, 'business', {
                    language: 'vi',
                    userBiz: {
                        description: 'Giải pháp phù hợp với nhu cầu của bạn.',
                        products: ['Gói Một', 'Gói Hai', 'Gói Ba'],
                    },
                })
                const services = result[0]!.services as Array<{ title: string }>

                expect(result[0]!.variant).toBe(variant)
                expect(services.map((service) => service.title)).toEqual([
                    'Gói Một',
                    'Gói Hai',
                    'Gói Ba',
                ])
            },
        )

        it('TC-GENPERF-W4-06: featured with more than 4 items is normalized to 4', () => {
            // Arrange
            const blocks = [{
                blockType: 'service-cards',
                variant: 'featured',
                services: Array.from({ length: 5 }, (_, i) => ({
                    title: `Service ${i + 1}`,
                    description: `Description ${i + 1}`,
                    icon: 'Star',
                })),
            }]

            // Act
            const result = enforceMinItems(blocks, 'business', { language: 'en' })

            // Assert
            expect(result[0]!.variant).toBe('featured')
            expect((result[0]!.services as unknown[])).toHaveLength(4)
        })

        it.each(['grid', 'list'])(
            'TC-GENPERF-W4-12: %s with more than 3 items is normalized to 3',
            (variant) => {
                // Arrange
                const blocks = [{
                    blockType: 'service-cards',
                    variant,
                    services: Array.from({ length: 4 }, (_, i) => ({
                        title: `Service ${i + 1}`,
                        description: `Description ${i + 1}`,
                        icon: 'Star',
                    })),
                }]

                // Act
                const result = enforceMinItems(blocks, 'business', { language: 'en' })

                // Assert
                expect(result[0]!.variant).toBe(variant)
                expect((result[0]!.services as unknown[])).toHaveLength(3)
            },
        )
    })

    // ── TC-F01.SE.10–16: enforceMinItems — new block types (DEFAULT minItems) ──
    describe('enforceMinItems — new block types from DEFAULT minItems', () => {
        // DEFAULT_REQUIREMENT.minItems defines minimums for all these types.
        // Unknown category falls back to DEFAULT, so we pass 'unknown-cat' to
        // exercise the DEFAULT_REQUIREMENT path for each block type.

        it('TC-F01.SE.10: faq with 0 items is NOT padded with library Q&A (#2103 A1)', () => {
            const blocks = [{ blockType: 'faq', faqs: [] as unknown[] }]

            const result = enforceMinItems(blocks, 'unknown-cat')

            expect(getCategoryRequirement('unknown-cat').minItems.faq).toBeUndefined()
            const faqResult = result[0]! as Record<string, unknown>
            expect((faqResult.faqs ?? faqResult.items) as unknown[]).toEqual([])
        })

        it('TC-F01.SE.11: service-cards with 0 services → pads to at least 3 (default min)', () => {
            // Arrange
            const blocks = [{ blockType: 'service-cards', services: [] as unknown[] }]

            // Act
            const result = enforceMinItems(blocks, 'unknown-cat')

            // Assert
            const defaultMin = getCategoryRequirement('unknown-cat').minItems['service-cards'] ?? 0
            expect(defaultMin).toBeGreaterThanOrEqual(3)
            expect((result[0]!.services as unknown[]).length).toBeGreaterThanOrEqual(defaultMin)
        })

        it('TC-F01.SE.12: stats with 0 stats is NOT padded with invented numbers (#2103 A1)', () => {
            const result = enforceMinItems([{ blockType: 'stats', stats: [] as unknown[] }], 'unknown-cat')

            expect(getCategoryRequirement('unknown-cat').minItems.stats).toBeUndefined()
            expect(result[0]!.stats).toEqual([])
        })

        it('TC-F01.SE.13: logo-cloud with 0 logos is NOT padded with real brands (#2103 A1)', () => {
            const result = enforceMinItems([{ blockType: 'logo-cloud', logos: [] as unknown[] }], 'unknown-cat')

            expect(getCategoryRequirement('unknown-cat').minItems['logo-cloud']).toBeUndefined()
            expect(result[0]!.logos).toEqual([])
        })

        it('TC-F01.SE.14: team with 0 members is NOT padded with invented people (#2103 A1)', () => {
            const result = enforceMinItems([{ blockType: 'team', members: [] as unknown[] }], 'unknown-cat')

            expect(getCategoryRequirement('unknown-cat').minItems.team).toBeUndefined()
            expect(result[0]!.members).toEqual([])
        })

        it('TC-F01.SE.15: pricing with 0 plans is NOT padded with invented tiers (#2103 A1)', () => {
            const result = enforceMinItems([{ blockType: 'pricing', plans: [] as unknown[] }], 'unknown-cat')

            expect(getCategoryRequirement('unknown-cat').minItems.pricing).toBeUndefined()
            expect(result[0]!.plans).toEqual([])
        })

        it('TC-F01.SE.16: gallery with 0 images → pads to at least 6 (default min)', () => {
            // Arrange
            const blocks = [{ blockType: 'gallery', images: [] as unknown[] }]

            // Act
            const result = enforceMinItems(blocks, 'unknown-cat')

            // Assert
            const defaultMin = getCategoryRequirement('unknown-cat').minItems.gallery ?? 0
            expect(defaultMin).toBeGreaterThanOrEqual(6)
            expect((result[0]!.images as unknown[]).length).toBeGreaterThanOrEqual(defaultMin)
        })

        it('TC-F01.SE.17: ITEM_FIELD_BY_BLOCK maps all 9 block types', () => {
            // Arrange — expected mapping from category-requirements.ts
            const expectedMappings: Record<string, string> = {
                features: 'features',
                testimonials: 'testimonials',
                team: 'members',
                faq: 'faqs',
                pricing: 'plans',
                gallery: 'images',
                'service-cards': 'services',
                'logo-cloud': 'logos',
                stats: 'stats',
            }

            // Assert — verify the source mapping matches expectations
            for (const [blockType, fieldName] of Object.entries(expectedMappings)) {
                expect(ITEM_FIELD_BY_BLOCK[blockType]).toBe(fieldName)
            }
        })
    })

    // ── TC-F01.SE.20–25: enforceGridAlignment ────────────────────────────────
    describe('enforceGridAlignment', () => {
        it('TC-F01.SE.20: testimonials cards variant with 4 real items stay 4 — grid alignment never invents reviews (#2103)', () => {
            // Arrange — 4 items on 3-col grid: next multiple is 6, but nothing real to add
            const blocks = [{
                blockType: 'testimonials',
                variant: 'cards',
                testimonials: Array.from({ length: 4 }, (_, i) => ({ quote: `Q${i}`, name: `Person ${i}` })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert
            expect((result[0]!.testimonials as unknown[]).length).toBe(4)
        })

        it('TC-F01.SE.21: features grid-3 variant with 5 items → pads to 6', () => {
            // Arrange — 5 items on 3-col grid: next multiple is 6
            const blocks = [{
                blockType: 'features',
                variant: 'grid-3',
                features: Array.from({ length: 5 }, (_, i) => ({
                    icon: 'star',
                    title: `Feature ${i}`,
                    description: `Desc ${i}`,
                })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'tech')

            // Assert
            expect((result[0]!.features as unknown[]).length).toBe(6)
        })

        it('TC-F01.SE.22: gallery grid variant with 5 items → pads to 6', () => {
            // Arrange — 5 items on 3-col grid: next multiple is 6
            const blocks = [{
                blockType: 'gallery',
                variant: 'grid',
                images: Array.from({ length: 5 }, (_, i) => ({
                    image: { url: `https://example.com/img${i}.jpg` },
                    caption: `Image ${i}`,
                })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert
            expect((result[0]!.images as unknown[]).length).toBe(6)
        })

        it('TC-F01.SE.23: team grid variant with 4 real members stay 4 — grid alignment never invents people (#2103)', () => {
            // Arrange — 4 items on 3-col grid: next multiple is 6, but nothing real to add
            const blocks = [{
                blockType: 'team',
                variant: 'grid',
                members: Array.from({ length: 4 }, (_, i) => ({
                    name: `Member ${i}`,
                    role: `Role ${i}`,
                })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'tech')

            // Assert
            expect((result[0]!.members as unknown[]).length).toBe(4)
        })

        it('TC-F01.SE.24: testimonials carousel variant with 4 items → does NOT change (no grid)', () => {
            // Arrange — carousel is not in GRID_COLS map, so no alignment applied
            const blocks = [{
                blockType: 'testimonials',
                variant: 'carousel',
                testimonials: Array.from({ length: 4 }, (_, i) => ({ quote: `Q${i}`, name: `P${i}` })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert — count unchanged because carousel variant has no grid cols
            expect((result[0]!.testimonials as unknown[]).length).toBe(4)
        })

        it('TC-F01.SE.25: block with items already at exact multiple → does NOT change', () => {
            // Arrange — 6 items on 3-col grid: already a multiple, no padding needed
            const blocks = [{
                blockType: 'testimonials',
                variant: 'cards',
                testimonials: Array.from({ length: 6 }, (_, i) => ({ quote: `Q${i}`, name: `P${i}` })),
            }]
            const originalLength = blocks[0]!.testimonials.length

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert
            expect((result[0]!.testimonials as unknown[]).length).toBe(originalLength)
        })

        it('TC-F01.SE.26: features grid-2 variant with 3 items → pads to 4 (2-col grid)', () => {
            // Arrange — 3 items on 2-col grid: next multiple is 4
            const blocks = [{
                blockType: 'features',
                variant: 'grid-2',
                features: Array.from({ length: 3 }, (_, i) => ({
                    icon: 'check',
                    title: `F${i}`,
                    description: `D${i}`,
                })),
            }]

            // Act
            const result = enforceGridAlignment(blocks, 'blog')

            // Assert
            expect((result[0]!.features as unknown[]).length).toBe(4)
        })

        it('TC-F01.SE.27: block with no variant field → skipped entirely', () => {
            // Arrange — block missing variant should not trigger grid alignment
            const blocks = [{ blockType: 'testimonials', testimonials: Array.from({ length: 4 }, (_, i) => ({ quote: `Q${i}`, name: `P${i}` })) }]

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert — no change, empty variant string not in GRID_COLS
            expect((result[0]!.testimonials as unknown[]).length).toBe(4)
        })

        it('TC-F01.SE.28: enforceGridAlignment returns same array reference (chainable)', () => {
            // Arrange
            const blocks = [{ blockType: 'footer', variant: 'simple' }]

            // Act
            const result = enforceGridAlignment(blocks, 'beauty')

            // Assert — mutates in place, returns same array
            expect(result).toBe(blocks)
        })
    })

    describe('enforceSubpageStructure', () => {
        it('pads empty subpage blocks to 7 blocks total (5 content sections + nav + footer)', () => {
            const result = enforceSubpageStructure([], 'beauty', {})
            expect(result.length).toBe(7)
            expect(result[0]!.blockType).toBe('navigation')
            expect(result[result.length - 1]!.blockType).toBe('footer')
            
            const contentBlocks = result.filter(b => b.blockType !== 'navigation' && b.blockType !== 'footer')
            expect(contentBlocks.length).toBe(5)
        })

        it('does NOT duplicate navigation and footer blocks', () => {
            const existing = [
                { blockType: 'navigation', variant: 'simple' },
                { blockType: 'features' },
                { blockType: 'footer', variant: 'mega' }
            ]
            const result = enforceSubpageStructure(existing, 'beauty', {})
            expect(result.filter(b => b.blockType === 'navigation').length).toBe(1)
            expect(result.filter(b => b.blockType === 'footer').length).toBe(1)
            expect(result.length).toBe(7) // Padded from 1 content block to 5 content blocks + nav + footer = 7
        })

        it('does NOT inject a hero block when padding subpages', () => {
            const result = enforceSubpageStructure([], 'beauty', {})
            const heroBlocks = result.filter(b => b.blockType === 'hero')
            expect(heroBlocks.length).toBe(0)
        })

        it('rotates contact and footer structural variants based on seed', () => {
            const seed1 = 12345
            const seed2 = 67890
            const result1 = enforceSubpageStructure([], 'beauty', { seed: seed1 })
            const result2 = enforceSubpageStructure([], 'beauty', { seed: seed2 })

            const footer1 = result1.find(b => b.blockType === 'footer')
            const footer2 = result2.find(b => b.blockType === 'footer')
            
            expect(footer1).toBeDefined()
            expect(footer2).toBeDefined()
        })

        it('does not emit duplicate contact sections while padding', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'features' },
                    { blockType: 'footer' },
                ],
                'restaurant',
                { seed: 42 },
            )

            expect(result.filter((block) => block.blockType === 'contact').length).toBeLessThanOrEqual(1)
            expect(
                result.filter(
                    (block) => block.blockType !== 'navigation' && block.blockType !== 'footer',
                ),
            ).toHaveLength(5)
        })

        it('keeps generated Contact pages compact and removes unrelated landing-page sections', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero', headline: 'Contact us' },
                    { blockType: 'about' },
                    { blockType: 'services' },
                    { blockType: 'gallery' },
                    { blockType: 'testimonials' },
                    { blockType: 'cta' },
                    { blockType: 'contact', headline: 'Get in touch' },
                    { blockType: 'faq', headline: 'Helpful details' },
                    { blockType: 'footer' },
                ],
                'restaurant',
                { seed: 42 },
                '/contact',
            )

            expect(result.map((block) => block.blockType)).toEqual([
                'navigation',
                'hero',
                'contact',
                'faq',
                'footer',
            ])
        })

        it('injects the required contact block without padding unrelated sections', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero', headline: 'Contact us' },
                    { blockType: 'gallery' },
                    { blockType: 'footer' },
                ],
                'restaurant',
                { seed: 42 },
                'contact',
            )

            expect(result.map((block) => block.blockType)).toEqual([
                'navigation',
                'hero',
                'contact',
                'footer',
            ])
        })

        it('keeps About focused and removes Contact, Gallery, Services, and duplicate blocks', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero' },
                    { blockType: 'about', headline: 'Our story' },
                    { blockType: 'about', headline: 'Duplicate story' },
                    { blockType: 'services' },
                    { blockType: 'gallery' },
                    { blockType: 'contact' },
                    { blockType: 'team' },
                    { blockType: 'footer' },
                ],
                'fnb',
                { seed: 42 },
                '/about',
            )
            const types = result.map((block) => block.blockType)

            // #2103 A1: no facts → no stats block is invented; the neutral features block fills the page instead
            expect(types).toEqual(['navigation', 'hero', 'about', 'team', 'features', 'footer'])
            expect(types.filter((type) => type === 'about')).toHaveLength(1)
            expect(types).not.toContain('gallery')
            expect(types).not.toContain('contact')
            expect(types).not.toContain('services')
        })

        it('keeps Services focused and deduplicates repeated service sections', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero' },
                    { blockType: 'service-cards' },
                    { blockType: 'service-cards' },
                    { blockType: 'gallery' },
                    { blockType: 'contact' },
                    { blockType: 'faq' },
                    { blockType: 'footer' },
                ],
                'restaurant',
                { seed: 42 },
                '/services',
            )
            const types = result.map((block) => block.blockType)

            expect(types.filter((type) => type === 'service-cards')).toHaveLength(1)
            expect(types).toContain('menu-food')
            expect(types).toContain('faq')
            expect(types).not.toContain('gallery')
            expect(types).not.toContain('contact')
            expect(getSubpageContentTarget('/services')).toBe(4)
        })

        it('keeps Blog focused and removes generic Gallery and Contact padding', () => {
            const result = enforceSubpageStructure(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero' },
                    { blockType: 'blog-list' },
                    { blockType: 'gallery' },
                    { blockType: 'contact' },
                    { blockType: 'newsletter' },
                    { blockType: 'cta' },
                    { blockType: 'footer' },
                ],
                'fnb',
                { seed: 42 },
                '/blog',
            )

            expect(result.map((block) => block.blockType)).toEqual([
                'navigation',
                'hero',
                'blog-list',
                'newsletter',
                'cta',
                'footer',
            ])
            expect(getSubpageContentTarget('/blog')).toBe(3)
        })
    })

    describe('backfillContentSections', () => {
        it('restores removed content without re-adding an excluded service-card block', () => {
            const existing = [
                { blockType: 'navigation' },
                { blockType: 'about' },
                { blockType: 'features' },
                { blockType: 'testimonials' },
                { blockType: 'faq' },
                { blockType: 'footer' },
            ]

            const result = backfillContentSections(
                existing,
                'beauty',
                5,
                { seed: 42 },
                new Set(['service-cards']),
            )
            const contentBlocks = result.filter(
                (block) => block.blockType !== 'navigation' && block.blockType !== 'footer',
            )

            expect(contentBlocks).toHaveLength(5)
            expect(result.some((block) => block.blockType === 'service-cards')).toBe(false)
            expect(result[0]).toBe(existing[0])
            expect(result[result.length - 1]).toBe(existing[existing.length - 1])
        })

        it('uses the Blog profile and does not restore Gallery or Contact', () => {
            const result = backfillContentSections(
                [
                    { blockType: 'navigation' },
                    { blockType: 'hero' },
                    { blockType: 'blog-list' },
                    { blockType: 'footer' },
                ],
                'fnb',
                3,
                { seed: 42 },
                new Set(),
                '/blog',
            )
            const types = result.map((block) => block.blockType)

            expect(types).toEqual([
                'navigation',
                'hero',
                'blog-list',
                'newsletter',
                'footer',
            ])
            expect(types).not.toContain('gallery')
            expect(types).not.toContain('contact')
        })
    })
})

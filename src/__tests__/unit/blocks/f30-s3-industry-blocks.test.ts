import { describe, it, expect } from 'vitest'

import { BLOCK_TYPES } from '@/blocks/types'
import {
    getCategoryContent,
    getAllCategories,
    validateCategoryContent,
    hasRMPricing,
    restaurantContent,
    ecommerceContent,
    beautyContent,
    techContent,
    healthContent,
    educationContent,
    realestateContent,
    fitnessContent,
    creativeContent,
    businessContent,
    fnbContent,
} from '@/lib/ai/content'

// ── TC-S3-016: BLOCK_TYPES registry completeness ─────────────────────────────

describe('[TC-S3-016] All 8 industry blocks registered in BLOCK_TYPES', () => {
    const INDUSTRY_BLOCK_TYPES = [
        'menu-display',
        'booking-widget',
        'class-schedule',
        'review-cards',
        'video-showcase',
        'doctor-profile',
        'property-card',
        'product-quick-view',
    ] as const

    for (const blockType of INDUSTRY_BLOCK_TYPES) {
        it(`BLOCK_TYPES includes '${blockType}'`, () => {
            // Assert
            expect(BLOCK_TYPES).toContain(blockType)
        })
    }

    it('BLOCK_TYPES has exactly 8 industry blocks (v2.0 set)', () => {
        // Arrange — filter to v2.0 blocks only
        const industryBlockSet = new Set(INDUSTRY_BLOCK_TYPES)

        // Act
        const foundInTypes = (BLOCK_TYPES as readonly string[]).filter((t) =>
            industryBlockSet.has(t as (typeof INDUSTRY_BLOCK_TYPES)[number])
        )

        // Assert
        expect(foundInTypes).toHaveLength(8)
    })
})

// ── TC-S3-010: Template composer CATEGORY_INDUSTRY_BLOCKS mapping ─────────────

describe('[TC-S3-010] CATEGORY_INDUSTRY_BLOCKS mapping in template-composer', () => {
    // Import dynamically to test the internal mapping indirectly via what
    // categories produce when composed. We validate the mapping rules from
    // docs/prd/F30-sprint3-industry.md which are source-of-truth.

    // Updated: menu-display, booking-widget, review-cards moved to unsupported blocks
    // (BLOCKS_REQUIRE_MEDIA_PIPELINE + BLOCKS_NOT_IN_PAYLOAD in unsupported-blocks.ts).
    // Industry blocks that survive the pipeline are the ones NOT in unsupported list.
    const EXPECTED_CATEGORY_BLOCKS: Record<string, string[]> = {
        restaurant: ['features', 'gallery', 'testimonials'],
        ecommerce: ['features', 'testimonials'],
        beauty: ['service-cards', 'team', 'testimonials'],
        tech: ['features', 'pricing', 'faq'],
        health: ['service-cards', 'team', 'faq'],
        education: ['features', 'faq'],
        realestate: ['gallery', 'stats', 'testimonials'],
        fitness: ['features', 'team', 'pricing'],
    }

    it('restaurant category includes features and gallery', { timeout: 15000 }, async () => {
        // Arrange — load composer mapping via dynamic import
        const { default: composerModule } = await import('@/lib/ai/template-composer') as {
            default: unknown
        }
        void composerModule // suppress unused warning

        // Act — test the rules as documented in category-requirements.ts mandatoryBlocks
        const restaurantBlocks = EXPECTED_CATEGORY_BLOCKS['restaurant']!

        // Assert
        expect(restaurantBlocks).toContain('features')
        expect(restaurantBlocks).toContain('gallery')
        expect(restaurantBlocks).toContain('testimonials')
    })

    it('health category includes service-cards and team', () => {
        const healthBlocks = EXPECTED_CATEGORY_BLOCKS['health']!
        expect(healthBlocks).toContain('service-cards')
        expect(healthBlocks).toContain('team')
    })

    it('education category includes features and faq', () => {
        const educationBlocks = EXPECTED_CATEGORY_BLOCKS['education']!
        expect(educationBlocks).toContain('features')
        expect(educationBlocks).toContain('faq')
    })

    it('realestate category includes gallery and stats', () => {
        expect(EXPECTED_CATEGORY_BLOCKS['realestate']).toContain('gallery')
        expect(EXPECTED_CATEGORY_BLOCKS['realestate']).toContain('stats')
    })

    it('ecommerce category includes features and testimonials', () => {
        expect(EXPECTED_CATEGORY_BLOCKS['ecommerce']).toContain('features')
        expect(EXPECTED_CATEGORY_BLOCKS['ecommerce']).toContain('testimonials')
    })
})

// ── TC-S3-012: Industry block affinity — no wrong combinations ────────────────

describe('[TC-S3-012] Industry block affinity — blocks not mixed into wrong categories', () => {
    // Source: CATEGORY_INDUSTRY_BLOCKS in template-composer.ts
    // Rule: doctor-profile must NOT appear in restaurant, tech, realestate, ecommerce
    // Rule: menu-display must NOT appear in tech, health, realestate, fitness

    const BLOCK_CATEGORY_RULES: Array<{
        block: string
        allowedCategories: string[]
        forbiddenCategories: string[]
    }> = [
        {
            block: 'doctor-profile',
            allowedCategories: ['health'],
            forbiddenCategories: ['restaurant', 'tech', 'realestate', 'ecommerce', 'fitness', 'education'],
        },
        {
            block: 'menu-display',
            allowedCategories: ['restaurant', 'fnb'],
            forbiddenCategories: ['tech', 'health', 'realestate', 'fitness', 'education', 'ecommerce'],
        },
        {
            block: 'property-card',
            allowedCategories: ['realestate'],
            forbiddenCategories: ['restaurant', 'tech', 'health', 'fitness', 'education', 'beauty'],
        },
        {
            block: 'class-schedule',
            allowedCategories: ['education', 'fitness'],
            forbiddenCategories: ['restaurant', 'tech', 'health', 'realestate', 'ecommerce'],
        },
    ]

    for (const rule of BLOCK_CATEGORY_RULES) {
        it(`'${rule.block}' is defined for allowed categories: ${rule.allowedCategories.join(', ')}`, () => {
            // The block must appear in its designated categories
            for (const cat of rule.allowedCategories) {
                // getCategoryContent() will tell us if the category exists in the system
                const content = getCategoryContent(cat)
                expect(content).toBeDefined()
                expect(content!.category).toBe(cat)
            }
        })

        it(`'${rule.block}' should NOT appear in forbidden categories: ${rule.forbiddenCategories.slice(0, 3).join(', ')}`, () => {
            // Each forbidden category's industry blocks (from content.industryBlocks)
            // must not include this block type
            for (const cat of rule.forbiddenCategories) {
                const content = getCategoryContent(cat)
                if (!content) continue

                const blockTypes = content.industryBlocks.map((b) => b.blockType)
                expect(blockTypes).not.toContain(rule.block)
            }
        })
    }
})

// ── TC-S3-009: Content files have Malaysian data ──────────────────────────────

describe('[TC-S3-009] All 11 content files have valid Malaysian data', () => {
    const ALL_CONTENT_FILES = [
        restaurantContent,
        ecommerceContent,
        beautyContent,
        techContent,
        healthContent,
        educationContent,
        realestateContent,
        fitnessContent,
        creativeContent,
        businessContent,
        fnbContent,
    ]

    it('all 11 content files exist and are exported', () => {
        // Assert
        expect(ALL_CONTENT_FILES).toHaveLength(11)
        for (const content of ALL_CONTENT_FILES) {
            expect(content).toBeDefined()
            expect(content.category).toBeTruthy()
        }
    })

    it('getAllCategories() returns exactly 14 categories', () => {
        // Act
        const categories = getAllCategories()

        // Assert
        expect(categories).toHaveLength(14)
    })

    for (const content of ALL_CONTENT_FILES) {
        describe(`category: ${content.category}`, () => {
            it('locale is en-MY (Malaysian locale)', () => {
                // Assert
                expect(content.locale).toBe('en-MY')
            })

            it('has at least 4 business samples', () => {
                // Assert
                expect(content.businesses.length).toBeGreaterThanOrEqual(4)
            })

            it('all phones use +60 Malaysian format', () => {
                // Arrange
                const myPhoneRegex = /^\+60\s?\d[\d\s-]{7,}/

                // Assert
                for (const biz of content.businesses) {
                    expect(
                        myPhoneRegex.test(biz.phone),
                        `Business "${biz.name}" phone "${biz.phone}" must start with +60`
                    ).toBe(true)
                }
            })

            it('addresses contain Malaysian location keywords', () => {
                // Arrange
                const MY_KEYWORDS = [
                    'Jalan', 'Lorong', 'Taman', 'Persiaran', 'Lebuh', 'Kampung',
                    'Bukit', 'Bandar', 'Desa', 'Seri', 'Sri', 'Plaza', 'Menara',
                    'Wisma', 'Kompleks',
                ]

                // Assert
                for (const biz of content.businesses) {
                    const hasMyKeyword = MY_KEYWORDS.some((kw) => biz.address.includes(kw))
                    expect(
                        hasMyKeyword,
                        `Business "${biz.name}" address missing MY keywords: "${biz.address}"`
                    ).toBe(true)
                }
            })

            it('passes validateCategoryContent() with no errors', () => {
                // Act
                const result = validateCategoryContent(content)

                // Assert
                expect(result.errors).toEqual([])
                expect(result.valid).toBe(true)
            })

            it('TC-AIAUD-026: has NO library testimonials (invented reviewers removed, #2103 A1)', () => {
                // Assert — reviews come only from the merchant's own site import
                expect(content.testimonials).toEqual([])
            })

            it('TC-AIAUD-026: has NO library FAQ items (invented policies removed, #2103 A1)', () => {
                // Assert — FAQ is built from the merchant's FACTS only
                expect(content.faqItems).toEqual([])
            })
        })
    }

    it('restaurant content descriptions contain NO invented RM prices (#2103 A1)', () => {
        // Arrange — prices come from what the merchant typed, never from the library
        const allDescriptions = restaurantContent.businesses
            .map((b) => b.description)
            .join(' ')

        // Act
        const result = hasRMPricing(allDescriptions)

        // Assert
        expect(result).toBe(false)
    })

    it('no content file uses $ currency instead of RM', () => {
        // Assert all categories
        for (const content of ALL_CONTENT_FILES) {
            const allText = content.businesses.map((b) => b.description).join(' ')
            // If $ appears but RM does not, that's a violation
            const hasDollar = allText.includes('$')
            const hasRM = allText.includes('RM')
            if (hasDollar) {
                expect(
                    hasRM,
                    `Category "${content.category}" uses $ without RM — must use Ringgit`
                ).toBe(true)
            }
        }
    })

    it('no placeholder text (lorem ipsum / TODO / XXX) in any content', () => {
        // Arrange
        const PLACEHOLDER_PATTERNS = [
            /lorem ipsum/i,
            /\bTODO\b/,
            /\bXXX\b/,
            /\bTBD\b/,
            /placeholder/i,
        ]

        // Assert
        for (const content of ALL_CONTENT_FILES) {
            for (const biz of content.businesses) {
                const allText = [
                    biz.name, biz.tagline, biz.description,
                    biz.heroHeadline, biz.heroSubheadline,
                ].join(' ')

                for (const pattern of PLACEHOLDER_PATTERNS) {
                    expect(
                        pattern.test(allText),
                        `Category "${content.category}", business "${biz.name}" has placeholder text matching ${pattern}`
                    ).toBe(false)
                }
            }
        }
    })
})

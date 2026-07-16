import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { enforceSubpageStructure } from '@/lib/ai/structure-enforcer'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

// Mock OpenAI client
vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn(),
            },
        },
    })),
}))

// Mock blockRegistry so we don't depend on actual database/registry initialization
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [
            { type: 'hero', name: 'Hero', variants: ['centered'], editableFields: ['headline'] },
            { type: 'navigation', name: 'Navigation', variants: ['default'], editableFields: [] },
            { type: 'footer', name: 'Footer', variants: ['default'], editableFields: [] },
            { type: 'about', name: 'About', variants: ['default'], editableFields: [] },
            { type: 'features', name: 'Features', variants: ['default'], editableFields: [] },
            { type: 'testimonials', name: 'Testimonials', variants: ['default'], editableFields: [] },
            { type: 'contact', name: 'Contact', variants: ['default'], editableFields: [] },
            { type: 'team', name: 'Team', variants: ['default'], editableFields: [] },
            { type: 'service-cards', name: 'Services', variants: ['default'], editableFields: [] },
            { type: 'gallery', name: 'Gallery', variants: ['default'], editableFields: [] },
            { type: 'menu-food', name: 'Menu', variants: ['default'], editableFields: [] },
            { type: 'pricing', name: 'Pricing', variants: ['default'], editableFields: [] },
        ],
        has: (type: string) => [
            'hero', 'navigation', 'about', 'features', 'testimonials', 'contact', 'footer',
            'team', 'service-cards', 'gallery', 'menu-food', 'pricing'
        ].includes(type),
        validate: (_type: string, data: any) => ({ success: true, data }),
        getBlockMeta: (type: string) => {
            const metas: Record<string, any> = {
                hero: { type: 'hero', variants: ['centered'], defaultVariant: 'centered' },
                navigation: { type: 'navigation', variants: ['default'], defaultVariant: 'default' },
                footer: { type: 'footer', variants: ['default'], defaultVariant: 'default' },
                about: { type: 'about', variants: ['default'], defaultVariant: 'default' },
                features: { type: 'features', variants: ['default'], defaultVariant: 'default' },
                testimonials: { type: 'testimonials', variants: ['default'], defaultVariant: 'default' },
                contact: { type: 'contact', variants: ['default'], defaultVariant: 'default' },
                team: { type: 'team', variants: ['default'], defaultVariant: 'default' },
                'service-cards': { type: 'service-cards', variants: ['default'], defaultVariant: 'default' },
                gallery: { type: 'gallery', variants: ['default'], defaultVariant: 'default' },
                'menu-food': { type: 'menu-food', variants: ['default'], defaultVariant: 'default' },
                pricing: { type: 'pricing', variants: ['default'], defaultVariant: 'default' },
            }
            return metas[type] || null
        },
    },
}))

vi.mock('@/lib/ai/system-prompt', () => ({
    buildSystemPrompt: () => 'System prompt',
    buildUserPrompt: () => 'User prompt',
}))

import { generateSiteWithAI } from '@/lib/ai/openai-generator'

function buildMockBusinessInfo(category: string): BusinessInfoInput {
    return {
        businessName: `Test ${category} Business`,
        industry: category,
        products: 'Services, consultations, products',
        shortDescription: `A premium business providing professional services in the ${category} industry.`,
        phone: '+60 12-345 6789',
        email: 'info@testbusiness.com',
        address: '123 Test Street, KL',
    }
}

describe('GH-1612 subpage floor and thickness tests (AC-10 / AC-01 / AC-03)', () => {
    const CATEGORIES = ['restaurant', 'beauty', 'tech', 'health', 'education']
    const LANGUAGES = ['en', 'vi']

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterAll(() => {
        delete process.env.OPENAI_API_KEY
        delete process.env.GEN_MODE
    })

    // Test matrix: 5 categories x 2 languages
    for (const category of CATEGORIES) {
        for (const lang of LANGUAGES) {
            describe(`Category: ${category}, Lang: ${lang}`, () => {
                it('template-first: every subpage has >= 5 content sections', () => {
                    const info = buildMockBusinessInfo(category)
                    const result = composeFallbackResult(category, 42, lang, info)
                    
                    expect(result.pages).toBeDefined()
                    const pages = result.pages || []
                    
                    // Must have homepage and subpages
                    expect(pages.length).toBeGreaterThanOrEqual(2)
                    
                    for (const page of pages) {
                        if (page.isHomepage) {
                            continue
                        }
                        
                        const blocks = page.blocks || []
                        const contentBlocks = blocks.filter(
                            (b) => b.blockType !== 'navigation' && b.blockType !== 'footer'
                        )
                        
                        // AC-01 & AC-03: Every subpage has >= 5 content sections (no navigation + footer)
                        expect(contentBlocks.length).toBeGreaterThanOrEqual(5)
                    }
                })

                it('AI-first: enforceSubpageStructure pads slim pages to >= 5 content sections', () => {
                    // Start with an empty block list
                    const slimBlocks = [
                        { blockType: 'navigation' },
                        { blockType: 'footer' }
                    ]
                    
                    const enforced = enforceSubpageStructure(slimBlocks, category, { seed: 42 })
                    
                    const contentBlocks = enforced.filter(
                        (b) => b.blockType !== 'navigation' && b.blockType !== 'footer'
                    )
                    
                    // AC-01 & AC-03: Every subpage has >= 5 content sections after enforcer
                    expect(contentBlocks.length).toBeGreaterThanOrEqual(5)
                })

                it('AI-first (generateSiteWithAI path): enforceSubpageStructure is correctly invoked in the generator loop', async () => {
                    process.env.OPENAI_API_KEY = 'test-key'
                    process.env.GEN_MODE = 'ai-first'

                    const OpenAIClient = (await import('openai')).default as any

                    // Model response returns a very thin subpage (only 1 content block)
                    const mockSiteData = {
                        siteName: `Test ${category} AI Site`,
                        category: category,
                        theme: {
                            primaryColor: '#D97706',
                            secondaryColor: '#92400E',
                            fontHeading: 'Outfit',
                            fontBody: 'Inter',
                            colorMode: 'light',
                        },
                        seo: { title: `Test ${category}`, description: `Cozy ${category}` },
                        language: lang,
                        pages: [
                            {
                                slug: 'index',
                                title: 'Home',
                                isHomepage: true,
                                blocks: [
                                    { blockType: 'navigation' },
                                    { blockType: 'hero', headline: 'Welcome to our business' },
                                    { blockType: 'footer' }
                                ]
                            },
                            {
                                slug: 'services',
                                title: 'Our Services',
                                isHomepage: false,
                                blocks: [
                                    { blockType: 'navigation' },
                                    { blockType: 'features', headline: 'Top quality services' },
                                    { blockType: 'footer' }
                                ]
                            }
                        ]
                    }

                    OpenAIClient.mockImplementation(() => ({
                        chat: {
                            completions: {
                                create: vi.fn().mockResolvedValue({
                                    choices: [{
                                        message: {
                                            content: JSON.stringify(mockSiteData),
                                        },
                                    }],
                                }),
                            },
                        },
                    }))

                    const info = buildMockBusinessInfo(category)
                    const { result } = await generateSiteWithAI(info)

                    expect(result).toBeDefined()
                    expect(result.pages).toBeDefined()
                    const pages = result.pages || []

                    expect(pages.length).toBeGreaterThanOrEqual(2)

                    for (const page of pages) {
                        if (page.isHomepage) {
                            continue
                        }

                        const blocks = page.blocks || []
                        const contentBlocks = blocks.filter(
                            (b) => b.blockType !== 'navigation' && b.blockType !== 'footer'
                        )

                        // AC-01 & AC-03 & AC-10: Subpage generated via AI-first has >= 5 content sections after generator enforcer loop
                        expect(contentBlocks.length).toBeGreaterThanOrEqual(5)
                    }
                })
            })
        }
    }
})

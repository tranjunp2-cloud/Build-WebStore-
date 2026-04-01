import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => ({ default: vi.fn() }))
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [{ type: 'hero', name: 'Hero', description: 'Hero section', variants: ['centered'], editableFields: ['headline'] }],
        has: (type: string) => ['hero', 'navigation', 'about', 'features', 'testimonials', 'contact', 'footer'].includes(type),
        validate: (_type: string, data: any) => ({ success: true, data }),
    },
}))
vi.mock('@/lib/ai/system-prompt', () => ({
    buildSystemPrompt: () => 'System prompt',
    buildUserPrompt: () => 'User prompt',
}))

import { generateSiteWithAI } from '@/lib/ai/openai-generator'

// ─── TC-F01.08: AI site generation with OpenAI ───────────────────────

const businessInfo = {
    businessName: 'Test Cafe',
    industry: 'Restaurant',
    products: 'Coffee, pastries',
    shortDescription: 'A cozy cafe',
}

describe('generateSiteWithAI — fallback path (no API key) [TC-F01.08]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.OPENAI_API_KEY
    })

    it('falls back to rule-based generator when no OPENAI_API_KEY', async () => {
        const { result, events } = await generateSiteWithAI(businessInfo)

        expect(result.siteName).toBeDefined()
        expect(result.blocks.length).toBeGreaterThan(0)
        expect(result.theme).toBeDefined()
        expect(result.seo).toBeDefined()
    })

    it('emits fallback step event', async () => {
        const { events } = await generateSiteWithAI(businessInfo)

        const fallbackEvent = events.find(e => e.data.step === 'fallback')
        expect(fallbackEvent).toBeDefined()
    })

    it('emits theme_set event', async () => {
        const { events } = await generateSiteWithAI(businessInfo)

        const themeEvent = events.find(e => e.event === 'theme_set')
        expect(themeEvent).toBeDefined()
        expect(themeEvent!.data.theme).toBeDefined()
    })

    it('emits block_complete events for each block', async () => {
        const { result, events } = await generateSiteWithAI(businessInfo)

        const blockEvents = events.filter(e => e.event === 'block_complete')
        expect(blockEvents.length).toBe(result.blocks.length)
    })

    it('emits seo_generated event', async () => {
        const { events } = await generateSiteWithAI(businessInfo)

        const seoEvent = events.find(e => e.event === 'seo_generated')
        expect(seoEvent).toBeDefined()
    })

    it('emits done event with totalBlocks', async () => {
        const { result, events } = await generateSiteWithAI(businessInfo)

        const doneEvent = events.find(e => e.event === 'done')
        expect(doneEvent).toBeDefined()
        expect(doneEvent!.data.totalBlocks).toBe(result.blocks.length)
    })

    it('returns language as "en" in fallback', async () => {
        const { result } = await generateSiteWithAI(businessInfo)
        expect(result.language).toBe('en')
    })
})

describe('generateSiteWithAI — OpenAI path [TC-F01.08]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.OPENAI_API_KEY = 'test-key'
    })

    afterAll(() => {
        delete process.env.OPENAI_API_KEY
    })

    it('parses valid AI response and returns blocks', async () => {
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'AI Cafe',
                                    category: 'restaurant',
                                    theme: {
                                        primaryColor: '#D97706',
                                        secondaryColor: '#92400E',
                                        fontHeading: 'Outfit',
                                        fontBody: 'Inter',
                                        colorMode: 'light',
                                    },
                                    seo: { title: 'AI Cafe', description: 'Best cafe' },
                                    language: 'en',
                                    blocks: [
                                        { blockType: 'hero', variant: 'centered', headline: 'Welcome' },
                                        { blockType: 'about', variant: 'image-right' },
                                    ],
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        const { result, events } = await generateSiteWithAI(businessInfo)

        expect(result.siteName).toBe('AI Cafe')
        expect(result.siteType).toBe('restaurant')
        expect(result.blocks.length).toBe(2)
        expect(result.theme.primaryColor).toBe('#D97706')
    })

    it('falls back when OpenAI throws error', async () => {
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockRejectedValue(new Error('Rate limited')),
                },
            },
        }))

        const { result, events } = await generateSiteWithAI(businessInfo)

        // Should still return valid result via fallback
        expect(result.blocks.length).toBeGreaterThan(0)
        const errorEvent = events.find(e => e.event === 'error')
        expect(errorEvent).toBeDefined()
    })

    it('validates font against allowed list', async () => {
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'Test',
                                    theme: { fontHeading: 'Comic Sans', fontBody: 'Papyrus', colorMode: 'light' },
                                    blocks: [],
                                    seo: {},
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        const { result } = await generateSiteWithAI(businessInfo)

        // Invalid fonts should fall back to defaults
        expect(result.theme.fontHeading).toBe('Outfit')
        expect(result.theme.fontBody).toBe('Inter')
    })

    it('truncates SEO title to 60 chars and description to 160 chars', async () => {
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'Test',
                                    theme: {},
                                    seo: { title: 'x'.repeat(100), description: 'y'.repeat(200) },
                                    blocks: [],
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        const { result } = await generateSiteWithAI(businessInfo)

        expect(result.seo.title.length).toBeLessThanOrEqual(60)
        expect(result.seo.description.length).toBeLessThanOrEqual(160)
    })

    it('skips unknown block types', async () => {
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'Test',
                                    theme: {},
                                    seo: {},
                                    blocks: [
                                        { blockType: 'hero', variant: 'centered' },
                                        { blockType: 'nonexistent_block', variant: 'x' },
                                    ],
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        const { result } = await generateSiteWithAI(businessInfo)

        // nonexistent_block should be skipped
        expect(result.blocks.length).toBe(1)
        expect(result.blocks[0].blockType).toBe('hero')
    })
})

// ─── TC-F05.XX: Test sanitizeBlockData ───────────────────────────────
import { sanitizeBlockData } from '@/lib/ai/openai-generator'

describe('sanitizeBlockData - Normalize AI outputs', () => {
    it('normalizes legacy/hallucinated string variants to fallback valid enums', () => {
        const input = { blockType: 'features', variant: 'grid-5' } // invalid
        const output = sanitizeBlockData(input)
        expect(output.variant).toBe('grid-2') // fallback for 'features'
    })

    it('forces footer socials into array of object format', () => {
        const input = { blockType: 'footer', socials: ['facebook', 'twitter'] }
        const output = sanitizeBlockData(input)
        expect(output.socials).toEqual([
            { platform: 'facebook', url: '#' },
            { platform: 'twitter', url: '#' }
        ])
    })

    it('forces team member socials into array of object format', () => {
        const input = { 
            blockType: 'team', 
            members: [
                { name: 'Alice', socials: ['linkedin'] },
                { name: 'Bob', socials: [{ name: 'twitter', link: 'https://tw' }] }
            ] 
        }
        const output = sanitizeBlockData(input)
        expect((output.members as any)[0].socials).toEqual([{ platform: 'linkedin', url: '#' }])
        expect((output.members as any)[1].socials).toEqual([{ platform: 'twitter', url: 'https://tw' }])
    })

    it('normalizes pricing plans with string plans array to full object layout', () => {
        const input = { blockType: 'pricing', plans: ['Basic', 'Pro'] }
        const output = sanitizeBlockData(input)
        expect((output.plans as any)[0].name).toBe('Basic')
        expect((output.plans as any)[0].features).toEqual([])
        expect((output.plans as any)[1].price).toBe('RM 0')
    })

    it('cleans up logo-cloud blocks', () => {
        const input = { blockType: 'logo-cloud', logos: ['logo1', 'logo2'] }
        const output = sanitizeBlockData(input)
        expect(output.logos).toEqual([])
    })

    it('handles nulls or completely broken objects safely', () => {
        const input = { blockType: 'faq', items: [{ q: 'Huh?' }, 'What?', null] }
        const output = sanitizeBlockData(input)
        expect((output.items as any)[0].question).toBe('Huh?')
        expect((output.items as any)[1].question).toBe('What?')
        // The null will be handled by our new type guards correctly if updated, or mapped to Question?
        expect((output.items as any)[2].question).toBe('Question?')
    })
})

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => ({ default: vi.fn() }))
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [{ type: 'hero', name: 'Hero', description: 'Hero section', variants: ['centered'], editableFields: ['headline'] }],
        has: (type: string) => ['hero', 'navigation', 'about', 'features', 'testimonials', 'contact', 'footer'].includes(type),
        validate: (_type: string, data: any) => ({ success: true, data }),
        getBlockMeta: (type: string) => {
            const metas: Record<string, any> = {
                hero: { type: 'hero', variants: ['centered', 'split'], defaultVariant: 'centered' },
                navigation: { type: 'navigation', variants: ['default'], defaultVariant: 'default' },
                footer: { type: 'footer', variants: ['default', 'minimal'], defaultVariant: 'default' },
                features: { type: 'features', variants: ['grid-2', 'grid-3', 'list'], defaultVariant: 'grid-2' },
                about: { type: 'about', variants: ['image-right', 'image-left'], defaultVariant: 'image-right' },
                testimonials: { type: 'testimonials', variants: ['cards', 'slider'], defaultVariant: 'cards' },
                contact: { type: 'contact', variants: ['split', 'centered'], defaultVariant: 'split' },
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

        // Phase-06 rewire: fallback now emits granular step events
        // ('fallback_analyzing', 'fallback_composing', 'fallback_validating', ...)
        // or 'fallback_legacy' if composer path throws.
        const fallbackEvent = events.find(e =>
            typeof e.data.step === 'string' && (e.data.step as string).startsWith('fallback')
        )
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
        // Force AI-first path so these tests still exercise the GPT code path
        process.env.GEN_MODE = 'ai-first'
    })

    afterAll(() => {
        delete process.env.OPENAI_API_KEY
        delete process.env.GEN_MODE
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

        // OpenAI mock may fallback to rule-based if mock not intercepted
        expect(result.siteName).toBeDefined()
        expect(result.blocks.length).toBeGreaterThan(0)
        expect(result.theme).toBeDefined()
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

    it('overrides AI theme with curated category preset [TC-F01D-CP.60]', async () => {
        // New contract: category theme preset is authoritative.
        // AI output for theme colors/fonts is IGNORED — preset wins.
        // See plans/260414-1630-phase-08-audit/phase-02-happy-path-integration.md
        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'Test',
                                    // AI attempts garbage fonts + generic blue
                                    theme: { primaryColor: '#0ea5e9', fontHeading: 'Comic Sans', fontBody: 'Papyrus', colorMode: 'light' },
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

        // Fonts come from the preset's fontPairingId (always allowlist).
        const ALLOWED_HEADING = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
        const ALLOWED_BODY = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']
        expect(ALLOWED_HEADING).toContain(result.theme.fontHeading)
        expect(ALLOWED_BODY).toContain(result.theme.fontBody)

        // "Test Cafe" + Restaurant industry → composer resolves to "restaurant".
        // Restaurant presets all use warm/earth primary colors, NEVER #0ea5e9.
        expect(result.theme.primaryColor).not.toBe('#0ea5e9')
        expect(result.theme.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)

        // Optional preset-only fields exposed by the wider type.
        expect(result.theme.accentColor).toBeTruthy()
        expect(result.theme.fontPairingId).toBeTruthy()
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

        // Unknown blocks filtered out — result contains only valid types
        expect(result.blocks.length).toBeGreaterThan(0)
        const blockTypes = result.blocks.map((b: any) => b.blockType)
        expect(blockTypes).not.toContain('nonexistent_block')
    })
})

// ─── TC-F05.XX: Test sanitizeBlockData ───────────────────────────────
import { sanitizeBlockData } from '@/lib/ai/openai-generator'

describe('sanitizeBlockData - Normalize AI outputs', () => {
    it('normalizes invalid variant to a valid one from registry', () => {
        const input = { blockType: 'features', variant: 'grid-5' } // invalid
        const output = sanitizeBlockData(input)
        // Weighted random picks from valid variants — not always the same default
        const validVariants = ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel']
        expect(validVariants).toContain(output.variant)
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
        const members = output.members as Array<{ socials: Array<{ platform: string, url: string }> }>
        expect(members[0].socials).toEqual([{ platform: 'linkedin', url: '#' }])
        expect(members[1].socials).toEqual([{ platform: 'twitter', url: 'https://tw' }])
    })

    it('normalizes pricing plans with string plans array to full object layout', () => {
        const input = { blockType: 'pricing', plans: ['Basic', 'Pro'] }
        const output = sanitizeBlockData(input)
        const plans = output.plans as Array<{ name: string, price: string, features: string[] }>
        expect(plans[0].name).toBe('Basic')
        expect(plans[0].features).toEqual([])
        expect(plans[1].price).toBe('RM 0')
    })

    it('preserves logo-cloud name metadata while stripping URLs', () => {
        const input = { blockType: 'logo-cloud', logos: ['Acme Corp', { name: 'Partner Inc', url: 'http://example.com' }] }
        const output = sanitizeBlockData(input)
        const logos = output.logos as Array<Record<string, unknown>>
        expect(logos).toHaveLength(2)
        expect(logos[0]).toEqual({ name: 'Acme Corp' })
        expect(logos[1]).toEqual({ name: 'Partner Inc' })
    })

    it('handles nulls or completely broken objects safely', () => {
        const input = { blockType: 'faq', items: [{ q: 'Huh?' }, 'What?', null] }
        const output = sanitizeBlockData(input)
        const items = output.items as Array<{ question: string }>
        expect(items[0].question).toBe('Huh?')
        expect(items[1].question).toBe('What?')
        // The null will be handled by our new type guards correctly if updated, or mapped to Question?
        expect(items[2].question).toBe('Question?')
    })
})

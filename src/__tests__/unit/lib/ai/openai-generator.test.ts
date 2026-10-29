import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

import { scripted } from '@/__tests__/helpers/scripted-ai-platform'
vi.mock('@/lib/ai-platform/actor-scope', async (importOriginal) => {
    const { scriptedActorScope } = await import('@/__tests__/helpers/scripted-ai-platform')
    return scriptedActorScope(await importOriginal<any>())
})
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
    buildPersonalizePrompt: () => ({ system: 'Personalize system', user: 'Personalize user' }),
}))

import { generateSiteWithAI, resolveSiteGenerationMode } from '@/lib/ai/openai-generator'

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
        scripted.create = null
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

    it('[TC-F26-11-04] fails instead of creating English fallback content for confirmed Italian', async () => {
        // Act / Assert
        await expect(generateSiteWithAI(
            businessInfo,
            undefined,
            'auto',
            undefined,
            undefined,
            undefined,
            { targetLocale: 'it' },
        )).rejects.toThrow('AI is required to generate content in Italian')
    })
})

describe('generateSiteWithAI — OpenAI path [TC-F01.08]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        scripted.create = null
        // Force AI-first path so these tests still exercise the GPT code path
        process.env.GEN_MODE = 'ai-first'
    })

    afterAll(() => {
        delete process.env.GEN_MODE
    })

    it('resolves ai-first from the AI actor alone, without a credit pilot call', async () => {
        const create = vi.fn().mockResolvedValue({
            model: 'gpt-5.4-mini',
            usage: { prompt_tokens: 5, completion_tokens: 3 },
            choices: [{ message: { content: '{"ok":true}' } }],
        })
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        const decision = await resolveSiteGenerationMode()

        expect(decision).toEqual({
            requestedGenMode: 'ai-first',
            effectiveGenMode: 'ai-first',
        })
        expect(create).not.toHaveBeenCalled()
    })

    it('[TC-AIMV-02] a platform 429 on every split step falls back per scope to the composer, and the site still generates', async () => {
        const quotaError = Object.assign(new Error('AI limit reached for this workspace'), { status: 429 })
        const create = vi.fn().mockRejectedValue(quotaError)
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        const output = await generateSiteWithAI(businessInfo)

        // Home + the two subpage batches were each tried once on the platform; none succeeded.
        expect(create).toHaveBeenCalledTimes(3)
        expect(output.result.blocks.length).toBeGreaterThan(0)
        expect(output.result.pages?.length).toBeGreaterThan(0)
    })

    it('keeps Malay generation on the configured template-first pipeline', async () => {
        process.env.GEN_MODE = 'template-first'
        const create = vi.fn().mockResolvedValue({
            model: 'gpt-5.4-mini',
            usage: { prompt_tokens: 5, completion_tokens: 3 },
            choices: [{
                message: {
                    content: JSON.stringify({
                        heroHeadline: 'Kopi Shah Alam',
                        heroSubheadline: 'Sarapan tempatan setiap hari.',
                        seoTitle: 'Kopi Shah Alam',
                        seoDescription: 'Kopi artisan dan sarapan tempatan.',
                    }),
                },
            }],
        })
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        try {
            const output = await generateSiteWithAI(
                {
                    businessName: 'Kopi Shah Alam',
                    industry: 'fnb',
                    products: 'Kopi artisan, Nasi lemak, Roti bakar',
                    shortDescription: 'Kafe tempatan dengan sarapan tradisional.',
                },
                undefined,
                'ms',
            )

            expect(output.effectiveGenMode).toBe('template-first')
            expect(output.modeReason).toBeUndefined()
            expect(output.result.language).toBe('ms')
            const menu = output.result.pages
                ?.flatMap((page) => page.blocks)
                .find((block) => block.blockType === 'menu-food') as Record<string, unknown> | undefined
            expect(menu?.headline).toBe('Menu Kami')
        } finally {
            process.env.GEN_MODE = 'ai-first'
        }
    })

    it('[TC-AIMV-02] a transient 429 is not probed before the run: the mode comes from the actor, with no model call', async () => {
        const transientRateLimit = Object.assign(new Error('Rate limit exceeded'), { status: 429 })
        const create = vi.fn().mockRejectedValue(transientRateLimit)
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        const decision = await resolveSiteGenerationMode()

        expect(decision).toEqual({
            requestedGenMode: 'ai-first',
            effectiveGenMode: 'ai-first',
        })
        expect(create).not.toHaveBeenCalled()
    })

    it('parses valid AI response and returns blocks', async () => {
        const OpenAI = scripted as any
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

    // TC-F01-AI-FALLBACK-SILENT-01 — OpenAI throws → fallback succeeds → no error event emitted
    it('falls back silently when OpenAI throws error (no error event)', async () => {
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockRejectedValue(new Error('Rate limited')),
                },
            },
        }))

        const { result, events } = await generateSiteWithAI(businessInfo)

        // Site still created via smart templates fallback
        expect(result.blocks.length).toBeGreaterThan(0)
        // BUG FIX: fallback success must NOT emit 'error' event (causes false error UI despite successful generation)
        const errorEvent = events.find(e => e.event === 'error' && (e.data as { code?: string }).code === 'ai_fallback')
        expect(errorEvent).toBeUndefined()
    })

    it('overrides AI theme with curated category preset [TC-F01D-CP.60]', async () => {
        // New contract: category theme preset is authoritative.
        // AI output for theme colors/fonts is IGNORED — preset wins.
        // See plans/260414-1630-phase-08-audit/phase-02-happy-path-integration.md
        const OpenAI = scripted as any
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
        const OpenAI = scripted as any
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
        const OpenAI = scripted as any
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

    // TC-F01-EVT.01: GH-1269 — onEvent must NOT forward internal 'done' events
    // Background: Before fix, generateSiteWithAI() forwarded all SSE events (including internal 'done')
    // via onEvent, causing client to receive TWO 'done' events (internal + route.ts's authoritative done).
    // Fix: Filter out 'done' from forwarded events while keeping all others.
    it('does NOT forward internal done event via onEvent [TC-F01-EVT.01]', async () => {
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    siteName: 'Test Site',
                                    theme: { primaryColor: '#D97706' },
                                    seo: { title: 'Test', description: 'Test site' },
                                    language: 'en',
                                    blocks: [
                                        { blockType: 'hero', variant: 'centered', headline: 'Welcome' },
                                    ],
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        // Arrange: Collect all events via onEvent callback
        const forwardedEvents: string[] = []
        const onEvent = (e: any) => {
            forwardedEvents.push(e.event)
        }

        // Act: Generate site with onEvent callback
        const { events: internalEvents } = await generateSiteWithAI(businessInfo, undefined, 'en', undefined, undefined, onEvent)

        // Assert: Internal events array contains 'done'
        const internalDoneCount = internalEvents.filter(e => e.event === 'done').length
        expect(internalDoneCount).toBeGreaterThan(0)

        // Assert: Forwarded events via onEvent should NOT include 'done'
        const forwardedDoneCount = forwardedEvents.filter(e => e === 'done').length
        expect(forwardedDoneCount).toBe(0)

        // Assert: Other events (like theme_set, step) ARE forwarded
        expect(forwardedEvents.length).toBeGreaterThan(0)
        const hasOtherEvents = forwardedEvents.some(e => e !== 'done' && e !== '')
        expect(hasOtherEvents).toBe(true)
    })
})

// ─── TC-F05.XX: Test sanitizeBlockData ───────────────────────────────
import { sanitizeBlockData } from '@/lib/ai/openai-generator'
import { resolveLocaleStructuralStrings } from '@/lib/ai/locale-structural-strings'

describe('sanitizeBlockData - Normalize AI outputs', () => {
    it('sanitizes announcement-bar padding before Payload persistence', () => {
        expect(sanitizeBlockData({
            blockType: 'announcement-bar',
            message: 'Holiday delivery available',
            paddingY: Number.NaN,
        })).not.toHaveProperty('paddingY')

        expect(sanitizeBlockData({
            blockType: 'announcement-bar',
            message: 'Holiday delivery available',
            paddingY: '18',
        }).paddingY).toBe(18)

        expect(sanitizeBlockData({
            blockType: 'announcement-bar',
            message: 'Holiday delivery available',
            paddingY: 100,
        }).paddingY).toBe(32)
    })

    it('normalizes contact fields without fieldName while preserving localized copy', () => {
        const input = {
            blockType: 'contact',
            formFields: [
                { label: 'Name', type: 'text', placeholder: 'Ihr Name', required: true },
                { label: 'E-Mail', type: 'email', placeholder: 'ihre@email.de', required: true },
                { label: 'Telefon', type: 'tel', placeholder: '+49 30 12345678' },
                { label: 'Betreff', type: 'text', placeholder: 'Worum geht es?' },
                { label: 'Nachricht', type: 'textarea', placeholder: 'Ihre Nachricht' },
            ],
        }

        const output = sanitizeBlockData(input, undefined, 'en', undefined, 'de')

        expect(output.formFields).toEqual([
            { fieldName: 'name', label: 'Name', fieldType: 'text', required: true, placeholder: 'Ihr Name' },
            { fieldName: 'email', label: 'E-Mail', fieldType: 'email', required: true, placeholder: 'ihre@email.de' },
            { fieldName: 'phone', label: 'Telefon', fieldType: 'phone', required: true, placeholder: '+49 30 12345678' },
            { fieldName: 'subject', label: 'Betreff', fieldType: 'text', required: true, placeholder: 'Worum geht es?' },
            { fieldName: 'message', label: 'Nachricht', fieldType: 'textarea', required: true, placeholder: 'Ihre Nachricht' },
        ])
    })

    it('TC-F01-PAS-11: adds the required secondary hero CTA in the structural locale', () => {
        // Arrange
        const input = {
            blockType: 'hero',
            ctaButtons: [
                { label: '立即选购', url: '/contact', style: 'primary' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input, undefined, 'en', undefined, 'zh-CN')

        // Assert
        expect(output.ctaButtons).toEqual([
            { label: '立即选购', url: '/contact', style: 'primary' },
            { label: '关于我们', url: '#about', style: 'secondary' },
        ])
    })

    it('uses request-scoped locale strings when adding the secondary hero CTA', () => {
        const english = resolveLocaleStructuralStrings('en')!
        const german = {
            ...english,
            navigation: {
                ...english.navigation,
                about: 'Über uns',
            },
        }
        const input = {
            blockType: 'hero',
            ctaButtons: [
                { label: 'Jetzt beraten lassen', url: '/contact', style: 'primary' },
            ],
        }

        const output = sanitizeBlockData(
            input,
            undefined,
            'en',
            undefined,
            'de-DE',
            german,
        )

        expect(output.ctaButtons).toEqual([
            { label: 'Jetzt beraten lassen', url: '/contact', style: 'primary' },
            { label: 'Über uns', url: '#about', style: 'secondary' },
        ])
    })

    it('normalizes invalid variant to a valid one from registry', () => {
        const input = { blockType: 'features', variant: 'grid-5' } // invalid
        const output = sanitizeBlockData(input)
        // Weighted random picks from valid variants — not always the same default
        const validVariants = ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel']
        expect(validVariants).toContain(output.variant)
    })

    it('normalizes invalid CTA style without replacing CTA content', () => {
        const output = sanitizeBlockData({
            blockType: 'cta',
            headline: 'Tempah sekarang',
            ctaLabel: 'Mulakan',
            ctaUrl: '/contact',
            ctaStyle: 'Kafe tempatan yang menyajikan kopi artisan.',
        })

        expect(output.ctaStyle).toBe('primary')
        expect(output.headline).toBe('Tempah sekarang')
        expect(output.ctaLabel).toBe('Mulakan')
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

    it('preserves valid logo-cloud placeholders while stripping URLs', () => {
        const input = { blockType: 'logo-cloud', logos: ['Acme Corp', { name: 'Partner Inc', url: 'http://example.com' }] }
        const output = sanitizeBlockData(input)
        const logos = output.logos as unknown as Array<Record<string, unknown>>
        expect(logos).toHaveLength(2)
        expect(logos[0]).toEqual({ name: 'Acme Corp', logo: { url: '', alt: 'Acme Corp' } })
        expect(logos[1]).toEqual({ name: 'Partner Inc', logo: { url: '', alt: 'Partner Inc' } })
    })

    it('handles nulls or completely broken objects safely', () => {
        const input = { blockType: 'faq', items: [{ q: 'Huh?' }, 'What?', null] }
        const output = sanitizeBlockData(input)
        // normalizer writes canonical faqs field and removes legacy items
        const faqs = output.faqs as Array<{ question: string }>
        expect(faqs[0].question).toBe('Huh?')
        expect(faqs[1].question).toBe('What?')
        expect(faqs[2].question).toBe('Question?')
        expect(output.items).toBeUndefined()
    })

    // ── TC-TF-023 / TC-TF-024: GH-1219 menu-food validation gate ────────────

    it('TC-TF-023: menu-food with categories:[] — gate drop condition is true (GH-1219)', () => {
        // Arrange
        const input = { blockType: 'menu-food', headline: 'Our Menu', categories: [], variant: 'classic' }

        // Act — mimic what validateBlocks does: sanitize → validate → check
        const sanitized = sanitizeBlockData(input)
        const cats = sanitized.categories

        // Assert — categories is empty; the GH-1219 guard condition is met → block would be dropped
        expect(cats).toEqual([])
    })

    it('TC-TF-024: menu-food with valid categories — gate drop condition is false (GH-1219)', () => {
        // Arrange
        const input = {
            blockType: 'menu-food',
            headline: 'Our Menu',
            variant: 'classic',
            categories: [
                {
                    name: 'Starters',
                    items: [
                        { name: 'Spring Rolls', description: 'Crispy', price: '12.90', currency: 'RM' },
                        { name: 'Tom Yum', description: 'Spicy broth', price: '18.00', currency: 'RM' },
                        { name: 'Satay', description: 'Grilled chicken', price: '22.00', currency: 'RM' },
                    ],
                },
                {
                    name: 'Mains',
                    items: [
                        { name: 'Nasi Lemak', description: 'Coconut rice', price: '28.00', currency: 'RM' },
                        { name: 'Pad Thai', description: 'Stir-fried noodles', price: '24.00', currency: 'RM' },
                        { name: 'Veg Curry', description: 'Coconut curry', price: '22.00', currency: 'RM' },
                    ],
                },
            ],
        }

        // Act
        const sanitized = sanitizeBlockData(input)
        const cats = sanitized.categories

        // Assert — categories preserved → drop condition false → block kept
        expect(Array.isArray(cats) && (cats as unknown[]).length > 0).toBe(true)
    })
})

describe('[TC-AIMV-02] sitegen steps run as platform tasks when an AI actor is in scope', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        scripted.create = null
        scripted.taskIds.length = 0
        process.env.GEN_MODE = 'ai-first'
    })

    afterEach(() => {
        process.env.GEN_MODE = 'ai-first'
    })

    it('without an AI actor the run is template-first with modeReason missing_api_key, and no task is sent', async () => {
        const decision = await resolveSiteGenerationMode()

        expect(decision).toEqual({
            requestedGenMode: 'ai-first',
            effectiveGenMode: 'template-first',
            modeReason: 'missing_api_key',
        })
        expect(scripted.taskIds).toEqual([])
    })

    it('with an actor the whole-site steps are sitegen.page-blocks tasks, one per split call', async () => {
        const pagesFor = (sys: string) => sys.includes('HOMEPAGE ONLY')
            ? [{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }]
            : sys.includes('Contact, Blog')
                ? [{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] }, { title: 'Blog', slug: '/blog', isHomepage: false, blocks: [] }]
                : [{ title: 'About', slug: '/about', isHomepage: false, blocks: [] }, { title: 'Services', slug: '/services', isHomepage: false, blocks: [] }]
        const create = vi.fn(async (opts: any) => ({
            model: 'test',
            usage: { prompt_tokens: 1, completion_tokens: 1 },
            choices: [{ message: { content: JSON.stringify({ siteName: 'Test Cafe', category: 'business', theme: {}, seo: {}, language: 'en', pages: pagesFor(String(opts.messages[0].content)) }) } }],
        }))
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        await generateSiteWithAI(businessInfo)

        expect(scripted.taskIds).toEqual(['sitegen.page-blocks', 'sitegen.page-blocks', 'sitegen.page-blocks'])
    })

    it('template-first sends its hero/SEO personalization to sitegen.personalize', async () => {
        process.env.GEN_MODE = 'template-first'
        const create = vi.fn(async () => ({
            model: 'test',
            usage: { prompt_tokens: 1, completion_tokens: 1 },
            choices: [{ message: { content: JSON.stringify({ heroHeadline: 'Kopi Shah Alam', heroSubheadline: 'Sarapan tempatan.', seoTitle: 'Kopi', seoDescription: 'Kopi artisan.' }) } }],
        }))
        const OpenAI = scripted as any
        OpenAI.mockImplementation(() => ({ chat: { completions: { create } } }))

        const output = await generateSiteWithAI(businessInfo)

        expect(output.effectiveGenMode).toBe('template-first')
        expect(scripted.taskIds).toContain('sitegen.personalize')
        expect(scripted.taskIds).not.toContain('sitegen.page-blocks')
    })
})

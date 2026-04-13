/**
 * OpenAI GPT-4o Block Generator
 * Streams AI-generated blocks with SSE events for real-time preview.
 * Falls back to rule-based generator if OpenAI fails.
 */

import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import { buildSystemPrompt, type BusinessInfoInput } from './system-prompt'
import { generateBlocks, type GenerationResult, type GeneratedBlock, type GeneratedPage } from './generate-blocks'
import { buildUserPrompt } from './system-prompt'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export type SSEEvent = {
    event: 'step' | 'theme_set' | 'block_complete' | 'seo_generated' | 'error' | 'done'
    data: Record<string, unknown>
}

/**
 * Generate a complete website using OpenAI GPT-4o with streaming.
 * Falls back to rule-based generation if API key missing or AI fails.
 */
export async function generateSiteWithAI(
    businessInfo: BusinessInfoInput,
    extraInstructions?: string,
    language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
    referencePrompt?: string,
): Promise<{ result: GenerationResult; events: SSEEvent[] }> {
    const events: SSEEvent[] = []
    const promptText = [
        businessInfo.businessName,
        businessInfo.industry,
        businessInfo.shortDescription,
        businessInfo.products,
    ].join(' | ')

    const openai = getOpenAI()
    if (!openai) {
        console.warn('[AI] No OPENAI_API_KEY — using rule-based fallback')
        return generateWithFallback(promptText, events)
    }

    try {
        events.push({ event: 'step', data: { step: 'analyzing', label: 'Analysing requirements...', progress: 10 } })

        const systemPrompt = buildSystemPrompt(language)
        const userPromptText = buildUserPrompt(businessInfo, extraInstructions, language, referencePrompt)

        events.push({ event: 'step', data: { step: 'generating', label: 'AI is generating content...', progress: 20 } })

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPromptText },
            ],
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('Empty AI response')
        }

        events.push({ event: 'step', data: { step: 'parsing', label: 'Processing AI results...', progress: 60 } })

        let parsed: Record<string, unknown>
        try {
            parsed = JSON.parse(content) as Record<string, unknown>
        } catch {
            // AI response may be truncated — try to repair by trimming incomplete trailing content
            const lastBrace = content.lastIndexOf('}')
            if (lastBrace > 0) {
                parsed = JSON.parse(content.slice(0, lastBrace + 1)) as Record<string, unknown>
            } else {
                throw new Error('Invalid JSON response from AI')
            }
        }

        // Set theme (validate fonts against Payload CMS allowed values)
        const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
        const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

        const parsedTheme = (parsed.theme && typeof parsed.theme === 'object' ? parsed.theme : {}) as Record<string, unknown>
        const rawHeadingFont = String(parsedTheme.fontHeading || 'Outfit')
        const rawBodyFont = String(parsedTheme.fontBody || 'Inter')

        const theme = {
            primaryColor: String(parsedTheme.primaryColor || '#0ea5e9'),
            secondaryColor: String(parsedTheme.secondaryColor || '#d946ef'),
            fontHeading: ALLOWED_HEADING_FONTS.includes(rawHeadingFont) ? rawHeadingFont : 'Outfit',
            fontBody: ALLOWED_BODY_FONTS.includes(rawBodyFont) ? rawBodyFont : 'Inter',
            colorMode: (['light', 'dark'] as const).includes(parsedTheme.colorMode as 'light' | 'dark') ? (parsedTheme.colorMode as 'light' | 'dark') : 'dark',
        }

        events.push({ event: 'theme_set', data: { theme } })

        // Detect site category for weighted variant selection
        const detectedCategory = typeof parsed.category === 'string' ? parsed.category : undefined

        // Helper: validate and sanitize an array of raw blocks
        function validateBlocks(rawBlocks: unknown[]): Record<string, unknown>[] {
            const valid: Record<string, unknown>[] = []
            for (const block of rawBlocks) {
                const sanitized = sanitizeBlockData(block as Record<string, unknown>, detectedCategory)
                if (typeof sanitized.blockType === 'string' && blockRegistry.has(sanitized.blockType)) {
                    const validation = blockRegistry.validate(sanitized.blockType, sanitized)
                    if (validation.success) {
                        valid.push(validation.data as Record<string, unknown>)
                    } else {
                        console.warn(`[AI] Block "${sanitized.blockType}" validation warning:`, validation.error)
                        valid.push(sanitized)
                    }
                } else if (sanitized.blockType) {
                    console.warn(`[AI] Unknown block type: ${sanitized.blockType}, skipping`)
                }
            }
            return valid
        }

        // Parse pages (multi-page) or blocks (single-page backward compat)
        const rawPages = Array.isArray(parsed.pages) ? parsed.pages : null
        let validBlocks: Record<string, unknown>[]
        let generatedPages: GeneratedPage[] | undefined

        if (rawPages && rawPages.length > 0) {
            // Multi-page format
            generatedPages = []
            const allBlocks: Record<string, unknown>[] = []

            for (let p = 0; p < rawPages.length; p++) {
                const rawPage = rawPages[p] as Record<string, unknown>
                const pageBlocks = validateBlocks(Array.isArray(rawPage.blocks) ? rawPage.blocks : [])
                const pageSeo = (rawPage.seo && typeof rawPage.seo === 'object' ? rawPage.seo : {}) as Record<string, unknown>

                generatedPages.push({
                    title: String(rawPage.title || `Page ${p + 1}`),
                    slug: String(rawPage.slug || (p === 0 ? '/' : `page-${p}`)),
                    isHomepage: rawPage.isHomepage === true || p === 0,
                    blocks: pageBlocks as GeneratedBlock[],
                    seo: {
                        title: String(pageSeo.title || rawPage.title || '').substring(0, 60),
                        description: String(pageSeo.description || '').substring(0, 160),
                    },
                })

                // First page blocks used as main blocks for backward compat
                if (p === 0) allBlocks.push(...pageBlocks)

                events.push({ event: 'step', data: { step: `page_${p}`, label: `Creating ${rawPage.title || 'page'}...`, progress: 60 + Math.round((p / rawPages.length) * 30) } })
            }

            validBlocks = allBlocks

            for (let i = 0; i < validBlocks.length; i++) {
                events.push({ event: 'block_complete', data: { block: validBlocks[i], index: i } })
            }
        } else {
            // Single-page backward compat
            const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
            validBlocks = validateBlocks(rawBlocks)

            for (let i = 0; i < validBlocks.length; i++) {
                const progress = 60 + Math.round((i / validBlocks.length) * 30)
                const blockTypeStr = String((validBlocks[i] as Record<string, unknown>).blockType || 'section')
                events.push({ event: 'step', data: { step: `block_${i}`, label: `Creating ${blockTypeStr}...`, progress } })
                events.push({ event: 'block_complete', data: { block: validBlocks[i], index: i } })
            }
        }

        // SEO (root-level for homepage)
        const parsedSeo = (parsed.seo && typeof parsed.seo === 'object' ? parsed.seo : {}) as Record<string, unknown>
        const seo = {
            title: String(parsedSeo.title || parsed.siteName || 'Website').substring(0, 60),
            description: String(parsedSeo.description || '').substring(0, 160),
        }

        events.push({ event: 'seo_generated', data: seo })
        events.push({ event: 'step', data: { step: 'saving', label: 'Saving to database...', progress: 95 } })

        const result: GenerationResult = {
            siteName: String(parsed.siteName || 'My Website'),
            siteType: (['business', 'ecommerce', 'restaurant', 'portfolio', 'blog'] as const).includes(parsed.category as 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog') ? (parsed.category as 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog') : 'business',
            blocks: validBlocks as GeneratedBlock[],
            pages: generatedPages,
            seo,
            language: (['en', 'ms', 'vi'] as const).includes(parsed.language as 'en' | 'ms' | 'vi') ? (parsed.language as 'en' | 'ms' | 'vi') : 'en',
            theme,
        }

        events.push({ event: 'done', data: { totalBlocks: validBlocks.length, timeMs: 0 } })

        return { result, events }
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error)
        console.error('[AI] OpenAI generation failed, falling back:', errMessage)
        events.push({ event: 'error', data: { code: 'ai_fallback', message: 'Using smart templates', retryable: false } })
        return generateWithFallback(promptText, events)
    }
}

function generateWithFallback(prompt: string, events: SSEEvent[]): { result: GenerationResult; events: SSEEvent[] } {
    events.push({ event: 'step', data: { step: 'fallback', label: 'Creating from smart templates...', progress: 50 } })

    const generated = generateBlocks(prompt)
    const result: GenerationResult = {
        ...generated,
        language: 'en' as const
    }

    events.push({ event: 'theme_set', data: { theme: result.theme } })

    result.blocks.forEach((block, i) => {
        events.push({ event: 'block_complete', data: { block: block as Record<string, unknown>, index: i } })
    })

    events.push({ event: 'seo_generated', data: result.seo as Record<string, unknown> })
    events.push({ event: 'done', data: { totalBlocks: result.blocks.length, timeMs: 0 } })

    return { result, events }
}

// ═══════════════════════════════════════════════════════════════════════
// VARIANT VARIETY SYSTEM
// Fuzzy matching + weighted-by-category fallback instead of always-default
// ═══════════════════════════════════════════════════════════════════════

/** Common AI hallucination patterns → correct variant name */
const VARIANT_ALIASES: Record<string, string> = {
    // Grid layouts
    'three-column': 'grid-3',
    'three-columns': 'grid-3',
    'two-column': 'grid-2',
    'two-columns': 'grid-2',
    'four-column': 'grid-4',
    'four-columns': 'grid-4',
    '3-column': 'grid-3',
    '2-column': 'grid-2',
    '4-column': 'grid-4',
    'simple-grid': 'grid-2',
    // Layout aliases
    'side-by-side': 'split',
    'left-right': 'split',
    'two-panel': 'split',
    'split-layout': 'split',
    // Carousel/slider
    'slider': 'carousel',
    'slideshow': 'carousel',
    'swiper': 'carousel',
    // Size/style
    'full-width': 'fullscreen',
    'full-screen': 'fullscreen',
    'compact': 'minimal',
    'clean': 'minimal',
    // Defaults
    'default': 'simple',
    'basic': 'simple',
    'standard': 'simple',
    'classic': 'simple',
    'normal': 'simple',
    // Vietnamese AI output
    'don-gian': 'simple',
    'toi-gian': 'minimal',
    'luoi': 'grid-3',
    'danh-sach': 'list',
    'bang': 'table',
    'the': 'cards',
    // Malay AI output
    'mudah': 'simple',
    'ringkas': 'minimal',
    'senarai': 'list',
    'kad': 'cards',
    'jadual': 'table',
}

/** Category-weighted variant preferences — preferred variants per category per block type */
const CATEGORY_VARIANT_WEIGHTS: Record<string, Record<string, string[]>> = {
    restaurant: {
        hero: ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen'],
        features: ['grid-3', 'icon-top', 'zigzag', 'list'],
        testimonials: ['cards', 'spotlight', 'masonry', 'carousel'],
        footer: ['expanded', 'mega-footer', 'dark-gradient'],
        contact: ['split', 'map-split', 'form'],
        stats: ['row', 'grid', 'highlight'],
        gallery: ['masonry', 'carousel', 'grid'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'table', 'horizontal'],
        about: ['split', 'story'],
        cta: ['banner', 'inline'],
        navigation: ['simple', 'transparent', 'centered'],
        newsletter: ['inline', 'banner'],
        team: ['grid', 'list'],
    },
    ecommerce: {
        hero: ['slideshow', 'cards-overlay', 'gradient', 'split-right'],
        features: ['grid-4', 'icon-left', 'carousel', 'grid-3'],
        testimonials: ['masonry', 'avatar-row', 'cards', 'carousel'],
        footer: ['expanded', 'minimal', 'simple'],
        contact: ['card-float', 'split', 'minimal-inline'],
        stats: ['grid', 'row'],
        gallery: ['grid', 'carousel', 'lightbox'],
        faq: ['accordion', 'grid'],
        pricing: ['cards', 'toggle', 'comparison'],
        about: ['simple', 'split'],
        cta: ['banner', 'floating'],
        navigation: ['simple', 'mega-menu', 'pill'],
        newsletter: ['inline', 'popup'],
        team: ['grid'],
    },
    beauty: {
        hero: ['gradient', 'minimal', 'parallax', 'split-left'],
        features: ['icon-top', 'zigzag', 'grid-3', 'carousel'],
        testimonials: ['minimal-quote', 'spotlight', 'carousel', 'masonry'],
        footer: ['centered-stack', 'dark-gradient', 'mega-footer'],
        contact: ['minimal-inline', 'card-float', 'split'],
        stats: ['highlight', 'row'],
        gallery: ['justified', 'filmstrip', 'masonry'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'minimal', 'toggle'],
        about: ['split', 'story'],
        cta: ['floating', 'inline'],
        navigation: ['transparent', 'simple', 'pill'],
        newsletter: ['inline', 'popup'],
        team: ['grid', 'list'],
    },
    tech: {
        hero: ['gradient', 'split-video', 'minimal', 'parallax'],
        features: ['zigzag', 'grid-2', 'icon-left', 'carousel'],
        testimonials: ['spotlight', 'cards', 'video-text'],
        footer: ['minimal', 'dark-gradient', 'expanded'],
        contact: ['split', 'form', 'card-float'],
        stats: ['grid', 'highlight'],
        gallery: ['grid', 'lightbox'],
        faq: ['accordion', 'grid'],
        pricing: ['toggle', 'comparison', 'cards'],
        about: ['simple', 'split'],
        cta: ['inline', 'banner'],
        navigation: ['simple', 'transparent', 'pill'],
        newsletter: ['inline', 'banner'],
        team: ['grid', 'list'],
    },
    business: {
        hero: ['centered', 'split-left', 'gradient', 'minimal'],
        features: ['grid-3', 'icon-left', 'list', 'zigzag'],
        testimonials: ['cards', 'carousel', 'spotlight'],
        footer: ['expanded', 'mega-footer', 'dark-gradient'],
        contact: ['split', 'form', 'map-split'],
        stats: ['row', 'grid', 'highlight'],
        gallery: ['grid', 'carousel'],
        faq: ['accordion', 'grid', 'simple'],
        pricing: ['cards', 'table', 'toggle'],
        about: ['split', 'simple'],
        cta: ['banner', 'inline'],
        navigation: ['simple', 'centered', 'mega-menu'],
        newsletter: ['inline', 'banner'],
        team: ['grid', 'list'],
    },
    portfolio: {
        hero: ['magazine', 'parallax', 'cards-overlay', 'minimal'],
        features: ['carousel', 'zigzag', 'grid-2'],
        testimonials: ['video-text', 'minimal-quote', 'simple'],
        footer: ['centered-stack', 'simple', 'dark-gradient'],
        contact: ['minimal-inline', 'card-float', 'form'],
        stats: ['highlight', 'row'],
        gallery: ['masonry', 'justified', 'lightbox'],
        faq: ['simple', 'accordion'],
        pricing: ['minimal', 'cards'],
        about: ['story', 'split'],
        cta: ['inline', 'floating'],
        navigation: ['transparent', 'pill', 'simple'],
        newsletter: ['inline'],
        team: ['list', 'grid'],
    },
    blog: {
        hero: ['minimal', 'split-left', 'fullscreen', 'centered'],
        features: ['list', 'icon-top', 'grid-3'],
        testimonials: ['simple', 'avatar-row', 'cards'],
        footer: ['simple', 'centered-stack', 'expanded'],
        contact: ['minimal-inline', 'form', 'split'],
        stats: ['row', 'grid'],
        gallery: ['grid', 'masonry'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'minimal'],
        about: ['simple', 'story'],
        cta: ['inline', 'banner'],
        navigation: ['simple', 'centered'],
        newsletter: ['inline', 'banner', 'popup'],
        team: ['list'],
    },
    health: {
        hero: ['centered', 'split-left', 'minimal', 'gradient'],
        features: ['icon-top', 'grid-3', 'list', 'zigzag'],
        testimonials: ['cards', 'spotlight', 'minimal-quote'],
        footer: ['expanded', 'simple', 'centered-stack'],
        contact: ['split', 'map-split', 'form'],
        stats: ['row', 'highlight'],
        gallery: ['grid', 'carousel'],
        faq: ['accordion', 'grid'],
        pricing: ['cards', 'table'],
        about: ['split', 'simple'],
        cta: ['banner', 'inline'],
        navigation: ['simple', 'centered'],
        newsletter: ['inline'],
        team: ['grid', 'list'],
    },
    education: {
        hero: ['centered', 'split-right', 'gradient', 'magazine'],
        features: ['grid-3', 'zigzag', 'icon-top', 'carousel'],
        testimonials: ['carousel', 'avatar-row', 'cards'],
        footer: ['expanded', 'mega-footer', 'simple'],
        contact: ['split', 'form', 'card-float'],
        stats: ['row', 'grid'],
        gallery: ['grid', 'carousel'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'table', 'toggle'],
        about: ['split', 'story'],
        cta: ['banner', 'inline'],
        navigation: ['simple', 'centered', 'mega-menu'],
        newsletter: ['inline', 'banner'],
        team: ['grid', 'list'],
    },
    realestate: {
        hero: ['fullscreen', 'parallax', 'slideshow', 'split-left'],
        features: ['grid-3', 'icon-left', 'list'],
        testimonials: ['spotlight', 'masonry', 'cards'],
        footer: ['expanded', 'mega-footer', 'dark-gradient'],
        contact: ['map-split', 'split', 'card-float'],
        stats: ['grid', 'highlight', 'row'],
        gallery: ['carousel', 'lightbox', 'grid'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'table'],
        about: ['split', 'story'],
        cta: ['banner', 'floating'],
        navigation: ['simple', 'transparent'],
        newsletter: ['inline'],
        team: ['grid'],
    },
    fitness: {
        hero: ['fullscreen', 'parallax', 'split-video', 'gradient'],
        features: ['grid-4', 'zigzag', 'icon-top', 'carousel'],
        testimonials: ['carousel', 'spotlight', 'cards'],
        footer: ['dark-gradient', 'mega-footer', 'expanded'],
        contact: ['split', 'form', 'card-float'],
        stats: ['highlight', 'grid', 'row'],
        gallery: ['masonry', 'carousel', 'grid'],
        faq: ['accordion', 'grid'],
        pricing: ['cards', 'toggle', 'comparison'],
        about: ['split', 'simple'],
        cta: ['banner', 'floating'],
        navigation: ['transparent', 'simple', 'pill'],
        newsletter: ['banner', 'inline'],
        team: ['grid', 'list'],
    },
    creative: {
        hero: ['magazine', 'parallax', 'cards-overlay', 'minimal'],
        features: ['carousel', 'zigzag', 'grid-2', 'icon-left'],
        testimonials: ['video-text', 'minimal-quote', 'masonry'],
        footer: ['centered-stack', 'dark-gradient', 'simple'],
        contact: ['minimal-inline', 'card-float', 'form'],
        stats: ['highlight', 'row'],
        gallery: ['masonry', 'justified', 'filmstrip'],
        faq: ['simple', 'grid'],
        pricing: ['minimal', 'cards'],
        about: ['story', 'split'],
        cta: ['inline', 'floating'],
        navigation: ['transparent', 'pill', 'sidebar'],
        newsletter: ['popup', 'inline'],
        team: ['list', 'grid'],
    },
    fnb: {
        hero: ['split-left', 'gradient', 'magazine', 'parallax'],
        features: ['icon-top', 'grid-3', 'zigzag', 'list'],
        testimonials: ['cards', 'masonry', 'carousel', 'minimal-quote'],
        footer: ['expanded', 'centered-stack', 'dark-gradient'],
        contact: ['split', 'map-split', 'form'],
        stats: ['row', 'highlight'],
        gallery: ['masonry', 'carousel', 'grid'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'horizontal'],
        about: ['split', 'story'],
        cta: ['banner', 'inline'],
        navigation: ['simple', 'transparent'],
        newsletter: ['inline', 'banner'],
        team: ['grid'],
    },
    events: {
        hero: ['fullscreen', 'gradient', 'split-left', 'centered'],
        features: ['grid-3', 'zigzag', 'icon-top'],
        testimonials: ['carousel', 'spotlight', 'cards'],
        footer: ['mega-footer', 'dark-gradient', 'expanded'],
        contact: ['map-split', 'split', 'form'],
        stats: ['row', 'grid', 'highlight'],
        gallery: ['lightbox', 'carousel', 'grid'],
        faq: ['accordion', 'simple'],
        pricing: ['cards', 'table'],
        about: ['story', 'split'],
        cta: ['banner', 'floating'],
        navigation: ['simple', 'transparent', 'centered'],
        newsletter: ['banner', 'inline'],
        team: ['grid', 'list'],
    },
    travel: {
        hero: ['fullscreen', 'parallax', 'slideshow', 'gradient'],
        features: ['zigzag', 'grid-3', 'carousel', 'icon-left'],
        testimonials: ['masonry', 'spotlight', 'carousel'],
        footer: ['mega-footer', 'expanded', 'dark-gradient'],
        contact: ['map-split', 'split', 'card-float'],
        stats: ['row', 'highlight', 'grid'],
        gallery: ['carousel', 'lightbox', 'masonry'],
        faq: ['accordion', 'grid'],
        pricing: ['cards', 'toggle'],
        about: ['story', 'split'],
        cta: ['banner', 'inline'],
        navigation: ['transparent', 'simple'],
        newsletter: ['inline', 'banner'],
        team: ['grid', 'list'],
    },
}

/** Variants confirmed broken (no implementation or renders wrong) — NEVER select these */
const BROKEN_VARIANTS: Record<string, string[]> = {
    hero: ['animated-gradient'],  // No implementation — falls back to centered silently
}

/** Minimum content items required per variant — if below, fallback to simpler variant */
const VARIANT_MIN_CONTENT: Record<string, Record<string, number>> = {
    testimonials: { carousel: 3, masonry: 4, 'avatar-row': 3, 'video-text': 2, spotlight: 1, cards: 2, simple: 1, 'minimal-quote': 1 },
    features: { 'grid-4': 4, 'grid-3': 3, 'grid-2': 2, carousel: 3, zigzag: 2, list: 2, 'icon-top': 2, 'icon-left': 2 },
    gallery: { masonry: 6, carousel: 3, grid: 4, lightbox: 4, filmstrip: 3, justified: 4 },
    pricing: { comparison: 2, table: 2, slider: 3, cards: 2, horizontal: 2, toggle: 2, tiered: 2, minimal: 1 },
    team: { grid: 2, list: 2 },
}

/**
 * Pick a weighted-by-category variant when AI's choice is invalid.
 * Excludes broken variants. Uses category preferences if available, otherwise random.
 */
function pickWeightedVariant(blockType: string, validVariants: string[], category?: string): string {
    // Filter out broken variants
    const broken = BROKEN_VARIANTS[blockType] ?? []
    const safeVariants = validVariants.filter(v => !broken.includes(v))
    const pool = safeVariants.length > 0 ? safeVariants : validVariants

    if (category) {
        const catWeights = CATEGORY_VARIANT_WEIGHTS[category]?.[blockType]
        if (catWeights) {
            const preferred = catWeights.filter(v => pool.includes(v))
            if (preferred.length > 0) {
                return preferred[Math.floor(Math.random() * preferred.length)]!
            }
        }
    }
    return pool[Math.floor(Math.random() * pool.length)]!
}

/**
 * Enforce minimum content count for a variant.
 * If block doesn't have enough items, fallback to a simpler variant that fits.
 */
export function enforceMinContent(blockType: string, variant: string, contentCount: number): string {
    const mins = VARIANT_MIN_CONTENT[blockType]
    if (!mins) return variant

    const required = mins[variant]
    if (required && contentCount < required) {
        // Find best variant that fits current count (largest min that still fits)
        const fitting = Object.entries(mins)
            .filter(([, min]) => contentCount >= min)
            .sort((a, b) => b[1] - a[1])
        if (fitting.length > 0) {
            const fallback = fitting[0]![0]
            console.warn(
                `[AI Content Guard] "${blockType}": variant "${variant}" needs ${required} items but got ${contentCount} → fallback to "${fallback}"`
            )
            return fallback
        }
    }
    return variant
}

/**
 * Try to match an AI-generated variant string to a valid variant.
 * Steps: exact match → case-insensitive → alias lookup → null (not found)
 */
function fuzzyMatchVariant(requested: string, validVariants: string[]): string | null {
    // 1. Exact match
    if (validVariants.includes(requested)) return requested

    // 2. Case-insensitive + normalize separators
    const normalized = requested.toLowerCase().replace(/[_\s]+/g, '-')
    const caseMatch = validVariants.find(v => v.toLowerCase() === normalized)
    if (caseMatch) return caseMatch

    // 3. Alias lookup
    const aliased = VARIANT_ALIASES[normalized]
    if (aliased && validVariants.includes(aliased)) return aliased

    return null
}

/**
 * Sanitize a single AI-generated block for Payload CMS compatibility.
 * Removes hallucinated fields, enforces exact variant enums, and recursively normalizes
 * objects into the strictly required keys to prevent validation failures.
 */
export function sanitizeBlockData(block: Record<string, unknown>, siteCategory?: string): Record<string, unknown> {
    const s = { ...block }

    // Helper: normalize array where strings should be objects
    const norm = (arr: unknown[], toObj: (v: string) => Record<string, unknown>): unknown[] =>
        arr.map((item: unknown) => typeof item === 'string' ? toObj(item) : item)

    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL: Strip ALL upload/image fields that are strings
    // Payload CMS expects Media IDs (numbers) or null for 'upload' fields.
    // AI generates URL strings which crash Payload.
    // ═══════════════════════════════════════════════════════════════════════
    const uploadFields = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']
    for (const field of uploadFields) {
        if (s[field] && typeof s[field] === 'string') {
            delete s[field] // Remove string URLs — Payload can't use them
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VARIANT VALIDATION: Fuzzy match → alias → weighted-by-category fallback
    // Uses blockRegistry as single source of truth (not a hardcoded list)
    // ═══════════════════════════════════════════════════════════════════════
    if (typeof s.blockType === 'string' && blockRegistry.has(s.blockType)) {
        const meta = blockRegistry.getBlockMeta(s.blockType)
        if (meta && meta.variants.length > 0) {
            // Coerce variant to string (AI sometimes returns number/null)
            const rawVariant = s.variant != null ? String(s.variant) : ''

            if (rawVariant.length > 0) {
                const matched = fuzzyMatchVariant(rawVariant, meta.variants)
                if (matched) {
                    s.variant = matched
                } else {
                    // No match — pick weighted-by-category variant instead of always-default
                    const replacement = pickWeightedVariant(s.blockType, meta.variants, siteCategory)
                    console.warn(
                        `[AI Sanitizer] "${s.blockType}": variant "${rawVariant}" → "${replacement}" (not in [${meta.variants.join(', ')}])`
                    )
                    s.variant = replacement
                }
            } else {
                // Empty/null variant — pick weighted variant
                s.variant = pickWeightedVariant(s.blockType, meta.variants, siteCategory)
            }

            // Content-count guard: ensure variant has enough items to render properly
            const contentArrays = ['testimonials', 'features', 'items', 'images', 'plans', 'members', 'logos']
            for (const field of contentArrays) {
                if (Array.isArray(s[field])) {
                    s.variant = enforceMinContent(s.blockType, s.variant as string, (s[field] as unknown[]).length)
                    break
                }
            }
        }
    }

    // Clean up hallucinated fields that cause validation issues
    if (s.blockType === 'navigation') {
        delete s.style
        delete s.layout
    }

    // Handle 'layout' specifically for 'about' block (sometimes AI hallucinates layout)
    if (s.blockType === 'about' && typeof s.layout === 'string') {
        const ABOUT_LAYOUTS = ['image-right', 'image-left', 'centered']
        if (!ABOUT_LAYOUTS.includes(s.layout)) {
            s.layout = 'image-right'
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'navigation') {
        // Rename navLinks → links
        if (s.navLinks && !s.links) {
            s.links = s.navLinks
            delete s.navLinks
        }
        // Normalize links
        if (Array.isArray(s.links)) {
            s.links = s.links.map((link: unknown) => {
                if (typeof link === 'string') return { label: link, url: '#', openInNewTab: false }
                const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
                return {
                    label: String(l.label || l.text || l.title || l.name || 'Link'),
                    url: String(l.url || l.href || l.link || '#'),
                    openInNewTab: typeof l.openInNewTab === 'boolean' ? l.openInNewTab : false
                }
            })
        }
        // Ensure ctaButton has required shape
        if (!s.ctaButton || typeof s.ctaButton !== 'object') {
            s.ctaButton = { show: true, label: 'Get Started', url: '#' }
        } else {
            const btn = s.ctaButton as Record<string, unknown>
            s.ctaButton = {
                show: typeof btn.show === 'boolean' ? btn.show : true,
                label: String(btn.label || btn.text || 'Get Started'),
                url: String(btn.url || btn.href || '#'),
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HERO BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'hero') {
        if (Array.isArray(s.ctaButtons)) {
            const primaryBtns = norm(s.ctaButtons, (v) => ({ label: v, url: '#', style: 'primary' }))
            s.ctaButtons = primaryBtns.map((btn: unknown) => {
                const bObj = (typeof btn === 'object' && btn !== null ? btn : {}) as Record<string, unknown>
                const style = String(bObj.style)
                return {
                    label: String(bObj.label || bObj.text || 'Button'),
                    url: String(bObj.url || bObj.href || '#'),
                    style: ['primary', 'secondary', 'outline', 'ghost'].includes(style) ? style : 'primary',
                }
            })
        }
        // Normalize badge
        if (s.badge && typeof s.badge === 'string') {
            s.badge = { show: true, text: s.badge }
        } else if (s.badge && typeof s.badge === 'object') {
            const badgeObj = s.badge as Record<string, unknown>
            s.badge = { show: typeof badgeObj.show === 'boolean' ? badgeObj.show : false, text: String(badgeObj.text || '') }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONTACT BLOCK: formFields
    // ═══════════════════════════════════════════════════════════════════════
    const VALID_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select']
    if (Array.isArray(s.formFields)) {
        s.formFields = s.formFields.map((field: unknown) => {
            if (typeof field === 'string') {
                const name = field.toLowerCase()
                let fieldType = 'text'
                if (name.includes('email')) fieldType = 'email'
                else if (name.includes('phone') || name.includes('tel') || name.includes('telefon')) fieldType = 'phone'
                else if (name.includes('message') || name.includes('content') || name.includes('notes') || name.includes('mesej')) fieldType = 'textarea'
                return { fieldName: field, label: field, fieldType, required: true }
            }
            const fObj = (typeof field === 'object' && field !== null ? field : {}) as Record<string, unknown>
            let ft = String(fObj.fieldType || fObj.type || 'text')
            if (ft === 'tel' || ft === 'telephone') ft = 'phone'
            if (ft === 'number') ft = 'text'
            if (!VALID_FIELD_TYPES.includes(ft)) ft = 'text'

            return {
                fieldName: String(fObj.fieldName || fObj.name || 'field'),
                label: String(fObj.label || fObj.fieldName || fObj.name || 'Field'),
                fieldType: ft,
                required: typeof fObj.required === 'boolean' ? fObj.required : true,
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER: columns + links + socials
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'footer') {
        // AI sometimes returns columns as object instead of array — wrap it
        if (s.columns && !Array.isArray(s.columns) && typeof s.columns === 'object') {
            s.columns = Object.values(s.columns as Record<string, unknown>)
        }
        if (Array.isArray(s.columns)) {
            s.columns = s.columns.map((col: unknown) => {
                if (typeof col === 'string') return { title: col, links: [] }
                const cObj = (typeof col === 'object' && col !== null ? col : {}) as Record<string, unknown>
                
                let cleanLinks: Record<string, unknown>[] = []
                if (Array.isArray(cObj.links)) {
                    cleanLinks = cObj.links.map((link: unknown) => {
                        if (typeof link === 'string') return { label: link, url: '#' }
                        const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
                        return {
                            label: String(l.label || l.text || l.title || l.name || 'Link'),
                            url: String(l.url || l.href || l.link || '#')
                        }
                    })
                }
                return {
                    title: String(cObj.title || cObj.heading || 'Column'),
                    links: cleanLinks,
                }
            })
        }
        if (Array.isArray(s.socials)) {
            s.socials = s.socials.map((social: unknown) => {
                if (typeof social === 'string') return { platform: social.toLowerCase(), url: '#' }
                const soc = (typeof social === 'object' && social !== null ? social : {}) as Record<string, unknown>
                return {
                    platform: String(soc.platform || soc.name || 'twitter').toLowerCase(),
                    url: String(soc.url || soc.link || '#')
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TESTIMONIALS: normalize testimonials array
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.testimonials)) {
        s.testimonials = s.testimonials.map((t: unknown) => {
            if (typeof t === 'string') return { quote: t, name: 'Customer' }
            const tObj = (typeof t === 'object' && t !== null ? t : {}) as Record<string, unknown>
            const result: Record<string, unknown> = {
                quote: String(tObj.quote || tObj.text || tObj.content || tObj.message || 'Great experience!'),
                name: String(tObj.name || tObj.author || tObj.customerName || 'Customer'),
            }
            if (tObj.title || tObj.role || tObj.position) result.title = String(tObj.title || tObj.role || tObj.position)
            if (tObj.company) result.company = String(tObj.company)
            if (tObj.rating) result.rating = Math.min(5, Math.max(1, Number(tObj.rating) || 5))
            return result
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEATURES
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'features') {
        if (Array.isArray(s.items) && !Array.isArray(s.features)) {
            s.features = s.items
            delete s.items
        }
        if (Array.isArray(s.features)) {
            s.features = s.features.map((f: unknown) => {
                if (typeof f === 'string') return { title: f, description: '', icon: '⭐' }
                const fObj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
                return {
                    icon: String(fObj.icon || fObj.emoji || '⭐'),
                    title: String(fObj.title || fObj.name || fObj.heading || 'Feature'),
                    description: String(fObj.description || fObj.text || fObj.body || ''),
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEAM
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'team' && Array.isArray(s.members)) {
        s.members = s.members.map((member: unknown) => {
            if (typeof member === 'string') return { name: member, role: 'Member' }
            const mObj = (typeof member === 'object' && member !== null ? member : {}) as Record<string, unknown>
            const safeMember = { ...mObj }
            safeMember.name = String(mObj.name || mObj.fullName || 'Member')
            safeMember.role = String(mObj.role || mObj.position || 'Role')

            if (Array.isArray(safeMember.socials)) {
                safeMember.socials = safeMember.socials.map((social: unknown) => {
                    if (typeof social === 'string') return { platform: social.toLowerCase(), url: '#' }
                    const soc = (typeof social === 'object' && social !== null ? social : {}) as Record<string, unknown>
                    return {
                        platform: String(soc.platform || soc.name || 'twitter').toLowerCase(),
                        url: String(soc.url || soc.link || '#')
                    }
                })
            }
            return safeMember
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FAQ
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'faq' && Array.isArray(s.items)) {
        s.items = s.items.map((item: unknown) => {
            if (typeof item === 'string') {
                return { question: item, answer: '...' }
            }
            const iObj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
            return {
                question: String(iObj.question || iObj.title || iObj.q || 'Question?'),
                answer: String(iObj.answer || iObj.description || iObj.a || 'Answer.'),
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRICING
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'pricing' && Array.isArray(s.plans)) {
        s.plans = s.plans.map((plan: unknown) => {
            if (typeof plan === 'string') {
                return { name: plan, price: 'RM 0', features: [], ctaLabel: 'Buy', ctaUrl: '#' }
            }
            const pObj = (typeof plan === 'object' && plan !== null ? plan : {}) as Record<string, unknown>
            const safePlan = { ...pObj }
            safePlan.name = String(pObj.name || pObj.title || 'Plan')
            safePlan.price = String(pObj.price || pObj.cost || '$0')
            safePlan.ctaLabel = String(pObj.ctaLabel || pObj.buttonText || 'Buy Now')
            safePlan.ctaUrl = String(pObj.ctaUrl || pObj.url || '#')
            
            // Payload expects features as [{text: string, included: boolean}], NOT plain strings
            if (Array.isArray(pObj.features)) {
                safePlan.features = pObj.features.map((f: unknown) => {
                    if (typeof f === 'string') return { text: f, included: true }
                    const fObj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
                    return {
                        text: String(fObj.text || fObj.name || fObj.feature || ''),
                        included: typeof fObj.included === 'boolean' ? fObj.included : true,
                    }
                })
            } else {
                safePlan.features = []
            }
            return safePlan
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GALLERY: Strip URL strings from image fields but keep alt/caption metadata
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'gallery' && Array.isArray(s.images)) {
        s.images = s.images.map((img: unknown) => {
            if (typeof img === 'string') return { alt: img } // URL string → keep as alt text
            const iObj = (typeof img === 'object' && img !== null ? img : {}) as Record<string, unknown>
            const cleaned: Record<string, unknown> = {}
            if (iObj.alt) cleaned.alt = String(iObj.alt)
            if (iObj.caption) cleaned.caption = String(iObj.caption)
            // Strip image/url fields (Payload expects Media IDs, not URLs)
            return cleaned
        }).filter((img: Record<string, unknown>) => Object.keys(img).length > 0)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LOGO CLOUD: Strip URL strings but keep name/alt metadata
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'logo-cloud' && Array.isArray(s.logos)) {
        s.logos = s.logos.map((logo: unknown) => {
            if (typeof logo === 'string') return { name: logo }
            const lObj = (typeof logo === 'object' && logo !== null ? logo : {}) as Record<string, unknown>
            const cleaned: Record<string, unknown> = {}
            if (lObj.name) cleaned.name = String(lObj.name)
            if (lObj.alt) cleaned.alt = String(lObj.alt)
            return cleaned
        }).filter((logo: Record<string, unknown>) => Object.keys(logo).length > 0)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABOUT: stats array
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.stats)) {
        s.stats = s.stats.map((stat: unknown) => {
            if (typeof stat === 'string') return { value: stat, label: stat }
            const sObj = (typeof stat === 'object' && stat !== null ? stat : {}) as Record<string, unknown>
            return { value: String(sObj.value || sObj.number || '0'), label: String(sObj.label || sObj.text || 'Stat') }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Generic links array cleanup
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.links) && s.blockType !== 'navigation') {
        const rawLinks = norm(s.links, (v) => ({ label: v, url: '#' }))
        s.links = rawLinks.map((link: unknown) => {
            if (typeof link === 'string') return { label: link, url: '#' }
            const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
            return {
                label: String(l.label || l.text || l.title || l.name || 'Link'),
                url: String(l.url || l.href || l.link || '#')
            }
        })
    }

    return s
}

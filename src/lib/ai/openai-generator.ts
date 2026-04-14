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
import { composeFallbackResult } from './fallback-adapter'
import { isUnsupportedBlock } from './unsupported-blocks'
import { selectModel } from './config'
import { logAiUsage } from './log-usage'
import { enforceMinimumStructure, enforceMinItems } from './structure-enforcer'
import { pickCategoryThemeWithMood, hashBusinessName } from './category-theme-picker'
import { pickRecipe } from './category-recipes'
import { resolveComposerCategory } from './composer-category-resolver'
import { resolveFontPairing } from './font-pairings'
import { seededShufflePick, hashString } from './seeded-random'
import {
    validateBlockContent,
    validateOrdering,
    checkPageBlockCount,
    normalizeLang,
    MIN_BLOCKS_PER_PAGE,
    type ContentLang,
} from './content-rules'

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
        return generateWithFallback(promptText, events, 'en', businessInfo)
    }

    try {
        events.push({ event: 'step', data: { step: 'analyzing', label: 'Analysing requirements...', progress: 10 } })

        // Resolve category + pick deterministic theme preset BEFORE prompt build
        // so phase-03 can inject the exact hex/font hint into the system prompt.
        // Precedence downstream: URL extraction visualStyle (route.ts) > this preset > AI output.
        //
        // Plan 260414-2249 phase-02: resolve mood from preset.moodId so GPT
        // prompt receives the COPY VOICE bulleted block (4-5 voice rules +
        // imagery hint + mood label). Without this, the happy path generates
        // generic copy even though the preset dictates elegant/bold/etc.
        //
        // Plan 260414-2249 phase-04: pick a layout recipe so GPT gets an
        // explicit RHYTHM section — hard-constrained block sequence drawn
        // from 3 curated recipes per category (story-first/menu-first/...).
        // Without this, GPT reverts to its prior and every site rhymes.
        const presetCategory = resolveComposerCategory(promptText)
        const themeSeed = hashBusinessName(businessInfo.businessName)
        const { preset: themePreset, mood: themeMood } = pickCategoryThemeWithMood(presetCategory, themeSeed)
        const layoutRecipe = pickRecipe(presetCategory, themeSeed)
        console.log(
            `[Theme] Using category preset "${themePreset.name}" (mood=${themeMood.id}, recipe=${layoutRecipe.id}) for category=${presetCategory} (seed=${themeSeed})`,
        )

        const systemPrompt = buildSystemPrompt(language, { preset: themePreset, category: presetCategory })
        const userPromptText = buildUserPrompt(businessInfo, {
            extraInstructions,
            language,
            referencePrompt,
            mood: themeMood,
            recipe: layoutRecipe,
        })

        events.push({ event: 'step', data: { step: 'generating', label: 'AI is generating content...', progress: 20 } })

        const callStart = Date.now()
        const modelName = selectModel('site-generation')
        let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>
        try {
            completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPromptText },
                ],
                temperature: 0.7,
                max_tokens: 8000,
                response_format: { type: 'json_object' },
            })
        } catch (err) {
            logAiUsage({
                endpoint: 'site-generation',
                model: modelName,
                tokensIn: 0,
                tokensOut: 0,
                durationMs: Date.now() - callStart,
                success: false,
                errorCode: err instanceof Error ? err.name : 'unknown',
            })
            throw err
        }

        logAiUsage({
            endpoint: 'site-generation',
            model: completion.model,
            tokensIn: completion.usage?.prompt_tokens ?? 0,
            tokensOut: completion.usage?.completion_tokens ?? 0,
            durationMs: Date.now() - callStart,
            success: true,
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

        // Hard override AI theme with curated category preset.
        // Preserves content/SEO/blocks from AI but forces theme DNA (colors + fonts +
        // spacing + radius + shadow) from the 14×5 preset library so every generation
        // feels category-appropriate instead of generic AI blue.
        //
        // URL extraction (route.ts:258-277) still runs AFTER this return and wins for
        // primary/secondary/colorMode when the user provided a reference URL.
        const fontPair = resolveFontPairing(themePreset.fontPairingId)
        const theme: GenerationResult['theme'] = {
            primaryColor: themePreset.primaryColor,
            secondaryColor: themePreset.secondaryColor,
            accentColor: themePreset.accentColor,
            fontPairingId: themePreset.fontPairingId,
            fontHeading: fontPair.fontHeading,
            fontBody: fontPair.fontBody,
            colorMode: themePreset.colorMode,
            spacingPreset: themePreset.spacingPreset,
            borderRadius: themePreset.borderRadius,
            shadowPreset: themePreset.shadowPreset,
        }

        events.push({ event: 'theme_set', data: { theme } })

        // Detect site category for weighted variant selection
        const detectedCategory = typeof parsed.category === 'string' ? parsed.category : undefined

        // Normalize pipeline language for content-rules lookups.
        // normalizeLang handles 'auto' → 'en' internally.
        const contentLang: ContentLang = normalizeLang(language)

        // Helper: validate and sanitize an array of raw blocks.
        // Unsupported block drop list lives in ./unsupported-blocks for reuse
        // between happy path (here) and fallback path (fallback-adapter).
        function validateBlocks(rawBlocks: unknown[]): Record<string, unknown>[] {
            const valid: Record<string, unknown>[] = []
            for (const block of rawBlocks) {
                const sanitized = sanitizeBlockData(block as Record<string, unknown>, detectedCategory, contentLang, themeSeed)
                const blockType = typeof sanitized.blockType === 'string' ? sanitized.blockType : ''
                if (!blockType) continue

                if (isUnsupportedBlock(blockType)) {
                    console.warn(`[AI] Dropping "${blockType}" block — needs media pipeline or not in Payload schema`)
                    continue
                }

                if (blockRegistry.has(blockType)) {
                    const validation = blockRegistry.validate(blockType, sanitized)
                    if (validation.success) {
                        valid.push(validation.data as Record<string, unknown>)
                    } else {
                        console.warn(`[AI] Block "${blockType}" validation warning:`, validation.error)
                        valid.push(sanitized)
                    }
                } else {
                    console.warn(`[AI] Unknown block type: ${blockType}, skipping`)
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

            const enforcerCtx = {
                businessName: businessInfo.businessName,
                industry: businessInfo.industry,
                seed: themeSeed,
            }

            for (let p = 0; p < rawPages.length; p++) {
                const rawPage = rawPages[p] as Record<string, unknown>
                let pageBlocks = validateBlocks(Array.isArray(rawPage.blocks) ? rawPage.blocks : [])
                // Apply structure enforcer ONLY to homepage (other pages have own content requirements)
                if (p === 0 && detectedCategory) {
                    pageBlocks = enforceMinimumStructure(
                        pageBlocks as Record<string, unknown>[],
                        detectedCategory,
                        enforcerCtx,
                    ) as typeof pageBlocks
                    pageBlocks = enforceMinItems(
                        pageBlocks as Record<string, unknown>[],
                        detectedCategory,
                        enforcerCtx,
                    ) as typeof pageBlocks
                }
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

            // Phase 04 — page-level guards: min block count + AIDA ordering.
            // Both log warnings only; they do not mutate pages or throw.
            for (const genPage of generatedPages) {
                const pageBlocks = genPage.blocks as Record<string, unknown>[]
                const stats = checkPageBlockCount(pageBlocks)
                if (!stats.viable) {
                    console.warn(
                        `[design-quality] page "${genPage.title}" has ${pageBlocks.length} blocks (min ${MIN_BLOCKS_PER_PAGE}). Missing: ${!stats.hasNav ? 'nav ' : ''}${!stats.hasHero ? 'hero ' : ''}${!stats.hasFooter ? 'footer' : ''}`.trim(),
                    )
                }
                const ordering = validateOrdering(pageBlocks, detectedCategory)
                if (!ordering.valid) {
                    for (const w of ordering.warnings) console.warn(`${w} (page: ${genPage.title})`)
                }
            }

            for (let i = 0; i < validBlocks.length; i++) {
                events.push({ event: 'block_complete', data: { block: validBlocks[i], index: i } })
            }
        } else {
            // Single-page backward compat
            const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
            validBlocks = validateBlocks(rawBlocks)
            // Apply structure enforcer to ensure min block count + item counts
            if (detectedCategory) {
                const enforcerCtx = {
                    businessName: businessInfo.businessName,
                    industry: businessInfo.industry,
                    seed: themeSeed,
                }
                validBlocks = enforceMinimumStructure(
                    validBlocks as Record<string, unknown>[],
                    detectedCategory,
                    enforcerCtx,
                ) as typeof validBlocks
                validBlocks = enforceMinItems(
                    validBlocks as Record<string, unknown>[],
                    detectedCategory,
                    enforcerCtx,
                ) as typeof validBlocks
            }

            // Phase 04 — page-level guards for single-page path
            const singleStats = checkPageBlockCount(validBlocks)
            if (!singleStats.viable) {
                console.warn(
                    `[design-quality] single-page has ${validBlocks.length} blocks (min ${MIN_BLOCKS_PER_PAGE}). Missing: ${!singleStats.hasNav ? 'nav ' : ''}${!singleStats.hasHero ? 'hero ' : ''}${!singleStats.hasFooter ? 'footer' : ''}`.trim(),
                )
            }
            const singleOrdering = validateOrdering(validBlocks, detectedCategory)
            if (!singleOrdering.valid) {
                for (const w of singleOrdering.warnings) console.warn(w)
            }

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
        const fallbackLang: 'en' | 'ms' | 'vi' = language === 'auto' ? 'en' : language
        return generateWithFallback(promptText, events, fallbackLang, businessInfo)
    }
}

/**
 * Fallback path — runs when OpenAI errors out or no API key.
 * Tier 1: call `composeFallbackResult` (rich composer path, 14 industries, Phase 04 validation).
 * Tier 2 (legacy safety net): fall through to `generateBlocks` skeleton if composer throws.
 *
 * Plan 260414-2249 phase-01: accept full BusinessInfoInput (not just name) so
 * user-supplied phone/email/address/products flow into composer block builders.
 */
function generateWithFallback(
    prompt: string,
    events: SSEEvent[],
    language: 'en' | 'ms' | 'vi' = 'en',
    businessInfo?: BusinessInfoInput,
): { result: GenerationResult; events: SSEEvent[] } {
    events.push({ event: 'step', data: { step: 'fallback_analyzing', label: 'Analysing template library...', progress: 50 } })
    events.push({ event: 'step', data: { step: 'fallback_composing', label: 'Composing from smart templates...', progress: 60 } })

    const seed = Date.now()

    try {
        const result = composeFallbackResult(prompt, seed, language, businessInfo)

        events.push({ event: 'step', data: { step: 'fallback_validating', label: 'Validating content...', progress: 75 } })
        events.push({ event: 'theme_set', data: { theme: result.theme } })

        const total = result.blocks.length
        result.blocks.forEach((block, i) => {
            const progress = 75 + Math.round((i / Math.max(total, 1)) * 15)
            events.push({ event: 'step', data: { step: `fallback_block_${i}`, label: `Assembling block ${i + 1}/${total}`, progress } })
            events.push({ event: 'block_complete', data: { block: block as Record<string, unknown>, index: i } })
        })

        events.push({ event: 'seo_generated', data: result.seo as Record<string, unknown> })
        events.push({ event: 'step', data: { step: 'saving', label: 'Saving...', progress: 95 } })
        events.push({ event: 'done', data: { totalBlocks: total, timeMs: 0 } })

        return { result, events }
    } catch (composerError: unknown) {
        // Legacy safety net — runs only if composeFallbackResult throws.
        // Do not extend generate-blocks.ts; see plans/260412-2156-ai-gen-website-audit/phase-06-step-7.
        const errMsg = composerError instanceof Error ? composerError.message : String(composerError)
        console.warn('[Fallback] composer failed, using legacy generateBlocks', errMsg)

        events.push({ event: 'step', data: { step: 'fallback_legacy', label: 'Using legacy templates...', progress: 55 } })

        const generated = generateBlocks(prompt, seed)
        const result: GenerationResult = {
            ...generated,
            language,
        }

        events.push({ event: 'theme_set', data: { theme: result.theme } })
        result.blocks.forEach((block, i) => {
            events.push({ event: 'block_complete', data: { block: block as Record<string, unknown>, index: i } })
        })
        events.push({ event: 'seo_generated', data: result.seo as Record<string, unknown> })
        events.push({ event: 'done', data: { totalBlocks: result.blocks.length, timeMs: 0 } })

        return { result, events }
    }
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

// VARIANT_MIN_CONTENT + enforceMinContent moved to ./variant-validation to break
// circular dep with template-composer.ts. Re-exported at end of file for source compat.

/**
 * Pick a weighted-by-category variant when AI's choice is invalid.
 * Excludes broken variants. Uses category preferences if available, otherwise random.
 *
 * When `seed` provided, uses `seededShuffle` to distribute picks deterministically
 * across the preferred pool — different seeds land on different variants, same seed
 * always reproduces. Without a seed, falls back to `Math.random()` (legacy path).
 *
 * Plan 2253 Phase 01 — fixes R2 (pool collapse to 1-2 dominant variants).
 */
function pickWeightedVariant(
    blockType: string,
    validVariants: string[],
    category?: string,
    seed?: number,
): string {
    // Filter out broken variants
    const broken = BROKEN_VARIANTS[blockType] ?? []
    const safeVariants = validVariants.filter(v => !broken.includes(v))
    const pool = safeVariants.length > 0 ? safeVariants : validVariants

    if (category) {
        const catWeights = CATEGORY_VARIANT_WEIGHTS[category]?.[blockType]
        if (catWeights) {
            const preferred = catWeights.filter(v => pool.includes(v))
            if (preferred.length > 0) {
                if (typeof seed === 'number') {
                    // Compound seed with blockType + category so (seed, blockType) tuples
                    // distribute evenly — otherwise same seed would pick same pool index
                    // across every blockType for the same category.
                    const compound = seed ^ hashString(blockType + category)
                    return seededShufflePick(preferred, compound) ?? preferred[0]!
                }
                return preferred[Math.floor(Math.random() * preferred.length)]!
            }
        }
    }
    if (typeof seed === 'number') {
        const compound = seed ^ hashString(blockType + (category ?? ''))
        return seededShufflePick(pool, compound) ?? pool[0]!
    }
    return pool[Math.floor(Math.random() * pool.length)]!
}

// enforceMinContent definition moved to ./variant-validation — re-exported below.
import { enforceMinContent, VARIANT_MIN_CONTENT } from './variant-validation'
export { enforceMinContent, VARIANT_MIN_CONTENT }

/**
 * Try to match an AI-generated variant string to a valid variant.
 * Steps: exact match → case-insensitive → alias lookup → null (not found)
 */
// Map AI-hallucinated icon names → emoji. Renderer dumps `feature.icon` as text node,
// so plain words like "coffee" appear literally in the UI. Convert to emoji or default.
const ICON_NAME_TO_EMOJI: Record<string, string> = {
    coffee: '☕', espresso: '☕', latte: '☕', cappuccino: '☕', tea: '🍵', drink: '🥤', juice: '🧃',
    cake: '🍰', cupcake: '🧁', pastry: '🥐', croissant: '🥐', bread: '🍞', donut: '🍩', cookie: '🍪',
    'ice-cream': '🍦', icecream: '🍦', icescream: '🍦', dessert: '🍨', chocolate: '🍫',
    pizza: '🍕', burger: '🍔', salad: '🥗', sandwich: '🥪', sushi: '🍣', noodle: '🍜', noodles: '🍜',
    rice: '🍚', soup: '🍲', meat: '🥩', fish: '🐟', seafood: '🦐', vegetable: '🥦', fruit: '🍎',
    laptop: '💻', computer: '💻', desktop: '🖥️', phone: '📱', mobile: '📱', tablet: '📱',
    star: '⭐', heart: '❤️', love: '❤️', check: '✅', verified: '✔️', shield: '🛡️', lock: '🔒',
    home: '🏠', house: '🏠', building: '🏢', shop: '🏪', store: '🏪', cart: '🛒', bag: '🛍️',
    book: '📚', pencil: '✏️', edit: '✏️', tool: '🛠️', gear: '⚙️', settings: '⚙️',
    rocket: '🚀', fire: '🔥', sparkle: '✨', sparkles: '✨', diamond: '💎', crown: '👑',
    clock: '⏰', time: '⏱️', calendar: '📅', target: '🎯', trophy: '🏆', medal: '🏅',
    chart: '📊', graph: '📈', money: '💰', coin: '🪙', card: '💳', gift: '🎁',
    user: '👤', users: '👥', team: '👥', people: '👥', person: '👤', smile: '😊',
    map: '🗺️', pin: '📍', location: '📍', globe: '🌐', plane: '✈️', car: '🚗',
    leaf: '🌿', plant: '🌱', flower: '🌸', sun: '☀️', moon: '🌙', cloud: '☁️',
    music: '🎵', headphones: '🎧', camera: '📷', video: '🎥', mic: '🎤',
    paint: '🎨', brush: '🖌️', palette: '🎨', design: '🎨', code: '💻', bug: '🐛',
    mail: '✉️', email: '📧', message: '💬', chat: '💬', bell: '🔔', notification: '🔔',
    wifi: '📶', signal: '📡', bolt: '⚡', lightning: '⚡', battery: '🔋', plug: '🔌',
    workspace: '🪑', chair: '🪑', desk: '🖥️', wifi2: '📶',
    // Spa / beauty / wellness
    massage: '💆', facial: '🧖', manicure: '💅', pedicure: '👣', nails: '💅',
    aromatherapy: '🕯️', candle: '🕯️', stone: '🪨', 'hot-stone': '🪨',
    scrub: '🧼', soap: '🧼', wellness: '🧘', yoga: '🧘', meditation: '🧘',
    spa: '💆', skincare: '🧴', lotion: '🧴', cream: '🧴', serum: '💧',
    haircut: '💇', hair: '💇', barber: '💈', salon: '💇', makeup: '💄',
    relax: '😌', sleep: '😴', bath: '🛁', shower: '🚿',
    // Health / fitness
    fitness: '💪', gym: '🏋️', workout: '🏋️', dumbbell: '🏋️', muscle: '💪',
    run: '🏃', running: '🏃', bike: '🚴', cycle: '🚴', swim: '🏊',
    health: '🩺', doctor: '👨‍⚕️', medical: '⚕️', stethoscope: '🩺', pill: '💊',
    dentist: '🦷', tooth: '🦷', eye: '👁️', glasses: '👓',
    // Education / learning
    school: '🏫', class: '📚', course: '📖', lesson: '📖', tutor: '👩‍🏫',
    student: '🎓', graduate: '🎓', university: '🎓', diploma: '📜',
    // Real estate / home
    apartment: '🏢', condo: '🏢', villa: '🏡', land: '🌍', key: '🔑',
    // Travel
    travel: '🧳', luggage: '🧳', hotel: '🏨', resort: '🏖️', beach: '🏖️',
}

// Parse "RM 12.50" / "$15" / "12,500" → number. Returns null if unparsable.
function parsePrice(raw: unknown): number | null {
    if (raw == null) return null
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    const cleaned = String(raw).replace(/[^\d.]/g, '')
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
}

// Clamp absurd stat values to 100K+. For non-absurd values, return the original
// string verbatim (preserve "+", "%", custom units like "kg", etc).
// Only triggers when AI hallucinates "50,000,000+ Cups Served" for a small cafe.
function clampStatValue(raw: string): string {
    const trimmed = String(raw).trim()
    if (!trimmed) return '0'
    const match = trimmed.match(/^([^\d-]*)([\d.,]+)([A-Za-z+%]*)(.*)$/)
    if (!match) return trimmed
    const [, prefix, numStr, suffix, rest] = match
    const cleanNum = numStr.replace(/,/g, '')
    const n = Number(cleanNum)
    if (!Number.isFinite(n)) return trimmed
    // Apply suffix multiplier to detect absurdity
    const suffixLower = suffix.toLowerCase()
    let multiplied = n
    if (suffixLower === 'k') multiplied = n * 1000
    else if (suffixLower === 'm') multiplied = n * 1000000
    else if (suffixLower === 'b') multiplied = n * 1000000000
    // If not absurdly large, return verbatim — preserve "+", "%", units
    if (multiplied <= 100000) return trimmed
    // Clamp absurd value
    return `${prefix}100K+${rest}`.trim()
}

// Generic icon names that AI overuses for everything → trigger title-based inference
const GENERIC_ICONS = new Set(['star', 'check', 'verified', 'sparkle', 'sparkles', 'circle', 'dot', 'box', 'square'])

function normalizeIcon(raw: unknown, contextTitle?: string): string {
    const str = raw == null ? '' : String(raw).trim()
    // Already an emoji → return as-is (unless title context can do better)
    if (str.length > 0 && str.length <= 4 && /[^\x20-\x7E]/.test(str)) return str
    // Try direct map from icon name
    const key = str.toLowerCase().replace(/[^a-z-]/g, '')
    if (str && !GENERIC_ICONS.has(key)) {
        if (ICON_NAME_TO_EMOJI[key]) return ICON_NAME_TO_EMOJI[key]
        for (const k of Object.keys(ICON_NAME_TO_EMOJI)) {
            if (key.includes(k)) return ICON_NAME_TO_EMOJI[k]
        }
    }
    // Title-based inference: AI sent generic "star" or empty → look at title for keywords
    if (contextTitle) {
        const titleKey = contextTitle.toLowerCase()
        for (const k of Object.keys(ICON_NAME_TO_EMOJI)) {
            if (titleKey.includes(k)) return ICON_NAME_TO_EMOJI[k]
        }
    }
    return '⭐'
}

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
export function sanitizeBlockData(
    block: Record<string, unknown>,
    siteCategory?: string,
    language: 'en' | 'vi' | 'ms' = 'en',
    seed?: number,
): Record<string, unknown> {
    const s = { ...block }

    // Helper: normalize array where strings should be objects
    const norm = (arr: unknown[], toObj: (v: string) => Record<string, unknown>): unknown[] =>
        arr.map((item: unknown) => typeof item === 'string' ? toObj(item) : item)

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK TYPE ALIASES: AI often uses singular/alt names not in registry
    // ═══════════════════════════════════════════════════════════════════════
    const BLOCK_TYPE_ALIASES: Record<string, string> = {
        testimonial: 'testimonials',
        review: 'social-proof',
        reviews: 'social-proof',
        feature: 'features',
        service: 'service-cards',
        services: 'service-cards',
        team_member: 'team',
        members: 'team',
        product: 'products-grid',
        products: 'products-grid',
        portfolio: 'portfolio-grid',
        gallery_grid: 'gallery',
        contactform: 'contact',
        'contact-form': 'contact',
        map: 'google-maps',
        maps: 'google-maps',
        booking: 'booking-widget',
        menu: 'menu-display',
        'social-widget': 'socialWidget',
        social_widget: 'socialWidget',
        socialwidget: 'socialWidget',
        'social-media': 'socialWidget',
        social: 'socialWidget',
    }
    if (typeof s.blockType === 'string' && BLOCK_TYPE_ALIASES[s.blockType]) {
        s.blockType = BLOCK_TYPE_ALIASES[s.blockType]
    }

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
                    const replacement = pickWeightedVariant(s.blockType, meta.variants, siteCategory, seed)
                    console.warn(
                        `[AI Sanitizer] "${s.blockType}": variant "${rawVariant}" → "${replacement}" (not in [${meta.variants.join(', ')}])`
                    )
                    s.variant = replacement
                }
            } else {
                // Empty/null variant — pick weighted variant
                s.variant = pickWeightedVariant(s.blockType, meta.variants, siteCategory, seed)
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

    // Phase 04 — Content validation (headline length, blocked CTAs, generic copy).
    // Auto-fixes merge into `s` with console.warn per violation.
    // NEVER throws: AI pipeline must always succeed.
    const contentValidation = validateBlockContent(s, language)
    if (!contentValidation.valid) {
        for (const w of contentValidation.warnings) console.warn(w)
        Object.assign(s, contentValidation.fixes)
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
            s.ctaButtons = primaryBtns.map((btn: unknown, i: number) => {
                const bObj = (typeof btn === 'object' && btn !== null ? btn : {}) as Record<string, unknown>
                const style = String(bObj.style)
                return {
                    label: String(bObj.label || bObj.text || 'Button'),
                    url: String(bObj.url || bObj.href || '#'),
                    // First button defaults primary, subsequent default secondary for visual contrast
                    style: ['primary', 'secondary', 'outline', 'ghost'].includes(style) ? style : (i === 0 ? 'primary' : 'secondary'),
                }
            })
            // Enforce min 2 CTAs for visual richness — add secondary if only 1
            // Note: avoid "Learn More" — blocked by design-quality content rules
            if ((s.ctaButtons as unknown[]).length === 1) {
                (s.ctaButtons as Array<{ label: string; url: string; style: string }>).push({
                    label: 'About Us',
                    url: '#about',
                    style: 'secondary',
                })
            }
        }
        // Normalize badge
        if (s.badge && typeof s.badge === 'string') {
            s.badge = { show: true, text: s.badge }
        } else if (s.badge && typeof s.badge === 'object') {
            const badgeObj = s.badge as Record<string, unknown>
            s.badge = { show: typeof badgeObj.show === 'boolean' ? badgeObj.show : false, text: String(badgeObj.text || '') }
        }
        // Normalize gradientPreset enum: aurora|sunset|ocean|forest
        if (s.gradientPreset != null) {
            const VALID_GRADIENTS = ['aurora', 'sunset', 'ocean', 'forest']
            const GRADIENT_ALIASES: Record<string, string> = {
                'dark-to-light': 'sunset', 'light-to-dark': 'sunset',
                sunrise: 'sunset', twilight: 'sunset', dusk: 'sunset', dawn: 'sunset', warm: 'sunset',
                sea: 'ocean', water: 'ocean', blue: 'ocean', teal: 'ocean', cool: 'ocean',
                green: 'forest', nature: 'forest', earth: 'forest', mint: 'forest',
                rainbow: 'aurora', purple: 'aurora', cosmic: 'aurora', galaxy: 'aurora', neon: 'aurora',
            }
            const raw = String(s.gradientPreset).toLowerCase().trim()
            if (!VALID_GRADIENTS.includes(raw)) {
                s.gradientPreset = GRADIENT_ALIASES[raw] || 'aurora'
            }
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
                if (typeof f === 'string') return { title: f, description: '', icon: normalizeIcon(undefined, f) }
                const fObj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
                const title = String(fObj.title || fObj.name || fObj.heading || 'Feature')
                return {
                    icon: normalizeIcon(fObj.icon ?? fObj.emoji, title),
                    title,
                    description: String(fObj.description || fObj.text || fObj.body || ''),
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SERVICE-CARDS: same icon variety problem as features
    // AI sends "star" for all 4 services → all render ⭐. Infer from title.
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'service-cards') {
        // AI may use "items" instead of "services"
        if (Array.isArray(s.items) && !Array.isArray(s.services)) {
            s.services = s.items
            delete s.items
        }
        if (Array.isArray(s.services)) {
            s.services = s.services.map((sv: unknown) => {
                if (typeof sv === 'string') {
                    return { title: sv, description: '', icon: normalizeIcon(undefined, sv) }
                }
                const svObj = (typeof sv === 'object' && sv !== null ? sv : {}) as Record<string, unknown>
                const title = String(svObj.title || svObj.name || svObj.heading || 'Service')
                return {
                    ...svObj,
                    icon: normalizeIcon(svObj.icon ?? svObj.emoji, title),
                    title,
                    description: String(svObj.description || svObj.text || svObj.body || ''),
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
    // SOCIAL-PROOF: reviews array requires { author, content } (Payload required)
    // AI hallucinates name/customer/text/quote — remap to schema.
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'social-proof' && Array.isArray(s.reviews)) {
        s.reviews = s.reviews.map((review: unknown) => {
            if (typeof review === 'string') {
                return { author: 'Customer', content: review, rating: 5 }
            }
            const rObj = (typeof review === 'object' && review !== null ? review : {}) as Record<string, unknown>
            const author = String(
                rObj.author || rObj.name || rObj.customer || rObj.customerName || rObj.reviewer || rObj.user || rObj.fullName || 'Customer'
            )
            const content = String(
                rObj.content || rObj.text || rObj.quote || rObj.comment || rObj.review || rObj.message || rObj.body || 'Great experience!'
            )
            const out: Record<string, unknown> = { author, content }
            if (rObj.role || rObj.title || rObj.position || rObj.jobTitle) {
                out.role = String(rObj.role || rObj.title || rObj.position || rObj.jobTitle)
            }
            const rawRating = rObj.rating ?? rObj.stars ?? rObj.score
            const rating = Number(rawRating)
            out.rating = Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 5
            // Strip avatar string (Payload upload expects Media ID)
            return out
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GALLERY: schema is { image: { url, alt? }, caption? } — wrap URL strings.
    // Falls back to Unsplash placeholder if no URL provided.
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'gallery' && Array.isArray(s.images)) {
        s.images = s.images.map((img: unknown, idx: number): Record<string, unknown> => {
            if (typeof img === 'string') {
                return { image: { url: img, alt: '' }, caption: '' }
            }
            const iObj = (typeof img === 'object' && img !== null ? img : {}) as Record<string, unknown>
            // AI may put url at root, in image.url, imageUrl, or src
            let url = ''
            let alt = ''
            if (iObj.image && typeof iObj.image === 'object') {
                const imgObj = iObj.image as Record<string, unknown>
                url = String(imgObj.url || imgObj.src || '')
                alt = String(imgObj.alt || iObj.alt || '')
            } else if (typeof iObj.image === 'string') {
                url = iObj.image
                alt = String(iObj.alt || '')
            } else {
                url = String(iObj.url || iObj.imageUrl || iObj.src || '')
                alt = String(iObj.alt || '')
            }
            // Fallback: use Unsplash random nature/spa stock based on index
            if (!url) {
                const seeds = ['spa', 'nature', 'wellness', 'serene', 'calm', 'zen']
                url = `https://source.unsplash.com/800x600/?${seeds[idx % seeds.length]}`
            }
            return {
                image: { url, alt },
                caption: String(iObj.caption || ''),
            }
        }).filter((img: Record<string, unknown>) => {
            const imgRef = img.image as Record<string, unknown> | undefined
            return imgRef != null && typeof imgRef.url === 'string' && imgRef.url.length > 0
        })
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
    // ABOUT/STATS: clamp absurd numbers + format with commas (50000000 → 50K+)
    // AI hallucinates "50,000,000+ Cups Served" for a small cafe. Cap and reformat.
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.stats)) {
        s.stats = s.stats.map((stat: unknown) => {
            if (typeof stat === 'string') return { value: stat, label: stat }
            const sObj = (typeof stat === 'object' && stat !== null ? stat : {}) as Record<string, unknown>
            const rawValue = String(sObj.value || sObj.number || '0')
            return {
                value: clampStatValue(rawValue),
                label: String(sObj.label || sObj.text || 'Stat'),
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MENU-DISPLAY: rename categories[].name + coerce price string→number
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'menu-display' && Array.isArray(s.categories)) {
        s.categories = s.categories.map((cat: unknown) => {
            const cObj = (typeof cat === 'object' && cat !== null ? cat : {}) as Record<string, unknown>
            const name = String(cObj.name || cObj.title || cObj.category || cObj.heading || 'Menu')
            const items = Array.isArray(cObj.items) ? cObj.items.map((item: unknown) => {
                const iObj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
                const price = parsePrice(iObj.price)
                const out: Record<string, unknown> = {
                    name: String(iObj.name || iObj.title || 'Item'),
                    price: price ?? 0,
                    dietaryTags: Array.isArray(iObj.dietaryTags) ? iObj.dietaryTags : [],
                }
                if (iObj.description) out.description = String(iObj.description)
                if (iObj.originalPrice != null) {
                    const op = parsePrice(iObj.originalPrice)
                    if (op != null) out.originalPrice = op
                }
                if (typeof iObj.isPopular === 'boolean') out.isPopular = iObj.isPopular
                if (typeof iObj.isNew === 'boolean') out.isNew = iObj.isNew
                return out
            }) : []
            const out: Record<string, unknown> = { name, items }
            if (cObj.description) out.description = String(cObj.description)
            if (cObj.icon) out.icon = String(cObj.icon)
            return out
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BOOKING-WIDGET: services[] string→object, availableDays + timeSlot to number
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'booking-widget') {
        if (Array.isArray(s.services)) {
            s.services = s.services.map((sv: unknown) => {
                if (typeof sv === 'string') {
                    return { name: sv, duration: 60, price: 0 }
                }
                const svObj = (typeof sv === 'object' && sv !== null ? sv : {}) as Record<string, unknown>
                const out: Record<string, unknown> = {
                    name: String(svObj.name || svObj.title || 'Service'),
                    duration: Number(svObj.duration) || 60,
                    price: parsePrice(svObj.price) ?? 0,
                }
                if (svObj.description) out.description = String(svObj.description)
                return out
            })
        }
        if (Array.isArray(s.availableDays)) {
            const DAY_MAP: Record<string, number> = {
                sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
                thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
            }
            s.availableDays = s.availableDays.map((d: unknown) => {
                if (typeof d === 'number') return Math.min(6, Math.max(0, Math.round(d)))
                const key = String(d).toLowerCase().trim()
                if (DAY_MAP[key] != null) return DAY_MAP[key]
                const n = Number(key)
                return Number.isFinite(n) ? Math.min(6, Math.max(0, Math.round(n))) : 1
            }).filter((d: unknown, i: number, arr: unknown[]) => arr.indexOf(d) === i)
        }
        if (s.timeSlotInterval != null) {
            const n = Number(s.timeSlotInterval)
            s.timeSlotInterval = Number.isFinite(n) && n > 0 ? Math.round(n) : 30
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GOOGLE-MAPS: height string→number
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'google-maps' && s.height != null) {
        const n = Number(s.height)
        s.height = Number.isFinite(n) && n > 0 ? Math.round(n) : 400
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BEFORE-AFTER: beforeImage|afterImage are { url, alt?, label? } objects.
    // AI sends raw URL string → wrap. Fallback Unsplash if missing.
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'before-after') {
        const wrapBeforeAfter = (val: unknown, fallbackSeed: string): Record<string, unknown> => {
            if (typeof val === 'string') {
                return { url: val || `https://source.unsplash.com/800x600/?${fallbackSeed}`, alt: '' }
            }
            const v = (typeof val === 'object' && val !== null ? val : {}) as Record<string, unknown>
            const url = String(v.url || v.imageUrl || v.src || v.image || '') || `https://source.unsplash.com/800x600/?${fallbackSeed}`
            const result: Record<string, unknown> = {
                url,
                alt: String(v.alt || ''),
            }
            if (v.label) result.label = String(v.label)
            return result
        }
        s.beforeImage = wrapBeforeAfter(s.beforeImage, 'before')
        s.afterImage = wrapBeforeAfter(s.afterImage, 'after')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SOCIAL-WIDGET: links[].platform must be enum (facebook|whatsapp|...)
    // AI hallucinates twitter/x/tiktok which Payload rejects. Map or drop.
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'socialWidget') {
        const VALID_PLATFORMS = ['facebook', 'whatsapp', 'instagram', 'linkedin', 'youtube']
        const PLATFORM_ALIASES: Record<string, string> = {
            fb: 'facebook', meta: 'facebook',
            ig: 'instagram', insta: 'instagram',
            wa: 'whatsapp', wapp: 'whatsapp', whatsap: 'whatsapp',
            yt: 'youtube', 'youtube-channel': 'youtube',
            'linked-in': 'linkedin', li: 'linkedin',
            // Unsupported platforms → fallback to instagram (most universal)
            twitter: 'instagram', x: 'instagram', 'twitter-x': 'instagram',
            tiktok: 'instagram', tt: 'instagram',
            telegram: 'whatsapp', tg: 'whatsapp',
            pinterest: 'instagram', pin: 'instagram',
            snapchat: 'instagram',
            threads: 'instagram',
        }
        if (Array.isArray(s.links)) {
            s.links = s.links
                .map((link: unknown) => {
                    if (typeof link === 'string') {
                        const key = link.toLowerCase().trim()
                        const platform = VALID_PLATFORMS.includes(key) ? key : (PLATFORM_ALIASES[key] || 'facebook')
                        return { platform, url: '#', enabled: true }
                    }
                    const lObj = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
                    const rawPlat = String(lObj.platform || lObj.name || lObj.type || '').toLowerCase().trim()
                    const platform = VALID_PLATFORMS.includes(rawPlat)
                        ? rawPlat
                        : (PLATFORM_ALIASES[rawPlat] || 'facebook')
                    return {
                        platform,
                        url: String(lObj.url || lObj.href || lObj.link || '#'),
                        enabled: lObj.enabled !== false,
                    }
                })
                .filter((link: { platform: string }, i: number, arr: { platform: string }[]) =>
                    arr.findIndex(l => l.platform === link.platform) === i
                )
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Generic links array cleanup — skip blocks with custom links shape.
    // navigation handles its own links above.
    // socialWidget needs platform field preserved (not just label/url).
    // Footer top-level `links` (rare) still uses generic shape — handled here.
    // ═══════════════════════════════════════════════════════════════════════
    const BLOCKS_WITH_CUSTOM_LINKS = new Set(['navigation', 'socialWidget'])
    if (Array.isArray(s.links) && !BLOCKS_WITH_CUSTOM_LINKS.has(String(s.blockType))) {
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

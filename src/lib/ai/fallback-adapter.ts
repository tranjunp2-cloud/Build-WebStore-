/**
 * Fallback adapter — bridges the composer (TemplatePreset → TemplateSeed) to the
 * generator's GenerationResult shape. Pure, synchronous, zero IO.
 *
 * Used by `generateWithFallback` when OpenAI is unavailable or errors out so that
 * the fallback path returns the same rich content as the happy path (14 industry
 * categories, real business samples, Phase 04 content validation) instead of the
 * legacy 6-block skeleton from generate-blocks.ts.
 *
 * Source: plans/260412-2156-ai-gen-website-audit/phase-06-step-4-shape-adapter.md
 */

import { composeFromBlueprint, type TemplateSeed } from './template-composer'
import { TEMPLATE_PRESETS } from './template-definitions'
import type { TemplatePreset } from './template-definitions'
import { resolveFontPairing } from './font-pairings'
import { resolveComposerCategory, type ComposerCategory } from './composer-category-resolver'
import { getCategoryContent } from './content'
import type { BusinessSample } from './content/types'
import type { GenerationResult, GeneratedBlock, GeneratedPage, BusinessIntent } from './generate-blocks'
import { filterUnsupportedBlocks } from './unsupported-blocks'

type Language = 'en' | 'ms' | 'vi'

// 14 composer categories → legacy 5 siteType buckets for downstream consumers.
const CATEGORY_TO_SITE_TYPE: Record<ComposerCategory, BusinessIntent['type']> = {
    restaurant: 'restaurant',
    fnb: 'restaurant',
    ecommerce: 'ecommerce',
    beauty: 'ecommerce',
    creative: 'portfolio',
    blog: 'blog',
    tech: 'business',
    health: 'business',
    education: 'business',
    realestate: 'business',
    fitness: 'business',
    events: 'business',
    travel: 'business',
    business: 'business',
}

function mapCategoryToSiteType(cat: ComposerCategory): BusinessIntent['type'] {
    return CATEGORY_TO_SITE_TYPE[cat] ?? 'business'
}

function truncate(str: string, max: number): string {
    if (!str) return ''
    if (str.length <= max) return str
    return str.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Pick a deterministic preset for a category using the seed.
 * Throws if no presets exist for the category (should never happen — all 14 have 4 each).
 */
function pickPreset(category: ComposerCategory, seed: number): TemplatePreset {
    const candidates = TEMPLATE_PRESETS.filter((p) => p.category === category)
    if (candidates.length === 0) {
        throw new Error(`[fallback-adapter] No TEMPLATE_PRESETS found for category: ${category}`)
    }
    const index = Math.abs(Math.floor(seed)) % candidates.length
    return candidates[index]!
}

/**
 * Adapt a TemplateSeed (composer output) to the GenerationResult shape the
 * AI route handler expects.
 */
export function adaptTemplateSeedToGenerationResult(
    templateSeed: TemplateSeed,
    biz: BusinessSample,
    category: ComposerCategory,
    language: Language,
): GenerationResult {
    const fontPair = resolveFontPairing(templateSeed.theme.fontPairingId)

    // Homepage blocks = first page's layout (composer always builds home first).
    // Filter out unsupported blocks (require media pipeline or missing from Payload schema) —
    // must match the drop list applied in AI happy path (openai-generator validateBlocks).
    const homePage = templateSeed.pages[0]
    const rawHomeBlocks = (homePage?.layout ?? []) as GeneratedBlock[]
    const blocks = filterUnsupportedBlocks(rawHomeBlocks, 'fallback')

    // Preserve full multi-page structure for downstream consumers that want it.
    const pages: GeneratedPage[] = templateSeed.pages.map((page, idx) => ({
        title: page.title,
        slug: page.slug,
        isHomepage: idx === 0,
        blocks: filterUnsupportedBlocks(page.layout as GeneratedBlock[], 'fallback'),
        seo: {
            title: `${biz.name} — ${page.title}`,
            description: truncate(biz.tagline ?? templateSeed.description, 160),
        },
    }))

    return {
        siteName: biz.name,
        siteType: mapCategoryToSiteType(category),
        blocks,
        pages,
        seo: {
            title: biz.tagline ? `${biz.name} — ${biz.tagline}` : biz.name,
            description: truncate(biz.description ?? templateSeed.description, 160),
        },
        language: language === 'en' || language === 'ms' || language === 'vi' ? language : 'en',
        theme: {
            primaryColor: templateSeed.theme.primaryColor,
            secondaryColor: templateSeed.theme.secondaryColor,
            fontHeading: fontPair.fontHeading,
            fontBody: fontPair.fontBody,
            colorMode: templateSeed.theme.colorMode,
        },
    }
}

/**
 * Top-level fallback entry: prompt → GenerationResult.
 *
 * Pipeline:
 *   1. resolveComposerCategory(prompt) → one of 14 categories
 *   2. pickPreset(category, seed) → deterministic TemplatePreset
 *   3. bizOverride = extractedName ? {name: extractedName} : undefined
 *   4. composeFromBlueprint(preset, seed, bizOverride) → TemplateSeed
 *   5. Look up canonical biz from content to populate siteName/SEO
 *   6. adaptTemplateSeedToGenerationResult(...) → GenerationResult
 */
export function composeFallbackResult(
    prompt: string,
    seed: number,
    language: Language = 'en',
    extractedName?: string,
): GenerationResult {
    const category = resolveComposerCategory(prompt)
    const preset = pickPreset(category, seed)

    const bizOverride: Partial<BusinessSample> | undefined = extractedName
        ? { name: extractedName }
        : undefined

    const templateSeed = composeFromBlueprint(preset, seed, bizOverride)

    // Fetch canonical biz from content to populate top-level siteName/SEO.
    // Composer already injected extractedName into blocks via bizOverride; we
    // mirror the same override here for the outer GenerationResult fields.
    const content = getCategoryContent(preset.category)
    const baseBiz = content?.businesses[preset.businessIndex]
    if (!baseBiz) {
        throw new Error(`[fallback-adapter] Missing business content for ${preset.category}[${preset.businessIndex}]`)
    }

    const biz: BusinessSample = bizOverride
        ? { ...baseBiz, ...bizOverride }
        : baseBiz

    return adaptTemplateSeedToGenerationResult(templateSeed, biz, category, language)
}

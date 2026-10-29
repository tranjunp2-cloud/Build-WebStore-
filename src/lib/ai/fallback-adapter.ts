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
import { GENERATION_TEMPLATE_PRESETS, selectTemplatePreset } from './template-definitions'
import type { TemplatePreset } from './template-definitions'
import { resolveFontPairing } from './font-pairings'
import {
    resolveBusinessCategory,
    resolveComposerCategory,
    type ComposerCategory,
} from './composer-category-resolver'
import { getCategoryContent } from './content'
import type { BusinessSample } from './content/types'
import type { GenerationResult, GeneratedBlock, GeneratedPage, BusinessIntent } from './generate-blocks'
import { filterUnsupportedBlocks } from './unsupported-blocks'
import { enforceMinimumStructure, enforceSubpageStructure, enforceMinItems, enforceGridAlignment } from './structure-enforcer'
import { mapBusinessInfo } from './business-info-mapper'
import type { BusinessInfoInput } from './system-prompt'
import { generateAllPageSeo, type PageForSeo } from './seo-generator'
import { withoutLibraryIdentity } from './library-identity'

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
 * Scan a block list for the first http image URL (image / backgroundImage /
 * imageUrl). Used to derive a site-wide hero fallback for SEO og:image +
 * LocalBusiness JSON-LD.
 */
function findFirstImage(blocks: GeneratedBlock[]): string | undefined {
    for (const block of blocks) {
        const b = block as unknown as Record<string, unknown>
        if (typeof b.image === 'string' && b.image.startsWith('http')) return b.image
        if (typeof b.backgroundImage === 'string' && b.backgroundImage.startsWith('http')) return b.backgroundImage
        if (typeof b.imageUrl === 'string' && b.imageUrl.startsWith('http')) return b.imageUrl
    }
    return undefined
}

/**
 * Pick a deterministic preset for a category using the seed.
 * Throws if no presets exist for the category (should never happen — all 14 have 4 each).
 */
function hasPresets(category: ComposerCategory): boolean {
    return GENERATION_TEMPLATE_PRESETS.some((p) => p.category === category)
}

function pickPreset(category: ComposerCategory, seed: number): TemplatePreset {
    const preset = selectTemplatePreset(category, seed)
    if (!preset) {
        throw new Error(`[fallback-adapter] No TEMPLATE_PRESETS found for category: ${category}`)
    }
    return preset
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
    seed: number = 42,
): GenerationResult {
    const fontPair = resolveFontPairing(templateSeed.theme.fontPairingId)

    const enforcerCtx = {
        businessName: biz.name,
        industry: category,
        seed,
        userBiz: biz,
        language,
    }

    // Homepage blocks = first page's layout (composer always builds home first).
    // Filter out unsupported blocks (require media pipeline or missing from Payload schema) —
    // must match the drop list applied in AI happy path (openai-generator validateBlocks).
    const homePage = templateSeed.pages[0]
    const rawHomeBlocks = (homePage?.layout ?? []) as GeneratedBlock[]
    let blocks = filterUnsupportedBlocks(rawHomeBlocks, 'fallback')
    blocks = enforceMinimumStructure(blocks as any[], category, enforcerCtx) as typeof blocks
    blocks = enforceMinItems(blocks as any[], category, enforcerCtx) as typeof blocks
    enforceGridAlignment(blocks as any[], category, enforcerCtx)

    // Phase 06: generate unique per-page SEO instead of reusing site tagline.
    // First materialize the filtered block list per page so the SEO generator
    // mines from blocks the user will actually see.
    const filteredPages = templateSeed.pages.map((page, idx) => {
        let pageBlocks = filterUnsupportedBlocks(page.layout as GeneratedBlock[], 'fallback')
        if (idx === 0) {
            pageBlocks = blocks
        } else {
            pageBlocks = enforceSubpageStructure(
                pageBlocks as any[],
                category,
                enforcerCtx,
                page.slug,
            ) as typeof pageBlocks
            pageBlocks = enforceMinItems(pageBlocks as any[], category, enforcerCtx) as typeof pageBlocks
            enforceGridAlignment(pageBlocks as any[], category, enforcerCtx)
        }
        return {
            title: page.title,
            slug: page.slug,
            isHomepage: idx === 0,
            blocks: pageBlocks,
        }
    })

    const pagesForSeo: PageForSeo[] = filteredPages.map((p) => ({
        title: p.title,
        slug: p.slug,
        isHomepage: p.isHomepage,
        blocks: p.blocks as unknown as Array<Record<string, unknown>>,
    }))
    // Derive a site-wide hero image from the homepage's first imagey block so
    // LocalBusiness JSON-LD and sub-page og:image fall back to a real URL.
    const siteHeroImage = findFirstImage(filteredPages[0]?.blocks ?? [])
    const pageSeoList = generateAllPageSeo(pagesForSeo, {
        biz,
        category,
        siteHeroImage,
    })

    // Preserve full multi-page structure for downstream consumers that want it.
    const pages: GeneratedPage[] = filteredPages.map((p, idx) => ({
        title: p.title,
        slug: p.slug,
        isHomepage: p.isHomepage,
        blocks: p.blocks,
        seo: {
            title: pageSeoList[idx]!.title,
            description: pageSeoList[idx]!.description,
            ogImage: pageSeoList[idx]!.ogImage,
            jsonLd: pageSeoList[idx]!.jsonLd as unknown as Array<Record<string, unknown>>,
        },
    }))

    return {
        siteName: biz.name,
        siteType: mapCategoryToSiteType(category),
        blocks,
        pages,
        seo: {
            title: biz.tagline ? `${biz.name} — ${biz.tagline}` : biz.name,
            description: truncate(biz.description || templateSeed.description, 160),
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
 *   3. bizOverride = info ? mapBusinessInfo(info) : { name: extractedName } (legacy)
 *   4. composeFromBlueprint(preset, seed, bizOverride) → TemplateSeed
 *   5. Look up canonical biz from content to populate siteName/SEO
 *   6. adaptTemplateSeedToGenerationResult(...) → GenerationResult
 *
 * Plan 260414-2249 phase-01: accept full BusinessInfoInput so user-supplied
 * phone/email/address/products flow into composer block builders instead of
 * being dropped. Legacy `extractedName` signature preserved via optional param.
 */
/**
 * Plan 260417-0837 item 1.2 — primary template-first gen path. Old name
 * `composeFallbackResult` stays as deprecated alias for tests + legacy
 * call sites. New code should import `composeTemplateResult`.
 */
export function composeTemplateResult(
    prompt: string,
    seed: number,
    language: Language = 'en',
    info?: BusinessInfoInput | string,
    disabledSet?: Set<string>,
): GenerationResult | null {
    // Plan 260415 fix-500 — return null on any unrecoverable composer
    // failure so the caller (openai-generator.generateWithFallback) can
    // cleanly try the legacy generateBlocks safety net instead of throwing
    // through the outer catch and surfacing as a 500 to the user.
    // GH-1611: the Builder form sends `industry` as an ALREADY-RESOLVED composer key
    // ('fnb'), which resolveComposerCategory scores at 0 and sinks to 'business' — so
    // a bakery got built from the corporate blueprint (and its images with it). Trust
    // the form key; score the free text only when there is no key.
    //
    // Guard: events/travel/blog have no TEMPLATE_PRESETS and pickPreset throws for
    // them (caller catches → legacy generator). That hole is pre-existing on the
    // free-text path; keep today's behaviour rather than let the form key newly
    // trigger it — fixing the preset gap is a separate issue.
    const industry = typeof info === 'string' ? undefined : info?.industry
    const formCategory = resolveBusinessCategory(industry, prompt)
    const category = hasPresets(formCategory) ? formCategory : resolveComposerCategory(prompt)
    const preset = pickPreset(category, seed)

    // Legacy string overload = extracted name only. New object overload = full wire info.
    let bizOverride: Partial<BusinessSample> | undefined
    if (typeof info === 'string') {
        bizOverride = info ? { name: info } : undefined
    } else if (info) {
        const mapped = mapBusinessInfo(info)
        bizOverride = Object.keys(mapped).length > 0 ? mapped : undefined
    }

    // GH-1184: strip non-ASCII products/tagline from bizOverride when target is English.
    if (language === 'en' && bizOverride) {
        if (bizOverride.products?.some(p => /[^\x00-\x7F]/.test(p))) {
            delete bizOverride.products
        }
        if (bizOverride.tagline && /[^\x00-\x7F]/.test(bizOverride.tagline)) {
            delete bizOverride.tagline
        }
    }

    const templateSeed = composeFromBlueprint(preset, seed, bizOverride, disabledSet, language)
    if (!templateSeed) {
        console.warn(`[fallback-adapter] composeFromBlueprint returned null for ${preset.category}`)
        return null
    }

    // Fetch canonical biz from content to populate top-level siteName/SEO.
    // Composer already injected extractedName into blocks via bizOverride; we
    // mirror the same override here for the outer GenerationResult fields.
    const content = getCategoryContent(preset.category)
    const baseBiz = content?.businesses[preset.businessIndex]
    if (!baseBiz) {
        console.warn(`[fallback-adapter] Missing business content for ${preset.category}[${preset.businessIndex}]`)
        return null
    }

    const biz: BusinessSample = bizOverride
        ? withoutLibraryIdentity(baseBiz, bizOverride)
        : baseBiz

    // Phase 06 — the consistency check runs ONE level up in
    // `generateWithFallback` (see openai-generator.ts) so it can push
    // `consistency_warning` SSE events into the gen event stream.
    // `composeTemplateResult` stays pure / side-effect-free for tests.
    return adaptTemplateSeedToGenerationResult(templateSeed, biz, category, language, seed)
}

/**
 * @deprecated Renamed to `composeTemplateResult` (Plan 260417-0837 item 1.2).
 * Kept as alias for test + legacy callers. Remove after all sites migrate.
 */
export const composeFallbackResult = composeTemplateResult

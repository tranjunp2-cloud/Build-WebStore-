/**
 * Post-AI content swap — Plan 260415 Phase 04.
 *
 * Detects generic AI-emitted blocks (hero / features / testimonials / faq /
 * about / cta) and swaps them for hand-curated composer output. Runs AFTER
 * sanitizeBlockData and BEFORE structure-enforcer in the generator pipeline.
 *
 * This is the biggest unlock for AI gen path content quality — PR #618 only
 * fired on gap-fill (~5% of cases). This step fires on the ~95% where AI
 * successfully emits blocks but with training-median generic copy like
 * "Quality Service / Exceptional quality in every interaction".
 *
 * Controlled by feature flag `AI_POST_SWAP_ENABLED` — enable on staging,
 * roll out to prod after measurement harness confirms positive delta.
 */

import type { BusinessSample, CategoryContent } from './content'
import { getCategoryContent } from './content'

/** Hydrate a Partial<BusinessSample> into a full BusinessSample for composer consumption. */
function hydrateBiz(partial: Partial<BusinessSample>, category: string): BusinessSample {
    const pack = getCategoryContent(category) ?? getCategoryContent('business')
    const fallback = pack?.businesses[0]
    return {
        name: partial.name ?? fallback?.name ?? 'Our Business',
        tagline: partial.tagline ?? fallback?.tagline ?? 'Serving you with care',
        description: partial.description ?? fallback?.description ?? 'Your trusted local business.',
        address: partial.address ?? fallback?.address ?? 'Kuala Lumpur, Malaysia',
        phone: partial.phone ?? fallback?.phone ?? '+60 3-0000 0000',
        email: partial.email ?? fallback?.email ?? 'hello@example.com',
        heroHeadline: partial.heroHeadline ?? fallback?.heroHeadline ?? 'Welcome',
        heroSubheadline: partial.heroSubheadline ?? fallback?.heroSubheadline ?? 'Quality service',
        products: partial.products ?? fallback?.products ?? [],
    }
}
import {
    buildHero as composerBuildHero,
    buildFeatures as composerBuildFeatures,
    buildTestimonials as composerBuildTestimonials,
    buildFAQ as composerBuildFAQ,
    buildAbout as composerBuildAbout,
    buildCTA as composerBuildCTA,
} from './template-composer'
import { hasUserDataReference, isGenericContent } from './content-rules'
import type { ThemeMood } from './theme-moods'

/** Block types eligible for post-AI swap. Other blocks are passed through. */
export const SWAPPABLE_BLOCKS: ReadonlySet<string> = new Set([
    'hero',
    'features',
    'testimonials',
    'faq',
    'about',
    'cta',
])

/** One telemetry entry emitted per swap decision (swap OR skip-with-reason). */
export interface SwapTelemetry {
    blockType: string
    action: 'swapped' | 'kept-user-data' | 'kept-not-generic' | 'kept-no-composer' | 'kept-composer-error'
    reason: string | null
    matchedPhrases?: string[]
}

export interface PostAISwapResult {
    blocks: Record<string, unknown>[]
    telemetry: SwapTelemetry[]
}

/**
 * Invoke the right composer builder for a given block type. Returns null
 * when composer fails or content pack is missing for the category.
 */
function callComposerBuilder(
    blockType: string,
    biz: BusinessSample,
    category: string,
    content: CategoryContent | null,
    mood?: ThemeMood,
): Record<string, unknown> | null {
    switch (blockType) {
        case 'hero':
            return composerBuildHero(biz, category, 0, mood)
        case 'features':
            return composerBuildFeatures(biz, category)
        case 'testimonials':
            return content ? composerBuildTestimonials(content, biz.name) : null
        case 'faq':
            return content ? composerBuildFAQ(content, biz.name) : null
        case 'about':
            return composerBuildAbout(biz)
        case 'cta':
            return composerBuildCTA(biz, category, mood)
        default:
            return null
    }
}

/**
 * Walk AI-emitted blocks. For each swappable block: if NOT user-data-referenced
 * AND IS generic → swap for composer output. Emit telemetry per decision.
 *
 * Never throws — on composer error, keeps the AI block and logs a skip.
 */
export function postAISwapStep(
    blocks: Record<string, unknown>[],
    bizPartial: Partial<BusinessSample>,
    category: string,
    mood?: ThemeMood,
): PostAISwapResult {
    const telemetry: SwapTelemetry[] = []
    const content = getCategoryContent(category) ?? null
    // Composer builders require a full BusinessSample — hydrate defaults from
    // category pack so AI gen path (which passes Partial from BusinessInfoInput)
    // never crashes the swap step.
    const biz = hydrateBiz(bizPartial, category)

    const swapped = blocks.map((block) => {
        const bt = typeof block.blockType === 'string' ? block.blockType : ''
        if (!SWAPPABLE_BLOCKS.has(bt)) return block

        // Guard 1: user data preservation — check against ORIGINAL user input
        // (not hydrated defaults), so library default names don't falsely
        // match AI blocks that happen to reuse library copy.
        if (hasUserDataReference(block, bizPartial)) {
            telemetry.push({ blockType: bt, action: 'kept-user-data', reason: null })
            return block
        }

        // Guard 2: quality bar — only swap genuinely generic blocks
        const genericCheck = isGenericContent(block)
        if (!genericCheck.generic) {
            telemetry.push({
                blockType: bt,
                action: 'kept-not-generic',
                reason: null,
                matchedPhrases: genericCheck.matchedPhrases,
            })
            return block
        }

        // Composer dispatch
        let composed: Record<string, unknown> | null = null
        try {
            composed = callComposerBuilder(bt, biz, category, content, mood)
        } catch (err) {
            console.warn(`[post-ai-swap] ${bt} composer threw, keeping AI block:`, err)
            telemetry.push({
                blockType: bt,
                action: 'kept-composer-error',
                reason: err instanceof Error ? err.message : 'unknown error',
            })
            return block
        }

        if (!composed) {
            telemetry.push({
                blockType: bt,
                action: 'kept-no-composer',
                reason: `no-composer-output-for-category:${category}`,
            })
            return block
        }

        // Preserve AI-chosen variant if the composer did not emit one — some
        // AI variants are deliberate per category recipe.
        const preservedVariant = typeof block.variant === 'string' && typeof composed.variant !== 'string'
            ? { variant: block.variant }
            : {}

        telemetry.push({
            blockType: bt,
            action: 'swapped',
            reason: genericCheck.reason,
            matchedPhrases: genericCheck.matchedPhrases,
        })
        console.warn(
            `[post-ai-swap] ${bt} swapped (reason=${genericCheck.reason}, category=${category})`,
        )
        return { ...composed, ...preservedVariant }
    })

    return { blocks: swapped, telemetry }
}

/**
 * Read the feature flag. Default: enabled on staging + dev, disabled on prod.
 * Prod rollout: flip after Phase 07 measurement harness validates positive
 * delta on content-quality axes.
 */
export function isPostAISwapEnabled(): boolean {
    const flag = process.env.AI_POST_SWAP_ENABLED
    if (flag === 'true') return true
    if (flag === 'false') return false
    // Default — ON unless explicitly disabled. Generator falls back to legacy
    // path if this returns false.
    return true
}

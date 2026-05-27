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
import { seededPick } from './seeded-random'

/**
 * Hydrate a Partial<BusinessSample> into a full BusinessSample for composer
 * consumption. Seeds across `pack.businesses` so two users in the same
 * category whose partial is missing the same field get different canned
 * baselines (GH-912 — addresses leak of `businesses[0]` phone/address/etc.).
 */
function hydrateBiz(partial: Partial<BusinessSample>, category: string, seed: number): BusinessSample {
    const pack = getCategoryContent(category) ?? getCategoryContent('business')
    const fallback = seededPick(pack?.businesses ?? [], seed)
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
import { getBlockStrings, hasDedicatedStrings, getNavLabels, getSectionLabels } from './block-i18n'

/**
 * Replace nav link labels for known URL slugs with i18n equivalents.
 * Uses the focused NAV_LABELS lookup (5 strings/lang) which covers languages
 * where GPT has training bias toward English nav labels. Returns blocks
 * unchanged when no nav labels are found for the language.
 */
function normalizeNavLinks(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const navLabels = getNavLabels(language)
    if (!navLabels) return blocks
    const urlToLabel: Record<string, string> = {
        '/': navLabels.home,
        '/about': navLabels.about,
        '/services': navLabels.services,
        '/contact': navLabels.contact,
    }
    return blocks.map((block) => {
        if (block.blockType !== 'navigation') return block
        const links = Array.isArray(block.links) ? block.links : []
        const normalizedLinks = links.map((link: unknown) => {
            const l = link as Record<string, unknown>
            const url = typeof l.url === 'string' ? l.url : ''
            const translated = urlToLabel[url]
            return translated ? { ...l, label: translated } : l
        })
        return { ...block, links: normalizedLinks }
    })
}

/** Patch contact block labels from i18n without replacing user-supplied data. */
function normalizeContactLabels(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'contact') return block
        return {
            ...block,
            submitLabel: i18n.contact.submitLabel,
            phoneLabel: i18n.contact.phoneLabel,
            addressLabel: i18n.contact.addressLabel,
            emailLabel: i18n.contact.emailLabel,
        }
    })
}

/** Patch client-logos headline from i18n without replacing logo data. */
function normalizeClientLogosHeadline(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'client-logos' && block.blockType !== 'logo-cloud') return block
        return { ...block, headline: i18n.clientLogos.headline }
    })
}

/** Patch about block sectionLabel — GPT defaults to English "About Us" even for non-English sites. */
function normalizeAboutSectionLabel(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'about') return block
        return { ...block, sectionLabel: i18n.footer.aboutUs }
    })
}

/** Patch contact block sectionLabel — GPT defaults to English "Contact" even for non-English sites. */
function normalizeContactSectionLabel(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'contact') return block
        return { ...block, sectionLabel: i18n.navigation.contact }
    })
}

/**
 * Patch features headline on ALL features blocks regardless of swap status.
 * Needed because non-generic GPT features are kept (not swapped) but still
 * have the English "Why Choose X" prefix from GPT's training default.
 */
function normalizeFeaturesHeadline(
    blocks: Record<string, unknown>[],
    language: string,
    bizName: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'features') return block
        return { ...block, headline: i18n.features.headlineWhyChoose(bizName) }
    })
}

/** Patch testimonials subheadline on non-swapped testimonials blocks. */
function normalizeTestimonialsSubheadline(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'testimonials') return block
        return { ...block, subheadline: i18n.testimonials.subheadline }
    })
}

/**
 * Patch sectionLabel on all blocks using the SECTION_LABELS_SEED lookup.
 * Runs before the hasDedicatedStrings guard so non-Latin-script languages
 * (ja/zh/ko/ar/th) get correct sectionLabels without a full BlockStrings entry.
 * en/ms/vi are excluded — their sectionLabels come from the STRINGS chain below.
 */
function normalizeSectionLabels(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    // Languages with full BlockStrings (hasDedicatedStrings) get their sectionLabels
    // from the STRINGS chain after the guard below — skip to avoid double-patching.
    if (hasDedicatedStrings(language)) return blocks
    const labels = getSectionLabels(language)
    if (!labels) return blocks

    const blockTypeToLabel: Record<string, string> = {
        'about': labels.about,
        'gallery': labels.gallery,
        'contact': labels.contact,
        'features': labels.features,
        'testimonials': labels.testimonials,
        'faq': labels.faq,
        'team': labels.team,
        'service-cards': labels.serviceCards,
        'stats': labels.stats,
        'pricing': labels.pricing,
        'newsletter': labels.newsletter,
        'client-logos': labels.clientLogos,
        'logo-cloud': labels.clientLogos,
        'blog-list': labels.blogList,
    }

    return blocks.map((block) => {
        const bt = typeof block.blockType === 'string' ? block.blockType : ''
        const label = blockTypeToLabel[bt]
        if (!label) return block
        // Contact block: also patch submitLabel which GPT keeps as "Send Message"
        const extra = bt === 'contact' ? { submitLabel: labels.contactSubmitLabel } : {}
        return { ...block, sectionLabel: label, ...extra }
    })
}

/**
 * Fix GPT/composer training bias for "About [Business]" headlines.
 * GPT defaults to "About XYZ" even for non-English sites. For languages
 * with an aboutHeadlinePrefix, replaces the English prefix.
 * Empty prefix (ja/ko) → drops "About " entirely, leaving just the business name.
 */
function normalizeAboutHeadline(
    blocks: Record<string, unknown>[],
    language: string,
): Record<string, unknown>[] {
    // Prefer SectionLabels seed (has aboutHeadlinePrefix); fall back to BlockStrings if available.
    const labels = getSectionLabels(language)
    const i18nPrefix = hasDedicatedStrings(language) ? getBlockStrings(language).about.headlinePrefix : null
    const prefix = labels?.aboutHeadlinePrefix ?? i18nPrefix
    // No localized prefix found — nothing to replace.
    if (prefix === null) return blocks

    return blocks.map((block) => {
        if (block.blockType !== 'about') return block
        const headline = typeof block.headline === 'string' ? block.headline : ''
        if (!/^About\s+/i.test(headline)) return block
        const bizPart = headline.replace(/^About\s+/i, '')
        return { ...block, headline: prefix ? `${prefix} ${bizPart}` : bizPart }
    })
}

/** Block types eligible for post-AI swap. Other blocks are passed through. */
export const SWAPPABLE_BLOCKS: ReadonlySet<string> = new Set([
    'hero',
    'features',
    'testimonials',
    'faq',
    'about',
    'cta',
])

/**
 * Content-heavy blocks where item copy (testimonial quotes, feature
 * titles/descriptions, FAQ Q&A) should come from GPT for non-English sites.
 * The English-only library would discard GPT's language-specific output.
 * Structural strings are still patched by the i18n normalize chain.
 */
export const GPT_CONTENT_BLOCKS: ReadonlySet<string> = new Set([
    'testimonials',
    'features',
    'faq',
])

/** One telemetry entry emitted per swap decision (swap OR skip-with-reason). */
export interface SwapTelemetry {
    blockType: string
    action: 'swapped' | 'kept-user-data' | 'kept-not-generic' | 'kept-no-composer' | 'kept-composer-error' | 'kept-lang-dynamic'
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
    language?: string,
): Record<string, unknown> | null {
    switch (blockType) {
        case 'hero':
            return composerBuildHero(biz, category, 0, mood)
        case 'features':
            return composerBuildFeatures(biz, category, language)
        case 'testimonials':
            return content ? composerBuildTestimonials(content, biz.name, language) : null
        case 'faq':
            return content ? composerBuildFAQ(content, biz.name, language) : null
        case 'about':
            return composerBuildAbout(biz, language)
        case 'cta':
            return composerBuildCTA(biz, category, mood, language)
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
    seed: number = 0,
    language?: string,
): PostAISwapResult {
    const telemetry: SwapTelemetry[] = []
    const content = getCategoryContent(category) ?? null
    // Composer builders require a full BusinessSample — hydrate defaults from
    // category pack so AI gen path (which passes Partial from BusinessInfoInput)
    // never crashes the swap step.
    const biz = hydrateBiz(bizPartial, category, seed)

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

        // Guard 1b: dynamic language trust — for non-English generation, GPT
        // already wrote content in the user's language. Swapping with an English
        // library block would discard GPT's language-specific copy. Structural
        // strings (headline, subheadline, sectionLabel) are patched by the i18n
        // normalize chain below regardless.
        // Covers content-heavy blocks where item copy (quotes, feature titles,
        // FAQ Q&A) must come from GPT, not the English-only library.
        if (language && language !== 'en' && GPT_CONTENT_BLOCKS.has(bt)) {
            telemetry.push({ blockType: bt, action: 'kept-lang-dynamic', reason: `lang:${language}` })
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
            composed = callComposerBuilder(bt, biz, category, content, mood, language)
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

    if (!language) return { blocks: swapped, telemetry }

    // Nav labels: always normalize using the focused NAV_LABELS lookup.
    // GPT has an insurmountable training bias toward English nav labels — even
    // explicit system-prompt instructions are ignored. NAV_LABELS covers
    // en/ms/vi/ja/zh/ko/ar/th; for other languages normalizeNavLinks is a no-op.
    const nav = normalizeNavLinks(swapped, language)
    // Section labels: patch before hasDedicatedStrings guard so ja/zh/ko/ar/th
    // get correct sectionLabels from the seed lookup. en/ms/vi are excluded from
    // SECTION_LABELS_SEED and handled by the full STRINGS chain below.
    const sectioned = normalizeSectionLabels(nav, language)
    // About headline: replace GPT/composer "About XYZ" English prefix with
    // the localized equivalent (e.g. "关于 重庆火锅" for Chinese).
    const aboutFixed = normalizeAboutHeadline(sectioned, language)

    // Full structural string chain (contact labels, logos, features headline, etc.)
    // only runs for languages with dedicated BlockStrings (en/ms/vi). For other
    // languages, GPT generates these strings correctly — trust its output rather
    // than overwriting with English fallback strings.
    if (!hasDedicatedStrings(language)) return { blocks: aboutFixed, telemetry }

    const contact = normalizeContactLabels(aboutFixed, language)
    const logos = normalizeClientLogosHeadline(contact, language)
    const features = normalizeFeaturesHeadline(logos, language, biz.name)
    const testimonials = normalizeTestimonialsSubheadline(features, language)
    const about = normalizeAboutSectionLabel(testimonials, language)
    const final = normalizeContactSectionLabel(about, language)
    return { blocks: final, telemetry }
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

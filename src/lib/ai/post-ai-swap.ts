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
import { withoutLibraryIdentity } from './library-identity'

/**
 * Hydrate a Partial<BusinessSample> into a full BusinessSample for composer
 * consumption. Identity + contact come from the merchant (or their FACTS) and
 * otherwise stay empty: the library sample businesses are fictional, so their
 * name / address / phone / email must never reach a real site (#2103 A1,
 * supersedes the GH-912 seed rotation, which only hid the leak). Generic
 * category copy (hero lines, products) still falls back to the library pack.
 */
function hydrateBiz(partial: Partial<BusinessSample>, category: string, seed: number): BusinessSample {
    const pack = getCategoryContent(category) ?? getCategoryContent('business')
    const sample = seededPick(pack?.businesses ?? [], seed)
    const base: BusinessSample = sample ?? {
        name: '',
        tagline: '',
        description: '',
        address: '',
        phone: '',
        email: '',
        heroHeadline: 'Welcome',
        heroSubheadline: 'Quality service',
    }
    const biz = withoutLibraryIdentity(base, partial)
    // Composer headings interpolate the name ("Why choose {name}"); keep them readable.
    return { ...biz, name: biz.name || 'Our Business' }
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
import {
    resolveLocaleStructuralStrings,
    type LocaleStructuralStrings,
} from './locale-structural-strings'
import { detectLanguageFromText } from '@/lib/language-detection'
import { resolveContactFieldKeys } from '@/lib/contact/contact-field-keys'

function isEnglishFallbackText(value: string): boolean {
    return Boolean(value.trim()) && detectLanguageFromText(value).locale === 'en'
}

function neutralLocaleFallback(bizName: string): LocaleStructuralStrings {
    const label = bizName.trim()
    return {
        navigation: {
            home: label,
            about: label,
            services: label,
            contact: label,
            getStarted: label,
            blog: label,
        },
        sections: {
            about: label,
            gallery: label,
            contact: label,
            features: label,
            testimonials: label,
            faq: label,
            team: label,
            serviceCards: label,
            stats: label,
            pricing: label,
            newsletter: label,
            clientLogos: label,
            blogList: label,
            contactSubmitLabel: label,
            aboutHeadlinePrefix: '',
        },
        newsletter: { buttonLabel: label, emailPlaceholder: label },
        blogList: {
            readArticleLabel: label,
            uncategorizedLabel: label,
            emptyStateLabel: label,
        },
        contact: {
            headline: label,
            subheadline: label,
            nameLabel: label,
            emailLabel: label,
            phoneLabel: label,
            addressLabel: label,
            messageLabel: label,
            submitLabel: label,
        },
        footer: { exploreLabel: label, allRightsReserved: label },
    }
}

/**
 * Replace nav link labels for known URL slugs with i18n equivalents.
 * Uses the focused NAV_LABELS lookup (5 strings/lang) which covers languages
 * where GPT has training bias toward English nav labels. Returns blocks
 * unchanged when no nav labels are found for the language.
 */
function normalizeNavLinks(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const navLabels =
        getNavLabels(language)
        ?? localizedOverride?.navigation
        ?? resolveLocaleStructuralStrings(language)?.navigation
    if (!navLabels) return blocks
    const urlToLabel: Record<string, string> = {
        '/': navLabels.home,
        '/about': navLabels.about,
        '/services': navLabels.services,
        '/contact': navLabels.contact,
        '/blog':
            localizedOverride?.navigation.blog
            ?? resolveLocaleStructuralStrings(language)?.navigation.blog
            ?? 'Blog',
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
        const ctaButton = block.ctaButton && typeof block.ctaButton === 'object'
            ? block.ctaButton as Record<string, unknown>
            : null
        const ctaUrl = typeof ctaButton?.url === 'string' ? ctaButton.url.toLowerCase() : ''
        const ctaLabel = typeof ctaButton?.label === 'string' ? ctaButton.label : ''
        const localizedCta = ctaButton
            && (ctaUrl === '/contact' || ctaUrl === '#contact' || ctaUrl === '/#contact')
            && (!ctaLabel || isEnglishFallbackText(ctaLabel))
                ? { ...ctaButton, label: navLabels.getStarted }
                : block.ctaButton
        return { ...block, links: normalizedLinks, ctaButton: localizedCta }
    })
}

/** Patch contact block labels from i18n without replacing user-supplied data. */
function normalizeContactLabels(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized && !hasDedicatedStrings(language)) return blocks
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'contact') return block
        const rawFields = Array.isArray(block.formFields) ? block.formFields : null
        // GH-2243: shared mapping with the storefront form; custom text names are left alone here.
        const keys = rawFields
            ? resolveContactFieldKeys(
                rawFields.map((f: unknown) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {})),
                { mapCustomText: false },
            )
            : []
        const labelFor: Record<string, string | undefined> = {
            email: localized?.contact.emailLabel ?? i18n.contact.emailLabel,
            phone: localized?.contact.phoneLabel ?? i18n.contact.phoneLabel,
            message: localized?.contact.messageLabel ?? i18n.contact.messageLabel,
            name: localized?.contact.nameLabel ?? i18n.contact.nameLabel,
        }
        const formFields = rawFields
            ? rawFields.map((field: unknown, index: number) => {
                if (!field || typeof field !== 'object') return field
                const record = field as Record<string, unknown>
                const fieldName = keys[index]!
                const label = labelFor[fieldName]
                return label ? { ...record, fieldName, label } : { ...record, fieldName }
            })
            : block.formFields
        return {
            ...block,
            headline: localized?.contact.headline ?? block.headline,
            subheadline: localized?.contact.subheadline ?? block.subheadline,
            submitLabel: localized?.contact.submitLabel ?? i18n.contact.submitLabel,
            phoneLabel: localized?.contact.phoneLabel ?? i18n.contact.phoneLabel,
            addressLabel: localized?.contact.addressLabel ?? i18n.contact.addressLabel,
            emailLabel: localized?.contact.emailLabel ?? i18n.contact.emailLabel,
            formFields,
        }
    })
}

function normalizeFooterStrings(
    blocks: Record<string, unknown>[],
    language: string,
    bizName: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    if (language.split('-')[0] === 'en') return blocks
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized) return blocks
    const english = getBlockStrings('en')

    return blocks.map((block) => {
        if (block.blockType !== 'footer') return block
        const columns = Array.isArray(block.columns)
            ? block.columns.map((column: unknown) => {
                if (!column || typeof column !== 'object') return column
                const record = column as Record<string, unknown>
                const title = typeof record.title === 'string' ? record.title.trim() : ''
                const links = Array.isArray(record.links)
                    ? record.links.map((link: unknown) => {
                        if (!link || typeof link !== 'object') return link
                        const item = link as Record<string, unknown>
                        const url = String(item.url ?? '')
                        const labelByUrl: Record<string, string> = {
                            '/': localized.navigation.home,
                            '/about': localized.navigation.about,
                            '/services': localized.navigation.services,
                            '/contact': localized.navigation.contact,
                            '/blog': localized.navigation.blog,
                        }
                        return labelByUrl[url] ? { ...item, label: labelByUrl[url] } : item
                    })
                    : record.links
                return {
                    ...record,
                    title:
                        !title || title === english.footer.explore
                            ? localized.footer.exploreLabel
                            : record.title,
                    links,
                }
            })
            : block.columns
        const copyrightText = typeof block.copyrightText === 'string'
            ? block.copyrightText
            : ''
        return {
            ...block,
            columns,
            copyrightText:
                !copyrightText || copyrightText.includes(english.footer.allRightsReserved)
                    ? `© ${new Date().getFullYear()} ${bizName}. ${localized.footer.allRightsReserved}`
                    : block.copyrightText,
        }
    })
}

/** Patch client-logos headline from i18n without replacing logo data. */
function normalizeClientLogosHeadline(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized && !hasDedicatedStrings(language)) return blocks
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'client-logos' && block.blockType !== 'logo-cloud') return block
        return { ...block, headline: localized?.sections.clientLogos ?? i18n.clientLogos.headline }
    })
}

/** Patch about block sectionLabel — GPT defaults to English "About Us" even for non-English sites. */
function normalizeAboutSectionLabel(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    // Skip if normalizeSectionLabels already patched via SECTION_LABELS_SEED — its values
    // are the authoritative section labels; BlockStrings.footer.aboutUs can diverge.
    if (getSectionLabels(language)) return blocks
    const localized = localizedOverride ?? resolveLocaleStructuralStrings(language)
    if (!localized && !hasDedicatedStrings(language)) return blocks
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'about') return block
        return { ...block, sectionLabel: localized?.sections.about ?? i18n.footer.aboutUs }
    })
}

/** Patch contact block sectionLabel — only for languages without a SECTION_LABELS_SEED entry. */
function normalizeContactSectionLabel(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    // Skip if normalizeSectionLabels already patched — navigation.contact is the short nav form
    // and can differ from the section label (e.g. ms: 'Hubungi' nav vs 'Hubungi Kami' section).
    if (getSectionLabels(language)) return blocks
    const localized = localizedOverride ?? resolveLocaleStructuralStrings(language)
    if (!localized && !hasDedicatedStrings(language)) return blocks
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'contact') return block
        return { ...block, sectionLabel: localized?.sections.contact ?? i18n.navigation.contact }
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
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized && !hasDedicatedStrings(language)) return blocks
    const i18n = getBlockStrings(language)
    return blocks.map((block) => {
        if (block.blockType !== 'features') return block
        return {
            ...block,
            headline: localized?.sections.features ?? i18n.features.headlineWhyChoose(bizName),
        }
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
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const labels = getSectionLabels(language) ?? localizedOverride?.sections
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
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    // Prefer SectionLabels seed (has aboutHeadlinePrefix); fall back to BlockStrings if available.
    const labels = getSectionLabels(language)
    const i18nPrefix = hasDedicatedStrings(language) ? getBlockStrings(language).about.headlinePrefix : null
    const prefix = labels?.aboutHeadlinePrefix
        ?? localizedOverride?.sections.aboutHeadlinePrefix
        ?? i18nPrefix
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

function normalizeHeroCTAs(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    if (language.split('-')[0] === 'en') return blocks
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized) return blocks
    const english = getBlockStrings('en')
    const explicitAboutLabels = new Set([
        english.navigation.about.toLowerCase(),
        english.footer.aboutUs.toLowerCase(),
    ])
    const contextualAboutFallbacks = new Set([
        english.pricing.learnMore.toLowerCase(),
        'button',
    ])

    return blocks.map((block) => {
        if (block.blockType !== 'hero' || !Array.isArray(block.ctaButtons)) return block

        const ctaButtons = block.ctaButtons.map((button: unknown) => {
            if (!button || typeof button !== 'object') return button
            const cta = button as Record<string, unknown>
            const url = typeof cta.url === 'string' ? cta.url.toLowerCase() : ''
            const rawLabel = cta.label ?? cta.text ?? cta.title
            const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
            const normalizedLabel = label.toLowerCase()

            if (
                explicitAboutLabels.has(normalizedLabel)
                || (
                    (url === '/about' || url === '#about' || url === '/#about')
                    && (!label || contextualAboutFallbacks.has(normalizedLabel))
                )
            ) {
                return { ...cta, label: localized.navigation.about }
            }
            if (
                normalizedLabel === english.navigation.getStarted.toLowerCase()
                || (
                    (url === '/contact' || url === '#contact' || url === '/#contact')
                    && (!label || isEnglishFallbackText(label))
                )
            ) {
                return { ...cta, label: localized.navigation.getStarted }
            }
            return cta
        })

        return { ...block, ctaButtons }
    })
}

function normalizeNewsletterStrings(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    if (language.split('-')[0] === 'en') return blocks
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized) return blocks
    const english = getBlockStrings('en')

    return blocks.map((block) => {
        if (block.blockType !== 'newsletter') return block
        const buttonLabel = typeof block.buttonLabel === 'string' ? block.buttonLabel.trim() : ''
        const placeholder = typeof block.placeholder === 'string' ? block.placeholder.trim() : ''
        return {
            ...block,
            buttonLabel:
                !buttonLabel || buttonLabel === english.newsletter.subscribeLabel
                    ? localized.newsletter.buttonLabel
                    : block.buttonLabel,
            placeholder:
                !placeholder || placeholder === 'your@email.com' || placeholder === english.contact.emailLabel
                    ? localized.newsletter.emailPlaceholder
                    : block.placeholder,
        }
    })
}

function normalizeBlogListStrings(
    blocks: Record<string, unknown>[],
    language: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const localized = resolveLocaleStructuralStrings(language) ?? localizedOverride
    if (!localized) return blocks

    return blocks.map((block) => {
        if (block.blockType !== 'blog-list') return block
        return {
            ...block,
            readArticleLabel: localized.blogList.readArticleLabel,
            uncategorizedLabel: localized.blogList.uncategorizedLabel,
            emptyStateLabel: localized.blogList.emptyStateLabel,
        }
    })
}

/**
 * Normalize locale-dependent structural fields after any stage that may add
 * blocks. Business content remains untouched.
 */
export function normalizeLocaleStructuralStrings(
    blocks: Record<string, unknown>[],
    language: string,
    bizName: string,
    localizedOverride?: LocaleStructuralStrings | null,
): Record<string, unknown>[] {
    const baseLanguage = language.split('-')[0]
    const localized = baseLanguage === 'en'
        ? localizedOverride
        : resolveLocaleStructuralStrings(language)
            ?? localizedOverride
    const conditionalFallback = localized
        ?? (baseLanguage === 'en' ? null : neutralLocaleFallback(bizName))
    const nav = normalizeNavLinks(blocks, language, localized)
    const sectioned = normalizeSectionLabels(nav, language, localized)
    const aboutFixed = normalizeAboutHeadline(sectioned, language, conditionalFallback)
    const hero = normalizeHeroCTAs(aboutFixed, language, conditionalFallback)
    const newsletter = normalizeNewsletterStrings(hero, language, conditionalFallback)
    const blogList = normalizeBlogListStrings(newsletter, language, localized)

    if (!hasDedicatedStrings(language) && baseLanguage === 'en') return blogList

    const contact = normalizeContactLabels(blogList, language, localized)
    const footer = normalizeFooterStrings(contact, language, bizName, localized)
    const logos = normalizeClientLogosHeadline(footer, language, localized)
    const features = normalizeFeaturesHeadline(logos, language, bizName, localized)
    const testimonials = hasDedicatedStrings(language)
        ? normalizeTestimonialsSubheadline(features, language)
        : features
    const about = normalizeAboutSectionLabel(testimonials, language, localized)
    return normalizeContactSectionLabel(about, language, localized)
}

export function normalizeGeneratedPageLocaleStrings<
    T extends { layout?: unknown[] },
>(
    pages: T[],
    language: string,
    bizName: string,
    localizedOverride?: LocaleStructuralStrings | null,
): T[] {
    return pages.map((page) => {
        if (!Array.isArray(page.layout)) return page
        const blockEntries = page.layout.filter(
            (block): block is Record<string, unknown> =>
                Boolean(block) && typeof block === 'object',
        )
        const normalizedBlocks = normalizeLocaleStructuralStrings(
            blockEntries,
            language,
            bizName,
            localizedOverride,
        )
        let normalizedIndex = 0
        return {
            ...page,
            layout: page.layout.map((block) =>
                Boolean(block) && typeof block === 'object'
                    ? normalizedBlocks[normalizedIndex++] ?? block
                    : block,
            ),
        }
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
 * Kept as a public compatibility export for callers that classify the original
 * content-heavy subset. postAISwapStep now preserves every swappable GPT block
 * for non-English sites because all composer builders are English-first.
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
            return composerBuildHero(biz, category, 0, mood, language)
        case 'features':
            return composerBuildFeatures(biz, category, language)
        case 'testimonials':
            return composerBuildTestimonials(biz, language)
        case 'faq':
            return composerBuildFAQ(biz, language)
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
    localeStrings?: LocaleStructuralStrings | null,
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

        // Guard 1b: dynamic language trust — composer content is English-first.
        // Preserve every GPT block for non-English generation; replacing even a
        // hero/about/CTA can reintroduce English copy after GPT localized it.
        // Structural fallback labels are normalized below.
        if (language && language.split('-')[0] !== 'en') {
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

    return {
        blocks: normalizeLocaleStructuralStrings(swapped, language, biz.name, localeStrings),
        telemetry,
    }
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

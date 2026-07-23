import {
    getBlockStrings,
    getNavLabels,
    getSectionLabels,
    hasDedicatedStrings,
    type BlockStrings,
    type NavLabels,
    type SectionLabels,
} from './block-i18n'

export interface LocaleStructuralStrings {
    navigation: NavLabels
    sections: SectionLabels
    newsletter: {
        buttonLabel: string
        emailPlaceholder: string
    }
    blogList: {
        readArticleLabel: string
        uncategorizedLabel: string
        emptyStateLabel: string
    }
}

function sectionsFromBlockStrings(strings: BlockStrings): SectionLabels {
    return {
        about: strings.footer.aboutUs,
        gallery: strings.gallery.headline,
        contact: strings.contact.headline,
        features: strings.serviceCards.headline,
        testimonials: strings.testimonials.headline,
        faq: strings.faq.headline,
        team: strings.team.headline,
        serviceCards: strings.serviceCards.headline,
        stats: strings.stats.headline,
        pricing: strings.pricing.headline,
        newsletter: strings.newsletter.subscribeLabel,
        clientLogos: strings.clientLogos.headline,
        blogList: 'Blog',
        contactSubmitLabel: strings.contact.submitLabel,
        aboutHeadlinePrefix: strings.about.headlinePrefix,
    }
}

/**
 * Resolve structural UI strings without branching on individual locales.
 * Unknown locales return null until the dynamic translator populates the cache.
 */
export function resolveLocaleStructuralStrings(locale?: string): LocaleStructuralStrings | null {
    if (!locale || !hasDedicatedStrings(locale)) return null

    const strings = getBlockStrings(locale)
    const navigation = getNavLabels(locale) ?? strings.navigation
    const sections = getSectionLabels(locale) ?? sectionsFromBlockStrings(strings)

    return {
        navigation,
        sections,
        newsletter: {
            buttonLabel: strings.newsletter.subscribeLabel,
            // Reuse the already-localized email field label instead of maintaining
            // another per-locale placeholder table.
            emailPlaceholder: strings.contact.emailLabel,
        },
        blogList: strings.blogList,
    }
}

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
    navigation: NavLabels & {
        blog: string
    }
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
    contact: {
        headline: string
        subheadline: string
        nameLabel: string
        emailLabel: string
        phoneLabel: string
        addressLabel: string
        messageLabel: string
        submitLabel: string
    }
    footer: {
        exploreLabel: string
        allRightsReserved: string
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

const REQUIRED_NAVIGATION_KEYS = ['home', 'about', 'services', 'contact', 'getStarted', 'blog'] as const
const REQUIRED_SECTION_KEYS = [
    'about',
    'gallery',
    'contact',
    'features',
    'testimonials',
    'faq',
    'team',
    'serviceCards',
    'stats',
    'pricing',
    'newsletter',
    'clientLogos',
    'blogList',
    'contactSubmitLabel',
    'aboutHeadlinePrefix',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasNonEmptyStrings(record: Record<string, unknown>, keys: readonly string[]): boolean {
    return keys.every((key) => typeof record[key] === 'string' && record[key]!.trim().length > 0)
}

/**
 * Parse the locale context returned in-band by the homepage generation call.
 * Invalid or incomplete payloads are ignored so they can never break generation.
 */
export function parseLocaleStructuralStrings(value: unknown): LocaleStructuralStrings | null {
    if (!isRecord(value)) return null

    const navigation = value.navigation
    const sections = value.sections
    const newsletter = value.newsletter
    const blogList = value.blogList
    const contact = value.contact
    const footer = value.footer

    if (
        !isRecord(navigation)
        || !isRecord(sections)
        || !isRecord(newsletter)
        || !isRecord(blogList)
        || !isRecord(contact)
        || !isRecord(footer)
    ) return null

    if (!hasNonEmptyStrings(navigation, REQUIRED_NAVIGATION_KEYS)) return null
    if (!hasNonEmptyStrings(sections, REQUIRED_SECTION_KEYS)) return null
    if (!hasNonEmptyStrings(newsletter, ['buttonLabel', 'emailPlaceholder'])) return null
    if (!hasNonEmptyStrings(blogList, ['readArticleLabel', 'uncategorizedLabel', 'emptyStateLabel'])) return null
    if (!hasNonEmptyStrings(contact, [
        'headline',
        'subheadline',
        'nameLabel',
        'emailLabel',
        'phoneLabel',
        'addressLabel',
        'messageLabel',
        'submitLabel',
    ])) return null
    if (!hasNonEmptyStrings(footer, ['exploreLabel', 'allRightsReserved'])) return null

    return value as unknown as LocaleStructuralStrings
}

/**
 * Resolve structural UI strings without branching on individual locales.
 * Static/cache-backed strings take priority; dynamic locales use the locale
 * context generated in the same request.
 */
export function resolveLocaleStructuralStrings(
    locale?: string,
    generated?: unknown,
): LocaleStructuralStrings | null {
    if (!locale) return null
    if (!hasDedicatedStrings(locale)) return parseLocaleStructuralStrings(generated)

    const strings = getBlockStrings(locale)
    const sections = getSectionLabels(locale) ?? sectionsFromBlockStrings(strings)
    const navigation = {
        ...(getNavLabels(locale) ?? strings.navigation),
        blog: sections.blogList,
    }

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
        contact: {
            headline: strings.contact.headline,
            subheadline: strings.contact.subheadline,
            nameLabel: strings.contact.nameLabel,
            emailLabel: strings.contact.emailLabel,
            phoneLabel: strings.contact.phoneLabel,
            addressLabel: strings.contact.addressLabel,
            messageLabel: strings.contact.messageLabel,
            submitLabel: strings.contact.submitLabel,
        },
        footer: {
            exploreLabel: strings.footer.explore,
            allRightsReserved: strings.footer.allRightsReserved,
        },
    }
}

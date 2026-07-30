import { describe, expect, it } from 'vitest'
import {
    getBlockStrings,
    getSectionLabels,
    injectBlockStrings,
    injectSectionLabels,
} from '@/lib/ai/block-i18n'
import {
    parseLocaleStructuralStrings,
    resolveLocaleStructuralStrings,
} from '@/lib/ai/locale-structural-strings'

const germanLocaleContext = {
    navigation: {
        home: 'Startseite',
        about: 'Über uns',
        services: 'Leistungen',
        contact: 'Kontakt',
        getStarted: 'Jetzt starten',
        blog: 'Magazin',
    },
    sections: {
        about: 'Über uns',
        gallery: 'Galerie',
        contact: 'Kontakt',
        features: 'Vorteile',
        testimonials: 'Kundenstimmen',
        faq: 'Häufige Fragen',
        team: 'Unser Team',
        serviceCards: 'Leistungen',
        stats: 'Unsere Zahlen',
        pricing: 'Preise',
        newsletter: 'Newsletter',
        clientLogos: 'Partner',
        blogList: 'Magazin',
        contactSubmitLabel: 'Nachricht senden',
        aboutHeadlinePrefix: 'Über',
    },
    newsletter: {
        buttonLabel: 'Abonnieren',
        emailPlaceholder: 'Ihre E-Mail-Adresse',
    },
    blogList: {
        readArticleLabel: 'Artikel lesen',
        uncategorizedLabel: 'Ohne Kategorie',
        emptyStateLabel: 'Noch keine Beiträge veröffentlicht.',
    },
    contact: {
        headline: 'Kontakt aufnehmen',
        subheadline: 'Wir freuen uns auf Ihre Nachricht.',
        nameLabel: 'Name',
        emailLabel: 'E-Mail',
        phoneLabel: 'Telefon',
        addressLabel: 'Adresse',
        messageLabel: 'Nachricht',
        submitLabel: 'Nachricht senden',
    },
    footer: {
        exploreLabel: 'Entdecken',
        allRightsReserved: 'Alle Rechte vorbehalten.',
    },
}

describe('TC-F01-PAS-09: dynamic structural locale resolver', () => {
    it('resolves a locale populated at runtime without a locale-specific branch', () => {
        // Arrange
        const runtimeLocale = 'runtime-locale'
        injectBlockStrings(runtimeLocale, getBlockStrings('zh'))
        injectSectionLabels(runtimeLocale, getSectionLabels('zh')!)

        // Act
        const result = resolveLocaleStructuralStrings(runtimeLocale)

        // Assert
        expect(result).not.toBeNull()
        expect(result?.navigation.about).toBe('关于我们')
        expect(result?.sections.gallery).toBe('图片展示')
        expect(result?.newsletter.emailPlaceholder).toBe('邮箱')
        expect(result?.blogList.readArticleLabel).toBe('阅读文章')
    })

    it('returns null instead of silently falling back to English before translation', () => {
        // Arrange
        const unresolvedLocale = 'not-translated-yet'

        // Act
        const result = resolveLocaleStructuralStrings(unresolvedLocale)

        // Assert
        expect(result).toBeNull()
    })

    it('TC-F01-LOCALE-PERF-03: resolves a complete in-band locale context without warming a cache', () => {
        expect(parseLocaleStructuralStrings(germanLocaleContext)?.navigation.blog).toBe('Magazin')
        expect(
            resolveLocaleStructuralStrings('de-contract-test', germanLocaleContext)?.blogList.readArticleLabel,
        ).toBe('Artikel lesen')
    })

    it('TC-F01-LOCALE-PERF-04: ignores incomplete in-band locale context', () => {
        expect(parseLocaleStructuralStrings({
            ...germanLocaleContext,
            navigation: { home: 'Startseite' },
        })).toBeNull()
    })
})

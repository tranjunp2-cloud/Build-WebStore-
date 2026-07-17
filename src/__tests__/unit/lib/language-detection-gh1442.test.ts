import { describe, expect, it } from 'vitest'
import {
    buildLanguageDetectionText,
    detectLanguageFromText,
    normalizeSupportedLocale,
    resolveGenerationLanguageDecision,
} from '@/lib/language-detection'

describe('[TC-F26-11-01] shared language detection', () => {
    it.each([
        ['Yoga Studio', 'en'],
        ['Pizza Place', 'en'],
        ['Ottimi dolci e birra', 'it'],
        ['Bonjour boulangerie artisanale', 'fr'],
        ['Kedai runcit barangan keperluan', 'ms'],
        ['Toko makanan terbaik untuk keluarga', 'id'],
        ['Restoran keluarga terbaik', 'id'],
        ['Klinik keluarga terpercaya', 'id'],
        ['Butik keluarga modern', 'id'],
        ['Phở bò Hà Nội ngon nhất', 'vi'],
        ['Tiệm bánh ngon', 'vi'],
        ['Quán Phở', 'vi'],
        ['Nhà thuốc', 'vi'],
        ['Bún bò Huế', 'vi'],
        ['Tiệm hoa', 'vi'],
        ['Verse bakkerij Amsterdam', 'nl'],
        ['Українська пекарня Київ', 'uk'],
        ['Русская пекарня Москва', 'ru'],
        ['اردو بیکری لاہور', 'ur'],
        ['Taze ekmek firini Istanbul', 'tr'],
        ['Polska piekarnia swiezy chleb', 'pl'],
        ['Svenskt bageri farskt brod', 'sv'],
        ['さくらラーメン 東京', 'ja'],
        ['传统中餐厅 北京', 'zh'],
    ])('detects %s as %s', (text, locale) => {
        // Arrange / Act
        const result = detectLanguageFromText(text)

        // Assert
        expect(result.locale).toBe(locale)
    })

    it('does not classify otherwise English text as Vietnamese from one exclusive mark', () => {
        // Arrange
        const text = 'Professional bakery with frếsh bread every morning'

        // Act / Assert
        expect(detectLanguageFromText(text).locale).toBe('en')
    })

    it('uses the same four business fields for UI and server detection', () => {
        // Arrange / Act
        const text = buildLanguageDetectionText({
            businessName: 'Casa Bella',
            industry: 'ristorante italiano',
            shortDescription: 'cucina tradizionale',
            products: 'ottimi dolci',
        })

        // Assert
        expect(text).toContain('ristorante italiano')
        expect(detectLanguageFromText(text).locale).toBe('it')
    })

    it('normalizes pasted zero-width and non-breaking whitespace', () => {
        // Arrange / Act
        const text = buildLanguageDetectionText({ businessName: 'Ottimi\u200B\u00A0dolci', products: 'e birra' })

        // Assert
        expect(text).toBe('Ottimi dolci e birra')
        expect(detectLanguageFromText(text).locale).toBe('it')
    })
})

describe('[TC-F26-11-02][TC-F26-11-03][TC-F26-11-05] pre-generation decision', () => {
    it.each(['en', 'ms', 'vi'])('generates directly for manually selected %s', (locale) => {
        // Act / Assert
        expect(resolveGenerationLanguageDecision(locale, 'ignored')).toEqual({
            locale,
            requiresConfirmation: false,
        })
    })

    it.each([
        ['Yoga Studio', 'en', false],
        ['Kedai runcit terbaik', 'ms', false],
        ['Phở ngon Hà Nội', 'vi', true],
        ['Ottimi dolci e birra', 'it', true],
        ['さくらラーメン 東京', 'ja', true],
    ])('resolves Auto input %s to %s (confirm=%s)', (text, locale, requiresConfirmation) => {
        // Act / Assert
        expect(resolveGenerationLanguageDecision('auto', text)).toEqual({ locale, requiresConfirmation })
    })

    it('canonicalizes a regional confirmed locale before server use', () => {
        // Act / Assert
        expect(normalizeSupportedLocale('IT-it')).toBe('it')
        expect(normalizeSupportedLocale('not-a-locale')).toBeNull()
    })
})

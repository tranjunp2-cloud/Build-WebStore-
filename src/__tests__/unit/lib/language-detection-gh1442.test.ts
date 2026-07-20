import { describe, expect, it } from 'vitest'
import {
    buildLanguageDetectionText,
    detectLanguageFromText,
    normalizeSupportedLocale,
    resolveGenerationLanguageDecision,
} from '@/lib/language-detection'
import { detectLocaleFromText } from '@/lib/detect-locale'
import { detectLanguage } from '@/lib/ai/lang-detect'
import {
    GH1442_ACCURACY_CORPUS,
    GH1442_TARGET_LOCALES,
} from '@/__tests__/fixtures/language-detection-gh1442'

describe('[TC-F26-11-01] shared language detection', () => {
    it.each([
        ['Yoga Studio', 'en'],
        ['Pizza Place', 'en'],
        ['Ottimi dolci e birra', 'it'],
        ['Bonjour boulangerie artisanale', 'fr'],
        ['Kedai runcit barangan keperluan', 'ms'],
        ['Restoran makanan segar setiap hari', 'ms'],
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
        ['北京餐厅', 'zh'],
        ['Кафе', 'ru'],
        ['شركة خبز', 'ar'],
        ['رستوران ایرانی', 'fa'],
        ['מסעדה עברית', 'he'],
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

    it('does not treat an ambiguous domain token as Vietnamese evidence', () => {
        // Arrange
        const text = 'Professional bakery at example.com with frếsh bread'

        // Act / Assert
        expect(detectLanguageFromText(text).locale).toBe('en')
    })

    it('does not let one foreign-script character override strong English evidence', () => {
        // Arrange
        const text = 'Fresh bakery 北 with bread daily'

        // Act / Assert
        expect(detectLanguageFromText(text).locale).toBe('en')
    })

    it('keeps an arbitrary four-field English builder submission in English', () => {
        // Arrange
        const text = buildLanguageDetectionText({
            businessName: 'Golden Hair',
            industry: 'beauty',
            products: 'cuts styling',
            shortDescription: 'Look your best',
        })

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

describe('[TC-F26-11-07] reviewed per-locale accuracy corpus', () => {
    it.each(GH1442_TARGET_LOCALES)('keeps %s accuracy at or above 95/100', (locale) => {
        // Arrange
        const samples = GH1442_ACCURACY_CORPUS[locale]

        // Act
        const correct = samples.filter(({ expectedLocale, input }) =>
            detectLanguageFromText(buildLanguageDetectionText(input)).locale === expectedLocale).length

        // Assert
        expect(samples).toHaveLength(100)
        expect(new Set(samples.map(({ input }) => JSON.stringify(input))).size).toBe(100)
        expect(correct).toBeGreaterThanOrEqual(95)
    })

    it('keeps the UI and AI wrappers aligned for all 800 samples', () => {
        // Arrange
        const samples = GH1442_TARGET_LOCALES.flatMap((locale) => GH1442_ACCURACY_CORPUS[locale])

        // Act / Assert
        expect(samples).toHaveLength(800)
        for (const { input } of samples) {
            const text = buildLanguageDetectionText(input)
            const sharedLocale = detectLanguageFromText(text).locale
            expect(detectLocaleFromText(text)).toBe(sharedLocale)
            expect(detectLanguage(text).blockLang).toBe(sharedLocale)
        }
    })

    it.each([
        [{ businessName: 'Maison', industry: 'retail', products: 'chaussures', shortDescription: 'produits locales' }, 'fr'],
        [{ businessName: 'Schuh Haus', industry: 'retail', products: 'Schuhe', shortDescription: 'freundliche Beratung' }, 'de'],
        [{ businessName: 'Casa Sol', industry: 'retail', products: 'tapas', shortDescription: 'sabores locales para amigos' }, 'es'],
        [{ businessName: 'Casa Dolce', industry: 'retail', products: 'gelato artigianale', shortDescription: 'sapori per tutti' }, 'it'],
        [{ businessName: 'Maju Jaya', industry: 'retail', products: 'produk berkualitas', shortDescription: 'layanan pelanggan terpercaya' }, 'id'],
    ])('detects held-out full-form input as %s', (input, expectedLocale) => {
        // Arrange
        const text = buildLanguageDetectionText(input)

        // Act / Assert
        expect(detectLanguageFromText(text).locale).toBe(expectedLocale)
        expect(resolveGenerationLanguageDecision('auto', text)).toEqual({
            locale: expectedLocale,
            requiresConfirmation: true,
        })
    })

    it.each([
        ['Български ресторант София', 'bg'],
        ['Српски ресторан Београд', 'sr'],
        ['Македонска куќа Скопје', 'mk'],
        ['Беларуская пякарня Мінск', 'be'],
        ['Кوردی رێستوران', 'ku'],
        ['ئۇيغۇر ئاشخانىسى', 'ug'],
        ['Cà phê ngon', 'vi'],
        ['Toi ban banh ngon moi ngay', 'vi'],
    ])('keeps distinct language evidence for %s', (text, expectedLocale) => {
        // Act / Assert
        expect(detectLanguageFromText(text).locale).toBe(expectedLocale)
    })
})

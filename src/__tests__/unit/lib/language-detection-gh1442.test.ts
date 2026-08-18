import { describe, expect, it } from 'vitest'
import {
    buildLanguageDetectionText,
    detectLanguageFromText,
    normalizeSupportedLocale,
    resolveGenerationLanguageDecision,
} from '@/lib/language-detection'
import { detectLocaleFromText } from '@/lib/detect-locale'
import { detectLanguage } from '@/lib/ai/lang-detect'
import { getLocaleLabel } from '@/lib/locale-labels'
import {
    GH1442_ACCURACY_CORPUS,
    GH1442_HELD_OUT_FULL_FORM_CASES,
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
        ['मराठी बेकरी पुणे', 'mr'],
        ['नेपाली रेस्टुरेन्ट काठमाडौं', 'ne'],
        ['हिंदी बेकरी दिल्ली', 'hi'],
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

    it('does not let English industry labels override a long French business brief', () => {
        const text = buildLanguageDetectionText({
            businessName: 'Éclat Peau Studio',
            industry: 'Beauty / Spa / Wellness',
            shortDescription: 'Studio de soins de la peau à Paris proposant des traitements personnalisés pour une peau saine, lumineuse et équilibrée.',
            products: 'Diagnostic de peau, soin hydratant, traitement anti-acné, soin pour peau sensible, thérapie éclaircissante et consultation skincare.',
        })

        expect(resolveGenerationLanguageDecision('auto', text)).toEqual({
            locale: 'fr',
            requiresConfirmation: true,
        })
    })

    it('does not let Romance-language ambiguity fall back to English', () => {
        const text = buildLanguageDetectionText({
            businessName: 'Luce Pelle Beauty Studio',
            industry: 'Beauty / Spa / Wellness',
            shortDescription: 'Centro per la cura della pelle a Milano che offre trattamenti personalizzati per una pelle sana, luminosa ed equilibrata.',
            products: 'Analisi della pelle, trattamento idratante, trattamento anti acne, cura della pelle sensibile, terapia illuminante e consulenza skincare.',
        })

        expect(resolveGenerationLanguageDecision('auto', text)).toEqual({
            locale: 'it',
            requiresConfirmation: true,
        })
    })

    it('detects a realistic Malay spa builder submission instead of falling back to English', () => {
        const text = buildLanguageDetectionText({
            businessName: 'Seri Embun Wellness',
            industry: 'beauty',
            shortDescription: 'Pusat rawatan wanita di Shah Alam yang menawarkan pengalaman penjagaan diri yang tenang menggunakan bahan semula jadi.',
            products: 'Urutan aromaterapi, Rawatan muka, Mandian herba, Pakej pengantin',
        })

        expect(resolveGenerationLanguageDecision('auto', text)).toEqual({
            locale: 'ms',
            requiresConfirmation: false,
        })
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

describe('[TC-F26-11-07] per-locale robustness and held-out accuracy', () => {
    it.each(GH1442_TARGET_LOCALES)('keeps %s parameterized robustness at or above 95/100', (locale) => {
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

    it.each(GH1442_TARGET_LOCALES)('generalizes to independent held-out %s profiles', (locale) => {
        // Arrange
        const samples = GH1442_HELD_OUT_FULL_FORM_CASES[locale]

        // Act
        const detected = samples.map(({ input }) =>
            detectLanguageFromText(buildLanguageDetectionText(input)).locale)

        // Assert
        expect(samples).toHaveLength(5)
        expect(detected).toEqual(Array(5).fill(locale))
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

    it('uses a human-readable Persian label throughout the AI pipeline', () => {
        // Arrange / Act
        const result = detectLanguage('رستوران ایرانی تهران')

        // Assert
        expect(result).toMatchObject({ blockLang: 'fa', gpLang: 'Persian' })
        expect(getLocaleLabel('fa')).toMatchObject({ short: 'FA', full: 'Persian' })
    })
})

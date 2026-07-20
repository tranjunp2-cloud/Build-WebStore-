import { francAll } from 'franc-min'

export type DetectionSource = 'empty' | 'script' | 'vietnamese' | 'lexical' | 'statistical' | 'fallback'

export interface LanguageDetectionResult {
    locale: string
    confidence: number
    source: DetectionSource
}

export interface LanguageDetectionInput {
    businessName?: string
    industry?: string
    shortDescription?: string
    products?: string
}

export interface GenerationLanguageDecision {
    locale: string
    requiresConfirmation: boolean
}

const FRANC_ISO_TO_LOCALE: Record<string, string> = {
    eng: 'en', zlm: 'ms', zsm: 'ms', msa: 'ms', ind: 'id', vie: 'vi',
    tha: 'th', cmn: 'zh', zho: 'zh', jpn: 'ja', kor: 'ko', khm: 'km', mya: 'my', tgl: 'tl',
    hin: 'hi', ben: 'bn', urd: 'ur', pan: 'pa', guj: 'gu', mar: 'mr', mal: 'ml', kan: 'kn',
    tam: 'ta', tel: 'te', nep: 'ne', sin: 'si', pus: 'ps', arb: 'ar', ara: 'ar', heb: 'he',
    kur: 'ku', uig: 'ug', azj: 'az', kaz: 'kk', fas: 'fa', pes: 'fa', fra: 'fr', deu: 'de', spa: 'es', ita: 'it',
    por: 'pt', nld: 'nl', tur: 'tr', pol: 'pl', swe: 'sv', nor: 'no', dan: 'da', fin: 'fi',
    ces: 'cs', slk: 'sk', ron: 'ro', hun: 'hu', hrv: 'hr', bos: 'bs', srp: 'sr', slv: 'sl',
    sqi: 'sq', mkd: 'mk', mlt: 'mt', est: 'et', lav: 'lv', lit: 'lt', ell: 'el', afr: 'af',
    cat: 'ca', glg: 'gl', eus: 'eu', lat: 'la', epo: 'eo', rus: 'ru', ukr: 'uk', bel: 'be',
    bul: 'bg', hye: 'hy', kat: 'ka', swa: 'sw', swh: 'sw', amh: 'am', yor: 'yo', som: 'so',
    sna: 'sn', xho: 'xh', zul: 'zu',
}

const FRANC_CANDIDATES = [...new Set(Object.keys(FRANC_ISO_TO_LOCALE))]
const SUPPORTED_LOCALES = new Set(Object.values(FRANC_ISO_TO_LOCALE))

const MALAY_HIGH_PRECISION = new Set([
    'kedai', 'warung', 'restoran', 'klinik', 'butik', 'syarikat', 'perniagaan', 'jenama',
    'jualan', 'pelanggan', 'tempatan', 'berkualiti', 'terbaik', 'segar', 'makanan',
    'murah', 'harga', 'perkhidmatan', 'menyediakan', 'produk',
    'menggunakan', 'keperluan', 'kecantikan',
    'pergigian', 'pakaian', 'perabot', 'runcit', 'borong', 'khidmat', 'pemborong', 'hartanah',
])

const MALAY_CONTEXT_MARKERS = new Set([
    'kedai', 'warung', 'syarikat', 'perniagaan', 'jenama', 'jualan', 'pelanggan',
    'tempatan', 'berkualiti', 'perkhidmatan', 'menyediakan', 'pergigian', 'pakaian',
    'perabot', 'runcit', 'khidmat', 'pemborong', 'hartanah',
])

const MALAY_EXCLUSIVE_MARKERS = new Set([
    'kedai', 'syarikat', 'perniagaan', 'berkualiti', 'perkhidmatan', 'keperluan',
    'pergigian', 'perabot', 'runcit', 'khidmat', 'pemborong', 'hartanah',
    'pembaikan', 'pencuci', 'kanak', 'kediaman', 'penyelenggaraan', 'mengikut',
    'suai', 'mewujudkan',
])

const INDONESIAN_EXCLUSIVE_MARKERS = new Set([
    'toko', 'layanan', 'pelayanan', 'kebutuhan', 'kualitas', 'berkualitas',
    'terpercaya', 'waralaba', 'pelaku',
])

const LATIN_LEXICONS: Record<string, ReadonlySet<string>> = {
    en: new Set([
        'yoga', 'studio', 'pizza', 'place', 'nail', 'salon', 'coffee', 'shop', 'auto', 'repair',
        'fitness', 'gym', 'dental', 'clinic', 'bakery', 'restaurant', 'store', 'business',
        'services', 'professional', 'wellness', 'classes', 'bread', 'fresh', 'flowers', 'garden',
        'beauty', 'education', 'learning', 'children', 'kids', 'hair', 'styling', 'creative',
        'colorful', 'beautiful', 'outdoor', 'spaces', 'landscaping', 'toys', 'daily', 'best',
    ]),
    ms: MALAY_HIGH_PRECISION,
    id: new Set([
        'toko', 'keluarga', 'usaha', 'layanan', 'pelayanan', 'kebutuhan', 'kualitas',
        'berkualitas', 'terpercaya', 'waralaba', 'pelaku',
    ]),
    it: new Set([
        'ottimi', 'dolci', 'birra', 'ristorante', 'italiano', 'italiana', 'cucina',
        'tradizionale', 'qualita', 'autenticita', 'pane', 'fresco', 'negozio', 'azienda',
        'prodotti', 'artigianale', 'servizi', 'migliore', 'benvenuti', 'specialita', 'gelateria',
        'gelato', 'sapori', 'tutti', 'ciao', 'mondo', 'scarpe', 'famiglia',
    ]),
    fr: new Set([
        'francais', 'francaise', 'delicieux', 'delicieuse', 'cuisine', 'traditionnelle',
        'terroir', 'boulangerie', 'croissant', 'quotidien', 'entreprise', 'meilleur', 'plats',
        'bonjour', 'artisanale', 'patisserie', 'bienvenue', 'produits', 'services', 'maison',
        'chaussures', 'vendons', 'vente', 'conseils', 'femmes', 'locales',
    ]),
    de: new Set([
        'frisches', 'frisch', 'brot', 'taglich', 'backerei', 'unternehmen', 'dienstleistungen',
        'geschaft', 'qualitat', 'produkte', 'beste', 'traditionell', 'traditionelle', 'tradition',
        'deutsch', 'deutsche', 'deutsches', 'kuche', 'geback', 'hochwertig', 'schuh',
        'schuhe', 'beratung', 'verkaufen', 'freundliche',
    ]),
    es: new Set([
        'delicioso', 'deliciosa', 'panaderia', 'comida', 'tradicional', 'negocio', 'empresa',
        'productos', 'servicios', 'mejor', 'fresco', 'tienda', 'buenos', 'dias', 'amigos',
        'tapas', 'sabores', 'locales', 'cada',
    ]),
    pt: new Set([
        'delicioso', 'padaria', 'comida', 'tradicional', 'negocio', 'empresa', 'produtos',
        'servicos', 'melhor', 'fresco', 'fresca', 'loja',
    ]),
    nl: new Set(['verse', 'bakkerij', 'winkel', 'bedrijf', 'producten', 'diensten', 'brood', 'ambachtelijk']),
    tr: new Set(['taze', 'ekmek', 'firini', 'magaza', 'isletme', 'urunler', 'hizmetler', 'geleneksel']),
    pl: new Set(['polska', 'piekarnia', 'swiezy', 'chleb', 'sklep', 'firma', 'produkty', 'uslugi']),
    sv: new Set(['svenskt', 'bageri', 'farskt', 'brod', 'butik', 'foretag', 'produkter', 'tjanster']),
    ru: new Set(['русская', 'русский', 'пекарня', 'магазин', 'москва', 'свежий', 'хлеб', 'услуги', 'кафе']),
    uk: new Set(['українська', 'український', 'київ', 'крамниця', 'послуги', 'хліб']),
    be: new Set(['беларуская', 'беларускі', 'пякарня', 'мінск', 'крама', 'паслугі']),
    bg: new Set(['български', 'българска', 'софия', 'хляб', 'услуги', 'ресторант']),
    sr: new Set(['српски', 'српска', 'београд', 'продавница', 'услуге', 'хлеб', 'ресторан']),
    ar: new Set(['شركة', 'مطعم', 'مخبز', 'خبز', 'متجر', 'خدمات', 'عربي', 'عربية']),
    fa: new Set(['ایرانی', 'رستوران', 'فروشگاه', 'خدمات', 'نان', 'فارسی']),
    ur: new Set(['اردو', 'بیکری', 'لاہور', 'دکان', 'خدمات']),
    ku: new Set(['کوردی', 'رێستوران', 'فرۆشگا', 'خزمەتگوزاری']),
    ug: new Set(['ئۇيغۇر', 'ئاشخانىسى', 'دۇكان', 'مۇلازىمەت']),
}

const LATIN_FUNCTION_WORDS: Record<string, ReadonlySet<string>> = {
    en: new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'our', 'your', 'we', 'you', 'in', 'of', 'to']),
    ms: new Set(['dan', 'atau', 'untuk', 'yang', 'dengan', 'kami', 'anda', 'kepada', 'dari', 'dalam', 'adalah']),
    it: new Set(['il', 'lo', 'la', 'gli', 'le', 'di', 'del', 'della', 'delle', 'dai', 'con', 'per', 'una', 'uno', 'sono', 'alle', 'agli', 'nel', 'nella', 'ogni']),
    fr: new Set(['le', 'la', 'les', 'de', 'des', 'du', 'avec', 'pour', 'une', 'un', 'nous', 'notre', 'votre', 'chaque', 'dans', 'aux', 'par']),
    de: new Set(['der', 'die', 'das', 'den', 'dem', 'mit', 'fur', 'und', 'ein', 'eine', 'unser', 'unsere', 'wir', 'von', 'zu', 'nach', 'bei', 'aus', 'jede', 'jeder']),
    es: new Set(['el', 'la', 'los', 'las', 'de', 'del', 'con', 'para', 'una', 'uno', 'nuestro']),
    pt: new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'com', 'para', 'uma', 'nosso']),
}

const VIETNAMESE_EXCLUSIVE_RE = /[ăđơưắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/giu
const VIETNAMESE_LEXICON = new Set([
    'tiem', 'banh', 'ngon', 'cua', 'dep', 'quan', 'pho', 'viet',
    'dich', 'vu', 'san', 'pham', 'khach', 'tot', 'nhat', 'tuoi', 'moi', 'nha',
    'thuoc', 'bun', 'hue', 'hoa', 'ca', 'phe', 'toi', 'ban', 'ngay',
])

const DEVANAGARI_LANGUAGE_MARKERS: ReadonlyArray<readonly [string, ReadonlySet<string>]> = [
    ['mr', new Set(['मराठी', 'महाराष्ट्र', 'महाराष्ट्रीय'])],
    ['ne', new Set(['नेपाली', 'नेपाल', 'काठमाडौँ', 'काठमाडौं'])],
    ['hi', new Set(['हिंदी', 'हिन्दी'])],
]

const CONTROLLED_INDUSTRY_TOKENS = new Set([
    'food', 'beverage', 'retail', 'professional', 'services', 'health', 'wellness',
    'education',
])

export function normalizeLanguageDetectionText(text: string): string {
    return text
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function buildLanguageDetectionText(input: LanguageDetectionInput): string {
    return normalizeLanguageDetectionText([
        input.businessName,
        input.industry,
        input.shortDescription,
        input.products,
    ].filter(Boolean).join(' '))
}

export function resolveGenerationLanguageDecision(
    selectedLocale: string | undefined,
    detectionText: string,
): GenerationLanguageDecision {
    if (selectedLocale && selectedLocale !== 'auto') {
        return { locale: selectedLocale, requiresConfirmation: false }
    }

    const locale = detectLanguageFromText(detectionText).locale
    return { locale, requiresConfirmation: locale !== 'en' && locale !== 'ms' }
}

export function normalizeSupportedLocale(locale: string | undefined): string | null {
    if (!locale) return null
    const normalized = locale.trim().toLowerCase().split('-')[0]
    return SUPPORTED_LOCALES.has(normalized) ? normalized : null
}

function countMatches(text: string, pattern: RegExp): number {
    return text.match(pattern)?.length ?? 0
}

function isDominantScript(scriptLetters: number, latinLetters: number): boolean {
    if (scriptLetters === 0) return false
    if (latinLetters === 0) return true
    return scriptLetters >= 2 && scriptLetters / (scriptLetters + latinLetters) >= 0.3
}

function detectScript(text: string): string | null {
    const latinLetters = countMatches(text, /\p{Script=Latin}/gu)
    const scriptLocale = (pattern: RegExp, locale: string): string | null =>
        isDominantScript(countMatches(text, pattern), latinLetters) ? locale : null

    const kanaCount = countMatches(text, /[\u3040-\u30FF]/gu)
    const cjkCount = countMatches(text, /[\u3400-\u4DBF\u4E00-\u9FFF]/gu)
    if (isDominantScript(kanaCount + cjkCount, latinLetters) && kanaCount > 0) return 'ja'
    if (isDominantScript(cjkCount, latinLetters)) return 'zh'

    const devanagariCount = countMatches(text, /[\u0900-\u097F]/gu)
    if (isDominantScript(devanagariCount, latinLetters)) {
        const words = new Set(text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? [])
        for (const [locale, markers] of DEVANAGARI_LANGUAGE_MARKERS) {
            if ([...words].some((word) => markers.has(word))) return locale
        }
    }

    const direct = [
        [/[\u0E00-\u0E7F]/gu, 'th'], [/[\uAC00-\uD7AF]/gu, 'ko'],
        [/[\u0980-\u09FF]/gu, 'bn'],
        [/[\u0A00-\u0A7F]/gu, 'pa'], [/[\u0A80-\u0AFF]/gu, 'gu'],
        [/[\u0C00-\u0C7F]/gu, 'te'], [/[\u0C80-\u0CFF]/gu, 'kn'],
        [/[\u0D00-\u0D7F]/gu, 'ml'], [/[\u0B80-\u0BFF]/gu, 'ta'],
        [/[\u1200-\u137F]/gu, 'am'], [/[\u1000-\u109F]/gu, 'my'],
        [/[\u1780-\u17FF]/gu, 'km'], [/[\u0530-\u058F]/gu, 'hy'],
        [/[\u10A0-\u10FF]/gu, 'ka'], [/[\u0590-\u05FF]/gu, 'he'],
    ] as const
    for (const [pattern, locale] of direct) {
        const detected = scriptLocale(pattern, locale)
        if (detected) return detected
    }

    const arabicCount = countMatches(text, /[\u0600-\u06FF]/gu)
    if (isDominantScript(arabicCount, latinLetters)) {
        if (/[ڭۇۆۈۋې]/u.test(text)) return 'ug'
        if (/[ڕڵێە]/u.test(text)) return 'ku'
        if (/[ٹڈڑںھہے]/u.test(text)) return 'ur'
        if (/[پچژگکی]/u.test(text)) return 'fa'
    }

    const cyrillicCount = countMatches(text, /\p{Script=Cyrillic}/gu)
    if (isDominantScript(cyrillicCount, latinLetters)) {
        if (/[ѓќѕ]/iu.test(text)) return 'mk'
        if (/[ђљњћџ]/iu.test(text)) return 'sr'
        if (/ў/iu.test(text)) return 'be'
        if (/[їєґ]/iu.test(text)) return 'uk'
    }
    return null
}

function tokenizeLatin(text: string): string[] {
    return (text.toLowerCase().match(/\p{L}+/gu) ?? []).map((token) =>
        token.normalize('NFD').replace(/\p{M}+/gu, ''),
    )
}

function detectLatinByLexicon(tokens: string[]): LanguageDetectionResult | null {
    const uniqueTokens = new Set(tokens.filter((token) => !CONTROLLED_INDUSTRY_TOKENS.has(token)))
    if (tokens.length === 1 && uniqueTokens.has('кафе')) {
        return { locale: 'ru', confidence: 0.75, source: 'lexical' }
    }
    const malayExclusiveMatches = [...uniqueTokens].filter((token) => MALAY_EXCLUSIVE_MARKERS.has(token)).length
    const indonesianExclusiveMatches = [...uniqueTokens].filter((token) => INDONESIAN_EXCLUSIVE_MARKERS.has(token)).length
    if (malayExclusiveMatches || indonesianExclusiveMatches) {
        const locale = indonesianExclusiveMatches > malayExclusiveMatches ? 'id' : 'ms'
        return { locale, confidence: 0.98, source: 'lexical' }
    }

    const indonesianMatches = [...uniqueTokens].filter((token) => LATIN_LEXICONS.id?.has(token)).length
    const hasMalayContext = [...uniqueTokens].some((token) => MALAY_CONTEXT_MARKERS.has(token))
    const hasIndonesianAnchor = uniqueTokens.has('toko')
        || (uniqueTokens.has('keluarga') && !hasMalayContext)
        || indonesianMatches >= 2
    if (hasIndonesianAnchor) {
        return { locale: 'id', confidence: 0.96, source: 'lexical' }
    }

    let best: { locale: string; score: number; contentMatches: number; functionMatches: number } | null = null

    for (const [locale, lexicon] of Object.entries(LATIN_LEXICONS)) {
        const contentMatches = [...uniqueTokens].filter((token) => lexicon.has(token)).length
        const functionMatches = [...uniqueTokens].filter((token) => LATIN_FUNCTION_WORDS[locale]?.has(token)).length
        const score = contentMatches * 2 + functionMatches
        if (!best || score > best.score) best = { locale, score, contentMatches, functionMatches }
    }

    if (!best) return null
    if (best.locale === 'ms' && (best.contentMatches >= 2 || best.functionMatches >= 2)) {
        return { locale: 'ms', confidence: 0.96, source: 'lexical' }
    }
    if (
        best.contentMatches >= 2
        || (best.contentMatches >= 1 && best.score >= 4)
        || (tokens.length >= 5 && best.functionMatches >= 2)
    ) {
        return { locale: best.locale, confidence: Math.min(0.98, 0.72 + best.score * 0.04), source: 'lexical' }
    }
    return null
}

export function detectLanguageFromText(text: string): LanguageDetectionResult {
    const normalized = normalizeLanguageDetectionText(text).slice(0, 4000)
    if (!normalized) return { locale: 'en', confidence: 0, source: 'empty' }

    const scriptLocale = detectScript(normalized)
    if (scriptLocale) return { locale: scriptLocale, confidence: 1, source: 'script' }

    const vietnameseMatches = normalized.match(VIETNAMESE_EXCLUSIVE_RE)?.length ?? 0
    if (vietnameseMatches >= 2) return { locale: 'vi', confidence: 0.99, source: 'vietnamese' }

    const tokens = tokenizeLatin(normalized)
    const vietnameseLexicalMatches = new Set(tokens.filter((token) => VIETNAMESE_LEXICON.has(token))).size
    if (vietnameseLexicalMatches >= 2 && vietnameseMatches >= 1) {
        return { locale: 'vi', confidence: 0.96, source: 'vietnamese' }
    }
    if (vietnameseLexicalMatches >= 4 || (vietnameseLexicalMatches >= 3 && /[^\u0000-\u007F]/.test(normalized))) {
        return { locale: 'vi', confidence: 0.9, source: 'lexical' }
    }

    const lexical = detectLatinByLexicon(tokens)
    if (lexical) return lexical

    // A lone mark without Vietnamese lexical evidence is usually a typo or a person's name.
    if (vietnameseMatches === 1) return { locale: 'en', confidence: 0.65, source: 'fallback' }

    const hasNonAscii = /[^\u0000-\u007F]/.test(normalized)
    if (!hasNonAscii && tokens.length < 2) return { locale: 'en', confidence: 0.7, source: 'fallback' }

    const candidates = francAll(normalized, { minLength: 10, only: FRANC_CANDIDATES })
    const scoresByLocale = new Map<string, number>()
    for (const [iso, score] of candidates) {
        const locale = FRANC_ISO_TO_LOCALE[iso]
        if (locale) scoresByLocale.set(locale, Math.max(score, scoresByLocale.get(locale) ?? 0))
    }
    const [winner, runnerUp] = [...scoresByLocale.entries()].sort((a, b) => b[1] - a[1])
    if (!winner) return { locale: 'en', confidence: 0.5, source: 'fallback' }

    const [locale, score] = winner
    const margin = score - (runnerUp?.[1] ?? 0)
    const isShortAscii = !hasNonAscii && (tokens.length < 8 || normalized.length < 60)
    const minimumMargin = isShortAscii ? 0.25 : 0.08
    if (margin < minimumMargin) return { locale: 'en', confidence: 0.5, source: 'fallback' }

    return { locale, confidence: score, source: 'statistical' }
}

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
    'kedai', 'warung', 'syarikat', 'perniagaan', 'jenama',
    'jualan', 'pelanggan', 'tempatan', 'berkualiti', 'perkhidmatan', 'menyediakan',
    'menggunakan', 'keperluan', 'kecantikan',
    'pergigian', 'pakaian', 'perabot', 'runcit', 'borong', 'khidmat', 'pemborong', 'hartanah',
])

const LATIN_LEXICONS: Record<string, ReadonlySet<string>> = {
    en: new Set([
        'yoga', 'studio', 'pizza', 'place', 'nail', 'salon', 'coffee', 'shop', 'auto', 'repair',
        'fitness', 'gym', 'dental', 'clinic', 'bakery', 'restaurant', 'store', 'business',
        'services', 'professional', 'wellness', 'classes', 'bread', 'fresh',
    ]),
    ms: MALAY_HIGH_PRECISION,
    id: new Set(['toko', 'keluarga', 'usaha', 'layanan', 'pelayanan', 'kebutuhan', 'kualitas']),
    it: new Set([
        'ottimi', 'dolci', 'birra', 'ristorante', 'italiano', 'italiana', 'cucina',
        'tradizionale', 'qualita', 'autenticita', 'pane', 'fresco', 'negozio', 'azienda',
        'prodotti', 'artigianale', 'servizi', 'migliore', 'benvenuti', 'specialita', 'gelateria',
    ]),
    fr: new Set([
        'francais', 'francaise', 'delicieux', 'delicieuse', 'cuisine', 'traditionnelle',
        'terroir', 'boulangerie', 'croissant', 'quotidien', 'entreprise', 'meilleur', 'plats',
        'bonjour', 'artisanale', 'patisserie', 'bienvenue', 'produits', 'services',
    ]),
    de: new Set([
        'frisches', 'frisch', 'brot', 'taglich', 'backerei', 'unternehmen', 'dienstleistungen',
        'geschaft', 'qualitat', 'produkte', 'beste', 'traditionell',
    ]),
    es: new Set([
        'delicioso', 'deliciosa', 'panaderia', 'comida', 'tradicional', 'negocio', 'empresa',
        'productos', 'servicios', 'mejor', 'fresco', 'tienda',
    ]),
    pt: new Set([
        'delicioso', 'padaria', 'comida', 'tradicional', 'negocio', 'empresa', 'produtos',
        'servicos', 'melhor', 'fresco', 'fresca', 'loja',
    ]),
    nl: new Set(['verse', 'bakkerij', 'winkel', 'bedrijf', 'producten', 'diensten', 'brood', 'ambachtelijk']),
    tr: new Set(['taze', 'ekmek', 'firini', 'magaza', 'isletme', 'urunler', 'hizmetler', 'geleneksel']),
    pl: new Set(['polska', 'piekarnia', 'swiezy', 'chleb', 'sklep', 'firma', 'produkty', 'uslugi']),
    sv: new Set(['svenskt', 'bageri', 'farskt', 'brod', 'butik', 'foretag', 'produkter', 'tjanster']),
    ru: new Set(['русская', 'русский', 'пекарня', 'магазин', 'москва', 'свежий', 'хлеб', 'услуги']),
}

const LATIN_FUNCTION_WORDS: Record<string, ReadonlySet<string>> = {
    ms: new Set(['dan', 'atau', 'untuk', 'yang', 'dengan', 'kami', 'anda', 'kepada', 'dari', 'dalam', 'adalah']),
    it: new Set(['il', 'lo', 'la', 'gli', 'le', 'di', 'del', 'della', 'con', 'per', 'una', 'uno', 'sono']),
    fr: new Set(['le', 'la', 'les', 'de', 'des', 'du', 'avec', 'pour', 'une', 'un', 'nous', 'notre']),
    de: new Set(['der', 'die', 'das', 'den', 'dem', 'mit', 'fur', 'und', 'ein', 'eine', 'unser']),
    es: new Set(['el', 'la', 'los', 'las', 'de', 'del', 'con', 'para', 'una', 'uno', 'nuestro']),
    pt: new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'com', 'para', 'uma', 'nosso']),
}

const VIETNAMESE_EXCLUSIVE_RE = /[ăđơưắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/giu
const VIETNAMESE_LEXICON = new Set([
    'tiem', 'banh', 'ngon', 'cua', 'hang', 'dep', 'quan', 'pho', 'com', 'viet', 'nam',
    'dich', 'vu', 'san', 'pham', 'khach', 'hang', 'tot', 'nhat', 'tuoi', 'moi', 'nha',
    'thuoc', 'bun', 'bo', 'hue', 'hoa',
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

function detectScript(text: string): string | null {
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th'
    if (/[\u3040-\u30FF]/.test(text)) return 'ja'
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'
    if (/[\u3400-\u4DBF\u4E00-\u9FFF]/.test(text)) return 'zh'
    if (/[іїєґ]/iu.test(text)) return 'uk'
    if (/[ٹڈڑںھہے]/u.test(text)) return 'ur'
    if (/[\u0900-\u097F]/.test(text)) return 'hi'
    if (/[\u0980-\u09FF]/.test(text)) return 'bn'
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'
    if (/[\u1200-\u137F]/.test(text)) return 'am'
    if (/[\u1000-\u109F]/.test(text)) return 'my'
    if (/[\u1780-\u17FF]/.test(text)) return 'km'
    if (/[\u0530-\u058F]/.test(text)) return 'hy'
    if (/[\u10A0-\u10FF]/.test(text)) return 'ka'
    return null
}

function tokenizeLatin(text: string): string[] {
    return (text.toLowerCase().match(/\p{L}+/gu) ?? []).map((token) =>
        token.normalize('NFD').replace(/\p{M}+/gu, ''),
    )
}

function detectLatinByLexicon(tokens: string[]): LanguageDetectionResult | null {
    const uniqueTokens = new Set(tokens)
    let best: { locale: string; score: number; contentMatches: number; functionMatches: number } | null = null

    for (const [locale, lexicon] of Object.entries(LATIN_LEXICONS)) {
        const contentMatches = [...uniqueTokens].filter((token) => lexicon.has(token)).length
        const functionMatches = [...uniqueTokens].filter((token) => LATIN_FUNCTION_WORDS[locale]?.has(token)).length
        const score = contentMatches * 2 + functionMatches
        if (!best || score > best.score) best = { locale, score, contentMatches, functionMatches }
    }

    if (!best) return null
    if (best.locale === 'ms' && (best.contentMatches >= 1 || best.functionMatches >= 2)) {
        return { locale: 'ms', confidence: 0.96, source: 'lexical' }
    }
    if (best.locale === 'id' && best.contentMatches >= 1) {
        return { locale: 'id', confidence: 0.96, source: 'lexical' }
    }
    if (best.contentMatches >= 2 || (best.contentMatches >= 1 && best.score >= 4)) {
        return { locale: best.locale, confidence: Math.min(0.98, 0.72 + best.score * 0.04), source: 'lexical' }
    }
    return null
}

export function detectLanguageFromText(text: string): LanguageDetectionResult {
    const normalized = normalizeLanguageDetectionText(text).slice(0, 4000)
    if (normalized.length < 5) return { locale: 'en', confidence: 0, source: 'empty' }

    const scriptLocale = detectScript(normalized)
    if (scriptLocale) return { locale: scriptLocale, confidence: 1, source: 'script' }

    const vietnameseMatches = normalized.match(VIETNAMESE_EXCLUSIVE_RE)?.length ?? 0
    if (vietnameseMatches >= 2) return { locale: 'vi', confidence: 0.99, source: 'vietnamese' }

    const tokens = tokenizeLatin(normalized)
    const vietnameseLexicalMatches = new Set(tokens.filter((token) => VIETNAMESE_LEXICON.has(token))).size
    if (vietnameseLexicalMatches >= 1 && vietnameseMatches >= 1) {
        return { locale: 'vi', confidence: 0.96, source: 'vietnamese' }
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
    if (margin < 0.12) return { locale: 'en', confidence: 0.5, source: 'fallback' }

    return { locale, confidence: score, source: 'statistical' }
}

/**
 * Language detection for AI website generator.
 *
 * Two-tier approach:
 *  1. Fast heuristics for vi/ms (zero-cost, high precision for short business names)
 *  2. franc-min fallback for 70+ other languages (maps iso639-3 → GPT-friendly name)
 *
 * Returns:
 *  - contentLang: 'en'|'vi'|'ms' — for internal pipeline (CTAs, content-rules, templates)
 *  - gpLang: human-readable name — used verbatim in the GPT language instruction
 *
 * Any language not in the vi/ms fast path gets contentLang='en' (so existing
 * content-rules/CTA logic stays correct) but a proper gpLang so GPT actually
 * outputs content in the user's language.
 */

import { franc } from 'franc-min'
import type { ContentLang } from './content-rules'

export interface DetectedLanguage {
    /** For content pipeline (CTAs, testimonials headline, content-rules). en|vi|ms only. */
    contentLang: ContentLang
    /** For GPT instruction — any language name, e.g. "Chinese (Mandarin)", "Arabic". */
    gpLang: string
    /** ISO 639-1 code for block-i18n string selection — covers any language franc can detect. */
    blockLang: string
}

// Vietnamese-exclusive diacritical marks — not shared with French/Spanish/Portuguese.
const VI_DIACRITICS_RE = /[ăđơưắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/

// Unambiguous Malay business nouns — 1 match is enough.
const MALAY_HIGH_PRECISION = new Set([
    'kedai', 'warung', 'restoran', 'klinik', 'syarikat', 'perniagaan', 'butik',
    'jenama', 'jualan', 'pelanggan', 'tempatan', 'berkualiti', 'terbaik',
    'segar', 'makanan', 'murah', 'harga', 'perkhidmatan', 'menyediakan',
    'menggunakan', 'ialah', 'keperluan', 'kecantikan', 'pergigian', 'pakaian',
    'perabot', 'runcit', 'borong', 'khidmat', 'pemborong', 'hartanah',
])

// Malay grammar/function words — need 2+ distinct matches to avoid name false-positives.
const MALAY_FUNCTION_WORDS = new Set([
    'dan', 'atau', 'untuk', 'yang', 'dengan', 'tidak', 'kami', 'anda',
    'kepada', 'dari', 'juga', 'dalam', 'akan', 'boleh', 'sudah', 'adalah',
    'produk',
])

// franc ISO 639-3 codes → ISO 639-1 for block-i18n string selection.
// Covers languages franc-min can detect. Unmapped → falls back to 'en'.
const ISO_TO_BLOCK_LANG: Record<string, string> = {
    vie: 'vi',
    msa: 'ms', zsm: 'ms', ind: 'id',
    eng: 'en',
    cmn: 'zh', zho: 'zh', yue: 'zh',
    ara: 'ar',
    tha: 'th',
    kor: 'ko',
    jpn: 'ja',
    hin: 'hi',
    ben: 'bn',
    urd: 'ur',
    tam: 'ta',
    tel: 'te',
    kan: 'kn',
    mal: 'ml',
    pan: 'pa',
    guj: 'gu',
    mar: 'mr',
    sin: 'si',
    mya: 'my',
    khm: 'km',
    lao: 'lo',
    tgl: 'tl',
    jav: 'jv',
    por: 'pt',
    spa: 'es',
    fra: 'fr',
    deu: 'de',
    rus: 'ru',
    ukr: 'uk',
    pol: 'pl',
    ita: 'it',
    nld: 'nl',
    swe: 'sv',
    nor: 'no',
    dan: 'da',
    fin: 'fi',
    ron: 'ro',
    hun: 'hu',
    ces: 'cs',
    slk: 'sk',
    hrv: 'hr',
    bul: 'bg',
    ell: 'el',
    heb: 'he',
    fas: 'fa',
    tur: 'tr',
    uzb: 'uz',
    kaz: 'kk',
    aze: 'az',
    srp: 'sr',
    cat: 'ca',
    lit: 'lt',
    lav: 'lv',
    est: 'et',
    slv: 'sl',
    swa: 'sw',
    afr: 'af',
}

// franc ISO 639-3 codes → content pipeline language
const ISO_TO_CONTENT_LANG: Record<string, ContentLang> = {
    vie: 'vi',
    msa: 'ms',
    zsm: 'ms',
    ind: 'ms', // Indonesian is mutually intelligible with Malay — best fit
    eng: 'en',
}

// franc ISO 639-3 codes → human-readable name for GPT instruction.
// Covers the 70 languages in franc-min not mapped above.
const ISO_TO_LANG_NAME: Record<string, string> = {
    cmn: 'Chinese (Mandarin)',
    zho: 'Chinese',
    yue: 'Chinese (Cantonese)',
    ara: 'Arabic',
    tha: 'Thai',
    kor: 'Korean',
    jpn: 'Japanese',
    hin: 'Hindi',
    ben: 'Bengali',
    urd: 'Urdu',
    tam: 'Tamil',
    tel: 'Telugu',
    kan: 'Kannada',
    mal: 'Malayalam',
    pan: 'Punjabi',
    guj: 'Gujarati',
    mar: 'Marathi',
    sin: 'Sinhala',
    mya: 'Burmese',
    khm: 'Khmer',
    lao: 'Lao',
    tgl: 'Filipino (Tagalog)',
    jav: 'Javanese',
    sun: 'Sundanese',
    por: 'Portuguese',
    spa: 'Spanish',
    fra: 'French',
    deu: 'German',
    rus: 'Russian',
    ukr: 'Ukrainian',
    pol: 'Polish',
    ita: 'Italian',
    nld: 'Dutch',
    swe: 'Swedish',
    nor: 'Norwegian',
    dan: 'Danish',
    fin: 'Finnish',
    ron: 'Romanian',
    hun: 'Hungarian',
    ces: 'Czech',
    slk: 'Slovak',
    hrv: 'Croatian',
    bul: 'Bulgarian',
    ell: 'Greek',
    heb: 'Hebrew',
    fas: 'Persian (Farsi)',
    tur: 'Turkish',
    uzb: 'Uzbek',
    kaz: 'Kazakh',
    aze: 'Azerbaijani',
    srp: 'Serbian',
    cat: 'Catalan',
    lit: 'Lithuanian',
    lav: 'Latvian',
    est: 'Estonian',
    slv: 'Slovenian',
    swa: 'Swahili',
    amh: 'Amharic',
    hau: 'Hausa',
    yor: 'Yoruba',
    ibo: 'Igbo',
    afr: 'Afrikaans',
    nep: 'Nepali',
    som: 'Somali',
    hat: 'Haitian Creole',
    tgk: 'Tajik',
    kir: 'Kyrgyz',
    mon: 'Mongolian',
}

/**
 * Detect language from raw input text.
 *
 * Fast path checks vi/ms with cheap heuristics.
 * Falls back to franc for all other languages.
 */
export function detectLanguage(text: string): DetectedLanguage {
    // Vietnamese: exclusive diacritical marks (zero false-positives)
    if (VI_DIACRITICS_RE.test(text)) {
        return { contentLang: 'vi', gpLang: 'Vietnamese', blockLang: 'vi' }
    }

    const lower = text.toLowerCase()
    const tokens = new Set(lower.split(/\W+/).filter(Boolean))

    // Malay: high-precision business nouns (1 match sufficient)
    if ([...tokens].some(t => MALAY_HIGH_PRECISION.has(t))) {
        return { contentLang: 'ms', gpLang: 'Malay (Bahasa Melayu)', blockLang: 'ms' }
    }

    // Malay: function words (need 2+ distinct matches)
    const fnMatches = [...tokens].filter(t => MALAY_FUNCTION_WORDS.has(t)).length
    if (fnMatches >= 2) {
        return { contentLang: 'ms', gpLang: 'Malay (Bahasa Melayu)', blockLang: 'ms' }
    }

    // franc-min for all other languages
    const iso = franc(text, { minLength: 3 })
    if (iso === 'und') {
        return { contentLang: 'en', gpLang: 'English', blockLang: 'en' }
    }

    const contentLang = ISO_TO_CONTENT_LANG[iso]
    const blockLang = ISO_TO_BLOCK_LANG[iso] ?? 'en'
    if (contentLang) {
        const gpLang = contentLang === 'vi'
            ? 'Vietnamese'
            : contentLang === 'ms'
                ? 'Malay (Bahasa Melayu)'
                : 'English'
        return { contentLang, gpLang, blockLang }
    }

    const gpLang = ISO_TO_LANG_NAME[iso] ?? 'English'
    return { contentLang: 'en', gpLang, blockLang }
}

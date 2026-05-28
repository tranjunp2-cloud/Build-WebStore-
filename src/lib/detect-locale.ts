import { franc } from 'franc-min'

// Maps franc ISO 639-3 → our locale codes (ISO 639-1)
const FRANC_ISO_TO_LOCALE: Record<string, string> = {
    // English / Malay
    eng: 'en',
    msa: 'ms', zlm: 'ms',
    // franc-min misdetects BM as Indonesian — treat both as 'ms'
    ind: 'ms',

    // Asian
    tha: 'th',
    cmn: 'zh', zho: 'zh',
    jpn: 'ja',
    kor: 'ko',
    vie: 'vi',
    khm: 'km',
    mya: 'my',
    tgl: 'tl',

    // South Asian
    hin: 'hi',
    ben: 'bn',
    urd: 'ur',
    pan: 'pa',
    guj: 'gu',
    mar: 'mr',
    mal: 'ml',
    kan: 'kn',
    tam: 'ta',
    tel: 'te',
    nep: 'ne',
    sin: 'si',
    pus: 'ps',

    // Middle East / Central Asia
    arb: 'ar', ara: 'ar',
    heb: 'he',
    kur: 'ku',
    uig: 'ug',
    azj: 'az',
    kaz: 'kk',

    // European — Latin script
    fra: 'fr',
    deu: 'de',
    spa: 'es',
    ita: 'it',
    por: 'pt',
    nld: 'nl',
    tur: 'tr',
    pol: 'pl',
    swe: 'sv',
    nor: 'no',
    dan: 'da',
    fin: 'fi',
    ces: 'cs',
    slk: 'sk',
    ron: 'ro',
    hun: 'hu',
    hrv: 'hr',
    bos: 'bs',
    srp: 'sr',
    slv: 'sl',
    sqi: 'sq',
    mkd: 'mk',
    mlt: 'mt',
    est: 'et',
    lav: 'lv',
    lit: 'lt',
    ell: 'el',
    afr: 'af',
    cat: 'ca',
    glg: 'gl',
    eus: 'eu',
    lat: 'la',
    epo: 'eo',

    // Cyrillic
    rus: 'ru',
    ukr: 'uk',
    bel: 'be',
    bul: 'bg',
    hye: 'hy',
    kat: 'ka',

    // African
    swa: 'sw',
    amh: 'am',
    yor: 'yo',
    som: 'so',
    sna: 'sn',
    xho: 'xh',
    zul: 'zu',
}

// Unicode range check — reliable for non-Latin scripts, runs before franc
// Using \u escapes to avoid editor encoding issues with multi-byte chars
function detectByScript(text: string): string | null {
    if (/[฀-๿]/.test(text)) return 'th'   // Thai
    if (/[一-鿿㐀-䶿]/.test(text)) return 'zh'  // CJK
    if (/[぀-ヿ]/.test(text)) return 'ja'   // Hiragana/Katakana
    if (/[가-힯]/.test(text)) return 'ko'   // Hangul
    if (/[؀-ۿ]/.test(text)) return 'ar'   // Arabic
    if (/[Ѐ-ӿ]/.test(text)) return 'ru'   // Cyrillic
    if (/[ऀ-ॿ]/.test(text)) return 'hi'   // Devanagari
    if (/[ঀ-৿]/.test(text)) return 'bn'   // Bengali
    if (/[਀-੿]/.test(text)) return 'pa'   // Gurmukhi
    if (/[઀-૿]/.test(text)) return 'gu'   // Gujarati
    if (/[ఀ-౿]/.test(text)) return 'te'   // Telugu
    if (/[ಀ-೿]/.test(text)) return 'kn'   // Kannada
    if (/[ഀ-ൿ]/.test(text)) return 'ml'   // Malayalam
    if (/[஀-௿]/.test(text)) return 'ta'   // Tamil
    if (/[ሀ-፿]/.test(text)) return 'am'   // Ethiopic
    if (/[က-႟]/.test(text)) return 'my'   // Myanmar
    if (/[ក-៿]/.test(text)) return 'km'   // Khmer
    if (/[԰-֏]/.test(text)) return 'hy'   // Armenian
    if (/[Ⴀ-ჿ]/.test(text)) return 'ka'   // Georgian
    return null
}

/**
 * Detects locale from free-form text. Best-effort — used only for modal display label.
 * Falls back to 'en' on short/ambiguous input (franc needs ~20+ chars for Latin langs).
 */
export function detectLocaleFromText(text: string): string {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length < 5) return 'en'

    const byScript = detectByScript(trimmed)
    if (byScript) return byScript

    const iso = franc(trimmed, { minLength: 10 })
    return FRANC_ISO_TO_LOCALE[iso] ?? 'en'
}

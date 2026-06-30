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
    // Kana (Japanese) and Hangul (Korean) are script-exclusive — they share the CJK
    // ideograph block with Chinese via Kanji/Hanja, so check them BEFORE the CJK range
    // or Japanese/Korean text gets misdetected as Chinese.
    if (/[぀-ヿ]/.test(text)) return 'ja'   // Hiragana/Katakana → Japanese
    if (/[가-힯]/.test(text)) return 'ko'   // Hangul → Korean
    if (/[一-鿿㐀-䶿]/.test(text)) return 'zh'  // CJK ideographs (kanji w/o kana → Chinese)
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
    // Vietnamese uses Latin Extended Additional diacritics (U+1EA0-U+1EF9: ạắặấềổợ...).
    // Must detect here — before franc — to prevent English business names from diluting
    // mixed-input like "Brother Hai's Restaurant Phở ngon nhất Việt Nam" (GH-1184).
    if (/[Ạ-ỹ]/.test(text)) return 'vi'
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
    const locale = FRANC_ISO_TO_LOCALE[iso] ?? 'en'

    // franc-min is unreliable on short Latin-script text (business names are noun-heavy
    // and 2–5 words), routinely guessing random Latin languages (fr/es/it/nl/vi/...) for
    // plain English input → false "did you mean <X>?" modal (GH-1442). Genuine non-English
    // Latin languages carry their own diacritics (fr: é à ç, es: ñ, de: ü ß, pt: ã) — and
    // Vietnamese diacritics are already caught above by detectByScript. So when the text is
    // pure ASCII, trust franc only for the primary locales (en/ms, both ASCII); any other
    // guess is noise → default to English. Malay still resolves to 'ms' (skips the modal).
    const hasNonAscii = /[^\u0000-\u007F]/.test(trimmed)
    if (!hasNonAscii && locale !== 'en' && locale !== 'ms') return 'en'

    return locale
}

/**
 * F-26: Resolve which locale the editor should open in when a site is (re)loaded.
 *
 * On save we persist the user's last-viewed locale into `site.locale` (en/ms only).
 * On load we must restore that view so an MS-switched page does not snap back to the
 * base language. For non-standard base languages (vi/el, etc.) `site.locale` is only the
 * translation target slot — not a view preference — so we keep the native generation view.
 *
 * @param generationLocale ISO 639-1 the site's base blocks were authored in (en/ms/vi/...)
 * @param persistedLocale  `site.locale` from the API (the saved last-viewed locale, en/ms)
 */
export function resolveInitialActiveLocale(
    generationLocale: string,
    persistedLocale: string | undefined,
): string {
    const genIsStandard = generationLocale === 'en' || generationLocale === 'ms'
    if (genIsStandard && (persistedLocale === 'en' || persistedLocale === 'ms')) {
        return persistedLocale
    }
    return generationLocale
}

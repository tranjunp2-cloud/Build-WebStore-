/**
 * Display metadata for all locale codes that detectLocaleFromText() can return.
 * Covers all franc-min detectable languages + Unicode-range detections.
 * Flag = representative country for that language.
 */
export type LocaleLabel = { short: string; full: string; flag: string }

export const LOCALE_LABELS: Record<string, LocaleLabel> = {
    // Primary (skip modal)
    en: { short: 'EN', full: 'English', flag: '🇬🇧' },
    ms: { short: 'MY', full: 'Malay', flag: '🇲🇾' },
    id: { short: 'ID', full: 'Indonesian', flag: '🇮🇩' },

    // Asian
    th: { short: 'TH', full: 'Thai', flag: '🇹🇭' },
    zh: { short: 'ZH', full: 'Chinese', flag: '🇨🇳' },
    ja: { short: 'JA', full: 'Japanese', flag: '🇯🇵' },
    ko: { short: 'KO', full: 'Korean', flag: '🇰🇷' },
    vi: { short: 'VI', full: 'Vietnamese', flag: '🇻🇳' },
    km: { short: 'KM', full: 'Khmer', flag: '🇰🇭' },
    my: { short: 'MM', full: 'Burmese', flag: '🇲🇲' },
    tl: { short: 'TL', full: 'Tagalog', flag: '🇵🇭' },

    // South Asian
    hi: { short: 'HI', full: 'Hindi', flag: '🇮🇳' },
    bn: { short: 'BN', full: 'Bengali', flag: '🇧🇩' },
    ur: { short: 'UR', full: 'Urdu', flag: '🇵🇰' },
    pa: { short: 'PA', full: 'Punjabi', flag: '🇮🇳' },
    gu: { short: 'GU', full: 'Gujarati', flag: '🇮🇳' },
    mr: { short: 'MR', full: 'Marathi', flag: '🇮🇳' },
    ml: { short: 'ML', full: 'Malayalam', flag: '🇮🇳' },
    kn: { short: 'KN', full: 'Kannada', flag: '🇮🇳' },
    ta: { short: 'TA', full: 'Tamil', flag: '🇱🇰' },
    te: { short: 'TE', full: 'Telugu', flag: '🇮🇳' },
    ne: { short: 'NE', full: 'Nepali', flag: '🇳🇵' },
    si: { short: 'SI', full: 'Sinhala', flag: '🇱🇰' },
    ps: { short: 'PS', full: 'Pashto', flag: '🇦🇫' },

    // Middle East / Central Asia
    ar: { short: 'AR', full: 'Arabic', flag: '🇸🇦' },
    he: { short: 'HE', full: 'Hebrew', flag: '🇮🇱' },
    ku: { short: 'KU', full: 'Kurdish', flag: '🇮🇶' },
    ug: { short: 'UG', full: 'Uyghur', flag: '🌐' },
    az: { short: 'AZ', full: 'Azerbaijani', flag: '🇦🇿' },
    kk: { short: 'KK', full: 'Kazakh', flag: '🇰🇿' },

    // European — Latin script
    fr: { short: 'FR', full: 'French', flag: '🇫🇷' },
    de: { short: 'DE', full: 'German', flag: '🇩🇪' },
    es: { short: 'ES', full: 'Spanish', flag: '🇪🇸' },
    it: { short: 'IT', full: 'Italian', flag: '🇮🇹' },
    pt: { short: 'PT', full: 'Portuguese', flag: '🇵🇹' },
    nl: { short: 'NL', full: 'Dutch', flag: '🇳🇱' },
    tr: { short: 'TR', full: 'Turkish', flag: '🇹🇷' },
    pl: { short: 'PL', full: 'Polish', flag: '🇵🇱' },
    sv: { short: 'SV', full: 'Swedish', flag: '🇸🇪' },
    no: { short: 'NO', full: 'Norwegian', flag: '🇳🇴' },
    da: { short: 'DA', full: 'Danish', flag: '🇩🇰' },
    fi: { short: 'FI', full: 'Finnish', flag: '🇫🇮' },
    cs: { short: 'CS', full: 'Czech', flag: '🇨🇿' },
    sk: { short: 'SK', full: 'Slovak', flag: '🇸🇰' },
    ro: { short: 'RO', full: 'Romanian', flag: '🇷🇴' },
    hu: { short: 'HU', full: 'Hungarian', flag: '🇭🇺' },
    hr: { short: 'HR', full: 'Croatian', flag: '🇭🇷' },
    bs: { short: 'BS', full: 'Bosnian', flag: '🇧🇦' },
    sr: { short: 'SR', full: 'Serbian', flag: '🇷🇸' },
    sl: { short: 'SL', full: 'Slovenian', flag: '🇸🇮' },
    sq: { short: 'SQ', full: 'Albanian', flag: '🇦🇱' },
    mk: { short: 'MK', full: 'Macedonian', flag: '🇲🇰' },
    mt: { short: 'MT', full: 'Maltese', flag: '🇲🇹' },
    et: { short: 'ET', full: 'Estonian', flag: '🇪🇪' },
    lv: { short: 'LV', full: 'Latvian', flag: '🇱🇻' },
    lt: { short: 'LT', full: 'Lithuanian', flag: '🇱🇹' },
    el: { short: 'EL', full: 'Greek', flag: '🇬🇷' },
    af: { short: 'AF', full: 'Afrikaans', flag: '🇿🇦' },
    ca: { short: 'CA', full: 'Catalan', flag: '🇪🇸' },
    gl: { short: 'GL', full: 'Galician', flag: '🇪🇸' },
    eu: { short: 'EU', full: 'Basque', flag: '🇪🇸' },
    la: { short: 'LA', full: 'Latin', flag: '🇻🇦' },
    eo: { short: 'EO', full: 'Esperanto', flag: '🌐' },

    // Cyrillic script
    ru: { short: 'RU', full: 'Russian', flag: '🇷🇺' },
    uk: { short: 'UK', full: 'Ukrainian', flag: '🇺🇦' },
    be: { short: 'BE', full: 'Belarusian', flag: '🇧🇾' },
    bg: { short: 'BG', full: 'Bulgarian', flag: '🇧🇬' },
    hy: { short: 'HY', full: 'Armenian', flag: '🇦🇲' },
    ka: { short: 'KA', full: 'Georgian', flag: '🇬🇪' },

    // African
    sw: { short: 'SW', full: 'Swahili', flag: '🇹🇿' },
    am: { short: 'AM', full: 'Amharic', flag: '🇪🇹' },
    yo: { short: 'YO', full: 'Yoruba', flag: '🇳🇬' },
    so: { short: 'SO', full: 'Somali', flag: '🇸🇴' },
    sn: { short: 'SN', full: 'Shona', flag: '🇿🇼' },
    xh: { short: 'XH', full: 'Xhosa', flag: '🇿🇦' },
    zu: { short: 'ZU', full: 'Zulu', flag: '🇿🇦' },
}

/** Fallback for any locale code not in map */
export function getLocaleLabel(locale: string): LocaleLabel {
    return LOCALE_LABELS[locale] ?? {
        short: locale.toUpperCase().slice(0, 3),
        full: locale,
        flag: '🌐',
    }
}

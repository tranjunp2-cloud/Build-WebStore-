import { detectLanguageFromText, normalizeSupportedLocale } from '@/lib/language-detection'
import { getLocaleLabel } from '@/lib/locale-labels'
import type { ContentLang } from './content-rules'

export interface DetectedLanguage {
    contentLang: ContentLang
    gpLang: string
    blockLang: string
}

const GPT_LANGUAGE_NAMES: Record<string, string> = {
    ms: 'Malay (Bahasa Melayu)',
    zh: 'Chinese (Mandarin)',
    tl: 'Filipino (Tagalog)',
}

/** Resolve an already selected/detected locale without running detection again. */
export function resolveDetectedLanguage(locale: string): DetectedLanguage {
    const blockLang = normalizeSupportedLocale(locale) ?? 'en'
    const contentLang: ContentLang = blockLang === 'vi' || blockLang === 'ms' ? blockLang : 'en'
    const gpLang = GPT_LANGUAGE_NAMES[blockLang] ?? getLocaleLabel(blockLang).full
    return { contentLang, gpLang, blockLang }
}

export function detectLanguage(text: string): DetectedLanguage {
    return resolveDetectedLanguage(detectLanguageFromText(text).locale)
}

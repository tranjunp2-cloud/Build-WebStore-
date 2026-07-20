import { detectLanguageFromText } from './language-detection'

/** Best-effort locale detection for the pre-generation confirmation flow. */
export function detectLocaleFromText(text: string): string {
    return detectLanguageFromText(text).locale
}

/**
 * Resolve which locale the editor should open in when a site is (re)loaded.
 * Standard EN/MS sites restore the saved view; other sites open in their generation locale.
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

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
    /** the site's languages (Quick language): a saved view outside them opens in the first one */
    languages?: readonly string[],
): string {
    const genIsStandard = generationLocale === 'en' || generationLocale === 'ms'
    const resolved = genIsStandard && (persistedLocale === 'en' || persistedLocale === 'ms') ? persistedLocale : generationLocale
    return languages?.length && !languages.includes(resolved) ? languages[0]! : resolved
}

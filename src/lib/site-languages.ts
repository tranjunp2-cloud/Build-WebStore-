/**
 * The website's languages, as Menu → Quick language sets them: the primary one,
 * plus the secondary one once it was added. `Sites.locale` is not one of them —
 * it only remembers the language last viewed in the editor.
 */

type Header = { primaryLocale?: unknown; secondaryLocale?: unknown } | null | undefined

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function siteLanguages(input: { primaryLocale?: unknown; secondaryLocale?: unknown; generationLocale?: unknown; siteLocale?: unknown }): string[] {
    const primary = text(input.primaryLocale) || text(input.generationLocale) || text(input.siteLocale) || 'en'
    const secondary = text(input.secondaryLocale)
    return secondary && secondary !== primary ? [primary, secondary] : [primary]
}

/**
 * From a site record. "edited" (the editor, the copilot): the header being edited wins over
 * the live one. "live" (what visitors get): the published header only.
 */
export function siteLanguagesOf(
    site: { headerBlock?: unknown; pendingHeaderBlock?: unknown; generationLocale?: unknown; locale?: unknown },
    which: 'edited' | 'live' = 'edited',
): string[] {
    const pending = which === 'edited' ? (site.pendingHeaderBlock as Header) : null
    const header = (pending && typeof pending === 'object' ? pending : site.headerBlock) as Header
    return siteLanguages({
        primaryLocale: header?.primaryLocale,
        secondaryLocale: header?.secondaryLocale,
        generationLocale: site.generationLocale,
        siteLocale: site.locale,
    })
}

/** The cookie a visitor's language choice (the live site's language switcher) is kept in. */
export const VISITOR_LANGUAGE_COOKIE = 'pw_lang'

/**
 * The language a visitor gets: the one they chose (cookie) when it is one of the site's languages, else the
 * primary one. Never a language the site does not have.
 */
export function visitorLanguage(languages: readonly string[], chosen: string | null | undefined): string {
    const wanted = typeof chosen === 'string' ? chosen.trim() : ''
    return wanted && languages.includes(wanted) ? wanted : languages[0] ?? 'en'
}

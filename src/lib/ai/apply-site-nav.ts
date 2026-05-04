export type AIPageMeta = { title?: string; slug?: string; isHomepage?: boolean }

/**
 * Build nav link list from AI-generated page metadata.
 * Returns null when pages is empty/undefined (signals caller to use fallback).
 */
export function extractPageLinks(
    pages: AIPageMeta[] | undefined | null,
): Array<{ label: string; url: string }> | null {
    if (!Array.isArray(pages) || pages.length === 0) return null
    return pages.map((p, i) => {
        const isHome = p.isHomepage === true || i === 0
        const rawSlug = String(p.slug ?? (isHome ? '/' : `page-${i}`))
        const url = isHome ? '/' : `/${rawSlug.replace(/^\/+/, '')}`
        const label = String(p.title ?? (isHome ? 'Home' : `Page ${i + 1}`)).trim() || `Page ${i + 1}`
        return { label, url }
    })
}

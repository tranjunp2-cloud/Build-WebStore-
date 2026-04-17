/**
 * Lowercase the pathname of an internal URL so nav/footer links like
 * `/Services` (AI gen sometimes uses the display label as the URL) resolve
 * to the stored slug `/services`. Query string + hash are preserved as-is.
 *
 * External (`http://`, `https://`, `mailto:`, `tel:`, `#anchor`) and empty
 * URLs pass through unchanged.
 *
 * Why render-time and not a migration: existing published sites already
 * have bad URLs in the DB, so lowercasing at the href layer fixes every
 * site immediately without a data rewrite.
 */
export function normalizeInternalUrl(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return url ?? ''
    if (!url.startsWith('/')) return url
    const queryIdx = url.indexOf('?')
    const hashIdx = url.indexOf('#')
    const tailIdx = queryIdx >= 0 && hashIdx >= 0
        ? Math.min(queryIdx, hashIdx)
        : queryIdx >= 0
            ? queryIdx
            : hashIdx >= 0
                ? hashIdx
                : url.length
    return url.slice(0, tailIdx).toLowerCase() + url.slice(tailIdx)
}

type NavLinkLike = { label?: string; url?: string; children?: NavLinkLike[] }

/** Recursively normalize `url` on every link + child so sub-menus work too. */
export function normalizeNavLinks<T extends NavLinkLike>(links: T[] | undefined | null): T[] {
    if (!Array.isArray(links)) return []
    return links.map(link => ({
        ...link,
        url: normalizeInternalUrl(link?.url),
        ...(Array.isArray(link?.children)
            ? { children: normalizeNavLinks(link.children) }
            : {}),
    })) as T[]
}

type FooterLinkColumnLike = { title?: string; links?: NavLinkLike[] }

/** Footer columns: normalize url on every link inside every column. */
export function normalizeFooterColumns<T extends FooterLinkColumnLike>(columns: T[] | undefined | null): T[] {
    if (!Array.isArray(columns)) return []
    return columns.map(col => ({
        ...col,
        links: normalizeNavLinks(col?.links),
    })) as T[]
}

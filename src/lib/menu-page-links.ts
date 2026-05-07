type RawNavLink = Record<string, unknown>

type PageLite = { id: string; slug: string; isHomepage?: boolean }

/** Strip leading slash + lowercase for stable comparison */
function normalizeSlug(s: string): string {
    const trimmed = s.trim().toLowerCase()
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
}

/** Walk raw nav tree and collect page-type link slugs (normalized) */
function collectLinkedSlugs(links: RawNavLink[]): Set<string> {
    const out = new Set<string>()
    const walk = (items: RawNavLink[]) => {
        for (const link of items) {
            if (link.type === 'page' && typeof link.url === 'string' && link.url) {
                out.add(normalizeSlug(link.url))
            }
            if (Array.isArray(link.children)) walk(link.children as RawNavLink[])
        }
    }
    walk(links)
    return out
}

/**
 * Returns IDs of pages referenced by the raw nav link tree.
 * Homepage pages are always treated as linked (root "/" is implicitly in nav).
 */
export function collectMenuPageIds(rawLinks: RawNavLink[], pages: PageLite[]): Set<string> {
    const linkedSlugs = collectLinkedSlugs(rawLinks)
    const ids = new Set<string>()
    for (const page of pages) {
        if (page.isHomepage) {
            ids.add(String(page.id))
            continue
        }
        if (linkedSlugs.has(normalizeSlug(page.slug))) {
            ids.add(String(page.id))
        }
    }
    return ids
}

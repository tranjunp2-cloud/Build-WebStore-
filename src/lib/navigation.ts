type SitePageLink = Record<string, unknown> & {
    slug?: string | null
    isVisible?: boolean | null
    isHomepage?: boolean | null
    deletedAt?: string | null
}

type NavigationLink = {
    label?: string
    url?: string
}

function normalizePagePath(slug?: string | null, isHomepage?: boolean | null) {
    if (isHomepage || !slug || slug === '/' || slug === 'home') return '/'

    const trimmed = slug.trim()
    if (!trimmed) return '/'
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function isInternalPath(url?: string) {
    if (!url) return false
    return url.startsWith('/')
}

export function filterNavigationLinksByVisibility<T extends NavigationLink>(
    links: T[] | undefined,
    pages: SitePageLink[] | undefined,
) {
    if (!Array.isArray(links) || links.length === 0 || !Array.isArray(pages) || pages.length === 0) {
        return links ?? []
    }

    const hiddenPaths = new Set(
        pages
            .filter(page => !page.isHomepage && page.isVisible === false && !page.deletedAt)
            .map(page => normalizePagePath(page.slug, page.isHomepage)),
    )

    return links.filter(link => {
        if (!isInternalPath(link.url)) return true
        return !hiddenPaths.has(normalizePagePath(link.url, false))
    })
}

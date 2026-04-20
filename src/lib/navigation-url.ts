function isValidIpv4Hostname(hostname: string) {
    const parts = hostname.split('.')
    if (parts.length !== 4) return false

    return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isValidDomainLabel(label: string) {
    if (!label || label.length > 63) return false
    if (label.startsWith('-') || label.endsWith('-')) return false
    return /^[a-z0-9-]+$/i.test(label)
}

function isValidDomainHostname(hostname: string) {
    if (!hostname.includes('.')) return false

    const labels = hostname.split('.')
    if (labels.some(label => !isValidDomainLabel(label))) return false

    const topLevelLabel = labels[labels.length - 1]
    return /^[a-z]{2,63}$/i.test(topLevelLabel) || /^xn--[a-z0-9-]{2,59}$/i.test(topLevelLabel)
}

export function isValidExternalNavigationUrl(value: string) {
    const trimmedValue = value.trim()
    if (!trimmedValue) return false

    try {
        const parsedUrl = new URL(trimmedValue)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false
        }

        const hostname = parsedUrl.hostname.trim().toLowerCase()
        if (!hostname) return false
        if (hostname === 'localhost') return true
        if (isValidIpv4Hostname(hostname)) return true

        return isValidDomainHostname(hostname)
    } catch {
        return false
    }
}

// ── Nav URL resolver (page-slug-driven) ─────────────────────────────────────

/**
 * Resolve a nav/footer/cta link URL against the real pages list of a site.
 *
 * Why a resolver instead of blind `.toLowerCase()`: AI generate-site can
 * seed links using the display label (`/Services`) instead of the stored
 * page slug (`/services`). Since every page already has a canonical slug
 * on disk, the right fix is to look each URL up against that list and
 * rewrite to the canonical form on hit. Non-matches pass through so
 * external URLs, mailto/tel, and intentional forward-declared paths are
 * left alone.
 */

export type NavPageLike = {
    id: string | number
    slug?: string | null
    isHomepage?: boolean | null
}

/**
 * Build a `{ anyFormOfSlug → canonical /slug }` map from the pages list.
 * Three forms are indexed per page so the rewriter tolerates casing +
 * leading-slash drift:
 *   - exact               (`/services` → `/services`)
 *   - lowercased          (`/Services` → `/services`; fixes AI-gen case leak)
 *   - bare (no leading /) (`services`  → `/services`)
 * Homepage always resolves `'/'` → `'/'`.
 */
export function buildSlugCanonicalMap(
    pages: NavPageLike[] | null | undefined,
): Map<string, string> {
    const map = new Map<string, string>()
    if (!Array.isArray(pages)) return map

    for (const p of pages) {
        const rawSlug = (p?.slug ?? '').trim()
        if (!rawSlug) continue
        const withSlash = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`
        map.set(withSlash, withSlash)
        map.set(withSlash.toLowerCase(), withSlash)
        if (rawSlug !== '/') {
            const bare = rawSlug.replace(/^\//, '')
            map.set(bare, withSlash)
        }
    }
    const homepage = pages.find((p) => p?.isHomepage) ?? pages[0]
    if (homepage) map.set('/', '/')
    return map
}

/** Split `/Services?tab=a#x` → `['/Services', '?tab=a#x']`. */
export function splitPathAndTail(url: string): [string, string] {
    const qIdx = url.indexOf('?')
    const hIdx = url.indexOf('#')
    const tailIdx =
        qIdx >= 0 && hIdx >= 0 ? Math.min(qIdx, hIdx)
            : qIdx >= 0 ? qIdx
                : hIdx >= 0 ? hIdx
                    : url.length
    return [url.slice(0, tailIdx), url.slice(tailIdx)]
}

/**
 * Resolve a URL against the canonical slug map. Returns canonical `/slug`
 * (with query+hash reattached) when the path resolves to a known page.
 * Otherwise returns the URL unchanged.
 *
 * Lookup: exact → lowercased → bare. First hit wins.
 */
export function rewriteLiveUrl(
    url: string | undefined | null,
    slugCanonical: Map<string, string>,
): string {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith('#')) return url
    // e.g. `mailto:hi@x.com#ref` — preserve. Internal paths with `#` fall
    // through since they start with `/`.
    if (url.includes('#') && !url.startsWith('/')) return url
    if (!url.startsWith('/')) return url

    const [path, tail] = splitPathAndTail(url)
    const hit =
        slugCanonical.get(path) ??
        slugCanonical.get(path.toLowerCase()) ??
        slugCanonical.get(path.replace(/^\//, ''))
    return (hit ?? path) + tail
}

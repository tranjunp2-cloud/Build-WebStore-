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
 * Homepage aliases appended to the canonical slug map so AI-seeded nav
 * labels like "Home" / "Index" (which emit `/Home`, `/Index`) resolve to
 * the real `/` homepage instead of 404-ing on a nonexistent page. Kept
 * as an exported const so SiteRenderer's preview map can mirror the
 * exact same alias set without drifting.
 */
export const HOMEPAGE_ALIASES = ['/home', 'home', '/index', 'index'] as const

/** Runtime-only prefix marking an internal URL that could not be resolved to any known page.
 *  Never persisted to the database. Detected by useIsHiddenLink / BrokenLinkWarning in editor mode. */
export const BROKEN_URL_PREFIX = '_broken_url_:'

/**
 * Build a `{ anyFormOfSlug → canonical /slug }` map from the pages list.
 * Three forms are indexed per page so the rewriter tolerates casing +
 * leading-slash drift:
 *   - exact               (`/services` → `/services`)
 *   - lowercased          (`/Services` → `/services`; fixes AI-gen case leak)
 *   - bare (no leading /) (`services`  → `/services`)
 *
 * After per-page entries, a homepage block is appended:
 *   - `/` always resolves to `/` when any page exists.
 *   - `HOMEPAGE_ALIASES` entries (`/home`, `/index`, etc.) resolve to
 *     `/` unless the site explicitly owns that slug — page entries are
 *     written first and the alias block checks `!map.has(alias)` before
 *     setting, so first-write-wins.
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
    if (pages.length > 0) {
        map.set('/', '/')
        for (const alias of HOMEPAGE_ALIASES) {
            if (!map.has(alias)) map.set(alias, '/')
        }
    }
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
 * Resolve an internal URL to the canonical page path used for comparisons.
 * Unlike rewriteLiveUrl(), this accepts bare internal slugs too because editor
 * data may contain `services` while render data typically contains `/services`.
 */
export function resolveInternalUrlPath(
    url: string | undefined | null,
    slugCanonical: Map<string, string>,
): string | null {
    if (!url) return null
    const trimmed = url.trim()
    if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) return null
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return null
    if (trimmed.includes(':') && !trimmed.startsWith('/')) return null

    const [rawPath] = splitPathAndTail(trimmed)
    if (!rawPath || rawPath === '#') return null

    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, '') : path
    const bare = withoutTrailingSlash.replace(/^\//, '')
    const hit =
        slugCanonical.get(path) ??
        slugCanonical.get(path.toLowerCase()) ??
        slugCanonical.get(withoutTrailingSlash) ??
        slugCanonical.get(withoutTrailingSlash.toLowerCase()) ??
        slugCanonical.get(bare)

    return hit ?? withoutTrailingSlash.toLowerCase()
}

/**
 * Resolve a URL against the canonical slug map. Returns canonical `/slug`
 * (with query+hash reattached) when the path resolves to a known page.
 * Otherwise returns `path.toLowerCase()` + tail — unmatched internal paths
 * (e.g. links to pages that were deleted from the site, or AI-seeded
 * label-cased URLs like `/Contact` where no stored slug exists) are
 * lowercased so the URL bar never shows mixed-case junk.
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
    return (hit ?? path.toLowerCase()) + tail
}

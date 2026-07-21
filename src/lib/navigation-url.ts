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

/**
 * Build a `{ anyFormOfSlug → pageId }` map from the pages list, for the editor/builder
 * preview iframe. Mirrors buildSlugCanonicalMap's indexing (exact / lowercased / bare)
 * plus a homepage block so `/` and HOMEPAGE_ALIASES resolve to the homepage's pageId.
 * Used by createPreviewUrlRewriter — kept separate so the alias set never drifts.
 */
export function buildPreviewSlugToPageId(
    pages: NavPageLike[] | null | undefined,
): Map<string, string> {
    const map = new Map<string, string>()
    if (!Array.isArray(pages)) return map

    for (const p of pages) {
        const pid = String(p?.id)
        const rawSlug = (p?.slug ?? '').trim()
        if (!rawSlug) continue
        const withSlash = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`
        map.set(withSlash, pid)
        map.set(withSlash.toLowerCase(), pid)
        if (rawSlug !== '/') {
            map.set(rawSlug.replace(/^\//, ''), pid)
        }
    }
    const homepage = pages.find((p) => p?.isHomepage) ?? pages[0]
    if (homepage) {
        const homepageId = String(homepage.id)
        map.set('/', homepageId)
        for (const alias of HOMEPAGE_ALIASES) {
            if (!map.has(alias)) map.set(alias, homepageId)
        }
    }
    return map
}

/**
 * Create a URL rewriter that keeps internal nav/CTA/footer links inside the preview
 * iframe scope: internal path ("/about") → `/preview/{siteId}?pageId={matchedPageId}`
 * (+`&builder=1` in builder preview); unmatched internal → '#'; external/anchor/mailto
 * preserved as-is. Extracted from SiteRenderer so preview routes that render blocks
 * WITHOUT SiteRenderer (e.g. blog detail) rewrite links identically instead of leaking
 * raw `/` hrefs that navigate the iframe out to the platform root.
 */
export function createPreviewUrlRewriter(opts: {
    pages: NavPageLike[] | null | undefined
    siteId: string | number | null | undefined
    isBuilderPreview?: boolean
}): (url: string | undefined) => string {
    const previewSiteId = String(opts.siteId ?? '')
    const slugToPageId = buildPreviewSlugToPageId(opts.pages)
    const builderSuffix = opts.isBuilderPreview ? '&builder=1' : ''

    return (url: string | undefined): string => {
        if (!url) return '#'
        if (/^https?:\/\//i.test(url)) return url
        if (url.startsWith('#')) return url
        if (url.includes('#') && !url.startsWith('/')) return url
        if (!previewSiteId) return '#'
        const [path] = splitPathAndTail(url)
        const hit =
            slugToPageId.get(path) ??
            slugToPageId.get(path.toLowerCase()) ??
            slugToPageId.get(path.replace(/^\//, ''))
        if (hit) return `/preview/${previewSiteId}?pageId=${hit}${builderSuffix}`
        return '#'
    }
}

/**
 * Recursively apply a URL rewriter to a nav/footer links array (`{ url, children? }[]`).
 * Returns a shallow-cloned array; non-array input passes through. Paired with
 * createPreviewUrlRewriter for preview routes that render nav/footer WITHOUT SiteRenderer.
 */
export function rewriteNavLinkUrls(
    links: unknown,
    rewrite: (url: string | undefined) => string,
): unknown {
    if (!Array.isArray(links)) return links
    return links.map((l) => {
        if (!l || typeof l !== 'object') return l
        const link = l as Record<string, unknown>
        return {
            ...link,
            url: rewrite(link.url as string | undefined),
            ...(Array.isArray(link.children)
                ? { children: rewriteNavLinkUrls(link.children, rewrite) }
                : {}),
        }
    })
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

/**
 * Map common AI/template CTA placeholders (`#contact`, `#about`, `#`, …) to
 * the canonical page path they intend. First step inside
 * `resolveCtaSlugFromLinks`; also reused directly by the AI-gen nav/footer
 * link normalization.
 */
export function normalizeInternalUrl(url: unknown): string {
    if (typeof url !== 'string') return '#'
    if (url === '#' || url === '#home' || url === '/home' || url === 'home') return '/'
    if (url === '#about' || url === 'about') return '/about'
    if (url === '#features' || url === '#services' || url === '#products' || url === 'products') return '/products'
    if (url === '#contact' || url === 'contact') return '/contact'
    return url
}

/**
 * Map a CTA URL to a canonical page slug from a site's page list.
 * Returns '' when no matching internal page exists (caller decides whether to
 * drop the button or fall back). External URLs (https, mailto, tel, etc.) are
 * passed through unchanged. Keyword-segment fuzzy matching (segments ≥3 chars)
 * lets locale-custom slugs (`/hubungi`, `/about-us`) still resolve.
 */
export function resolveCtaSlugFromLinks(
    rawUrl: unknown,
    canonicalLinks: Array<{ url: string }>,
): string {
    const normalized = normalizeInternalUrl(rawUrl)
    if (normalized === '') return ''
    // Pass external URLs through unchanged — renderer (useLocalHref) handles them.
    if (/^(https?:|\/\/|mailto:|tel:|whatsapp:|sms:)/.test(normalized)) return normalized
    // Exact match (most common case — canonical slugs already align)
    if (canonicalLinks.some(l => l.url === normalized)) return normalized
    // Strip leading /# before splitting so '#about-us' resolves like '/about-us'.
    // Skip segments < 3 chars to prevent single-char false-positives (e.g. 'a' matching '/about').
    const segments = normalized.replace(/^[/#]+/, '').split(/[-_/]/).filter(Boolean)
    for (const kw of segments) {
        if (kw.length < 3) continue
        const match = canonicalLinks.find(l => l.url !== '/' && l.url.includes(kw))
        if (match) return match.url
    }
    return ''
}

/**
 * Resolve a pricing plan's action CTA. Returns a new plan with:
 *  - `ctaUrl` → canonical internal slug, preferring `/contact` and otherwise
 *    falling back to a page that actually exists.
 *  - `ctaActionType` → `'internal'` for an internal path so the editor shows
 *    the page picker; external (http) URLs keep their existing type.
 * Shared by AI-gen (`patchPageCtaUrls`) and manual-drag (`patchBlockCtaUrls`).
 */
export function resolvePricingPlanCta(
    plan: Record<string, unknown>,
    canonicalLinks: Array<{ url: string }>,
): Record<string, unknown> {
    const raw = typeof plan.ctaUrl === 'string' ? plan.ctaUrl.trim() : ''
    const resolved = raw && raw !== '#' ? resolveCtaSlugFromLinks(plan.ctaUrl, canonicalLinks) : ''
    const fallback = canonicalLinks.some(link => link.url === '/contact')
        ? '/contact'
        : canonicalLinks.find(link => link.url !== '/')?.url ?? '/'
    const ctaUrl = resolved || fallback
    const ctaActionType = ctaUrl.startsWith('/') ? 'internal' : plan.ctaActionType
    return { ...plan, ctaUrl, ctaActionType }
}

/**
 * Public storefront DTO — what a site/page may carry into public HTML (GH-2077).
 *
 * Storefront routes read through the Payload Local API, which runs with
 * `overrideAccess: true`, so field-level `access.read: () => false` does not
 * strip anything. At the default depth a site doc carries the populated tenant
 * (Xendit keys, EasyParcel tokens, ECH api key, bank account, billing ids) and
 * pages carry it again through `page.site` / `page.tenant` / `media.tenant`.
 * Anything handed to SiteRenderer/SiteLayoutShell is serialised into the RSC
 * payload of client blocks, so every storefront render passes through here.
 */

type Doc = Record<string, unknown>

/** Site fields blocks, SiteRenderer, SiteLayoutShell and JSON-LD read. Everything else stays on the server. */
const PUBLIC_SITE_KEYS = [
    'id',
    'name',
    'domain',
    'status',
    'siteType',
    'category',
    'locale',
    'generationLocale',
    'theme',
    'socialLinks',
    'branding',
    'contactInfo',
    'localBusiness',
    'aiCrawlersEnabled',
    'publishedAt',
    'headerBlock',
    'footerBlock',
    'globalBlocks',
    // render context added by the routes (not stored on the doc)
    'tenantSlug',
    'siteBasePath',
    'blogPreviewPath',
    'imageLibraryS3',
] as const

const PUBLIC_SEO_KEYS = ['metaTitle', 'metaDescription', 'ogImage'] as const

function isDoc(value: unknown): value is Doc {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function relationId(value: unknown): unknown {
    return isDoc(value) && 'id' in value ? value.id : value
}

function pick(source: Doc, keys: readonly string[]): Doc {
    const out: Doc = {}
    for (const key of keys) if (key in source) out[key] = source[key]
    return out
}

/**
 * Deep copy that collapses every populated `tenant` / `tenants` relation to its id
 * and every populated `site` relation to the public site shape.
 */
export function toPublicDoc<T>(value: T): T {
    return scrub(value) as T
}

function scrub(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(scrub)
    if (!isDoc(value)) return value
    const out: Doc = {}
    for (const [key, child] of Object.entries(value)) {
        if (key === 'tenant') out[key] = relationId(child)
        else if (key === 'tenants' && Array.isArray(child)) out[key] = child.map((t) => (isDoc(t) && 'tenant' in t ? scrub(t) : relationId(t)))
        else if (key === 'site' && isDoc(child)) out[key] = toPublicSite(child)
        else out[key] = scrub(child)
    }
    return out
}

/** Allow-listed site shape for public rendering. `tenant` is kept as its id (blog-list block fetches by it). */
export function toPublicSite<T extends object>(site: T): T {
    const source = site as unknown as Doc
    const out = pick(source, PUBLIC_SITE_KEYS)
    if ('tenant' in source) out.tenant = relationId(source.tenant)
    if (isDoc(source.seo)) out.seo = pick(source.seo, PUBLIC_SEO_KEYS)
    return scrub(out) as T
}

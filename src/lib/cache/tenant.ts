/**
 * Cached tenant/site lookups using Next.js unstable_cache.
 * 5-minute TTL with tag-based revalidation on publish/update.
 *
 * Usage:
 *   const tenant = await getCachedTenant('my-store')
 *   const page = await getCachedPage(siteId, '/about')
 *
 * Invalidation:
 *   revalidateTag('tenants')           // all tenant lookups
 *   revalidateTag(`site-${siteId}`)    // specific site pages
 */
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

const CACHE_TTL = 300 // 5 minutes

/**
 * Cached tenant lookup by slug.
 * Tag: 'tenants' — revalidate when any tenant is updated.
 */
export const getCachedTenantBySlug = unstable_cache(
    async (slug: string) => {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
        })
        return result.docs[0] ?? null
    },
    ['tenant-by-slug'],
    { revalidate: CACHE_TTL, tags: ['tenants'] }
)

/**
 * Cached tenant lookup by custom domain.
 * Tag: 'tenants' — revalidate when domains change.
 */
export const getCachedTenantByDomain = unstable_cache(
    async (domain: string) => {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'tenants',
            where: { 'customDomains.domain': { equals: domain } },
            limit: 1,
            depth: 0,
        })
        return result.docs[0] ?? null
    },
    ['tenant-by-domain'],
    { revalidate: CACHE_TTL, tags: ['tenants'] }
)

/**
 * Cached site lookup by ID.
 * Tag: `site-${siteId}` — revalidate when site is updated/published.
 */
export function getCachedSite(siteId: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            return payload.findByID({ collection: 'sites', id: siteId, depth: 1 })
        },
        [`site-${siteId}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

/**
 * Cached page data for published site rendering.
 * Tag: `site-${siteId}` — revalidate on publish.
 */
export function getCachedPage(siteId: string, slug: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: siteId } },
                        { slug: { equals: slug } },
                    ],
                },
                limit: 1,
                depth: 3,
            })
            return result.docs[0] ?? null
        },
        [`page-${siteId}-${slug}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

// ── Visitor-path storefront cache (anonymous, published-only) ────────────────
// These mirror the EXACT filters the storefront page applies for non-owner
// visitors. They MUST NOT be used for the owner preview path (owners see drafts
// + hidden pages). Invalidated by `site-${siteId}` — fired on publish/unpublish
// (publish API) and on any site/page write (collection afterChange hooks).

/**
 * Cached site lookup by tenant id (visitor render entry point).
 * Default depth mirrors the original `payload.find({ collection:'sites' })`
 * call (no explicit depth) so SiteRenderer receives the same shape.
 * Tag: `tenants` — site afterChange revalidates both `site-${id}` and `tenants`.
 */
export function getCachedSiteByTenant(tenantId: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'sites',
                where: { tenant: { equals: tenantId } },
                limit: 1,
            })
            return result.docs[0] ?? null
        },
        [`site-by-tenant-${tenantId}`],
        { revalidate: CACHE_TTL, tags: ['tenants', `site-by-tenant-${tenantId}`] }
    )()
}

/**
 * Cached current page for a visitor (published + visible + not soft-deleted).
 * Mirrors page.tsx visitor branch: isVisible≠false, deletedAt absent, depth 3,
 * published (no draft). `pageSlug` is the leading-slash form ('/', '/about').
 */
export function getCachedVisitorPage(siteId: string, pageSlug: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: siteId } },
                        { slug: { in: [pageSlug, pageSlug.replace(/^\//, '')] } },
                        { isVisible: { not_equals: false } },
                        { deletedAt: { exists: false } },
                    ],
                },
                limit: 1,
                depth: 3,
            })
            return result.docs[0] ?? null
        },
        [`visitor-page-v2-${siteId}-${pageSlug}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

/**
 * Cached homepage fallback for a visitor (legacy sites whose home slug isn't '/').
 * Mirrors page.tsx isHomepage fallback for the non-owner branch.
 */
export function getCachedVisitorHomepage(siteId: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: siteId } },
                        { isHomepage: { equals: true } },
                        { isVisible: { not_equals: false } },
                        { deletedAt: { exists: false } },
                    ],
                },
                limit: 1,
                depth: 3,
            })
            return result.docs[0] ?? null
        },
        [`visitor-homepage-${siteId}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

/**
 * Cached full page list for nav building (ALL pages incl. hidden/deleted — the
 * SiteRenderer derives hiddenSlugs client-side and filters nav there, so this
 * intentionally passes everything, mirroring page.tsx `navigationPages`).
 */
export function getCachedNavigationPages(siteId: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'pages',
                where: { and: [{ site: { equals: siteId } }] },
                limit: 100,
                sort: 'createdAt',
            })
            return result.docs
        },
        [`nav-pages-${siteId}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

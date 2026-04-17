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

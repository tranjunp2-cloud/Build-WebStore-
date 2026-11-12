/**
 * Cached tenant/site lookups using Next.js unstable_cache.
 * 5-minute TTL with tag-based revalidation on publish/update.
 *
 * Usage:
 *   const tenant = await getCachedTenant('my-store')
 *   const page = await getCachedPage(siteId, '/about')
 *
 * Invalidation (src/lib/cache/revalidate-storefront.ts, per tenant — TC-PERF-065):
 *   tenant-slug:<slug> / tenant-domain:<host> / site-by-tenant-<id>   // one shop's identity + site
 *   revalidateTag(`site-${siteId}`)    // specific site pages
 *   revalidateTag('tenants')           // every shop at once (manual only; no write path busts it any more)
 */
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { storefrontTags } from './storefront-tags'
import { MAIN_SUBSCRIPTION_SELECT, type MainSubscriptionState } from '@/lib/storefront/store-availability'

const CACHE_TTL = 300 // 5 minutes

/**
 * The tenant fields storefront code reads off a populated `site.tenant` / `page.site.tenant` (blog list: id, slug;
 * canonical origin: slug, customDomains). Populating whole tenant rows put payment and courier secrets
 * (`xenditSecretKey`, `xenditCallbackToken`, EasyParcel tokens — the Local API skips field read access) into the
 * site object every block component receives, and made every site/page row read carry ~70 tenant columns
 * (TC-PERF-061). Users (blog authors) keep only their display name.
 */
export const STOREFRONT_POPULATE = {
    tenants: { name: true, slug: true, customDomains: true, status: true },
    users: { firstName: true, lastName: true },
} as const

const PUBLIC_TENANT_FIELDS = ['id', 'name', 'slug', 'customDomains', 'status'] as const

/**
 * Payload applies `populate` to the first level of relations only: a page read at depth 2-3 still carries
 * `page.site.tenant` as a whole tenant row (payment / courier secrets). Storefront page reads go through this so
 * the nested tenant keeps the same public fields as STOREFRONT_POPULATE.
 */
export function withPublicSiteTenant<T>(doc: T): T {
    if (!doc || typeof doc !== 'object') return doc
    const site = (doc as { site?: unknown }).site
    if (!site || typeof site !== 'object') return doc
    const tenant = (site as { tenant?: unknown }).tenant
    if (!tenant || typeof tenant !== 'object') return doc
    const publicTenant = Object.fromEntries(
        PUBLIC_TENANT_FIELDS.filter((key) => key in tenant).map((key) => [key, (tenant as Record<string, unknown>)[key]]),
    )
    return { ...doc, site: { ...site, tenant: publicTenant } }
}

/** `withPublicSiteTenant` for a list of storefront page docs. */
export function withPublicSiteTenants<T>(docs: T[]): T[] {
    return docs.map(withPublicSiteTenant)
}

/**
 * Cached tenant lookup by slug.
 * Tags: `tenant-slug:<slug>` (busted by that tenant's writes) + `tenants` (a manual all-tenants bust).
 */
export function getCachedTenantBySlug(slug: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: slug } },
                limit: 1,
                pagination: false,
                depth: 0,
            })
            return result.docs[0] ?? null
        },
        ['tenant-by-slug', slug],
        { revalidate: CACHE_TTL, tags: ['tenants', storefrontTags.tenantSlug(slug)] },
    )()
}

/**
 * The tenant only when `domain` is one of its VERIFIED domains: a domain still `pending` (not proven to belong to
 * the shop) must not serve the store (TC-PERF-156). Checked on the matched entry itself, not on any entry.
 */
export function activeDomainTenant<T extends object>(tenant: T | null, domain: string): T | null {
    const list = (tenant as { customDomains?: unknown } | null)?.customDomains
    const entries = Array.isArray(list) ? (list as Array<{ domain?: unknown; status?: unknown } | null>) : []
    return entries.some((entry) => entry?.domain === domain && entry?.status === 'active') ? tenant : null
}

/**
 * Cached tenant lookup by custom domain.
 * Tags: `tenant-domain:<host>` (busted when a tenant listing that domain changes) + `tenants`.
 */
export function getCachedTenantByDomain(domain: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'tenants',
                where: { 'customDomains.domain': { equals: domain } },
                limit: 1,
                pagination: false,
                depth: 0,
            })
            return activeDomainTenant(result.docs[0] ?? null, domain)
        },
        ['tenant-by-domain', domain],
        { revalidate: CACHE_TTL, tags: ['tenants', storefrontTags.tenantDomain(domain)] },
    )()
}

/**
 * Cached "which tenant used to have this slug" lookup for the old-subdomain 301 (middleware → /api/slug/redirect).
 * Tag `tenant-previous-slugs`: busted only when some tenant's slug or previousSlugs change.
 */
export function getCachedTenantByPreviousSlug(slug: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'tenants',
                where: { 'previousSlugs.slug': { equals: slug } },
                limit: 1,
                pagination: false,
                depth: 0,
                select: { slug: true, previousSlugs: true },
            })
            return (result.docs[0] as { id: number | string; slug?: string | null; previousSlugs?: Array<{ slug: string; expiresAt: string }> | null } | undefined) ?? null
        },
        ['tenant-by-previous-slug', slug],
        { revalidate: CACHE_TTL, tags: ['tenants', storefrontTags.previousSlugs] },
    )()
}

/**
 * Cached site lookup by ID.
 * Tag: `site-${siteId}` — revalidate when site is updated/published.
 */
export function getCachedSite(siteId: string) {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            return payload.findByID({ collection: 'sites', id: siteId, depth: 1, populate: STOREFRONT_POPULATE })
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
            return withPublicSiteTenant(result.docs[0] ?? null)
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
                pagination: false,
                populate: STOREFRONT_POPULATE,
            })
            return result.docs[0] ?? null
        },
        [`site-by-tenant-${tenantId}`],
        { revalidate: CACHE_TTL, tags: ['tenants', storefrontTags.siteByTenant(tenantId)] }
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
                pagination: false,
                depth: 3,
                populate: STOREFRONT_POPULATE,
            })
            return withPublicSiteTenant(result.docs[0] ?? null)
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
                pagination: false,
                depth: 3,
                populate: STOREFRONT_POPULATE,
            })
            return withPublicSiteTenant(result.docs[0] ?? null)
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
                pagination: false,
                sort: 'createdAt',
                populate: STOREFRONT_POPULATE,
            })
            return withPublicSiteTenants(result.docs)
        },
        [`nav-pages-${siteId}`],
        { revalidate: CACHE_TTL, tags: [`site-${siteId}`] }
    )()
}

/**
 * Latest `main` plan subscription of a shop (status + dates only), for the store availability gate (#2179).
 * The row is cached, never the verdict: `endsAt` is compared with the clock on every request, so expiry takes effect
 * without a write. Tags: `plan-subscription:<tenantId>` (busted by PlanSubscriptions writes, e.g. SSO renew).
 */
export function getCachedMainSubscription(tenantId: string | number): Promise<MainSubscriptionState | null> {
    return unstable_cache(
        async () => {
            const payload = await getPayload({ config })
            const result = await payload.find({
                collection: 'plan-subscriptions',
                where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
                sort: '-createdAt',
                limit: 1,
                pagination: false,
                depth: 0,
                overrideAccess: true,
                select: MAIN_SUBSCRIPTION_SELECT,
            })
            return (result.docs[0] as unknown as MainSubscriptionState | undefined) ?? null
        },
        ['main-subscription-by-tenant', String(tenantId)],
        { revalidate: CACHE_TTL, tags: ['tenants', storefrontTags.planSubscription(tenantId)] },
    )()
}

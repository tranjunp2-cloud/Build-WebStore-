/**
 * Cached store availability for the storefront hot path (middleware lookups, storefront pages) — #2179 item 6.
 * Reads the per-shop cached tenant/site/main-subscription entries, so a warm shop costs no database work.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCachedMainSubscription, getCachedSite, getCachedSiteByTenant, getCachedTenantByDomain, getCachedTenantBySlug } from '@/lib/cache/tenant'
import { siteLanguagesOf } from '@/lib/site-languages'
import { isStoreUnavailable, isTenantIdUnavailable } from './store-availability'
import { storeUnavailableLocale, type StoreUnavailableLocale } from './store-unavailable'

type TenantLike = { id: string | number; status?: unknown }

export async function isCachedStoreUnavailable(tenant: TenantLike): Promise<boolean> {
    if (tenant.status === 'suspended') return true
    return isStoreUnavailable(tenant.status, await getCachedMainSubscription(tenant.id))
}

/** Language of the unavailable page: the site's published primary language (BA spec). */
export async function storeUnavailableLocaleOf(tenantId: string | number): Promise<StoreUnavailableLocale> {
    const site = await getCachedSiteByTenant(String(tenantId))
    if (!site) return 'en'
    return storeUnavailableLocale(siteLanguagesOf(site as Parameters<typeof siteLanguagesOf>[0], 'live')[0])
}

/** `{ unavailable: true, locale }` when the store must not be served, else null. */
export async function storeUnavailableResponse(tenant: TenantLike): Promise<{ unavailable: true; locale: StoreUnavailableLocale } | null> {
    if (!(await isCachedStoreUnavailable(tenant))) return null
    return { unavailable: true, locale: await storeUnavailableLocaleOf(tenant.id) }
}

/**
 * The same verdict from a storefront route's params: `slug` is the tenant slug, or `custom` with the custom-domain
 * host from the middleware (`x-tenant-hostname`). Unknown tenant → null (the route answers its own 404).
 */
export async function storefrontUnavailableFor(slug: string, customHostname: string | null | undefined) {
    const tenant = slug === 'custom'
        ? (customHostname ? await getCachedTenantByDomain(customHostname) : null)
        : await getCachedTenantBySlug(slug)
    if (!tenant) return null
    return storeUnavailableResponse(tenant as TenantLike)
}

/**
 * Same verdict keyed by site id, for the hot listing APIs (products, bounds, categories). The cached site gives the
 * tenant id and slug; the status comes from the per-slug tenant cache, which ban / unban bust (the `site-<id>` entry is
 * not), so a warm shop costs no query and a ban or unban shows at once. Unknown site → false: the route answers it.
 * The slug lookup can miss or hit another tenant only after a slug change inside the site cache window: then read
 * this tenant by id, uncached (rare).
 */
export async function isCachedSiteUnavailable(siteId: string | number): Promise<boolean> {
    const site = await getCachedSite(String(siteId)).catch(() => null)
    const siteTenant = (site as { tenant?: unknown } | null)?.tenant
    if (!siteTenant || typeof siteTenant !== 'object') return false
    const { id, slug } = siteTenant as { id?: string | number; slug?: unknown }
    if (id == null) return false
    const tenant = typeof slug === 'string' && slug ? await getCachedTenantBySlug(slug) : null
    if (tenant && String(tenant.id) === String(id)) return isCachedStoreUnavailable(tenant as TenantLike)
    return isTenantIdUnavailable(await getPayload({ config }), id)
}

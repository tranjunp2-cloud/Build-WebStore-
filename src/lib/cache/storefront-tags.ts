/**
 * Cache tags of the storefront identity lookups (src/lib/cache/tenant.ts). Per shop, so one merchant's edit drops
 * only that shop's entries; the global `tenants` tag stays on every entry for a manual all-shops bust.
 */
export const storefrontTags = {
    tenantSlug: (slug: string) => `tenant-slug:${slug}`,
    tenantDomain: (domain: string) => `tenant-domain:${domain}`,
    siteByTenant: (tenantId: string | number) => `site-by-tenant-${tenantId}`,
    previousSlugs: 'tenant-previous-slugs',
    /** Latest main plan subscription of a shop (store availability gate, #2179). */
    planSubscription: (tenantId: string | number) => `plan-subscription:${tenantId}`,
} as const

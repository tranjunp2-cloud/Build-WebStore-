/**
 * Page slugs users cannot create. `/404` is auto-managed; `/checkout` and `/orders` are fixed
 * storefront routes (src/app/sites/[slug]/{checkout,orders}) that always win over a user page.
 */
export const RESERVED_PAGE_SLUGS = new Set(['/404', '/checkout', '/orders'])

/** True when a page slug (with or without leading/trailing slash, any case) is reserved. */
export function isReservedPageSlug(slug: string): boolean {
    const normalized = `/${slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '')}`
    return RESERVED_PAGE_SLUGS.has(normalized)
}

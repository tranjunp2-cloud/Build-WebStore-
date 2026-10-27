/**
 * Page slugs users cannot create. `/404` is auto-managed; `/checkout` is a fixed
 * storefront route (src/app/sites/[slug]/checkout) that always wins over a user page.
 */
export const RESERVED_PAGE_SLUGS = new Set(['/404', '/checkout'])

/** True when a page slug (with or without leading/trailing slash, any case) is reserved. */
export function isReservedPageSlug(slug: string): boolean {
    const normalized = `/${slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '')}`
    return RESERVED_PAGE_SLUGS.has(normalized)
}

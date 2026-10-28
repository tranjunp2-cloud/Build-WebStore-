/**
 * Clickjacking guard for the merchant's own screens (the dashboard and the site editor): only a page of this same
 * origin may frame them, so a page on another site, or on a shop's subdomain (same-site, so it gets the Lax session
 * cookie), can't show them under a decoy and steer a click onto Approve / Delete.
 *
 * Set by the middleware on the platform host only. A shop's storefront (its subdomain, a custom domain, or
 * `/sites/<slug>`) uses the same paths (`/products`, `/blog`, `/orders`) and keeps no such header, and neither do the
 * pages the app itself frames (`/preview/*`, `/api/templates/preview`). None of the protected screens is framed by
 * the app: the editor and builder frame `/preview/<siteId>`, never the other way round.
 */

export const FRAME_PROTECTION_HEADERS: Readonly<Record<string, string>> = {
    'Content-Security-Policy': "frame-ancestors 'self'",
    'X-Frame-Options': 'SAMEORIGIN',
}

/** Top-level paths of `app/(dashboard)` and `app/(editor)` (the page and everything under it). */
const PROTECTED_PREFIXES = [
    '/dashboard',
    '/products',
    '/orders',
    '/customers',
    '/contact-leads',
    '/discounts',
    '/media',
    '/blog',
    '/settings',
    '/help',
    '/templates-health',
    '/forbidden',
    '/editor',
]
/** `/sites` is the dashboard's website list; `/sites/<slug>/…` is a storefront and is left alone. */
const PROTECTED_EXACT = ['/sites']

export function isFrameProtectedPath(pathname: string): boolean {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    if (PROTECTED_EXACT.includes(path)) return true
    return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** Adds the headers to a platform-host response for a protected path; anything else is returned unchanged. */
export function withFrameProtection<T extends { headers: Headers }>(response: T, pathname: string): T {
    if (isFrameProtectedPath(pathname)) {
        for (const [name, value] of Object.entries(FRAME_PROTECTION_HEADERS)) response.headers.set(name, value)
    }
    return response
}

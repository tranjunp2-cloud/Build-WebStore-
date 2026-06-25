/**
 * No-website guard (GH-1392). Within the (dashboard) route group we guard ALL
 * routes by default (deny-by-default) and list only the few exceptions here, so
 * new modules are guarded automatically.
 *
 * Excluded routes still render normally when the tenant has no website:
 * - /settings/profile, /settings/staff — user can manage profile/team without a site
 * - /help — documentation must always be reachable
 * - /sites — already has its own empty/create-first UI (SitesPageClient)
 *
 * Routes outside (dashboard) (/builder/new, /onboarding, /login, …) never reach
 * this layout, so they need no entry here.
 */
export const NO_WEBSITE_EXCLUDED_PREFIXES = [
    '/settings/profile',
    '/settings/staff',
    '/help',
    '/sites',
] as const

/**
 * Decide whether to replace page content with the no-website empty state.
 * Pure → unit-testable. Prefix matching (with a `/` boundary) covers dynamic
 * children (e.g. /orders/[id]) while avoiding false matches like
 * `/settings/profile-x` against `/settings/profile`.
 */
export function shouldShowNoWebsiteGuard(pathname: string, hasWebsite: boolean): boolean {
    if (hasWebsite) return false
    return !NO_WEBSITE_EXCLUDED_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(p + '/'),
    )
}

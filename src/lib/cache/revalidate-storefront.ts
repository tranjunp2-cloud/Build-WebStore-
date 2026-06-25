/**
 * Payload collection hooks that bust the storefront data cache
 * (see `src/lib/cache/tenant.ts`) whenever a site or page mutates.
 *
 * Why hooks AND the publish/page API routes both revalidate: the API routes
 * cover the editor flow, but direct edits in the Payload admin bypass them.
 * These afterChange/afterDelete hooks close that gap so visitors never see
 * stale content past the next write (independent of the 5-min TTL).
 *
 * revalidateTag throws outside a Next.js request scope (migrations, seeds,
 * standalone scripts) — every call is guarded so those paths never break.
 */
import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/** Bust a site's page-level caches (visitor page/homepage/nav). */
function bustSitePages(siteId: string | number | null | undefined) {
    if (siteId == null) return
    try {
        revalidateTag(`site-${siteId}`)
    } catch {
        // Out-of-request scope (seed/migration) — nothing to revalidate.
    }
}

/**
 * Bust a site's page caches AND the tenant/site-by-tenant identity caches.
 * Used for site-doc writes (status, settings) which the `tenants`-tagged
 * `getCachedSiteByTenant` / tenant lookups depend on.
 */
function bustSiteAndTenants(siteId: string | number | null | undefined) {
    if (siteId == null) return
    try {
        revalidateTag(`site-${siteId}`)
        revalidateTag('tenants')
    } catch {
        // Out-of-request scope (seed/migration) — nothing to revalidate.
    }
}

/** Extract the related site id from a page doc (`site` may be id or populated). */
function pageSiteId(doc: Record<string, unknown>): string | number | null {
    const site = doc?.site
    if (site == null) return null
    if (typeof site === 'object') return (site as { id?: string | number }).id ?? null
    return site as string | number
}

// ── Sites collection (doc.id IS the site id) ────────────────────────────────
export const revalidateSiteAfterChange: CollectionAfterChangeHook = ({ doc }) => {
    bustSiteAndTenants((doc as { id?: string | number }).id)
    return doc
}

export const revalidateSiteAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bustSiteAndTenants((doc as { id?: string | number }).id)
    return doc
}

// ── Pages collection (doc.site is the site id) ──────────────────────────────
// Page writes don't change tenant/site identity, so only the site's page
// caches are busted (mirrors /api/sites/[siteId]/pages/[pageId] route).
export const revalidatePageAfterChange: CollectionAfterChangeHook = ({ doc }) => {
    bustSitePages(pageSiteId(doc as Record<string, unknown>))
    return doc
}

export const revalidatePageAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bustSitePages(pageSiteId(doc as Record<string, unknown>))
    return doc
}

// ── Tenants collection ──────────────────────────────────────────────────────
// Tenant identity (slug, customDomains) drives the `tenants`-tagged lookups
// (getCachedTenantBySlug/ByDomain/getCachedSiteByTenant). Editing a tenant in
// the Payload admin bypasses the dashboard domain action, so bust here too —
// otherwise a re-pointed slug/domain serves stale content for up to the TTL.
const bustTenants = () => {
    try {
        revalidateTag('tenants')
    } catch {
        // Out-of-request scope (seed/migration) — nothing to revalidate.
    }
}

export const revalidateTenantAfterChange: CollectionAfterChangeHook = ({ doc }) => {
    bustTenants()
    return doc
}

export const revalidateTenantAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bustTenants()
    return doc
}

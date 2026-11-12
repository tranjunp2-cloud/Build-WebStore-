/**
 * Payload collection hooks that bust the storefront data cache
 * (see `src/lib/cache/tenant.ts`) whenever a site or page mutates.
 *
 * Why hooks AND the publish/page API routes both revalidate: the API routes
 * cover the editor flow, but direct edits in the Payload admin bypass them.
 * These afterChange/afterDelete hooks close that gap so visitors never see
 * stale content past the next write (independent of the 5-min TTL).
 *
 * Every bust is scoped to the shop that changed (TC-PERF-065). Site writes used to bust the global `tenants` tag:
 * the editor autosaves every few seconds, so with a few hundred merchants editing, every shop's tenant/site lookup
 * was evicted all the time and storefronts rendered cold.
 *
 * revalidateTag throws outside a Next.js request scope (migrations, seeds,
 * standalone scripts) — every call is guarded so those paths never break.
 */
import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { storefrontTags } from './storefront-tags'

function bust(tags: Iterable<string>) {
    for (const tag of new Set(tags)) {
        try {
            revalidateTag(tag, { expire: 0 })
        } catch {
            // Out-of-request scope (seed/migration) — nothing to revalidate.
        }
    }
}

function relationId(value: unknown): string | number | null {
    if (value == null) return null
    if (typeof value === 'object') return (value as { id?: string | number }).id ?? null
    return value as string | number
}

/**
 * A site's page caches + its shop's site-by-tenant entry. With no tenant id (unknown caller) it falls back to the
 * all-shops `tenants` tag rather than leaving a stale site.
 */
export function revalidateSiteStorefront(siteId: string | number | null | undefined, tenantId: unknown) {
    if (siteId == null) return
    const tenant = relationId(tenantId)
    bust([`site-${siteId}`, tenant != null ? storefrontTags.siteByTenant(tenant) : 'tenants'])
}

/** Bust a site's page-level caches (visitor page/homepage/nav). */
function bustSitePages(siteId: string | number | null | undefined) {
    if (siteId == null) return
    bust([`site-${siteId}`])
}

// ── Sites collection (doc.id IS the site id) ────────────────────────────────
export const revalidateSiteAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
    const siteId = (doc as { id?: string | number }).id
    revalidateSiteStorefront(siteId, (doc as { tenant?: unknown }).tenant)
    const before = relationId((previousDoc as { tenant?: unknown } | undefined)?.tenant)
    if (before != null && before !== relationId((doc as { tenant?: unknown }).tenant)) {
        bust([storefrontTags.siteByTenant(before)])
    }
    return doc
}

export const revalidateSiteAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    revalidateSiteStorefront((doc as { id?: string | number }).id, (doc as { tenant?: unknown }).tenant)
    return doc
}

// ── Pages collection (doc.site is the site id) ──────────────────────────────
// Page writes don't change tenant/site identity, so only the site's page
// caches are busted (mirrors /api/sites/[siteId]/pages/[pageId] route).
export const revalidatePageAfterChange: CollectionAfterChangeHook = ({ doc }) => {
    bustSitePages(relationId((doc as Record<string, unknown>)?.site))
    return doc
}

export const revalidatePageAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bustSitePages(relationId((doc as Record<string, unknown>)?.site))
    return doc
}

// ── Tenants collection ──────────────────────────────────────────────────────
// Tenant identity (slug, customDomains) drives the tenant lookups (getCachedTenantBySlug/ByDomain/
// getCachedSiteByTenant). Editing a tenant in the Payload admin bypasses the dashboard domain action, so bust
// here too — for this tenant only: its slug (old and new), its domains (old and new), its site entry, and the
// old-slug index only when the slug or previousSlugs changed.
type TenantIdentity = {
    id?: string | number
    slug?: string | null
    customDomains?: Array<{ domain?: string | null }> | null
    previousSlugs?: unknown
}

export function tenantStorefrontTags(doc: TenantIdentity | null | undefined, previousDoc?: TenantIdentity | null): string[] {
    const tags: string[] = []
    for (const version of [doc, previousDoc]) {
        if (!version) continue
        if (version.slug) tags.push(storefrontTags.tenantSlug(version.slug))
        for (const entry of version.customDomains ?? []) {
            if (entry?.domain) tags.push(storefrontTags.tenantDomain(entry.domain))
        }
        if (version.id != null) tags.push(storefrontTags.siteByTenant(version.id))
    }
    const slugChanged = (doc?.slug ?? null) !== (previousDoc?.slug ?? null)
    const previousSlugsChanged = JSON.stringify(doc?.previousSlugs ?? null) !== JSON.stringify(previousDoc?.previousSlugs ?? null)
    if (slugChanged || previousSlugsChanged) tags.push(storefrontTags.previousSlugs)
    return [...new Set(tags)]
}

export const revalidateTenantAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
    bust(tenantStorefrontTags(doc as TenantIdentity, previousDoc as TenantIdentity | undefined))
    return doc
}

/**
 * Bust one tenant's storefront entries again once its write has committed. The afterChange hook runs before Payload
 * commits, so a storefront read in between can re-cache the old status (ban / unban) for the TTL (#2179).
 */
export function revalidateTenantStorefront(doc: TenantIdentity | null | undefined) {
    bust(tenantStorefrontTags(doc, doc))
}

export const revalidateTenantAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bust(tenantStorefrontTags(doc as TenantIdentity, null))
    return doc
}

// ── PlanSubscriptions collection ─────────────────────────────────────────────
/**
 * Bust a shop's cached main subscription. The collection hooks run before Payload commits, so a storefront read in
 * between can re-cache the old (expired) row for the TTL: SSO renew / upgrade / downgrade call this again once the write returned.
 */
export function revalidatePlanSubscription(tenantId: string | number) {
    bust([storefrontTags.planSubscription(tenantId)])
}

// The main subscription decides store availability (#2179): SSO renew/upgrade write here and must reopen the shop now.
export const revalidatePlanSubscriptionAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
    const tags = [doc, previousDoc]
        .map((version) => relationId((version as { tenant?: unknown } | undefined)?.tenant))
        .filter((id): id is string | number => id != null)
        .map((id) => storefrontTags.planSubscription(id))
    bust(tags)
    return doc
}

export const revalidatePlanSubscriptionAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    const tenant = relationId((doc as { tenant?: unknown }).tenant)
    if (tenant != null) bust([storefrontTags.planSubscription(tenant)])
    return doc
}


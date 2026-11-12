import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * Bust the sidebar badge-counts cache whenever a badge-driving record (orders, products)
 * is created/updated/deleted, so the dashboard badges reflect reality on the next render.
 * Pairs with a client router.refresh() in the orders UI (re-renders the layout that holds
 * the badges); other pages pick it up on their next navigation.
 *
 * Shared by the Orders + Products collections (both carry a `tenant` field). Catches EVERY
 * mutation path — dashboard PATCH, API routes, Stripe webhook, storefront checkout — because
 * it lives on the collection, not the UI. Tag must match the one in
 * sidebar-badge-counts-cached.ts (`sidebar-badge-counts:${tenantId}`).
 *
 * Best-effort: revalidateTag throws outside a request scope (seed scripts, migrations) — we
 * swallow that; the cache still self-expires via its 60s TTL.
 */
function bustBadgeCache(tenant: unknown): void {
    const tenantId =
        typeof tenant === 'object' && tenant !== null ? (tenant as { id: string | number }).id : tenant
    if (tenantId == null) return
    try {
        revalidateTag(`sidebar-badge-counts:${String(tenantId)}`, { expire: 0 })
    } catch {
        // outside request scope (scripts/seeds) — falls back to the cache's 60s TTL
    }
}

export const revalidateBadgeCountsAfterChange: CollectionAfterChangeHook = ({ doc }) => {
    bustBadgeCache(doc.tenant)
    return doc
}

export const revalidateBadgeCountsAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
    bustBadgeCache(doc?.tenant)
    return doc
}

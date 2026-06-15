import type { Payload } from 'payload'
import type { SidebarBadgeKey } from '@/components/dashboard/Sidebar'

/**
 * Sidebar badge counts (F18 #1138) — dynamic numbers shown right of nav labels.
 *
 * Tenant-scoped, computed server-side in the dashboard layout. Counts run in parallel;
 * any single query failure degrades to 0 (badge hidden) rather than breaking the layout.
 * The Sidebar hides a pill when the count is 0/undefined, so 0 is a safe default.
 *
 * Five badges: orders, products, customers, discounts, leads (Contact Leads).
 * Some are scoped to an actionable subset rather than a raw total:
 *   - orders   → status='pending' (awaiting the merchant's attention)
 *   - products → status='active' + not soft-deleted (live products, matching storefront read)
 */

const totalOf = (promise: Promise<{ totalDocs: number }>) =>
    promise.then((r) => r.totalDocs).catch(() => 0)

/**
 * Contact Leads = contact-submissions + newsletter subscribers, scoped by the tenant's sites
 * (these collections key off `site`, not `tenant`). Raw sum of both — no email dedup — to keep
 * it to two cheap COUNT queries; the figure can run slightly higher than the deduped list page.
 */
async function countLeads(payload: Payload, tenantId: string): Promise<number> {
    const sites = await payload
        .find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 100, depth: 0 })
        .catch(() => null)
    const siteIds = sites?.docs.map((s) => s.id) ?? []
    if (siteIds.length === 0) return 0

    const site = { in: siteIds }
    const [contacts, subscribers] = await Promise.all([
        totalOf(payload.count({ collection: 'contact-submissions', where: { site } })),
        totalOf(payload.count({ collection: 'subscribers', where: { site } })),
    ])
    return contacts + subscribers
}

export async function getSidebarBadgeCounts(
    payload: Payload,
    tenantId: string | null,
): Promise<Partial<Record<SidebarBadgeKey, number>>> {
    if (!tenantId) return {}
    const tenant = { equals: tenantId }

    const [orders, products, customers, discounts, leads] = await Promise.all([
        totalOf(payload.count({ collection: 'orders', where: { tenant, status: { equals: 'pending' } } })),
        totalOf(payload.count({ collection: 'products', where: { tenant, status: { equals: 'active' }, deletedAt: { exists: false } } })),
        totalOf(payload.count({ collection: 'customers', where: { tenant } })),
        totalOf(payload.count({ collection: 'discounts', where: { tenant } })),
        countLeads(payload, tenantId),
    ])

    return { orders, products, customers, discounts, leads }
}

import { describe, it, expect, vi } from 'vitest'
import { getSidebarBadgeCounts } from '@/lib/dashboard/sidebar-badge-counts'

/**
 * TC-F18.10 — Sidebar badge counts (data layer). Verifies getSidebarBadgeCounts is
 * tenant-scoped, aggregates leads from contact-submissions + subscribers, and degrades
 * each count to 0 on failure (so a bad query never breaks the dashboard layout).
 *
 * Payload is stubbed: count() keyed by collection, find() resolves the tenant's site ids.
 */
type CountArgs = { collection: string; where?: Record<string, unknown> }

function makePayload(opts: {
    counts?: Record<string, number>
    sites?: Array<{ id: number }>
    countThrows?: string
    sitesThrows?: boolean
}) {
    const counts = opts.counts ?? {}
    const count = vi.fn(async ({ collection }: CountArgs) => {
        if (opts.countThrows === collection) throw new Error('count failed')
        return { totalDocs: counts[collection] ?? 0 }
    })
    const find = vi.fn(async ({ collection }: CountArgs) => {
        if (collection === 'sites') {
            if (opts.sitesThrows) throw new Error('sites failed')
            return { docs: opts.sites ?? [] }
        }
        return { docs: [] }
    })
    // Cast: helper only ever calls .count() and .find() at runtime.
    return { count, find } as unknown as Parameters<typeof getSidebarBadgeCounts>[0] & { count: typeof count; find: typeof find }
}

describe('getSidebarBadgeCounts (TC-F18.10)', () => {
    it('returns empty object and hits no DB when tenantId is null', async () => {
        const payload = makePayload({})
        const result = await getSidebarBadgeCounts(payload, null)
        expect(result).toEqual({})
        expect(payload.count).not.toHaveBeenCalled()
        expect(payload.find).not.toHaveBeenCalled()
    })

    it('aggregates all five badges; leads = contact-submissions + subscribers', async () => {
        const payload = makePayload({
            counts: { orders: 5, products: 3, customers: 2, discounts: 16, 'contact-submissions': 8, subscribers: 4 },
            sites: [{ id: 1 }, { id: 2 }],
        })
        const result = await getSidebarBadgeCounts(payload, 't1')
        expect(result).toEqual({ orders: 5, products: 3, customers: 2, discounts: 16, leads: 12 })
    })

    it('scopes orders by tenant + status=pending, others by tenant, leads by tenant sites', async () => {
        const payload = makePayload({ counts: { orders: 1 }, sites: [{ id: 9 }] })
        await getSidebarBadgeCounts(payload, 't42')

        // Orders badge counts only actionable (pending) orders, not all statuses
        const orders = payload.count.mock.calls.find((c) => c[0].collection === 'orders')?.[0]
        expect(orders?.where).toMatchObject({ tenant: { equals: 't42' }, status: { equals: 'pending' } })

        // Products badge counts only live (active, not soft-deleted) products
        const products = payload.count.mock.calls.find((c) => c[0].collection === 'products')?.[0]
        expect(products?.where).toMatchObject({
            tenant: { equals: 't42' },
            status: { equals: 'active' },
            deletedAt: { exists: false },
        })

        const sitesFind = payload.find.mock.calls.find((c) => c[0].collection === 'sites')?.[0]
        expect(sitesFind?.where).toMatchObject({ tenant: { equals: 't42' } })

        const contacts = payload.count.mock.calls.find((c) => c[0].collection === 'contact-submissions')?.[0]
        expect(contacts?.where).toMatchObject({ site: { in: [9] } })
    })

    it('degrades a failing count to 0 without breaking the others', async () => {
        const payload = makePayload({
            counts: { orders: 5, products: 3, customers: 2 },
            countThrows: 'discounts',
            sites: [{ id: 1 }],
        })
        const result = await getSidebarBadgeCounts(payload, 't1')
        expect(result.discounts).toBe(0)
        expect(result.orders).toBe(5)
    })

    it('returns leads = 0 when the tenant has no sites (skips lead counts)', async () => {
        const payload = makePayload({ counts: { orders: 5 }, sites: [] })
        const result = await getSidebarBadgeCounts(payload, 't1')
        expect(result.leads).toBe(0)
        expect(payload.count).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'subscribers' }))
    })

    it('returns leads = 0 when the sites lookup fails', async () => {
        const payload = makePayload({ counts: { orders: 5 }, sitesThrows: true })
        const result = await getSidebarBadgeCounts(payload, 't1')
        expect(result.leads).toBe(0)
    })
})

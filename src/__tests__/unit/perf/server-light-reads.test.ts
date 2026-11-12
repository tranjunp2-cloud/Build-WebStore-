/**
 * Server reads that ran Payload's defaults (depth 2, a COUNT per find, every column) or one statement per row,
 * now one light statement each — TC-PERF-053, 060, 063, 071.
 * Payload is a call-recording fake: these tests pin the query shape that keeps the SQL count flat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
    find: vi.fn(),
    findByID: vi.fn(),
    unstableCache: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: h.find, findByID: h.findByID })) }))
vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown, keys: unknown, options: unknown) => {
        h.unstableCache(keys, options)
        return fn
    },
    revalidateTag: vi.fn(),
}))

import { findDashboardProductPage } from '@/lib/products/dashboard-product-list'
import { fetchCustomerOrderStats } from '@/lib/customers/customer-order-stats'
import { resolveImageLibraryS3Map, resolveImageLibraryS3MapCached } from '@/lib/images/image-library-resolver'
import { getActivePlanSubscription, getFeatureValue } from '@/lib/subscriptions/plan-subscription'

beforeEach(() => {
    vi.clearAllMocks()
    h.find.mockReset()
    h.findByID.mockReset()
})

describe('products list page [TC-PERF-053]', () => {
    it('scans the catalog in one read and hydrates only the chosen page, both without a COUNT', async () => {
        // Arrange — 250 products: the old loop read 3 pages × (find + count + categories)
        const candidates = Array.from({ length: 250 }, (_, i) => ({ id: 250 - i, name: `P${250 - i}`, status: 'active', createdAt: new Date(Date.UTC(2026, 0, 1) + (250 - i) * 60_000).toISOString() }))
        h.find
            .mockResolvedValueOnce({ docs: candidates })
            .mockImplementationOnce(async ({ where }: { where: { and: Array<{ id?: { in: number[] } }> } }) => ({
                docs: where.and.find((c) => c.id)!.id!.in.map((id) => ({ id, name: `P${id}` })),
            }))
        const user = { id: 1, tenants: [{ tenant: 7 }] }

        // Act
        const page = await findDashboardProductPage({ find: h.find } as never, user as never, { page: 2, limit: 25 })

        // Assert
        expect(h.find).toHaveBeenCalledTimes(2)
        const [scan, batch] = h.find.mock.calls.map(([args]) => args)
        expect(scan).toMatchObject({ collection: 'products', limit: 0, pagination: false, overrideAccess: false, user })
        expect(scan).not.toHaveProperty('page')
        expect(batch).toMatchObject({ collection: 'products', limit: 0, pagination: false })
        expect(page.totalDocs).toBe(250)
        expect(page.docs.map((d: { id: number }) => d.id)).toEqual(Array.from({ length: 25 }, (_, i) => 225 - i))
    })
})

describe('customer order stats [TC-PERF-060]', () => {
    it('reads only customer, total, status and paymentStatus of the orders, as one statement', async () => {
        // Arrange
        h.find.mockResolvedValue({ docs: [{ customer: 3, total: 10, status: 'completed' }, { customer: { id: 3 }, total: 5, status: 'cancelled' }] })

        // Act
        const stats = await fetchCustomerOrderStats({ find: h.find } as never, [3, 4], '7')

        // Assert
        // cancelled order is counted but its total is excluded from spend (#2086)
        expect(stats.get(3)).toEqual({ count: 2, total: 10, completed: 1, failed: 1 })
        expect(h.find).toHaveBeenCalledWith({
            collection: 'orders',
            where: { and: [{ customer: { in: [3, 4] } }, { tenant: { equals: '7' } }] },
            limit: 400,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            select: { customer: true, total: true, status: true, paymentStatus: true },
        })
    })

    it('warns when the cap was reached (the stats may be partial)', async () => {
        // Arrange
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        h.find.mockResolvedValue({ docs: [{ customer: 3, total: 1, status: 'new' }, { customer: 3, total: 1, status: 'new' }] })

        // Act
        await fetchCustomerOrderStats({ find: h.find } as never, [3], '7', 2)

        // Assert
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('possibly truncated'))
        warn.mockRestore()
    })
})

describe('image library map [TC-PERF-063]', () => {
    it('reads alt/url columns in one statement and caches the visitor variant per site under the site tag', async () => {
        // Arrange
        h.find.mockResolvedValue({ docs: [{ alt: 'imglib:s5:hero[0]', url: '/m/h.jpg' }] })

        // Act
        const live = await resolveImageLibraryS3Map({ find: h.find } as never, 5)
        const cached = await resolveImageLibraryS3MapCached({ find: h.find } as never, 5)

        // Assert
        expect(live).toEqual({ 'hero[0]': '/m/h.jpg' })
        expect(cached).toEqual(live)
        expect(h.find.mock.calls[0][0]).toMatchObject({ collection: 'media', limit: 200, pagination: false, depth: 0, select: { alt: true, url: true, filename: true, prefix: true } })
        expect(h.unstableCache).toHaveBeenCalledWith(['image-library-s3', '5'], { revalidate: 300, tags: ['site-5'] })
    })
})

describe('plan gate reads [TC-PERF-071]', () => {
    it('reads the main subscription and a plan feature as one depth-0 statement each', async () => {
        // Arrange
        h.find
            .mockResolvedValueOnce({ docs: [{ id: 1, plan: 'PRO', status: 'active', endsAt: '2999-01-01T00:00:00.000Z' }] })
            .mockResolvedValueOnce({ docs: [{ value: 'YES' }] })
        const payload = { find: h.find } as never

        // Act
        const sub = await getActivePlanSubscription(payload, 7)
        const value = await getFeatureValue(payload, 'PRO' as never, 'order_management')

        // Assert
        expect(sub).toMatchObject({ plan: 'PRO' })
        expect(value).toBe('YES')
        for (const [args] of h.find.mock.calls) expect(args).toMatchObject({ limit: 1, pagination: false, depth: 0 })
    })
})

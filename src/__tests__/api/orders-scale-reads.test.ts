/**
 * Orders reads at scale — TC-PERF-050, TC-PERF-051, TC-PERF-052, TC-PERF-080.
 *   050  GET /api/orders/metrics counts with payload.count (never a `find({ limit: 0 })`, which loads every order)
 *   051  GET /api/orders?limit=0 is a COUNT: `{ docs: [], totalDocs }`, no find
 *   052  the list / detail populate tenants and sites with a few public fields (not whole rows)
 *   080  both answer with a weak ETag; a matching If-None-Match gets 304 with no body
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), count: vi.fn(), findByID: vi.fn() }))
const mockUser = { id: 1, tenants: [{ tenant: 7 }] }

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (...args: unknown[]) => unknown) => async (req: unknown, ctx: unknown) => handler(mockUser, req, ctx),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({ withFeatureGuard: () => (handler: unknown) => handler }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: mocks.find, count: mocks.count, findByID: mocks.findByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET as listOrders } from '@/app/api/orders/route'
import { GET as orderMetrics } from '@/app/api/orders/metrics/route'
import { GET as orderDetail } from '@/app/api/orders/[id]/route'

const request = (url: string, headers: Record<string, string> = {}) => new Request(`http://localhost${url}`, { headers })

describe('GET /api/orders/metrics [TC-PERF-050, TC-PERF-080]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.count.mockImplementation(async ({ where }: { where: { status: { in: string[] } } }) => ({ totalDocs: where.status.in.length }))
    })

    it('counts each status group with payload.count as the caller, never loading orders', async () => {
        // Act
        const res = await orderMetrics(request('/api/orders/metrics'), {} as never)
        const body = await res.json()

        // Assert
        expect(mocks.find).not.toHaveBeenCalled()
        expect(mocks.count).toHaveBeenCalledTimes(7)
        for (const [args] of mocks.count.mock.calls) {
            expect(args).toMatchObject({ collection: 'orders', user: mockUser, overrideAccess: false })
        }
        expect(body).toEqual({
            success: true,
            data: { pending: 3, confirmed: 1, readyToShip: 1, shipped: 1, completed: 2, cancelled: 1, refunded: 1 },
        })
    })

    it('answers 304 without a body when If-None-Match carries the current ETag', async () => {
        // Arrange
        const first = await orderMetrics(request('/api/orders/metrics'), {} as never)
        const etag = first.headers.get('ETag')!

        // Act
        const second = await orderMetrics(request('/api/orders/metrics', { 'if-none-match': etag }), {} as never)

        // Assert
        expect(etag).toMatch(/^W\/"/)
        expect(first.headers.get('Cache-Control')).toBe('private, max-age=0')
        expect(second.status).toBe(304)
        expect(await second.text()).toBe('')
    })
})

describe('GET /api/orders [TC-PERF-051, TC-PERF-052, TC-PERF-080]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.count.mockResolvedValue({ totalDocs: 4 })
        mocks.find.mockResolvedValue({ docs: [{ id: 1 }], totalDocs: 1, page: 1, totalPages: 1 })
    })

    it('limit=0 returns the count only: one COUNT with the same filters, no rows', async () => {
        // Act
        const res = await listOrders(request('/api/orders?paymentStatus=pending_verification&paymentMethod=bank_transfer&limit=0'), {} as never)
        const body = await res.json()

        // Assert
        expect(mocks.find).not.toHaveBeenCalled()
        expect(mocks.count).toHaveBeenCalledWith({
            collection: 'orders',
            where: { tenant: { equals: 7 }, paymentMethod: { equals: 'bank_transfer' }, paymentStatus: { equals: 'pending_verification' } },
            user: mockUser,
            overrideAccess: false,
        })
        expect(body).toMatchObject({ success: true, docs: [], totalDocs: 4, hasNextPage: false })
    })

    it('a junk limit falls back to a 20-row page instead of an unbounded read', async () => {
        // Act
        await listOrders(request('/api/orders?limit=abc'), {} as never)

        // Assert
        expect(mocks.count).not.toHaveBeenCalled()
        expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }))
    })

    it('populates tenants / sites / products / users with only the fields the Orders screens read', async () => {
        // Act
        await listOrders(request('/api/orders?page=2&limit=20'), {} as never)

        // Assert
        const args = mocks.find.mock.calls[0][0]
        expect(args).toMatchObject({ collection: 'orders', depth: 1, page: 2, limit: 20, user: mockUser, overrideAccess: false })
        expect(Object.keys(args.populate.tenants).sort()).toEqual(['easyParcelIntegration', 'name', 'slug'])
        expect(args.populate.sites).toEqual({ name: true, domain: true })
        expect(args.populate.products).toEqual({ name: true, slug: true, sku: true, weight: true, images: true })
        expect(args.populate.users).toEqual({ email: true, firstName: true, lastName: true })
    })

    it('sends a weak ETag and 304s an unchanged page', async () => {
        // Arrange
        const first = await listOrders(request('/api/orders'), {} as never)

        // Act
        const second = await listOrders(request('/api/orders', { 'if-none-match': first.headers.get('ETag')! }), {} as never)

        // Assert
        expect(first.status).toBe(200)
        expect(second.status).toBe(304)
    })
})

describe('GET /api/orders/:id [TC-PERF-052]', () => {
    it('keeps depth 2 for item images but trims the populated tenant and site rows', async () => {
        // Arrange
        vi.clearAllMocks()
        mocks.findByID.mockResolvedValue({ id: 9 })

        // Act
        await orderDetail(request('/api/orders/9'), { params: Promise.resolve({ id: '9' }) } as never)

        // Assert
        const args = mocks.findByID.mock.calls[0][0]
        expect(args).toMatchObject({ collection: 'orders', id: '9', depth: 2, user: mockUser, overrideAccess: false })
        expect(Object.keys(args.populate.tenants).sort()).toEqual(['easyParcelIntegration', 'name', 'slug'])
        expect(args.populate.sites).toEqual({ name: true, domain: true })
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
    user: { id: 1, roles: [] as string[], tenants: [{ tenant: 7 }, { tenant: 8 }] },
    count: vi.fn(),
    find: vi.fn(),
    findByID: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: typeof state.user, request: Request, context?: unknown) => Promise<Response>) =>
        (request: Request, context?: unknown) => handler(state.user, request, context),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({ withFeatureGuard: () => (handler: unknown) => handler }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ count: state.count, find: state.find, findByID: state.findByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET as getMetrics } from '@/app/api/orders/metrics/route'
import { GET as getOrders } from '@/app/api/orders/route'
import { GET as getOrderDetail } from '@/app/api/orders/[id]/route'
import { GET as getOrderPoll } from '@/app/api/orders/[id]/poll/route'

const request = (path: string) => new Request(`http://localhost${path}`)
const detailContext = { params: Promise.resolve({ id: 'order-8' }) }

describe('[TC-GH2364-01..03] Orders dashboard primary workspace', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.user = { id: 1, roles: [], tenants: [{ tenant: 7 }, { tenant: 8 }] }
        state.count.mockResolvedValue({ totalDocs: 1 })
        state.find.mockResolvedValue({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
    })

    it('[TC-GH2364-01] counts every metrics group only in the primary tenant', async () => {
        // Arrange — the user can read tenants 7 and 8; the sidebar shows tenant 7.

        // Act
        const response = await getMetrics(request('/api/orders/metrics'), {} as never)

        // Assert
        expect(response.status).toBe(200)
        expect(state.count).toHaveBeenCalledTimes(7)
        for (const [query] of state.count.mock.calls) {
            expect(query).toMatchObject({
                collection: 'orders',
                where: { tenant: { equals: 7 } },
                user: state.user,
                overrideAccess: false,
            })
        }
    })

    it('[TC-GH2364-02] scopes filtered list and limit=0 count to the primary tenant', async () => {
        // Arrange — search uses an OR group, which must stay inside the tenant restriction.

        // Act
        const listResponse = await getOrders(request('/api/orders?status=pending&search=alice'), {} as never)
        const countResponse = await getOrders(request('/api/orders?limit=0&paymentStatus=pending_verification'), {} as never)

        // Assert
        expect(listResponse.status).toBe(200)
        expect(countResponse.status).toBe(200)
        expect(state.find).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                tenant: { equals: 7 },
                status: { in: ['pending', 'new', 'payment_failed'] },
                or: expect.arrayContaining([{ customerName: { contains: 'alice' } }]),
            }),
            user: state.user,
            overrideAccess: false,
        }))
        expect(state.count).toHaveBeenCalledWith(expect.objectContaining({
            where: { tenant: { equals: 7 }, paymentStatus: { equals: 'pending_verification' } },
            user: state.user,
            overrideAccess: false,
        }))
    })

    it('[TC-GH2364-03] refuses a direct detail URL for the second tenant', async () => {
        // Arrange
        state.findByID.mockResolvedValue({ id: 'order-8', tenant: 8, orderNumber: 'B-1' })

        // Act
        const response = await getOrderDetail(request('/api/orders/order-8'), detailContext)

        // Assert
        expect(response.status).toBe(404)
    })

    it('[TC-GH2364-03] allows detail for the primary tenant', async () => {
        // Arrange
        state.findByID.mockResolvedValue({ id: 'order-8', tenant: { id: 7 }, orderNumber: 'A-1' })

        // Act
        const response = await getOrderDetail(request('/api/orders/order-8'), detailContext)

        // Assert
        expect(response.status).toBe(200)
        expect((await response.json()).data.orderNumber).toBe('A-1')
    })

    it('[TC-GH2364-03] refuses a direct poll URL for the second tenant', async () => {
        // Arrange
        state.findByID.mockResolvedValue({ id: 'order-8', tenant: 8, updatedAt: '2026-01-01T00:00:00Z' })

        // Act
        const response = await getOrderPoll(request('/api/orders/order-8/poll'), detailContext)

        // Assert
        expect(response.status).toBe(404)
        expect(state.findByID).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({ tenant: true }),
            user: state.user,
            overrideAccess: false,
        }))
    })

    it('[TC-GH2364-03] allows polling an order in the primary tenant', async () => {
        // Arrange
        state.findByID.mockResolvedValue({ id: 'order-7', tenant: 7, updatedAt: '2026-01-01T00:00:00Z', status: 'shipped' })

        // Act
        const response = await getOrderPoll(request('/api/orders/order-7/poll'), { params: Promise.resolve({ id: 'order-7' }) })

        // Assert
        expect(response.status).toBe(200)
        expect((await response.json()).data).toMatchObject({ updatedAt: '2026-01-01T00:00:00Z', status: 'shipped' })
    })

    it('[TC-GH2364-03] scopes a super-admin who has a primary workspace', async () => {
        // Arrange — platform role does not make the dashboard an all-shops view.
        state.user = { id: 1, roles: ['super-admin'], tenants: [{ tenant: 7 }, { tenant: 8 }] }

        // Act
        const response = await getMetrics(request('/api/orders/metrics'), {} as never)

        // Assert
        expect(response.status).toBe(200)
        expect(state.count).toHaveBeenCalledTimes(7)
        for (const [query] of state.count.mock.calls) {
            expect(query.where.tenant).toEqual({ equals: 7 })
        }
    })

    it('[TC-GH2364-03] does not show all shops to a super-admin without a workspace', async () => {
        // Arrange
        state.user = { id: 1, roles: ['super-admin'], tenants: [] }

        // Act
        const responses = await Promise.all([
            getMetrics(request('/api/orders/metrics'), {} as never),
            getOrders(request('/api/orders'), {} as never),
            getOrderDetail(request('/api/orders/order-8'), detailContext),
            getOrderPoll(request('/api/orders/order-8/poll'), detailContext),
        ])

        // Assert
        expect(responses.map(response => response.status)).toEqual([403, 403, 403, 403])
        for (const response of responses) {
            expect((await response.json()).error.code).toBe('NO_WORKSPACE')
        }
        expect(state.count).not.toHaveBeenCalled()
        expect(state.find).not.toHaveBeenCalled()
        expect(state.findByID).not.toHaveBeenCalled()
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/notifications/route'
import { POST } from '@/app/api/notifications/mark-read/route'
import { NextRequest } from 'next/server'

// Mock payload
vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        find: vi.fn().mockResolvedValue({
            docs: [{ id: 1, isRead: false }, {id: 2, isRead: false}],
            totalDocs: 2,
            totalPages: 1,
            page: 1,
            limit: 20
        }),
        update: vi.fn().mockResolvedValue({ id: 1, isRead: true })
    }),
}))

vi.mock('@/payload.config', () => ({ default: {} }))

// Mock auth middleware
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: unknown) => async (request: unknown, ...args: unknown[]) => {
        const fakeUser = { id: 100, tenants: [{ tenant: 200 }] }
        if (typeof handler === 'function') {
            return handler(fakeUser, request, ...args)
        }
    },
    getCurrentUser: vi.fn().mockResolvedValue({ id: 100, tenants: [{ tenant: 200 }] })
}))

function createRequest(url: string, method = 'GET', body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
        method,
        body: body ? JSON.stringify(body) : undefined,
    })
}

describe('/api/notifications', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('GET /api/notifications', () => {
        it('returns paginated notifications with total unread count', async () => {
            const res = await GET(createRequest('/api/notifications?page=1&limit=10'))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.items).toHaveLength(2)
            expect(body.unreadCount).toBe(2)
        })

        it('returns 500 when payload fails', async () => {
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                find: vi.fn().mockRejectedValue(new Error('DB Error')),
            } as any)

            const res = await GET(createRequest('/api/notifications'))
            expect(res.status).toBe(500)
        })
    })

    describe('POST /api/notifications/mark-read', () => {
        it('returns 400 if payload is invalid', async () => {
            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', {
                // missing mark_all and notificationIds
            }))
            const body = await res.json()
            expect(res.status).toBe(400)
            expect(body.success).toBe(false)
        })

        it('handles specific notificationIds', async () => {
            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', {
                notificationIds: ['1', '2']
            }))
            const body = await res.json()
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.updated).toBe(2)
        })

        it('handles bulk marking all as read', async () => {
            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', {
                mark_all: true
            }))
            const body = await res.json()
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
        })

        it('returns 500 on internal failure', async () => {
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                find: vi.fn().mockRejectedValue(new Error('DB Bulk Error')),
            } as any)

            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', {
                mark_all: true
            }))
            
            expect(res.status).toBe(500)
        })
    })
})

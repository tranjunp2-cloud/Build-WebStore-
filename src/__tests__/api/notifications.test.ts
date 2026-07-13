import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/notifications/route'
import { POST } from '@/app/api/notifications/mark-read/route'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { PgDialect } from 'drizzle-orm/pg-core'

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
        update: vi.fn().mockResolvedValue({ id: 1, isRead: true }),
        // mark-read now uses a single batched raw UPDATE via payload.db.drizzle (GH #1535)
        db: { drizzle: { execute: vi.fn().mockResolvedValue({ rowCount: 2 }) } },
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

// Mock rate limiter
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
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
            } as unknown as Payload)

            const res = await GET(createRequest('/api/notifications'))
            expect(res.status).toBe(500)
        })

        // ── GH#1519 regression tests: since parameter + NotFound handling ────────

        it('TC-GH1519-02a: returns 200 when since parameter is missing', async () => {
            // Arrange
            const res = await GET(createRequest('/api/notifications'))

            // Assert
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body).toHaveProperty('unreadCount')
            expect(body).toHaveProperty('items')
        })

        it('TC-GH1519-02b: returns 200 when since is valid ISO string', async () => {
            // Arrange
            const since = encodeURIComponent('2026-07-10T10:00:00Z')
            const res = await GET(createRequest(`/api/notifications?since=${since}`))

            // Assert
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body).toHaveProperty('items')
        })

        it('TC-GH1519-02c: returns 200 when since is epoch milliseconds', async () => {
            // Arrange
            const res = await GET(createRequest('/api/notifications?since=1720704000000'))

            // Assert
            expect(res.status).toBe(200)
        })

        it('TC-GH1519-02d: returns 400 when since is unparseable date string', async () => {
            // Arrange
            const res = await GET(createRequest('/api/notifications?since=not-a-date'))

            // Assert
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.success).toBe(false)
            expect(body.error.code).toBe('INVALID_SINCE')
        })

        it('TC-GH1519-02e: returns 400 when since is malformed (99-99-99)', async () => {
            // Arrange
            const res = await GET(createRequest('/api/notifications?since=99-99-99'))

            // Assert
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error.code).toBe('INVALID_SINCE')
        })

        it('TC-GH1519-02f: returns 200 (not 500) when limit/offset are non-numeric', async () => {
            // Arrange — fuzzed bad pagination input must coerce to safe defaults,
            // not flow into payload.find as NaN and 500 (GH #1519 bug class).
            const res = await GET(createRequest('/api/notifications?limit=abc&offset=xyz'))

            // Assert
            expect(res.status).toBe(200)
        })

        it('TC-GH1519-02g: returns 404 when Payload throws NotFound error', async () => {
            // Arrange
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                find: vi.fn().mockRejectedValue({
                    name: 'NotFound',
                    message: 'Notifications collection not found',
                }),
            } as unknown as Payload)

            // Act
            const res = await GET(createRequest('/api/notifications'))

            // Assert
            expect(res.status).toBe(404)
            const body = await res.json()
            expect(body.error.code).toBe('NOT_FOUND')
        })

        it('TC-GH1519-02h: returns 404 when NotFoundError variant is thrown', async () => {
            // Arrange
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                find: vi.fn().mockRejectedValue({
                    name: 'NotFoundError',
                    message: 'Document not found',
                }),
            } as unknown as Payload)

            // Act
            const res = await GET(createRequest('/api/notifications'))

            // Assert
            expect(res.status).toBe(404)
        })

        it('TC-GH1519-02i: returns 404 when error.status is 404', async () => {
            // Arrange
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                find: vi.fn().mockRejectedValue({
                    status: 404,
                    message: 'Not found',
                }),
            } as unknown as Payload)

            // Act
            const res = await GET(createRequest('/api/notifications'))

            // Assert
            expect(res.status).toBe(404)
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

        it('TC-GH1535-02a: mark_all UPDATE is scoped to caller user_id + tenant_id (no IDOR)', async () => {
            // The raw batched UPDATE bypasses Payload access control, so the WHERE MUST
            // pin the caller's own rows. Capture the executed query and assert the bound
            // params carry the fake user's id (100) and tenant (200). Guards against a
            // future regression that drops the ownership clause. (GH #1535 Bug 2)
            const { getPayload } = await import('payload')
            const captured: unknown[] = []
            vi.mocked(getPayload).mockResolvedValueOnce({
                db: { drizzle: { execute: vi.fn(async (q: unknown) => { captured.push(q); return { rowCount: 3 } }) } },
            } as unknown as Payload)

            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', { mark_all: true }))
            expect(res.status).toBe(200)

            const { params } = new PgDialect().sqlToQuery(captured[0] as never)
            expect(params).toContain(100) // user_id
            expect(params).toContain(200) // tenant_id
        })

        it('TC-GH1535-02b: notificationIds UPDATE also enforces user_id + tenant_id ownership', async () => {
            const { getPayload } = await import('payload')
            const captured: unknown[] = []
            vi.mocked(getPayload).mockResolvedValueOnce({
                db: { drizzle: { execute: vi.fn(async (q: unknown) => { captured.push(q); return { rowCount: 2 } }) } },
            } as unknown as Payload)

            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', { notificationIds: ['1', '2'] }))
            expect(res.status).toBe(200)

            const { params } = new PgDialect().sqlToQuery(captured[0] as never)
            expect(params).toContain('{1,2}') // id list as integer[] literal
            expect(params).toContain(100)     // user_id
            expect(params).toContain(200)     // tenant_id
        })

        it('returns 500 on internal failure', async () => {
            const { getPayload } = await import('payload')
            vi.mocked(getPayload).mockResolvedValueOnce({
                db: { drizzle: { execute: vi.fn().mockRejectedValue(new Error('DB Bulk Error')) } },
            } as unknown as Payload)

            const res = await POST(createRequest('/api/notifications/mark-read', 'POST', {
                mark_all: true
            }))
            
            expect(res.status).toBe(500)
        })
    })
})

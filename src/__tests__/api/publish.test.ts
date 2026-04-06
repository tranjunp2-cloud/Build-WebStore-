import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH as PublishPATCH, DELETE as UnpublishDELETE } from '@/app/api/sites/[siteId]/publish/route'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// ── Auth mock (toggle via mockAuthUser) ──────────────────────────────────────
let mockAuthUser: any = {
    id: 'user-1',
    email: 'owner@example.com',
    tenants: [{ tenant: 'tenant-1' }],
}

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => mockAuthUser),
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => handler(mockAuthUser, req, ctx)
    }),
}))

vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }),
}))

// ── Payload mock (stateful site DB) ─────────────────────────────────────────
let mockSiteRecord: any = {
    id: 'site-123',
    name: 'My Coffee Site',
    status: 'draft',
    tenant: 'tenant-1',
    publishedAt: null,
}

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => ({
        findByID: vi.fn().mockImplementation(async ({ collection, id, depth }) => {
            if (collection === 'sites' && id === mockSiteRecord.id) {
                // depth=1 call returns tenant as an object (for slug resolution)
                if (depth === 1) {
                    return {
                        ...mockSiteRecord,
                        tenant: { id: 'tenant-1', slug: 'coffee-shop' },
                    }
                }
                return mockSiteRecord
            }
            return null
        }),
        update: vi.fn().mockImplementation(async ({ collection, id, data }) => {
            if (collection === 'sites' && id === mockSiteRecord.id) {
                mockSiteRecord = { ...mockSiteRecord, ...data }
                return mockSiteRecord
            }
            return null
        }),
    })),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
const makePatchReq = (siteId: string) =>
    new NextRequest(`http://localhost:3000/api/sites/${siteId}/publish`, { method: 'PATCH' })

const makeDeleteReq = (siteId: string) =>
    new NextRequest(`http://localhost:3000/api/sites/${siteId}/publish`, { method: 'DELETE' })

// ── TC-F01-publish: /api/sites/[siteId]/publish ───────────────────────────────
describe('[TC-F01-publish] PATCH /api/sites/[siteId]/publish', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
        mockSiteRecord = {
            id: 'site-123',
            name: 'My Coffee Site',
            status: 'draft',
            tenant: 'tenant-1',
            publishedAt: null,
        }
    })

    // ── Publish (PATCH) ──────────────────────────────────────────────────────

    it('TC-F01-pub-01: publishes site successfully (draft → published)', async () => {
        // Arrange
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.status).toBe('published')
        expect(body.data.publishedAt).toBeTruthy()
    })

    it('TC-F01-pub-02: allows re-publish (published → published, no 409)', async () => {
        // Arrange — site already published
        mockSiteRecord.status = 'published'
        mockSiteRecord.publishedAt = '2026-01-01T00:00:00.000Z'
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert — must succeed, not return 409
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.status).toBe('published')
    })

    it('TC-F01-pub-03: returns domain URL with tenant slug', async () => {
        // Arrange
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data.url).toMatch(/^https:\/\//)
        expect(body.data.domain).toContain('.primeweb.app')
        expect(body.data.domain).toContain('coffee-shop')
    })

    it('TC-F01-pub-04: returns 401 when user is not authenticated', async () => {
        // Arrange — no authenticated user
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('AUTH_REQUIRED')
    })

    it('TC-F01-pub-05: returns 403 when site belongs to different tenant', async () => {
        // Arrange — user belongs to tenant-1 but site belongs to tenant-99
        mockSiteRecord.tenant = 'tenant-99'
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('TC-F01-pub-06: returns 403 when site tenant is null (orphan site)', async () => {
        // Arrange — site has no tenant (regression: typeof null === 'object' used to throw 500)
        mockSiteRecord.tenant = null
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert — must be 403, not 500
        expect(res.status).toBe(403)
        expect(body.success).toBe(false)
    })

    it('TC-F01-pub-07: returns 404 when site does not exist', async () => {
        // Arrange — requesting a non-existent site
        const { getPayload } = await import('payload')
        // @ts-ignore
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockResolvedValue(null),
        })
        const req = makePatchReq('site-does-not-exist')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-does-not-exist' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('NOT_FOUND')
    })
})

// ── TC-F01-unpublish: DELETE /api/sites/[siteId]/publish ─────────────────────
describe('[TC-F01-unpublish] DELETE /api/sites/[siteId]/publish', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
        mockSiteRecord = {
            id: 'site-123',
            name: 'My Coffee Site',
            status: 'published',
            tenant: 'tenant-1',
            publishedAt: '2026-01-15T10:00:00.000Z',
        }
    })

    it('TC-F01-unp-01: unpublishes site successfully (published → draft)', async () => {
        // Arrange
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.data.status).toBe('draft')
    })

    it('TC-F01-unp-02: returns 401 when user is not authenticated', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValueOnce(null)
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(401)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('AUTH_REQUIRED')
    })

    it('TC-F01-unp-03: returns 403 when site belongs to different tenant', async () => {
        // Arrange
        mockSiteRecord.tenant = 'tenant-99'
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('TC-F01-unp-04: returns 409 when site is not published (cannot unpublish a draft)', async () => {
        // Arrange — site is already draft
        mockSiteRecord.status = 'draft'
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(409)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('NOT_PUBLISHED')
    })

    it('TC-F01-unp-05: returns 404 when site does not exist', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        // @ts-ignore
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockResolvedValue(null),
        })
        const req = makeDeleteReq('site-does-not-exist')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-does-not-exist' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(404)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('TC-F01-unp-06: response only contains id, name, status (no publishedAt or URL)', async () => {
        // Arrange
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.data).toHaveProperty('id')
        expect(body.data).toHaveProperty('name')
        expect(body.data).toHaveProperty('status', 'draft')
        expect(body.data).not.toHaveProperty('url')
        expect(body.data).not.toHaveProperty('domain')
    })
})

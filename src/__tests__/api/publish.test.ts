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
        find: vi.fn().mockImplementation(async () => ({
            docs: [
                { id: 'page-1', layout: [{ blockType: 'hero', headline: 'Hello' }] },
            ],
        })),
        update: vi.fn().mockImplementation(async ({ collection, id, data }) => {
            if (collection === 'sites' && id === mockSiteRecord.id) {
                mockSiteRecord = { ...mockSiteRecord, ...data }
                return mockSiteRecord
            }
            return { id, ...data }
        }),
    })),
}))

// ── Rate limiter mock (added by PR #589 review fixes) ───────────────────────
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
    checkTwoTierRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
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
        vi.stubEnv('NEXT_PUBLIC_PLATFORM_DOMAIN', 'primeweb.app')
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

    it('TC-F01-pub-09: promotes draft pages with depth:0 and draft:false so new pages go live after Update', async () => {
        // Regression: new page stayed "draft" after user clicked Update because
        // populated relationships (default depth=2) + unstripped version fields
        // (_versionID, _currentVersionId) caused payload.update to silently
        // drop the promotion for freshly-created draft pages.
        const { getPayload } = await import('payload')
        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: 'page-new', _status: 'draft', _versionID: 'v1', site: 'site-123', layout: [] },
            ],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id, data }) => {
            if (collection === 'sites') {
                mockSiteRecord = { ...mockSiteRecord, ...data }
                return mockSiteRecord
            }
            return { id, ...data }
        })
        // @ts-ignore
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockImplementation(async ({ collection, id, depth }) => {
                if (collection === 'sites' && id === mockSiteRecord.id) {
                    if (depth === 1) return { ...mockSiteRecord, tenant: { id: 'tenant-1', slug: 'coffee-shop' } }
                    return mockSiteRecord
                }
                return null
            }),
            find: findSpy,
            update: updateSpy,
        })

        const req = makePatchReq('site-123')
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        expect(res.status).toBe(200)

        // find must use depth:0 so relationships come back as IDs, not populated objects
        expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            depth: 0,
            draft: true,
        }))

        // update for each page must pass draft:false, strip version fields, and
        // explicitly set _status:'published' (Payload 3.79 bug — update with
        // draft:false doesn't flip _status on main row on its own)
        const pageUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'pages' && c[0].id === 'page-new')
        expect(pageUpdate).toBeTruthy()
        expect(pageUpdate![0].draft).toBe(false)
        expect(pageUpdate![0].data._status).toBe('published')
        expect(pageUpdate![0].data).not.toHaveProperty('_versionID')
        expect(pageUpdate![0].data).not.toHaveProperty('_currentVersionId')
    })

    it('TC-F01-pub-10: surfaces Payload ValidationError in failures[] so user can diagnose missing required fields', async () => {
        // Regression: page with an industry block (doctor-profile, property-card,
        // class-schedule, etc.) whose nested required array row was seeded empty
        // used to fail publish with an opaque {pageId:"793"} in failures[] —
        // no errName, no errMsg, no validationErrors. That's because Payload's
        // ValidationError has no .cause (unlike Drizzle-wrapped pg errors),
        // so the old catch-block hit undefined on every extracted field.
        const { getPayload } = await import('payload')

        class FakeValidationError extends Error {
            data: { collection?: string; errors: Array<{ path: string; message: string }> }
            constructor() {
                super('The following fields are invalid: doctors.0.name')
                this.name = 'ValidationError'
                this.data = {
                    collection: 'pages',
                    errors: [
                        { path: 'layout.2.doctors.0.name', message: 'This field is required.' },
                    ],
                }
            }
        }

        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: 'page-793', _status: 'draft', site: 'site-123', layout: [{ blockType: 'doctor-profile', doctors: [{}] }] },
            ],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id }) => {
            if (collection === 'pages' && id === 'page-793') {
                throw new FakeValidationError()
            }
            return { id }
        })
        // @ts-ignore
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'sites' && id === mockSiteRecord.id) return mockSiteRecord
                return null
            }),
            find: findSpy,
            update: updateSpy,
        })

        const req = makePatchReq('site-123')
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('PARTIAL_PUBLISH_FAILURE')
        expect(body.error.failedPages).toEqual(['page-793'])
        expect(body.error.failures).toHaveLength(1)

        const failure = body.error.failures[0]
        expect(failure.pageId).toBe('page-793')
        expect(failure.errName).toBe('ValidationError')
        expect(failure.errMsg).toContain('doctors.0.name')
        expect(failure.validationErrors).toEqual([
            { path: 'layout.2.doctors.0.name', message: 'This field is required.' },
        ])
    })

    it('TC-F01-pub-11: surfaces generic errors without .cause in failures[] (errName + errMsg always present)', async () => {
        // Sister-case to TC-F01-pub-10 — a plain TypeError (no .cause, no
        // .data.errors) still needs to return something actionable, not an
        // opaque {pageId} blob.
        const { getPayload } = await import('payload')
        const findSpy = vi.fn().mockResolvedValue({
            docs: [{ id: 'page-99', _status: 'draft', site: 'site-123', layout: [] }],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection }) => {
            if (collection === 'pages') {
                throw new TypeError("Cannot read properties of undefined (reading 'foo')")
            }
            return {}
        })
        // @ts-ignore
        vi.mocked(getPayload).mockResolvedValueOnce({
            findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
                if (collection === 'sites' && id === mockSiteRecord.id) return mockSiteRecord
                return null
            }),
            find: findSpy,
            update: updateSpy,
        })

        const req = makePatchReq('site-123')
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        expect(res.status).toBe(500)
        const failure = body.error.failures[0]
        expect(failure.errName).toBe('TypeError')
        expect(failure.errMsg).toContain("Cannot read properties of undefined")
        expect(failure.validationErrors).toBeUndefined()
    })

    it('TC-F01-pub-08: returns 429 when publish rate limit exceeded', async () => {
        // Arrange
        const resetAt = Date.now() + 60000
        vi.mocked(checkTwoTierRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt })
        const req = makePatchReq('site-123')

        // Act
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(429)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(body.retryAfter).toBeGreaterThan(0)
        expect(res.headers.get('Retry-After')).toBeTruthy()
        expect(checkTwoTierRateLimit).toHaveBeenCalledWith('publish:user-1', 5, 30)
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

    it('TC-F01-unp-07: returns 429 when unpublish rate limit exceeded', async () => {
        // Arrange
        const resetAt = Date.now() + 60000
        vi.mocked(checkTwoTierRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt })
        const req = makeDeleteReq('site-123')

        // Act
        const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(429)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(body.retryAfter).toBeGreaterThan(0)
        expect(res.headers.get('Retry-After')).toBeTruthy()
        expect(checkTwoTierRateLimit).toHaveBeenCalledWith('unpublish:user-1', 5, 30)
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const CURRENT_REVISION = 'a'.repeat(64)
const EXPECTED_UPDATED_AT = '2026-08-05T02:00:00.000Z'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = {
    id: 1,
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1', status: 'active' }],
}
type AuthHandler = (
    user: typeof mockUser,
    request: Request,
    context?: unknown,
) => unknown
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn(
        (handler: AuthHandler) => async (req: Request, ctx?: unknown) =>
            handler(mockUser, req, ctx),
    ),
}))

const mockFindByID = vi.fn()
const mockFind = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() =>
        Promise.resolve({
            findByID: mockFindByID,
            find: mockFind,
            update: mockUpdate,
        }),
    ),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(
        () =>
            <T>(handler: T): T =>
                handler,
    ),
}))

const mockCheckTwoTierRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 })
vi.mock('@/lib/rateLimit', () => ({
    checkTwoTierRateLimit: (...args: unknown[]) => mockCheckTwoTierRateLimit(...args),
}))

const mockEvaluateAuthoritativeLocalSeo = vi.fn().mockResolvedValue({
    response: { revisionToken: CURRENT_REVISION },
    metadataItems: [
        {
            collection: 'products',
            id: 'prod-1',
            missingFields: ['title', 'description'],
        },
        {
            collection: 'blogs',
            id: 'blog-1',
            missingFields: ['title', 'description'],
        },
        {
            collection: 'blogs',
            id: 'blog-2',
            missingFields: ['title', 'description'],
        },
    ],
})
vi.mock('@/lib/seo/local-seo-evaluation', () => ({
    evaluateAuthoritativeLocalSeo: (...args: unknown[]) =>
        mockEvaluateAuthoritativeLocalSeo(...args),
}))

import { POST as applyFixesPOST } from '@/app/api/seo/apply-fixes/route'
import { POST as sitemapPOST } from '@/app/api/seo/sitemap/route'

// ─── TC-F03.30: Sitemap XML generation ────────────────────────────────
// ─── TC-F03.36: SEO character trimming ────────────────────────────────
// ─── TC-F19.38: IDOR prevention in SEO fixes ─────────────────────────

describe('POST /api/seo/apply-fixes [TC-F03.36, TC-F19.38]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.PAYLOAD_SECRET = 'seo-routes-test-secret'
        mockUser.roles = []
    })

    it('applies SEO fixes and returns undo data', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            site: 'prod-1',
            tenant: 'tenant-1',
            updatedAt: EXPECTED_UPDATED_AT,
            seo: { title: 'Old Title', description: 'Old Desc' },
        })
        mockUpdate.mockResolvedValue({ docs: [{ id: 'prod-1' }], errors: [] })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'prod-1',
                            collection: 'products',
                            seo: { title: 'New SEO Title' },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.undoData).toHaveLength(1)
        expect(body.undoData[0].seo.title).toBe('Old Title')
    })

    it('rejects cross-tenant fix attempt [TC-F19.38]', async () => {
        // Arrange — product belongs to different tenant
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            site: 'prod-1',
            tenant: 'other-tenant',
            seo: {},
        })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'prod-1',
                            collection: 'products',
                            seo: { title: 'Hack' },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)

        // Assert
        expect(res.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('allows super-admin to bypass IDOR', async () => {
        // Arrange
        mockUser.roles = ['super-admin']
        mockFindByID.mockResolvedValue({
            id: 'prod-1',
            site: 'prod-1',
            tenant: 'any-tenant',
            updatedAt: EXPECTED_UPDATED_AT,
            seo: { title: 'Old' },
        })
        mockUpdate.mockResolvedValue({ docs: [{ id: 'prod-1' }], errors: [] })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'prod-1',
                            collection: 'products',
                            seo: { title: 'Admin Fix' },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
    })

    // Route context unused by handler — `{} as never` follows existing test pattern (lines 58, 85, 111)
    it('maps blog fields metaTitle/metaDescription on apply [TC-F03.40]', async () => {
        // Arrange — blog uses seo.metaTitle / seo.metaDescription
        mockFindByID.mockResolvedValue({
            id: 'blog-1',
            site: 'blog-1',
            tenant: 'tenant-1',
            updatedAt: EXPECTED_UPDATED_AT,
            seo: {
                metaTitle: 'Old Blog Title',
                metaDescription: 'Old blog desc',
            },
        })
        mockUpdate.mockResolvedValue({ docs: [{ id: 'blog-1' }], errors: [] })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'blog-1',
                            collection: 'blogs',
                            seo: {
                                title: 'New Blog SEO Title',
                                description: 'New blog SEO desc',
                            },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)
        const body = await res.json()

        // Assert — should write metaTitle/metaDescription, not title/description
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                data: {
                    seo: expect.objectContaining({
                        metaTitle: 'New Blog SEO Title',
                        metaDescription: 'New blog SEO desc',
                    }),
                },
            }),
        )
        // Undo data should map back to generic title/description
        expect(body.undoData[0].seo.title).toBe('Old Blog Title')
        expect(body.undoData[0].seo.description).toBe('Old blog desc')
    })

    it('blog undo returns empty string when no existing meta [TC-F03.40]', async () => {
        // Arrange — blog with no existing SEO
        mockFindByID.mockResolvedValue({
            id: 'blog-2',
            site: 'blog-2',
            tenant: 'tenant-1',
            updatedAt: EXPECTED_UPDATED_AT,
            seo: {},
        })
        mockUpdate.mockResolvedValue({ docs: [{ id: 'blog-2' }], errors: [] })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'blog-2',
                            collection: 'blogs',
                            seo: { title: 'Brand New Title' },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.undoData[0].seo.title).toBe('')
        expect(body.undoData[0].seo.description).toBe('')
    })

    it('rejects cross-tenant blog fix [TC-F19.38]', async () => {
        // Arrange — blog belongs to different tenant
        mockFindByID.mockResolvedValue({
            id: 'blog-1',
            site: 'blog-1',
            tenant: 'other-tenant',
            seo: {},
        })

        // Act
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: [
                        {
                            targetId: 'blog-1',
                            collection: 'blogs',
                            seo: { title: 'Hack' },
                        },
                    ],
                }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)

        // Assert
        expect(res.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects more than 100 fixes in one apply batch', async () => {
        const req = {
            json: () =>
                Promise.resolve({
                    operation: 'apply',
                    siteId: 'site-1',
                    revisionToken: CURRENT_REVISION,
                    fixes: Array.from({ length: 101 }, (_, index) => ({
                        targetId: String(index),
                        collection: 'pages',
                        seo: { title: 'Title ' + index },
                    })),
                }),
        } as unknown as Request

        const res = await applyFixesPOST(req, {} as never)

        expect(res.status).toBe(400)
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid schema', async () => {
        // Act — missing required fields
        const req = {
            json: () => Promise.resolve({ fixes: 'not-an-array' }),
        } as unknown as Request
        const res = await applyFixesPOST(req, {} as never)

        // Assert
        expect(res.status).toBe(400)
    })
})

describe('POST /api/seo/sitemap [TC-F03.30]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('generates sitemap XML with published pages', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            domain: 'mycafe.com',
            slug: 'mycafe',
        })
        mockFind.mockResolvedValue({
            docs: [
                { slug: 'home', updatedAt: '2026-03-01T00:00:00Z' },
                { slug: 'about', updatedAt: '2026-03-02T00:00:00Z' },
            ],
        })

        // Act
        const req = {
            json: () => Promise.resolve({ siteId: 'site-1' }),
        } as unknown as Request
        const res = await sitemapPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.success).toBe(true)
        expect(body.data.xml).toContain('<?xml version="1.0"')
        expect(body.data.xml).toContain('https://mycafe.com')
        expect(body.data.pageCount).toBe(2)
    })

    it('home page gets priority 1.0, others get 0.8', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', tenant: 'tenant-1', domain: 'test.com' })
        mockFind.mockResolvedValue({
            docs: [
                { slug: 'home', updatedAt: '2026-03-01T00:00:00Z' },
                { slug: 'products', updatedAt: '2026-03-01T00:00:00Z' },
            ],
        })

        // Act
        const req = {
            json: () => Promise.resolve({ siteId: 'site-1' }),
        } as unknown as Request
        const res = await sitemapPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.data.xml).toContain('<priority>1.0</priority>')
        expect(body.data.xml).toContain('<priority>0.8</priority>')
    })

    it('normalizes home slug to empty path', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', tenant: 'tenant-1', domain: 'test.com' })
        mockFind.mockResolvedValue({
            docs: [{ slug: 'home', updatedAt: '2026-03-01T00:00:00Z' }],
        })

        // Act
        const req = {
            json: () => Promise.resolve({ siteId: 'site-1' }),
        } as unknown as Request
        const res = await sitemapPOST(req, {} as never)
        const body = await res.json()

        // Assert — home should be https://test.com (not /home)
        expect(body.data.xml).toContain('<loc>https://test.com</loc>')
        expect(body.data.xml).not.toContain('/home')
    })

    it('returns 404 when site not found', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        // Act
        const req = {
            json: () => Promise.resolve({ siteId: 'bad' }),
        } as unknown as Request
        const res = await sitemapPOST(req, {} as never)

        // Assert
        expect(res.status).toBe(404)
    })

    it('falls back to server URL when no custom domain', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({ id: 'site-1', tenant: 'tenant-1', slug: 'mysite' })
        mockFind.mockResolvedValue({ docs: [] })
        process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.primeweb.com'

        // Act
        const req = {
            json: () => Promise.resolve({ siteId: 'site-1' }),
        } as unknown as Request
        const res = await sitemapPOST(req, {} as never)
        const body = await res.json()

        // Assert
        expect(body.data.sitemapUrl).toContain('app.primeweb.com/sites/mysite')
    })
})

describe('POST /api/seo/sitemap — another tenant\'s site [TC-PERF-138]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('403s without listing the other shop\'s pages', async () => {
        // Arrange
        mockUser.roles = []
        mockFindByID.mockResolvedValue({ id: 'site-9', tenant: 'tenant-9', slug: 'other' })
        const req = new Request('http://localhost/api/seo/sitemap', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: 'site-9' }),
        })

        // Act
        const res = await sitemapPOST(req, {} as never)

        // Assert
        expect(res.status).toBe(403)
        expect(mockFind).not.toHaveBeenCalled()
    })
})

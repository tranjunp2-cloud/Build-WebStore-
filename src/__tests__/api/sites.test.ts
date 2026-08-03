import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH as SavePATCH } from '@/app/api/sites/[siteId]/save/route'
import { PATCH as PublishPATCH, DELETE as UnpublishDELETE } from '@/app/api/sites/[siteId]/publish/route'
import { GET as EditorDataGET } from '@/app/api/sites/[siteId]/editor-data/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription } from '@/lib/subscriptions/plan-subscription'
import { checkRateLimit } from '@/lib/rateLimit'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => {
    const user = { id: 'user-1', email: 'admin@example.com', tenants: [{ tenant: 'tenant-1' }] }
    return {
        // vi.mock factory runs before imports — types unavailable, use unknown
        withAuth: vi.fn().mockImplementation((handler: unknown) => {
            return async (req: unknown, ctx: unknown) => (handler as Function)(user, req, ctx)
        }),
        getCurrentUser: vi.fn().mockResolvedValue(user),
    }
})

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({
        allowed: true, remaining: 59, resetAt: Date.now() + 60_000,
    }),
    checkTwoTierRateLimit: vi.fn().mockResolvedValue({
        allowed: true, remaining: 59, resetAt: Date.now() + 60_000,
    }),
}))

// Mock cookies từ next/headers
vi.mock('next/headers', () => {
    return {
        cookies: vi.fn().mockResolvedValue({
            get: vi.fn().mockImplementation((name) => {
                if (name === 'payload-token') return { value: 'mock-valid-token' }
                return undefined
            })
        })
    }
})

// Mock Payload CMS Database và Auth function
vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            auth: vi.fn().mockImplementation(async ({ headers }) => {
                const token = headers.get('Authorization')
                // Nếu header auth hợp lệ (mocked ở trên) -> Cho phép user đi tiếp
                if (token === 'JWT mock-valid-token') {
                    return { user: { id: 'user-1', email: 'admin@example.com', tenants: [{ tenant: 'tenant-1' }] } }
                }
                return { user: null }
            }),
            findByID: vi.fn().mockResolvedValue({ id: 'site-123', status: 'draft', tenant: 'tenant-1' }),
            find: vi.fn().mockResolvedValue({
                docs: [
                    { id: 'page-home', isHomepage: true, layout: [] }
                ]
            }),
            update: vi.fn().mockResolvedValue({ id: 'site-123' })
        })
    }
})

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
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

describe('Sites APIs', () => {

    describe('PATCH /api/sites/[siteId]/save', () => {
        
        // Mock clear các giá trị cũ sau mỗi test
        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('returns 401 Unauthorized if token is missing or invalid', async () => {
             // Routes now use getCurrentUser() — mock it to return null for 401 test
             vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

             const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                 method: 'PATCH',
                 body: JSON.stringify({ blocks: [{ blockType: 'hero' }] })
             })

             // Gọi API handler với Dynamic params { siteId: '123' }
             const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })

             expect(res.status).toBe(401)
        })

        it('returns 200 and updates blocks if valid token is provided', async () => {
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({ blocks: [{ blockType: 'hero', headline: 'Updated Hero' }] })
            })
            
            // Giả lập Promise.resolve cho params theo chuẩn App Router v15
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            const result = await res.json()
            
            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.message).toBe('Saved successfully')
        })

        it('returns 200 and updates locale and shippingConfig', async () => {
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({ 
                    locale: 'ms',
                    shippingConfig: { westRate: 1000, eastRate: 2000, freeAbove: 5000 }
                })
            })
            
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            const result = await res.json()
            
            expect(res.status).toBe(200)
            expect(result.success).toBe(true)
            
            // Verify payload.update was called with the correct data
            const { getPayload } = await import('payload')
            const payload = await getPayload({ config: {} as any })
            expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'sites',
                id: '123',
                data: expect.objectContaining({
                    locale: 'ms',
                    shippingConfig: { westRate: 1000, eastRate: 2000, freeAbove: 5000 }
                })
            }))
        })

        it('[TC-F37-01-28] rejects cross-tenant Minimal Business Data before persistence', async () => {
            // Arrange
            const payload = await getPayload({ config: {} as never })
            vi.mocked(payload.findByID).mockResolvedValueOnce({
                id: 'site-123',
                status: 'draft',
                tenant: 'tenant-2',
            } as never)
            const req = new NextRequest('http://localhost:3000/api/sites/site-123/save', {
                method: 'PATCH',
                body: JSON.stringify({
                    siteName: 'Kedai Tenant Dua',
                    contactInfo: { phone: '+60 12-345 6789' },
                    localBusiness: {
                        streetAddress: '12 Jalan Ampang',
                        city: 'Kuala Lumpur',
                        postcode: '50450',
                        country: 'MY',
                    },
                }),
                headers: { 'Content-Type': 'application/json' },
            })

            // Act
            const res = await SavePATCH(req, {
                params: Promise.resolve({ siteId: 'site-123' }),
            })
            const result = await res.json()

            // Assert
            expect(res.status).toBe(403)
            expect(result).toEqual({ error: 'Forbidden' })
            expect(checkRateLimit).toHaveBeenCalledWith('save:user-1', 60, 60_000)
            expect(payload.update).not.toHaveBeenCalled()
            expect(getActivePlanSubscription).not.toHaveBeenCalled()
        })

        it('allows saving header navigation with empty destination (draft link)', async () => {
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({
                    headerBlock: {
                        blockType: 'navigation',
                        links: [{ label: 'About', url: '' }],
                    },
                })
            })

            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
        })

        it('returns 400 when header navigation contains a protocol-relative URL', async () => {
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({
                    headerBlock: {
                        blockType: 'navigation',
                        links: [{ label: 'Evil', url: '//evil.com', type: 'external' }],
                    },
                })
            })

            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(400)
        })

        it('[TC-F37-02-31] rejects a sparse category patch that conflicts with persisted subtype and performs zero writes', async () => {
            // Arrange
            const update = vi.fn()
            const payload = {
                findByID: vi.fn().mockResolvedValue({
                    id: '123', tenant: 'tenant-1',
                    localBusiness: { businessCategory: 'foodEstablishment', schemaSubtype: 'Bakery', city: 'Petaling Jaya' },
                }),
                update,
            }
            vi.mocked(getPayload).mockResolvedValueOnce(payload as unknown as Awaited<ReturnType<typeof getPayload>>)
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH', body: JSON.stringify({ localBusiness: { businessCategory: 'store' } }),
            })

            // Act
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })

            // Assert
            expect(res.status).toBe(400)
            expect(await res.json()).toMatchObject({ error: 'Invalid local business data' })
            expect(update).not.toHaveBeenCalled()
        })

        it('[TC-F37-02-31] validates and persists one merged effective group for a valid sparse patch', async () => {
            // Arrange
            const update = vi.fn().mockResolvedValue({ id: '123' })
            const payload = {
                findByID: vi.fn().mockResolvedValue({
                    id: '123', tenant: 'tenant-1',
                    localBusiness: { businessCategory: 'foodEstablishment', schemaSubtype: 'Bakery', city: 'Petaling Jaya' },
                }),
                update,
            }
            vi.mocked(getPayload).mockResolvedValueOnce(payload as unknown as Awaited<ReturnType<typeof getPayload>>)
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH', body: JSON.stringify({ localBusiness: { priceRange: '$$' } }),
            })

            // Act
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })

            // Assert
            expect(res.status).toBe(200)
            expect(update).toHaveBeenCalledTimes(1)
            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'sites', id: '123',
                data: expect.objectContaining({
                    localBusiness: expect.objectContaining({ businessCategory: 'foodEstablishment', schemaSubtype: 'Bakery', city: 'Petaling Jaya', priceRange: '$$' }),
                }),
            }))
        })

        it('[TC-F37-02-31] self-heals persisted legacy opening hours before validating a sparse patch', async () => {
            // Arrange
            const update = vi.fn().mockResolvedValue({ id: '123' })
            const payload = {
                findByID: vi.fn().mockResolvedValue({
                    id: '123',
                    tenant: 'tenant-1',
                    localBusiness: {
                        businessCategory: 'foodEstablishment',
                        schemaSubtype: 'Bakery',
                        openingHours: [{ dayOfWeek: 'Tu' }],
                    },
                }),
                update,
            }
            vi.mocked(getPayload).mockResolvedValueOnce(
                payload as unknown as Awaited<ReturnType<typeof getPayload>>,
            )
            const req = new NextRequest('http://localhost:3000/api/sites/123/save', {
                method: 'PATCH',
                body: JSON.stringify({ localBusiness: { priceRange: '$$' } }),
            })

            // Act
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })

            // Assert
            expect(res.status).toBe(200)
            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'sites',
                id: '123',
                data: expect.objectContaining({
                    localBusiness: expect.objectContaining({
                        priceRange: '$$',
                        openingHours: [{ dayOfWeek: 'Tu', isClosed: true }],
                    }),
                }),
            }))
        })

        it('[TC-F37-02-31] rejects an invalid pageId before persisting mixed LocalBusiness changes', async () => {
            // Arrange
            const payload = await getPayload({ config: {} as never })
            vi.mocked(payload.findByID).mockResolvedValueOnce({
                id: '123',
                tenant: 'tenant-1',
                localBusiness: {
                    businessCategory: 'foodEstablishment',
                    schemaSubtype: 'Bakery',
                },
            } as never)
            const req = new NextRequest('http://localhost:3000/api/sites/123/save?pageId=not-a-page', {
                method: 'PATCH',
                body: JSON.stringify({
                    blocks: [{ blockType: 'hero', headline: 'Must not persist partially' }],
                    localBusiness: { priceRange: '$$' },
                }),
            })

            // Act
            const res = await SavePATCH(req, { params: Promise.resolve({ siteId: '123' }) })

            // Assert
            expect(res.status).toBe(400)
            expect(await res.json()).toEqual({ error: 'Invalid pageId' })
            expect(payload.update).not.toHaveBeenCalled()
        })
    })

    describe('PATCH & DELETE /api/sites/[siteId]/publish', () => {
        
        beforeEach(() => { vi.clearAllMocks() })

        it('returns 401 if token is missing when publishing', async () => {
            // Routes now use getCurrentUser() — mock it to return null for 401 test
            vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(401)
        })

        it('returns 404 if site is not found when publishing', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenants: [{ tenant: 'tenant-1' }] } }),
                findByID: vi.fn().mockResolvedValue(null) // Mock Not found
            })

            const req = new NextRequest('http://localhost:3000/api/sites/999/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '999' }) })
            expect(res.status).toBe(404)
        })

        it('returns 200 and successfully publishes the site', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenants: [{ tenant: 'tenant-1' }] } }),
                findByID: vi.fn().mockResolvedValue({ id: '123', status: 'draft', tenant: 'tenant-1' }),
                find: vi.fn().mockResolvedValue({ docs: [{ id: 'page-1', layout: [] }], hasNextPage: false }),
                update: vi.fn().mockResolvedValue({ id: '123', status: 'published', publishedAt: new Date().toISOString() })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'PATCH' })
            const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.success).toBe(true)
            expect(result.data.status).toBe('published')
        })
        
        it('returns 200 and successfully unpublishes the site', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenants: [{ tenant: 'tenant-1' }] } }),
                findByID: vi.fn().mockResolvedValue({ id: '123', status: 'published', tenant: 'tenant-1' }),
                update: vi.fn().mockResolvedValue({ id: '123', status: 'draft' })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/publish', { method: 'DELETE' })
            const res = await UnpublishDELETE(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.success).toBe(true)
            expect(result.data.status).toBe('draft')
        })
    })

    describe('GET /api/sites/[siteId]/editor-data', () => {

        beforeEach(() => { vi.clearAllMocks() })

        it('returns 404 if site is not found', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue(null),
                find: vi.fn().mockResolvedValue({ docs: [] }),
            })

            const req = new NextRequest('http://localhost:3000/api/sites/999/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '999' }) })
            expect(res.status).toBe(404)
        })

        it('returns 200 with site and page data (including locale and shippingConfig)', async () => {
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue({
                    id: '123',
                    name: 'Test Site',
                    status: 'draft',
                    tenant: 'tenant-1',
                    siteType: 'business',
                    locale: 'ms',
                    shippingConfig: { westRate: 800, eastRate: 1500 }
                }),
                find: vi.fn().mockResolvedValue({
                    docs: [{ id: 'page-1', title: 'Home', layout: [{ blockType: 'hero' }] }]
                })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()

            expect(result.site.name).toBe('Test Site')
            expect(result.site.locale).toBe('ms')
            expect(result.site.shippingConfig.westRate).toBe(800)
            expect(result.page.layout[0].blockType).toBe('hero')
        })

        it('returns user.role field in editor-data response', async () => {
            // Default mock user has tenants: [{ tenant: 'tenant-1' }] without explicit role
            // → role resolves to 'viewer' fallback (tenant match exists but role undefined)
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue({
                    id: '123', name: 'Test Site', status: 'draft', tenant: 'tenant-1', locale: 'ms',
                    theme: { primaryColor: '#000' }, seo: {}, socialLinks: {}, branding: {}, contactInfo: {},
                    shippingConfig: { westRate: 800 },
                }),
                find: vi.fn().mockResolvedValue({
                    docs: [{ id: 'page-1', title: 'Home', layout: [{ blockType: 'hero' }] }]
                })
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '123' }) })
            expect(res.status).toBe(200)
            const result = await res.json()
            expect(result.user).toHaveProperty('role')
            expect(typeof result.user.role).toBe('string')
        })

        it('[TC-editor-data-null-tenant] returns 403 (not 500) when site.tenant is null', async () => {
            // Regression test: typeof null === 'object' → accessing null.id used to throw TypeError → 500
            // After fix: resolveTenantId(null) returns null → siteTenantId is null → 403 Forbidden
            // @ts-ignore
            getPayload.mockResolvedValueOnce({
                findByID: vi.fn().mockResolvedValue({
                    id: '123',
                    name: 'Orphan Site',
                    status: 'draft',
                    tenant: null, // ← root cause of the 500 bug
                }),
                find: vi.fn().mockResolvedValue({ docs: [] }),
            })

            const req = new NextRequest('http://localhost:3000/api/sites/123/editor-data')
            const res = await EditorDataGET(req, { params: Promise.resolve({ siteId: '123' }) })

            // Must return 403, not 500
            expect(res.status).toBe(403)
            const result = await res.json()
            expect(result.error).toBe('Forbidden')
        })
    })

})

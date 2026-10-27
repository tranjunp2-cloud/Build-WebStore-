import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: unknown) => async (req: unknown, ctx: unknown) => (handler as Function)(mockUser, req, ctx)),
}))

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
// `deletedAt` soft-delete writes straight to the base `pages` row via raw SQL
// (payload.db.drizzle.execute) — see route.ts #1226. Mock the drizzle handle
// so that path resolves instead of throwing on an undefined `db`.
const mockExecute = vi.fn().mockResolvedValue(undefined)
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        find: mockFind,
        findByID: mockFindByID,
        update: mockUpdate,
        db: { drizzle: { execute: mockExecute } },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
    }),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { PATCH } from '@/app/api/sites/[siteId]/pages/[pageId]/route'

// ─── TC-F05.02: Page update API ──────────────────────────────────────

const ctx = { params: Promise.resolve({ siteId: '1', pageId: '10' }) }

describe('PATCH /api/sites/[siteId]/pages/[pageId] [TC-F05.02]', () => {
    beforeEach(() => vi.clearAllMocks())

    it('updates page visibility', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'published' })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'published', isVisible: false, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.isVisible).toBe(false)
    })

    // BUG-F05-12: toggling visibility on a draft-only page (never published)
    // previously called `payload.update({draft:false})` which forces publish-
    // validation on the whole layout — AI-seeded blocks occasionally fail
    // that and threw 500. Fix routes draft-only pages through `draft:true`.
    it('saves visibility to draft when page was never published', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'draft' })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'draft', isVisible: false, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            id: '10',
            data: expect.objectContaining({ isVisible: false }),
            draft: true,
        }))
    })

    // BUG-F05-visibility-pk: toggling visibility on a page whose layout
    // contains AI-seeded block UUIDs that collide with other pages' live
    // block rows caused PG 23505 → ValidationError{path:'id'}. Fix strips
    // block-row `id` + `_uuid` so Drizzle regenerates fresh UUIDs.
    it('strips block ids from layout before passing to payload.update', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({
                id: '10', site: 1, slug: '/about', title: 'About', _status: 'draft',
                layout: [
                    { id: 'collide-uuid', _uuid: 'collide-uuid', blockType: 'hero', headline: 'Hi' },
                    {
                        id: 'another-uuid', blockType: 'features',
                        features: [
                            { id: 'nested-uuid', name: 'F1' },
                        ],
                    },
                ],
            })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'draft', isVisible: false, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(200)
        const callArg = mockUpdate.mock.calls[0][0] as { data: { layout: unknown[] } }
        const sentLayout = callArg.data.layout as Array<Record<string, unknown>>
        expect(sentLayout).toHaveLength(2)
        // block-level ids gone
        expect(sentLayout[0]).not.toHaveProperty('id')
        expect(sentLayout[0]).not.toHaveProperty('_uuid')
        expect(sentLayout[0]).toMatchObject({ blockType: 'hero', headline: 'Hi' })
        // nested array ids also gone
        const nestedFeatures = (sentLayout[1].features as Array<Record<string, unknown>>)
        expect(nestedFeatures[0]).not.toHaveProperty('id')
        expect(nestedFeatures[0]).toMatchObject({ name: 'F1' })
    })

    it('publishes visibility immediately when page is already published clean', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'published' })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'published', isVisible: true, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'pages',
            id: '10',
            data: expect.objectContaining({ isVisible: true }),
            draft: false,
        }))
    })

    // #1226: soft-delete / restore writes `deleted_at` straight to the base
    // `pages` row via raw SQL — NOT through payload.update({draft}). On a draft
    // page the payload path routes the change into the versions table and
    // pages.deleted_at stays NULL (slug never frees, delete doesn't persist).
    // Behaviour is now identical regardless of publish status.
    it('writes deletedAt via raw SQL on a draft (never-published) page', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'draft' })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'draft', isVisible: true, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ deletedAt: '2026-04-20T10:00:00Z' }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(200)
        // deletedAt persisted via raw SQL, not payload.update
        expect(mockExecute).toHaveBeenCalledTimes(1)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('writes deletedAt via raw SQL on an already-published page', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'published' })
            .mockResolvedValueOnce({
                id: '10', title: 'About', slug: '/about',
                _status: 'published', isVisible: true, seo: {}, updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ deletedAt: '2026-04-20T10:00:00Z' }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(200)
        expect(mockExecute).toHaveBeenCalledTimes(1)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // Shape mirrors `/api/sites/[siteId]/publish` error envelope so a single
    // client parser (see editor page.tsx handleRepublish) reads both.
    it('surfaces Payload validation errors with structured detail on 500', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'published' })
        const validationError = Object.assign(new Error('ValidationError'), {
            name: 'ValidationError',
            data: {
                errors: [
                    { path: 'layout.0.links.0.url', message: 'URL is required' },
                ],
            },
        })
        mockUpdate.mockRejectedValueOnce(validationError)

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.message).toBe('Failed to update page')
        expect(body.error.failures).toHaveLength(1)
        const failure = body.error.failures[0]
        expect(failure.pageId).toBe('10')
        expect(failure.errName).toBe('ValidationError')
        expect(failure.errMsg).toBe('ValidationError')
        expect(failure.causeMsg).toBe('ValidationError')
        expect(failure.validationErrors).toEqual([
            { path: 'layout.0.links.0.url', message: 'URL is required' },
        ])
    })

    it('omits validationErrors when none returned by Payload', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About', _status: 'published' })
        mockUpdate.mockRejectedValueOnce(new Error('DB connection lost'))

        const req = { json: () => Promise.resolve({ isVisible: false }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(500)
        const failure = body.error.failures[0]
        expect(failure.errMsg).toBe('DB connection lost')
        expect(failure.validationErrors).toBeUndefined()
    })

    it('updates page SEO fields', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID
            .mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About' }) // initial lookup
            .mockResolvedValueOnce({ // re-read after update
                id: '10', title: 'About', slug: '/about',
                _status: 'draft', isVisible: true,
                seo: { title: 'New SEO', description: 'New desc' },
                updatedAt: '2026-04-01',
            })
        mockUpdate.mockResolvedValue({})

        const req = { json: () => Promise.resolve({ seoTitle: 'New SEO', seoDescription: 'New desc' }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.page.seoTitle).toBe('New SEO')
    })

    it('returns 403 for unauthorized site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [] })

        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(403)
    })

    it('returns 404 when page not on site', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 999 }) // wrong site

        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(404)
    })

    it('returns 400 for invalid params', async () => {
        const badCtx = { params: Promise.resolve({ siteId: 'abc', pageId: 'xyz' }) }
        const req = { json: () => Promise.resolve({ isVisible: true }) } as unknown as Request
        const res = await PATCH(req, badCtx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(400)
    })

    it('returns 400 for 404 page slug change', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/404', title: '404 Not Found' })

        const req = { json: () => Promise.resolve({ slug: 'new-slug' }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toContain('404')
    })

    it('returns 400 for duplicate slug', async () => {
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] }) // auth
            .mockResolvedValueOnce({ docs: [{ id: '20' }] }) // duplicate slug found
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/old', title: 'Old' })

        const req = { json: () => Promise.resolve({ slug: 'existing' }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toContain('duplicate')
    })

    it.each(['checkout', '/checkout', 'checkout/'])('TC-F05-02-28: returns 400 when renaming a page to reserved slug %s', async (slug) => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] }) // auth
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/old', title: 'Old' })

        const req = { json: () => Promise.resolve({ slug }) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toContain('reserved')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 when no fields to update', async () => {
        mockFind.mockResolvedValueOnce({ docs: [{ id: '1', tenant: 'tenant-1' }] })
        mockFindByID.mockResolvedValueOnce({ id: '10', site: 1, slug: '/about', title: 'About' })

        const req = { json: () => Promise.resolve({}) } as unknown as Request
        const res = await PATCH(req, ctx as { params: Promise<{ siteId: string; pageId: string }> })

        expect(res.status).toBe(400)
    })
})

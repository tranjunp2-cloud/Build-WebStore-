import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH as PublishPATCH, DELETE as UnpublishDELETE } from '@/app/api/sites/[siteId]/publish/route'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { PgDialect } from 'drizzle-orm/pg-core'

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

    it('TC-F01-pub-03b: sanitizes pending header/footer blocks before promoting site-level publish data', async () => {
        const { getPayload } = await import('payload')
        const siteRecordWithPending = {
            ...mockSiteRecord,
            pendingHeaderBlock: {
                blockType: 'navigation',
                links: [
                    { label: 'Home', url: '/' },
                    { label: 'Broken' },
                ],
            },
            pendingFooterBlock: {
                blockType: 'footer',
                columns: [
                    { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Broken link only' }] },
                    { links: [{ label: 'Missing title', url: '/x' }] },
                ],
            },
        }
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
                    if (depth === 1) return { ...siteRecordWithPending, tenant: { id: 'tenant-1', slug: 'coffee-shop' } }
                    return siteRecordWithPending
                }
                return null
            }),
            find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
            update: updateSpy,
            db: { drizzle: { execute: vi.fn().mockResolvedValue({ rows: [] }) } },
        })

        const req = makePatchReq('site-123')
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        expect(res.status).toBe(200)

        const siteUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'sites')
        expect(siteUpdate).toBeTruthy()
        expect(siteUpdate![0].data.headerBlock).toEqual({
            blockType: 'navigation',
            links: [{ label: 'Home', url: '/' }],
        })
        expect(siteUpdate![0].data.footerBlock).toEqual({
            blockType: 'footer',
            columns: [{ title: 'Company', links: [{ label: 'About', url: '/about' }] }],
        })
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

    it('TC-F01-pub-12: strips block + nested array id/_uuid before promote so cross-page UUID collisions do not hit pg unique constraint', async () => {
        // Regression (pages 790 + 793): AI generate-site seeded multiple pages
        // with colliding block UUIDs. First page publishes OK, second page's
        // promote hits live pages_blocks_*.id PK collision under a different
        // _parent_id → PG error 23505 → wrapped into ValidationError
        // {path:'id', message:'Value must be unique'}. Fix: drop block and
        // nested-array row id + _uuid so column defaults (gen_random_uuid)
        // regenerate safe UUIDs. Matches upstream Payload PR #11887.
        const { getPayload } = await import('payload')

        const draftPage = {
            id: 'page-793',
            _status: 'draft',
            site: 'site-123',
            title: 'Home',
            layout: [
                {
                    id: 'block-uuid-shared-1', // <-- would collide with page-790's block
                    _uuid: 'block-uuid-shared-1',
                    blockType: 'hero',
                    headline: 'Welcome',
                    ctaButtons: [
                        { id: 'cta-uuid-shared', _uuid: 'cta-uuid-shared', label: 'Go', url: '/' },
                    ],
                },
                {
                    id: 'block-uuid-shared-2',
                    _uuid: 'block-uuid-shared-2',
                    blockType: 'features',
                    features: [
                        { id: 'feat-uuid-shared', _uuid: 'feat-uuid-shared', title: 'Fast', description: 'Very' },
                    ],
                },
            ],
        }

        const findSpy = vi.fn().mockResolvedValue({ docs: [draftPage], hasNextPage: false })
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

        const pageUpdateCall = updateSpy.mock.calls.find(c => c[0].collection === 'pages')
        expect(pageUpdateCall).toBeTruthy()
        const sentLayout = pageUpdateCall![0].data.layout as Array<Record<string, unknown>>

        // Block rows stripped
        expect(sentLayout).toHaveLength(2)
        for (const block of sentLayout) {
            expect(block).not.toHaveProperty('id')
            expect(block).not.toHaveProperty('_uuid')
            expect(block).toHaveProperty('blockType')
        }

        // Nested array rows (ctaButtons, features) stripped too
        const hero = sentLayout.find(b => b.blockType === 'hero') as { ctaButtons: Array<Record<string, unknown>> }
        expect(hero.ctaButtons[0]).not.toHaveProperty('id')
        expect(hero.ctaButtons[0]).not.toHaveProperty('_uuid')
        expect(hero.ctaButtons[0].label).toBe('Go')

        const features = sentLayout.find(b => b.blockType === 'features') as { features: Array<Record<string, unknown>> }
        expect(features.features[0]).not.toHaveProperty('id')
        expect(features.features[0]).not.toHaveProperty('_uuid')
        expect(features.features[0].title).toBe('Fast')
    })

    it('TC-F01-pub-13: skips soft-deleted pages on publish so a deleted-then-recreated slug does not trip the partial unique index (no 500)', async () => {
        // Regression: user creates page "/about" (id=page-del), deletes it
        // (soft-delete → deleted_at set), then recreates "/about" (id=page-live).
        // On publish, the promote loop iterated ALL pages incl. the soft-deleted
        // one; promoting it reset deleted_at→NULL, so two live rows shared
        // (site_id, slug) → partial unique index pages_site_slug_uniq → 500.
        // Fix: resolve soft-deleted ids from pages.deleted_at via raw SQL and
        // `continue` past them — the deleted page is NEVER promoted.
        const { getPayload } = await import('payload')

        // Use a NUMERIC siteId — in production sites.id is a serial int, so the route's
        // `Number(siteId)` must yield a real integer (not NaN). A non-numeric id here
        // would let Number()→NaN slip through unnoticed and mask a broken WHERE clause.
        const siteId = '123'
        mockSiteRecord = { id: siteId, name: 'My Coffee Site', status: 'draft', tenant: 'tenant-1', publishedAt: null }

        // draft:true find returns BOTH pages (it reads version snapshots where
        // deleted_at is null, so it cannot tell them apart — that's why the raw
        // deleted_at query is the reliable source).
        // pages.id is serial int — use numeric ids (id 11 = deleted, id 12 = live).
        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: 11, _status: 'draft', site: siteId, slug: '/about', layout: [] },
                { id: 12, _status: 'draft', site: siteId, slug: '/about', layout: [] },
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
        // db.drizzle.execute reports id 11 as soft-deleted (deleted_at IS NOT NULL).
        const executeSpy = vi.fn().mockResolvedValue({ rows: [{ id: 11 }] })
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
            db: { drizzle: { execute: executeSpy } },
        })

        const req = makePatchReq(siteId)
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId }) })
        const body = await res.json()

        // Publish succeeds — no 500, no partial-failure.
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)

        // The deleted-id query must target the right column + value — serialize the
        // drizzle SQL so a broken WHERE clause (wrong column / NaN site_id) fails here
        // instead of silently passing on the mocked rows.
        expect(executeSpy).toHaveBeenCalledTimes(1)
        const { sql: deletedQuerySql, params: deletedQueryParams } = new PgDialect().sqlToQuery(
            executeSpy.mock.calls[0][0],
        )
        expect(deletedQuerySql).toContain('site_id =')
        expect(deletedQuerySql).toContain('deleted_at IS NOT NULL')
        expect(deletedQueryParams).toContain(Number(siteId)) // 123, never NaN

        // The soft-deleted page must NEVER be promoted...
        const pageUpdates = updateSpy.mock.calls.filter(c => c[0].collection === 'pages')
        const promotedIds = pageUpdates.map(c => c[0].id)
        expect(promotedIds).not.toContain(11)
        // ...while the live recreated page IS promoted.
        expect(promotedIds).toContain(12)
    })

    it('TC-F01-pub-14: promote never writes deletedAt — 2nd-layer guard so a page soft-deleted mid-publish (race) cannot reset deleted_at and trip the unique index', async () => {
        // Race: a page passes the deletedPageIds query (not yet deleted) but is
        // soft-deleted DURING the loop. It still reaches promote. The draft snapshot
        // carries deletedAt=null, so writing it would reset deleted_at→NULL → 500.
        // Fix: deletedAt is stripped from the promote payload entirely, so the base
        // row's deleted_at is left untouched regardless of the snapshot value.
        const { getPayload } = await import('payload')
        const siteId = '123'
        mockSiteRecord = { id: siteId, name: 'My Coffee Site', status: 'draft', tenant: 'tenant-1', publishedAt: null }

        // Draft doc explicitly carries deletedAt (null) + a deletedAt-like timestamp to
        // prove BOTH are dropped, never forwarded to payload.update.
        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: 20, _status: 'draft', site: siteId, slug: '/about', layout: [], deletedAt: null, title: 'About' },
            ],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id, data }) => {
            if (collection === 'sites') { mockSiteRecord = { ...mockSiteRecord, ...data }; return mockSiteRecord }
            return { id, ...data }
        })
        // deletedPageIds query returns empty → page 20 is NOT skipped, it WILL be promoted.
        const executeSpy = vi.fn().mockResolvedValue({ rows: [] })
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
            db: { drizzle: { execute: executeSpy } },
        })

        const req = makePatchReq(siteId)
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId }) })
        expect(res.status).toBe(200)

        // Page 20 was promoted...
        const pageUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'pages' && c[0].id === 20)
        expect(pageUpdate).toBeDefined()
        // ...but the promote payload must NOT carry deletedAt — leaving the base row's
        // soft-delete state untouched even under the mid-publish race.
        expect(Object.prototype.hasOwnProperty.call(pageUpdate![0].data, 'deletedAt')).toBe(false)
    })

    it('TC-F01-pub-15: skips orphan version rows (id=null) so publish does not 500 with "Missing where"', async () => {
        // Regression (Sentry, staging): a hard-deleted / failed page-create leaves an
        // orphan row in _pages_v (parent_id NULL). find({draft:true}) surfaces it as a
        // doc with id=null; payload.update({id:null}) has neither id nor where → Payload
        // throws APIError "Missing 'where' query of documents to update." → the ENTIRE
        // publish 500s (real pages never promote). Fix: skip id==null docs in the loop.
        const { getPayload } = await import('payload')
        const siteId = '123'
        mockSiteRecord = { id: siteId, name: 'My Coffee Site', status: 'draft', tenant: 'tenant-1', publishedAt: null }

        // draft:true returns the orphan (id:null) alongside a real page (id:12).
        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: null, _status: 'draft', site: siteId, slug: '/orphan', layout: [] },
                { id: 12, _status: 'draft', site: siteId, slug: '/home', layout: [] },
            ],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id, data }) => {
            if (collection === 'sites') {
                mockSiteRecord = { ...mockSiteRecord, ...data }
                return mockSiteRecord
            }
            // Faithfully mirror Payload: update() with neither a resolved id nor a
            // `where` throws APIError — this is the exact 500 the fix must prevent.
            if (id == null) {
                throw Object.assign(new Error("Missing 'where' query of documents to update."), { name: 'APIError' })
            }
            return { id, ...data }
        })
        const executeSpy = vi.fn().mockResolvedValue({ rows: [] }) // no soft-deleted pages
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
            db: { drizzle: { execute: executeSpy } },
        })

        const req = makePatchReq(siteId)
        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId }) })
        const body = await res.json()

        // No 500 — orphan is skipped, not promoted.
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)

        const pageUpdates = updateSpy.mock.calls.filter(c => c[0].collection === 'pages')
        const promotedIds = pageUpdates.map(c => c[0].id)
        // Real page IS promoted...
        expect(promotedIds).toContain(12)
        // ...the orphan (id null) is NEVER passed to update — that call is exactly what
        // would throw "Missing 'where'".
        expect(promotedIds).not.toContain(null)
        expect(promotedIds).not.toContain(undefined)
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

        // GH #1535: partial publish failure now returns 409 (client/data condition),
        // not 500. Still a 4xx so res.ok stays false → client behavior unchanged.
        expect(res.status).toBe(409)
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

    it('TC-F01-pub-16: GH-1621 P1 — failures[].friendlyDetail resolves block/item/page from the raw path instead of a bare field name', async () => {
        // Regression: the old toast only ever showed "title: This field is
        // required." with zero indication of WHICH block/item/page — exactly
        // the GH-1621 complaint. friendlyDetail must resolve the actual block
        // type + 1-indexed item position + page title from the failing page's
        // own layout (the only place that data is knowable from).
        const { getPayload } = await import('payload')

        class FakeValidationError extends Error {
            data: { collection?: string; errors: Array<{ path: string; message: string }> }
            constructor() {
                super('The following fields are invalid: layout.6.projects.4.title')
                this.name = 'ValidationError'
                this.data = {
                    collection: 'pages',
                    errors: [
                        { path: 'layout.6.projects.4.title', message: 'This field is required.' },
                    ],
                }
            }
        }

        const failingPageLayout = Array.from({ length: 7 }, (_, i) =>
            i === 6
                ? { blockType: 'portfolio-grid', projects: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }, {}, {}] }
                : { blockType: 'hero' },
        )
        const findSpy = vi.fn().mockResolvedValue({
            docs: [
                { id: 'page-3710', title: 'About Us', _status: 'draft', site: 'site-123', layout: failingPageLayout },
            ],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id }) => {
            if (collection === 'pages' && id === 'page-3710') throw new FakeValidationError()
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

        expect(res.status).toBe(409)
        const failure = body.error.failures[0]
        expect(failure.pageTitle).toBe('About Us')
        // Block 6 (index) is portfolio-grid; item index 4 → "Project 5" (1-indexed).
        expect(failure.friendlyDetail).toBe('About Us → Portfolio → Project 5 → title: This field is required.')
    })

    it('TC-F01-pub-18: GH-1621 code-review follow-up — sanitizeBlocksRequiredFields runs right before promote, NOT on every draft autosave', async () => {
        // The sanitizer moved from /api/sites/[siteId]/save (every autosave — caught
        // in review as a silent-mutation/data-loss risk) to here, right before a
        // page's draft is promoted to published. Verify payload.update actually
        // receives the backfilled layout at publish time.
        const { getPayload } = await import('payload')
        const layout = [{ blockType: 'portfolio-grid', projects: [{ title: 'Real Project' }, {}] }]
        const findSpy = vi.fn().mockResolvedValue({
            docs: [{ id: 'page-42', title: 'Home', _status: 'draft', site: 'site-123', layout }],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockResolvedValue({ id: 'page-42' })
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

        expect(res.status).toBe(200)
        const savedLayout = updateSpy.mock.calls[0][0].data.layout
        expect(savedLayout[0].projects).toEqual([
            { title: 'Real Project' },
            { title: 'Project 2' },
        ])
    })

    it('TC-F01-pub-19: GH-1621 code-review follow-up — friendlyValidationLocation falls back to field-name-only for doubly-nested arrays, never a wrong item label', async () => {
        // menu-food/menu-display's categories[].items[].name is a real doubly-nested
        // required field. A path like layout.2.categories.1.items.0.name (7
        // segments) must NOT be misread as "Category 2 → items" (segments[4] is the
        // nested array's field name, not the leaf field) — fall back to the always-
        // correct leaf field name instead.
        const { getPayload } = await import('payload')

        class FakeValidationError extends Error {
            data: { collection?: string; errors: Array<{ path: string; message: string }> }
            constructor() {
                super('The following fields are invalid: layout.2.categories.1.items.0.name')
                this.name = 'ValidationError'
                this.data = {
                    collection: 'pages',
                    errors: [{ path: 'layout.2.categories.1.items.0.name', message: 'This field is required.' }],
                }
            }
        }

        const failingPageLayout = [
            { blockType: 'hero' },
            { blockType: 'hero' },
            { blockType: 'menu-food', categories: [{ name: 'Mains' }, { name: 'Drinks', items: [{}] }] },
        ]
        const findSpy = vi.fn().mockResolvedValue({
            docs: [{ id: 'page-55', title: 'Menu', _status: 'draft', site: 'site-123', layout: failingPageLayout }],
            hasNextPage: false,
        })
        const updateSpy = vi.fn().mockImplementation(async ({ collection, id }) => {
            if (collection === 'pages' && id === 'page-55') throw new FakeValidationError()
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

        expect(res.status).toBe(409)
        const failure = body.error.failures[0]
        // Must NOT be "Menu → Category 2 → items" (wrong field) — field-name-only fallback.
        expect(failure.friendlyDetail).toBe('Menu → Food Menu → name: This field is required.')
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

        // GH #1535 (review): a non-validation server fault (TypeError, no validationErrors)
        // keeps 500 so it stays visible in 5xx monitoring — only pure ValidationError
        // failures downgrade to 409 (see TC-F01-pub-10).
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

    // ── TC-F10-GBL-034..036: globalBlocks promotion on publish ─────────────

    it('TC-F10-GBL-034: PATCH with globalBlocks body → writes directly to site.globalBlocks and clears pendingGlobalBlocks', async () => {
        // Regression: publish route used to read pendingGlobalBlocks from DB which
        // could silently return undefined if migration not applied, leaving live
        // globalBlocks unchanged after user deleted a widget and clicked Update.
        const { getPayload } = await import('payload')
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
            find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
            update: updateSpy,
        })

        const cartWidget = { blockType: 'cartWidget', variant: 'floating', showCount: true }
        const sentGlobalBlocks = { cartWidget, whatsappButton: null, socialWidget: null }
        const req = new NextRequest('http://localhost:3000/api/sites/site-123/publish', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ globalBlocks: sentGlobalBlocks }),
        })

        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        expect(res.status).toBe(200)

        const sitesUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'sites')
        expect(sitesUpdate).toBeDefined()
        const data = sitesUpdate![0].data as Record<string, unknown>
        expect(data.globalBlocks).toEqual(sentGlobalBlocks)
        expect(data.pendingGlobalBlocks).toBeNull()
    })

    it('TC-F10-GBL-035: PATCH with cartWidget:null in body → null preserved in globalBlocks (no BC fallback)', async () => {
        // cartWidget:null is the explicit sentinel meaning "user disabled cart".
        // Absent key would reactivate BC page-scan fallback. Publish must keep null.
        const { getPayload } = await import('payload')
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
            find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
            update: updateSpy,
        })

        const removedGlobalBlocks = { cartWidget: null, whatsappButton: null, socialWidget: null }
        const req = new NextRequest('http://localhost:3000/api/sites/site-123/publish', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ globalBlocks: removedGlobalBlocks }),
        })

        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        expect(res.status).toBe(200)

        const sitesUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'sites')
        const data = sitesUpdate![0].data as Record<string, unknown>
        const storedGb = data.globalBlocks as typeof removedGlobalBlocks
        expect(storedGb).not.toBeNull()
        expect(storedGb.cartWidget).toBeNull()
    })

    it('TC-F10-GBL-036: PATCH without body globalBlocks → falls back to pendingGlobalBlocks from DB', async () => {
        // Old clients / tests that do not send body still get correct promotion
        // via the DB fallback path (pendingGlobalBlocks → globalBlocks).
        const { getPayload } = await import('payload')
        const pending = { cartWidget: { blockType: 'cartWidget', variant: 'floating' }, whatsappButton: null, socialWidget: null }
        mockSiteRecord = { ...mockSiteRecord, pendingGlobalBlocks: pending }
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
            find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
            update: updateSpy,
        })

        // No body — old-style request
        const req = makePatchReq('site-123')

        const res = await PublishPATCH(req, { params: Promise.resolve({ siteId: 'site-123' }) })
        expect(res.status).toBe(200)

        const sitesUpdate = updateSpy.mock.calls.find(c => c[0].collection === 'sites')
        const data = sitesUpdate![0].data as Record<string, unknown>
        expect(data.globalBlocks).toEqual(pending)
        expect(data.pendingGlobalBlocks).toBeNull()
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

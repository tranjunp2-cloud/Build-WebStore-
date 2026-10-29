/**
 * Unit Tests — POST /api/ai/apply-template
 *
 * Coverage:
 *   TC-F07.039 — Apply template to existing site (smart mapping)
 *   TC-F07.016 — Unauthorized access blocked (401/403)
 *   TC-F07.023 — New site creation from template (backward compat)
 *   TC-F07.022 — Rate limit protection (429)
 *   TC-F07.050 — GH-731: service-cards empty titles coerced before payload.update on apply-template
 *   TC-AIWB-121 — applying a template bumps the editor draft revision (site + reskinned pages) inside the swap
 *                 transaction and answers the applying tab's new draftVersion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks — MUST be declared before any imports that trigger module resolution ──

// Bypass withAuth HOC — inject authenticated user directly
let mockUser: Record<string, unknown> = {
    id: 'user-42',
    email: 'owner@example.com',
    tenants: [{ tenant: { id: 'tenant-99' }, role: 'owner', status: 'active' }],
}

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => handler(mockUser, req, ctx)
    }),
    getCurrentUser: vi.fn().mockImplementation(() => Promise.resolve(mockUser)),
}))

// Rate limiter — controlled per test via mockRateLimitAllowed flag
let mockRateLimitAllowed = true

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockImplementation(() => ({
        allowed: mockRateLimitAllowed,
        remaining: mockRateLimitAllowed ? 19 : 0,
        resetAt: Date.now() + 3_600_000,
    })),
}))

// Payload CMS — controlled via shared mock state below
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => mockPayloadInstance),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1', plan: 'PROFESSIONAL_TM_USER', status: 'active', startDate: '2026-01-01T00:00:00.000Z',
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

// ── Shared mock state ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = {
    id: 'tpl-modern',
    name: 'Modern Business',
    category: 'business',
    usageCount: 5,
    defaultTheme: {
        primaryColor: '#6366f1',
        secondaryColor: '#d946ef',
        fontHeading: 'Outfit',
        fontBody: 'Inter',
        colorMode: 'dark',
    },
    defaultBlocks: [
        { blockType: 'hero', headline: 'Welcome' },
        { blockType: 'features', items: [] },
    ],
}

const DEFAULT_TENANT = { id: 'tenant-99', name: 'Acme Store' }

const DEFAULT_SITE = {
    id: 101,
    name: 'My Site',
    tenant: { id: 'tenant-99' }, // object form (populated relationship)
    status: 'published',
}

const DEFAULT_HOMEPAGE = {
    id: 201,
    slug: 'home',
    isHomepage: true,
    layout: [
        { blockType: 'hero', variant: 'centered', headline: 'Old Hero' },
        { blockType: 'footer', logoText: 'Old Footer' },
    ],
}

// Mutable references — reset in beforeEach, overridden in specific tests
let mockTemplate: Record<string, unknown> | null = { ...DEFAULT_TEMPLATE }
let mockTenant: Record<string, unknown> | null = { ...DEFAULT_TENANT }
let mockSite: Record<string, unknown> | null = { ...DEFAULT_SITE }
let mockHomepage: Record<string, unknown> | null = { ...DEFAULT_HOMEPAGE }
let mockCreatedSite = { id: 999, name: DEFAULT_TEMPLATE.name }

const mockTransaction = {
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
}

const mockTransactionExecute = vi.fn().mockResolvedValue(undefined)
let mockTransactionExecuteCall = 0
let mockExistingSiteRequest = false
const mockDrizzleTransaction = vi.fn().mockImplementation(async (
    operation: (transaction: { execute: typeof mockTransactionExecute }) => Promise<unknown>,
) => operation({ execute: mockTransactionExecute }))

const mockPayloadInstance = {
    findByID: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'templates') return mockTemplate
        if (collection === 'sites') return mockSite
        if (collection === 'pages') return mockHomepage
        return null
    }),
    find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'tenants') return { docs: mockTenant ? [mockTenant] : [] }
        return { docs: [] }
    }),
    create: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'sites') return mockCreatedSite
        return { id: 1000 + Math.random() }
    }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    db: {
        beginTransaction: vi.fn().mockResolvedValue(mockTransaction),
        drizzle: {
            // Simulates: SELECT id FROM pages WHERE site_id = ? AND deleted_at IS NULL LIMIT 100
            execute: vi.fn().mockImplementation(async () => ({
                rows: mockHomepage ? [{ id: (mockHomepage as Record<string, unknown>).id }] : [],
            })),
            transaction: mockDrizzleTransaction,
        },
        sessions: {} as Record<string, { db: { execute: typeof mockTransactionExecute } }>,
        transactionOptions: undefined,
    },
}

// ── Route handler — imported AFTER all mocks ─────────────────────────────────

import { POST } from '@/app/api/ai/apply-template/route'
import { canUseWithinLimit, recordUsage } from '@/lib/subscriptions/plan-subscription'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
    mockExistingSiteRequest = body.siteId != null
    return new NextRequest('http://localhost:3000/api/ai/apply-template', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/apply-template', () => {

    beforeEach(() => {
        vi.clearAllMocks()

        // Reset all control flags and mock state to known defaults
        mockRateLimitAllowed = true
        vi.mocked(canUseWithinLimit).mockResolvedValue(true)
        mockUser = {
            id: 'user-42',
            email: 'owner@example.com',
            tenants: [{ tenant: { id: 'tenant-99' }, role: 'owner', status: 'active' }],
        }
        mockTemplate = { ...DEFAULT_TEMPLATE }
        mockTenant = { ...DEFAULT_TENANT }
        mockSite = { ...DEFAULT_SITE }
        mockHomepage = { ...DEFAULT_HOMEPAGE }
        mockCreatedSite = { id: 999, name: DEFAULT_TEMPLATE.name }

        // Re-wire mock implementations after clearAllMocks resets them
        mockPayloadInstance.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection === 'templates') return mockTemplate
            if (collection === 'sites') return mockSite
            if (collection === 'pages') return mockHomepage
            return null
        })
        mockPayloadInstance.find.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection === 'tenants') return { docs: mockTenant ? [mockTenant] : [] }
            return { docs: [] }
        })
        mockPayloadInstance.create.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection === 'sites') return mockCreatedSite
            return { id: 1000 }
        })
        mockPayloadInstance.update.mockResolvedValue({})
        mockPayloadInstance.delete.mockResolvedValue({})
        mockPayloadInstance.db.drizzle.execute.mockImplementation(async () => ({
            rows: mockHomepage ? [{ id: (mockHomepage as Record<string, unknown>).id }] : [],
        }))
        mockTransactionExecute.mockResolvedValue(undefined)
        mockTransactionExecuteCall = 0
        mockExistingSiteRequest = false
        mockTransactionExecute.mockImplementation(async () => {
            mockTransactionExecuteCall++
            if (!mockExistingSiteRequest) return { rows: [] }
            if (mockTransactionExecuteCall === 2) {
                const tenant = mockSite?.tenant
                const tenantId = typeof tenant === 'object' && tenant !== null
                    ? (tenant as { id?: unknown }).id
                    : tenant
                return { rows: mockSite && String(tenantId) === 'tenant-99' ? [{ id: 101 }] : [] }
            }
            if (mockTransactionExecuteCall === 3) {
                return { rows: mockHomepage ? [{ id: (mockHomepage as Record<string, unknown>).id }] : [] }
            }
            return { rows: [] }
        })
        mockPayloadInstance.db.sessions = {}
    })

    // ── TC-F07.022: Rate limiting ─────────────────────────────────────────────

    // ── TC-F07.022: Rate limit exceeded → 429 ──────────────────────────────
    describe('[TC-F07.022] Rate limit protection', () => {

        it('returns 429 when user has exceeded 20 calls per hour', async () => {
            // Arrange
            mockRateLimitAllowed = false
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(429)
            expect(body.error).toMatch(/rate limit/i)
            expect(mockPayloadInstance.create).not.toHaveBeenCalled()
            expect(mockPayloadInstance.update).not.toHaveBeenCalled()
        })
    })

    // ── Validation errors ─────────────────────────────────────────────────────

    describe('Input validation', () => {

        it('returns 400 with VALIDATION_ERROR when templateId is missing', async () => {
            // Arrange
            const req = makeRequest({ siteId: '101' }) // templateId absent

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(400)
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(body.error.details.fieldErrors).toHaveProperty('templateId')
        })

        it('returns 400 with VALIDATION_ERROR when body is empty JSON object', async () => {
            // Arrange
            const req = makeRequest({})

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(400)
            expect(body.error.code).toBe('VALIDATION_ERROR')
        })
    })

    // ── TC-F07.023: Backward compat — create new site ─────────────────────────

    describe('[TC-F07.023] New site creation from template (no siteId)', () => {

        it('returns 200 with success:true and no "applied" field when siteId is omitted', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.siteId).toBe(999)
            expect(body.siteName).toBe('Modern Business')
            expect(body.templateName).toBe('Modern Business')
            expect(body.applied).toBeUndefined()
        })

        it('creates site with template theme, homepage, and 404 page', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            await POST(req)

            // Assert — site created with template theme
            const siteCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(siteCreateCall).toBeDefined()
            expect(siteCreateCall[0].data.theme).toEqual(DEFAULT_TEMPLATE.defaultTheme)
            expect(siteCreateCall[0].data.status).toBe('draft')

            // Two pages created: home + 404
            const pageCreateCalls = mockPayloadInstance.create.mock.calls.filter(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageCreateCalls).toHaveLength(2)

            const slugs = pageCreateCalls.map((c: any[]) => c[0].data.slug)
            expect(slugs).toContain('home')
            expect(slugs).toContain('404')
        })

        it('records template usage after creating a new site', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            await POST(req)

            // Assert
            expect(mockPayloadInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'templates', data: { usageCount: 6 },
            }))
            expect(recordUsage).toHaveBeenCalledWith(mockPayloadInstance, 'mock-sub-1', 'template_limit')
            expect(mockDrizzleTransaction).not.toHaveBeenCalled()
        })

        it('returns 404 when templateId does not match any template', async () => {
            // Arrange
            mockTemplate = null
            const req = makeRequest({ templateId: 'tpl-does-not-exist' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error).toMatch(/template not found/i)
        })

        it('auto-creates tenant when user has no associated tenant', async () => {
            // Arrange — user.tenants is empty (no tenant assigned)
            mockUser = { id: 'user-42', email: 'owner@example.com', tenants: [] }
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert — should succeed by auto-creating tenant (same as generate-site)
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
        })

        it('uses default theme values when template has no defaultTheme', async () => {
            // Arrange
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultTheme: undefined }
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            await POST(req)

            // Assert — falls back to hardcoded default theme
            const siteCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(siteCreateCall[0].data.theme).toMatchObject({
                primaryColor: '#0ea5e9',
                fontHeading: 'Outfit',
                fontBody: 'Inter',
                colorMode: 'dark',
            })
        })

        it('handles template with array category by taking the first element as siteType', async () => {
            // Arrange
            mockTemplate = { ...DEFAULT_TEMPLATE, category: ['restaurant', 'food'] }
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            await POST(req)

            // Assert
            const siteCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(siteCreateCall[0].data.siteType).toBe('restaurant')
        })
    })

    // ── TC-F07.039: Apply template to existing site ───────────────────────────

    describe('[TC-F07.039] Apply template to existing site (siteId provided)', () => {

        it('rejects a requested page absent from the live site-scoped rows before usage recording or writes', async () => {
            // Arrange — only the current site's live homepage is returned by the locked query.
            // The requested page 202 is absent from that authorized result in all three cases.
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId: '202' })
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

            try {
                // Act
                const res = await POST(req)
                const body = await res.json()

                // Assert — check the SQL authorization/deletion predicates as well as the result.
                const calls = mockTransactionExecute.mock.calls as unknown as Array<[SQL]>
                const query = new PgDialect().sqlToQuery(calls[2][0])
                expect(query.sql).toContain('pages.site_id = $1')
                expect(query.sql).toContain('sites.tenant_id = $2')
                expect(query.sql).toContain('pages.deleted_at IS NULL')
                expect(query.sql).toContain('FOR UPDATE OF pages')
                expect(query.params).toEqual([101, 'tenant-99', 202])
                expect(res.status).toBe(404)
                expect(body.error.code).toBe('PAGE_NOT_FOUND')
                expect(recordUsage).not.toHaveBeenCalled()
                expect(mockPayloadInstance.update).not.toHaveBeenCalled()
                expect(mockPayloadInstance.create).not.toHaveBeenCalled()
            } finally {
                consoleError.mockRestore()
            }
        })

        it('normalizes a leading-zero page ID and applies to the requested page', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId: '00201' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.data.appliedState.page.id).toBe(201)
            expect(mockPayloadInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'pages', id: 201,
            }))
        })

        it.each(['0', 0, '-1', '1.5', '9007199254740993', Number.MAX_SAFE_INTEGER + 1])('rejects invalid page ID %s before entering the transaction', async (pageId) => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(400)
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(mockDrizzleTransaction).not.toHaveBeenCalled()
            expect(recordUsage).not.toHaveBeenCalled()
            expect(mockPayloadInstance.update).not.toHaveBeenCalled()
        })

        it('returns 200 with applied:true when siteId is valid and owned by user', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId: '201' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.applied).toBe(true)
            expect(body.data.siteId).toBe(101)
            expect(body.data.siteName).toBe('My Site')
            expect(body.data.templateName).toBe('Modern Business')
            expect(body.data.appliedState).toEqual(expect.objectContaining({
                site: expect.objectContaining({ theme: DEFAULT_TEMPLATE.defaultTheme }),
                page: expect.objectContaining({ id: 201, layout: expect.any(Array) }),
            }))
            expect(body.meta.timestamp).toEqual(expect.any(String))
        })

        it('updates site theme with template defaultTheme', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — sites.update called with the template theme
            const siteUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [{ collection: string; data?: { theme?: unknown }; id?: number | string }]) => c[0].collection === 'sites' && c[0].data?.theme
            )
            expect(siteUpdateCall).toBeDefined()
            expect(siteUpdateCall[0].id).toBe(101)
            expect(siteUpdateCall[0].data.theme).toEqual(DEFAULT_TEMPLATE.defaultTheme)
        })

        it('updates existing homepage layout via smart mapping (not delete+create)', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — page UPDATED in-place (smart mapping), NOT deleted+created
            expect(mockPayloadInstance.delete).not.toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'pages' })
            )
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeDefined()
            const layout = pageUpdateCall[0].data.layout as Record<string, unknown>[]
            expect(layout.length).toBeGreaterThan(0)
            expect(layout[0].blockType).toBe('hero')
        })

        it('updates only the active non-homepage while reading homepage globals as context', async () => {
            // Arrange
            const homepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    { blockType: 'navigation', variant: 'default', logoText: 'My Brand' },
                    { blockType: 'hero', variant: 'centered', headline: 'Home hero' },
                    { blockType: 'footer', variant: 'default', copyrightText: 'My Copyright' },
                ],
            }
            const aboutPage = {
                id: 202,
                slug: 'about',
                isHomepage: false,
                layout: [
                    { blockType: 'hero', variant: 'centered', headline: 'About us' },
                    { blockType: 'faq', variant: 'accordion', headline: 'Questions' },
                ],
            }
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                templatePages: [{
                    isHomepage: true,
                    layout: [
                        { blockType: 'navigation', variant: 'transparent', logoText: 'Template logo' },
                        { blockType: 'hero', variant: 'split-left', headline: 'Template hero' },
                        { blockType: 'footer', variant: 'minimal', copyrightText: 'Template copyright' },
                    ],
                }],
            }
            mockPayloadInstance.findByID.mockImplementation(async ({ collection, id }: { collection: string; id?: number | string }) => {
                if (collection === 'templates') return mockTemplate
                if (collection === 'sites') return mockSite
                if (collection === 'pages') return String(id) === '202' ? aboutPage : homepage
                return null
            })
            mockTransactionExecute.mockImplementation(async () => {
                mockTransactionExecuteCall++
                if (mockTransactionExecuteCall === 2) return { rows: [{ id: 101 }] }
                if (mockTransactionExecuteCall === 3) return { rows: [{ id: 201 }, { id: 202 }] }
                return { rows: [] }
            })

            // Act
            const response = await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId: '202' }))
            const body = await response.json()

            // Assert — the homepage is context only, so one editor undo can restore every page write.
            expect(response.status).toBe(200)
            const pageUpdates = mockPayloadInstance.update.mock.calls
                .map((call: [{ collection: string; id?: number | string; data?: { layout?: Record<string, unknown>[] } }]) => call[0])
                .filter(call => call.collection === 'pages')
            expect(pageUpdates).toHaveLength(1)
            expect(pageUpdates[0].id).toBe(202)
            expect(pageUpdates[0].data?.layout).toEqual([
                expect.objectContaining({ blockType: 'hero', variant: 'split-left', headline: 'About us' }),
                expect.objectContaining({ blockType: 'faq', variant: 'accordion', headline: 'Questions' }),
            ])
            expect(body.data.appliedState.page.id).toBe(202)

            const siteUpdate = mockPayloadInstance.update.mock.calls
                .map((call: [{ collection: string; data?: Record<string, unknown> }]) => call[0])
                .find(call => call.collection === 'sites' && call.data?.theme)
            expect(siteUpdate?.data?.pendingHeaderBlock).toEqual(
                expect.objectContaining({ variant: 'transparent', logoText: 'My Brand' }),
            )
        })

        it('skips homepage layout update when site has no homepage', async () => {
            // Arrange
            mockHomepage = null
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)

            // Assert — pages.update should NOT be called, but site update must still happen
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageUpdateCall).toBeUndefined()
            expect(res.status).toBe(200)
        })

        it('increments template usageCount when applying to existing site', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert
            expect(mockPayloadInstance.update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'templates', data: { usageCount: 6 },
            }))
        })

        it('updates existing pages in-place when applying template (smart mapping)', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — pages are UPDATED, not created anew
            const pageUpdateCalls = mockPayloadInstance.update.mock.calls.filter(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageUpdateCalls.length).toBeGreaterThanOrEqual(1)
        })

        it('TC-AIWB-121: bumps the site and reskinned page revisions in the swap transaction and answers the new draftVersion', async () => {
            // Arrange
            const dialect = new PgDialect()
            mockPayloadInstance.db.drizzle.execute.mockImplementation(async (query: SQL) => {
                const text = dialect.sqlToQuery(query).sql
                if (text.includes('FROM sites')) return { rows: [{ editor_revision: 8, editor_last_save_id: null }] }
                if (text.includes('FROM pages')) return { rows: [{ editor_revision: 4, editor_last_save_id: null }] }
                return { rows: mockHomepage ? [{ id: (mockHomepage as Record<string, unknown>).id }] : [] }
            })
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101', pageId: '201' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            const bumps = mockTransactionExecute.mock.calls
                .map(([query]: [SQL]) => dialect.sqlToQuery(query))
                .filter(query => query.sql.includes('editor_revision = editor_revision + 1'))
            expect(bumps.map(query => query.sql.split(' ')[1])).toEqual(['sites', 'pages'])
            expect(bumps[0].params).toEqual([null, 101])
            expect(bumps[1].params).toEqual([null, 201, 101])
            expect(body.data.draftVersion).toBe('8.4')
        })

        it('runs the complete template swap in one transaction', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)

            // Assert
            expect(res.status).toBe(200)
            expect(mockDrizzleTransaction).toHaveBeenCalledTimes(1)

            const swapUpdates = mockPayloadInstance.update.mock.calls
                .map((call: [{ collection: string; req?: { transactionID?: string } }]) => call[0])
                .filter(call => call.collection === 'sites' || call.collection === 'pages')

            expect(swapUpdates).not.toHaveLength(0)
            expect(swapUpdates.every(call => typeof call.req?.transactionID === 'string')).toBe(true)
            expect(new Set(swapUpdates.map(call => call.req?.transactionID)).size).toBe(1)
        })

        it('TC-F07.039: preserves the stable block ID used by locale_content', async () => {
            // Arrange
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    {
                        id: '5f47ac10b58c4c6b9f0e8a2d',
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Localized hero',
                    },
                ],
            }

            // Act
            await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))

            // Assert
            const pageUpdate = mockPayloadInstance.update.mock.calls.find(
                (call: [{ collection: string }]) => call[0].collection === 'pages',
            )
            expect(pageUpdate?.[0].data.layout[0].id).toBe('5f47ac10b58c4c6b9f0e8a2d')
            expect(pageUpdate?.[0].draft).toBe(true)
        })

        it('TC-F07.039: applies the template layout to an empty homepage', async () => {
            // Arrange
            mockHomepage = { ...DEFAULT_HOMEPAGE, layout: [] }

            // Act
            const response = await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))
            const body = await response.json()

            // Assert
            const pageUpdate = mockPayloadInstance.update.mock.calls.find(
                (call: [{ collection: string }]) => call[0].collection === 'pages',
            )
            // [TC-AIAUD-213] the template's features block has no rows; Payload refuses an empty
            // required `features` list, so the shared sanitizer drops it instead of failing the page.
            const layout = pageUpdate?.[0].data.layout as Array<{ blockType: string }>
            expect(layout.map((block) => block.blockType)).toEqual(['hero'])
            expect(body.data.pagesUpdated).toBe(1)
        })

        it('TC-F07.040: reports unmatched sections without injecting them into the new layout', async () => {
            // Arrange
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    { blockType: 'hero', headline: 'Keep me' },
                    { blockType: 'faq', headline: 'Old FAQ', items: [{ question: 'Q', answer: 'A' }] },
                ],
            }

            // Act
            const response = await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))
            const body = await response.json()

            // Assert
            const pageUpdate = mockPayloadInstance.update.mock.calls.find(
                (call: [{ collection: string }]) => call[0].collection === 'pages',
            )
            const layout = pageUpdate?.[0].data.layout as Array<{ blockType: string }>

            expect(layout.some(block => block.blockType === 'faq')).toBe(false)
            expect(body.data.unmatchedBlocks).toContain('faq')
        })

        it('TC-F07.039: reskins canonical header/footer as pending draft data', async () => {
            // Arrange
            const headerLocales = { vi: { logoText: 'Thương hiệu của tôi', links: [{ label: 'Trang chủ', url: '/' }] } }
            const footerLocales = { vi: { copyrightText: 'Bản quyền của tôi' } }
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                templatePages: [{
                    isHomepage: true,
                    layout: [
                        { blockType: 'navigation', variant: 'transparent', logoText: 'Template logo' },
                        { blockType: 'hero', variant: 'split', headline: 'Template hero' },
                        { blockType: 'footer', variant: 'minimal', copyrightText: 'Template copyright' },
                    ],
                }],
            }
            mockSite = {
                ...DEFAULT_SITE,
                pendingHeaderBlock: { blockType: 'navigation', variant: 'default', logoText: 'My Brand', _localeContent: headerLocales },
                pendingFooterBlock: { blockType: 'footer', variant: 'default', copyrightText: 'My Copyright', _localeContent: footerLocales },
            }

            // Act
            await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))

            // Assert
            const siteUpdate = mockPayloadInstance.update.mock.calls.find(
                (call: [{ collection: string; data?: { theme?: unknown } }]) => call[0].collection === 'sites' && call[0].data?.theme,
            )?.[0]
            expect(siteUpdate.data.pendingHeaderBlock).toMatchObject({ variant: 'transparent', logoText: 'My Brand' })
            expect(siteUpdate.data.pendingFooterBlock).toMatchObject({ variant: 'minimal', copyrightText: 'My Copyright' })
            expect(siteUpdate.data.pendingHeaderBlock._localeContent).toEqual(headerLocales)
            expect(siteUpdate.data.pendingFooterBlock._localeContent).toEqual(footerLocales)
        })

        it('TC-F07.022: rejects an exhausted template allowance before swap writes', async () => {
            // Arrange
            vi.mocked(canUseWithinLimit).mockResolvedValue(false)

            // Act
            const response = await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))
            const body = await response.json()

            // Assert
            expect(response.status).toBe(403)
            expect(body.error.code).toBe('FEATURE_LOCKED')
            expect(mockPayloadInstance.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'pages' }),
            )
        })

        it('returns an error when a swap write fails, allowing the transaction to roll back', async () => {
            // Arrange
            mockPayloadInstance.update.mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'pages') throw new Error('page update failed')
                return {}
            })
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

            // Act
            const res = await POST(makeRequest({ templateId: 'tpl-modern', siteId: '101' }))

            // Assert
            expect(res.status).toBe(500)
            expect(mockDrizzleTransaction).toHaveBeenCalledTimes(1)
            consoleError.mockRestore()
        })

        it('finds all existing pages inside the tenant transaction', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — tenant lock, site lock, page read, then the site + page draft revision bumps (TC-AIWB-121)
            // all share one session.
            expect(mockTransactionExecute).toHaveBeenCalledTimes(5)
            // payload.findByID must be called for the fetched page IDs
            const pageFindByIDCall = mockPayloadInstance.findByID.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageFindByIDCall).toBeDefined()
        })
    })

    // ── TC-F07.016: Authorization / tenant ownership ──────────────────────────

    describe('[TC-F07.016] Authorization and tenant ownership', () => {

        it('returns tenant-safe 404 when site belongs to a different tenant', async () => {
            // Arrange — site tenant does NOT match user's tenant
            mockSite = { ...DEFAULT_SITE, tenant: { id: 'tenant-DIFFERENT' } }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error.message).toMatch(/site not found/i)
        })

        it('returns tenant-safe 404 when scalar site.tenant does not match user tenant', async () => {
            // Arrange — tenant stored as plain ID string (non-populated relationship)
            mockSite = { ...DEFAULT_SITE, tenant: 'tenant-DIFFERENT' }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error.message).toMatch(/site not found/i)
        })

        it('accepts ownership when site.tenant is a scalar ID matching user tenant', async () => {
            // Arrange — tenant stored as plain ID (non-populated)
            mockSite = { ...DEFAULT_SITE, tenant: 'tenant-99' }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.data.applied).toBe(true)
        })

        it('returns 404 when siteId does not match any site in database', async () => {
            // Arrange
            mockSite = null
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '999' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error.message).toMatch(/site not found/i)
        })
    })

    // ── Edge cases ────────────────────────────────────────────────────────────

    describe('Edge cases', () => {

        it('skips a page write when template has no defaultBlocks and layout is unchanged', async () => {
            // Arrange — template has no blocks → templateBlocksClean is empty
            // → smart mapping skipped → re-skin path keeps existing blocks
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultBlocks: undefined }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert — no redundant page write; the stored layout is already correct.
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeUndefined()
            expect(body.data.pagesUpdated).toBe(0)
            expect(res.status).toBe(200)
        })

        it('passes siteId as Number when calling payload.findByID and payload.update for sites', async () => {
            // Arrange — siteId is a string in the request body
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — route must coerce to Number before DB calls
            const sitesFindCall = mockPayloadInstance.findByID.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(typeof sitesFindCall[0].id).toBe('number')
            expect(sitesFindCall[0].id).toBe(101)

            const sitesUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(typeof sitesUpdateCall[0].id).toBe('number')
        })

        it('returns siteId as a Number in the response body (not a string)', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(typeof body.data.siteId).toBe('number')
            expect(body.data.siteId).toBe(101)
        })

        // ── TC-F07.040: null defaultBlocks ────────────────────────────────────

        it('TC-F07.040: skips a page write when null defaultBlocks leaves layout unchanged', async () => {
            // Arrange — template.defaultBlocks is null → templateBlocksClean = []
            // → re-skin path preserves existing blocks
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultBlocks: null }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert — no redundant page write; the stored layout is already correct.
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeUndefined()
            expect(body.data.pagesUpdated).toBe(0)
            expect(res.status).toBe(200)
        })

        // ── TC-F07.041: null defaultTheme ─────────────────────────────────────

        it('TC-F07.041: apply template with null defaultTheme uses fallback theme defaults', async () => {
            // Arrange — template.defaultTheme is explicitly null
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultTheme: null }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — site theme must contain hardcoded fallback values
            const siteUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [{ collection: string; data?: { theme?: unknown }; id?: number | string }]) => c[0].collection === 'sites' && c[0].data?.theme
            )
            expect(siteUpdateCall).toBeDefined()
            expect(siteUpdateCall[0].data.theme).toMatchObject({
                primaryColor: '#0ea5e9',
                fontHeading: 'Outfit',
                fontBody: 'Inter',
                colorMode: 'dark',
            })
        })

        // ── TC-F07.044–046: contact formFields sanitization ────────────────────

        it('TC-F07.044: valid contact formFields are preserved during template apply', async () => {
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                defaultBlocks: [{ blockType: 'contact', headline: 'Template contact', formFields: [] }],
            }
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    {
                        blockType: 'contact', headline: 'Contact Us',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Name', required: true },
                            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                        ],
                    },
                    { blockType: 'footer', logoText: 'Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            await POST(req)

            type PageUpdateArg = { collection: string; id?: number | string; data: { layout?: Record<string, unknown>[] } }
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [PageUpdateArg]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeDefined()
            const layout = pageUpdateCall![0].data.layout as Record<string, unknown>[]
            const contactBlock = layout.find(b => b.blockType === 'contact')
            expect(contactBlock).toBeDefined()
            const formFields = contactBlock!.formFields as Record<string, unknown>[]
            expect(formFields).toHaveLength(2)
            expect(formFields[0].fieldName).toBe('name')
        })

        it('TC-F07.045: invalid formFields items are filtered out (missing/wrong type)', async () => {
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                defaultBlocks: [{ blockType: 'contact', headline: 'Template contact', formFields: [] }],
            }
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    {
                        blockType: 'contact', headline: 'Contact',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Name' },          // valid
                            { fieldName: '', fieldType: 'text', label: 'Empty name' },          // invalid: empty fieldName
                            { fieldName: 123, fieldType: 'text', label: 'Number name' },        // invalid: non-string
                            { fieldName: 'x', fieldType: 'bogus', label: 'Bad type' },          // invalid: unknown fieldType
                            { fieldName: 'msg', fieldType: 'textarea', label: '' },             // invalid: empty label
                            { fieldName: '   ', fieldType: 'text', label: 'Whitespace' },       // invalid: whitespace-only
                        ],
                    },
                    { blockType: 'footer', logoText: 'Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            await POST(req)

            type PageUpdateArg = { collection: string; id?: number | string; data: { layout?: Record<string, unknown>[] } }
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [PageUpdateArg]) => c[0].collection === 'pages' && c[0].id === 201
            )
            const layout = pageUpdateCall![0].data.layout as Record<string, unknown>[]
            const contactBlock = layout.find(b => b.blockType === 'contact')!
            const formFields = contactBlock.formFields as Record<string, unknown>[]
            expect(formFields).toHaveLength(1) // only 'name' survives
            expect(formFields[0].fieldName).toBe('name')
        })

        it('TC-F07.046: all-invalid formFields falls back to default 3 fields', async () => {
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                defaultBlocks: [{ blockType: 'contact', headline: 'Template contact', formFields: [] }],
            }
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    {
                        blockType: 'contact', headline: 'Contact',
                        formFields: [
                            { fieldName: null, fieldType: null, label: null },
                            { bad: 'data' },
                        ],
                    },
                    { blockType: 'footer', logoText: 'Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            await POST(req)

            type PageUpdateArg = { collection: string; id?: number | string; data: { layout?: Record<string, unknown>[] } }
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [PageUpdateArg]) => c[0].collection === 'pages' && c[0].id === 201
            )
            const layout = pageUpdateCall![0].data.layout as Record<string, unknown>[]
            const contactBlock = layout.find(b => b.blockType === 'contact')!
            const formFields = contactBlock.formFields as Record<string, unknown>[]
            expect(formFields).toHaveLength(3)
            expect(formFields.map(f => f.fieldName)).toEqual(['name', 'email', 'message'])
        })

        // ── TC-F07.047: google-maps dropped — temporarily disabled per GH-820 ──

        it('TC-F07.047: google-maps block is dropped (embedUrl cannot be auto-generated, GH-820)', async () => {
            mockHomepage = {
                ...DEFAULT_HOMEPAGE,
                layout: [
                    { blockType: 'google-maps', headline: 'Find Us', embedUrl: '', address: '123 Street' },
                    { blockType: 'footer', logoText: 'Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            await POST(req)

            type PageUpdateArg = { collection: string; id?: number | string; data: { layout?: Record<string, unknown>[] } }
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: [PageUpdateArg]) => c[0].collection === 'pages' && c[0].id === 201
            )
            const layout = pageUpdateCall![0].data.layout as Record<string, unknown>[]
            const mapsBlock = layout.find(b => b.blockType === 'google-maps')
            expect(mapsBlock).toBeUndefined()
        })

        // ── TC-F07.048: usageCount failure doesn't crash apply ────────────────

        it('TC-F07.048: template usageCount update failure does not fail the apply', async () => {
            // Save original implementation to restore after test
            const originalImpl = mockPayloadInstance.update.getMockImplementation()

            // Make template update throw on usageCount (but not on other updates)
            mockPayloadInstance.update.mockImplementation(async (args: Record<string, unknown>) => {
                if (args.collection === 'templates') {
                    throw new Error('Category validation failed')
                }
                return {}
            })

            try {
                const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })
                const res = await POST(req)
                const body = await res.json()

                // Apply should still succeed despite usageCount failure
                expect(res.status).toBe(200)
                expect(body.data.applied).toBe(true)
            } finally {
                // Restore original mock to avoid polluting subsequent tests
                if (originalImpl) {
                    mockPayloadInstance.update.mockImplementation(originalImpl)
                } else {
                    mockPayloadInstance.update.mockResolvedValue({})
                }
            }
        })

        // ── TC-F07.042: siteId as empty string ────────────────────────────────

        it('TC-F07.042: siteId as empty string "" is treated as falsy, creates new site', async () => {
            // Arrange — schema transforms "" to "" but route checks if (siteId) which is falsy
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert — went through new-site creation path, not apply-to-existing
            expect(res.status).toBe(200)
            expect(body.applied).toBeUndefined()
            expect(body.siteId).toBe(999) // mockCreatedSite.id
            const siteCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'sites'
            )
            expect(siteCreateCall).toBeDefined()
        })

        // ── TC-F07.043: templateId as number ──────────────────────────────────

        it('TC-F07.043: templateId as number is coerced to string by schema and works correctly', async () => {
            // Arrange — schema: z.union([z.string().min(1), z.number()]).transform(String)
            const req = makeRequest({ templateId: 42, siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert — schema coerces 42 → "42", route calls findByID with "42"
            expect(res.status).toBe(200)
            expect(body.data.applied).toBe(true)
            const templateFindCall = mockPayloadInstance.findByID.mock.calls.find(
                (c: any[]) => c[0].collection === 'templates'
            )
            expect(templateFindCall).toBeDefined()
            expect(typeof templateFindCall[0].id).toBe('string')
            expect(templateFindCall[0].id).toBe('42')
        })

        // ── TC-F07.050: GH-731 service-cards empty titles coerced on apply ─────
        it('TC-F07.050: service-cards with empty titles in existing layout are coerced before payload.update', async () => {
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                defaultBlocks: [{ blockType: 'service-cards', variant: 'grid', headline: 'Template services', services: [] }],
            }
            // Arrange — homepage has a service-cards block with empty service titles
            // (simulates data written to DB before the AI gen sanitization fix)
            mockHomepage = {
                id: 201,
                slug: 'home',
                isHomepage: true,
                layout: [
                    { blockType: 'hero', variant: 'centered', headline: 'Hero' },
                    {
                        blockType: 'service-cards',
                        variant: 'grid',
                        headline: 'Our Services',
                        services: [
                            { title: '', description: 'desc 1', icon: '🛠️' },
                            { title: null, description: 'desc 2', icon: '⭐' },
                            { description: 'desc 3', icon: '🔧' },
                            { title: 'Valid Title', description: 'desc 4', icon: '✅' },
                        ],
                    },
                    { blockType: 'footer', logoText: 'Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — payload.update for the page was called with coerced titles
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeDefined()
            const layout = pageUpdateCall[0].data.layout as Record<string, unknown>[]
            const scBlock = layout.find(b => b.blockType === 'service-cards')
            expect(scBlock).toBeDefined()
            const services = scBlock!.services as Record<string, unknown>[]
            // empty/null/missing titles must be coerced to 'Service'
            expect(services[0].title).toBe('Service')
            expect(services[1].title).toBe('Service')
            expect(services[2].title).toBe('Service')
            // valid title must be preserved
            expect(services[3].title).toBe('Valid Title')
        })

        // ── TC-F07.049: multi-page template dedup ─────────────────────────────
        // Bug repro: templatePages.flatMap across all pages concatenated nav+footer
        // from every template page into the homepage Smart Mapping source, creating
        // duplicate nav/footer blocks on the user's homepage layout.
        it('TC-F07.049: multi-page template applies homepage-only blocks, no nav/footer duplication', async () => {
            // Arrange — Professional-style template with 3 pages, each carrying nav+footer
            mockTemplate = {
                ...DEFAULT_TEMPLATE,
                templatePages: [
                    {
                        title: 'Home',
                        slug: 'home',
                        isHomepage: true,
                        layout: [
                            { blockType: 'navigation', links: [] },
                            { blockType: 'hero', variant: 'centered', headline: 'Tpl Hero' },
                            { blockType: 'features', items: [] },
                            { blockType: 'footer', logoText: 'Tpl Footer' },
                        ],
                    },
                    {
                        title: 'About',
                        slug: 'about',
                        isHomepage: false,
                        layout: [
                            { blockType: 'navigation', links: [] },
                            { blockType: 'team', members: [] },
                            { blockType: 'footer', logoText: 'Tpl Footer' },
                        ],
                    },
                    {
                        title: 'Contact',
                        slug: 'contact',
                        isHomepage: false,
                        layout: [
                            { blockType: 'navigation', links: [] },
                            { blockType: 'contact', formFields: [] },
                            { blockType: 'footer', logoText: 'Tpl Footer' },
                        ],
                    },
                ],
            }
            // User homepage has 1 nav + 1 hero + 1 footer
            mockHomepage = {
                id: 201,
                slug: 'home',
                isHomepage: true,
                layout: [
                    { blockType: 'navigation', links: [{ label: 'User Link', url: '/' }] },
                    { blockType: 'hero', variant: 'split', headline: 'User Hero' },
                    { blockType: 'footer', logoText: 'User Footer' },
                ],
            }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — user homepage updated with exactly 1 nav + 1 footer (no dupes)
            const pageUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages' && c[0].id === 201
            )
            expect(pageUpdateCall).toBeDefined()
            const layout = pageUpdateCall[0].data.layout as Record<string, unknown>[]
            const navCount = layout.filter(b => b.blockType === 'navigation').length
            const footerCount = layout.filter(b => b.blockType === 'footer').length
            expect(navCount).toBe(1)
            expect(footerCount).toBe(1)
            // User's footer content must be preserved (Smart Mapping intent)
            const footer = layout.find(b => b.blockType === 'footer')
            expect(footer?.logoText).toBe('User Footer')
        })
    })
})

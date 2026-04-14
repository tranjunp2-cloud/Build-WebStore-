/**
 * Unit Tests — POST /api/ai/apply-template
 *
 * Coverage:
 *   TC-F07.039 — Apply template to existing site (smart mapping)
 *   TC-F07.016 — Unauthorized access blocked (401/403)
 *   TC-F07.023 — New site creation from template (backward compat)
 *   TC-F07.022 — Rate limit protection (429)
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

const DEFAULT_HOMEPAGE = { id: 201, slug: 'home', isHomepage: true }

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

const mockPayloadInstance = {
    findByID: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'templates') return mockTemplate
        if (collection === 'sites') return mockSite
        return null
    }),
    find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'tenants') return { docs: mockTenant ? [mockTenant] : [] }
        if (collection === 'pages') return { docs: mockHomepage ? [mockHomepage] : [] }
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
    },
}

// ── Route handler — imported AFTER all mocks ─────────────────────────────────

import { POST } from '@/app/api/ai/apply-template/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
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
            return null
        })
        mockPayloadInstance.find.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection === 'tenants') return { docs: mockTenant ? [mockTenant] : [] }
            if (collection === 'pages') return { docs: mockHomepage ? [mockHomepage] : [] }
            return { docs: [] }
        })
        mockPayloadInstance.create.mockImplementation(async ({ collection }: { collection: string }) => {
            if (collection === 'sites') return mockCreatedSite
            return { id: 1000 }
        })
        mockPayloadInstance.update.mockResolvedValue({})
        mockPayloadInstance.delete.mockResolvedValue({})
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
            expect(body.applied).toBeUndefined() // backward compat: no applied field
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

        it('increments template usageCount by 1 when creating new site', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern' })

            // Act
            await POST(req)

            // Assert
            const templateUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'templates'
            )
            expect(templateUpdateCall).toBeDefined()
            expect(templateUpdateCall[0].data.usageCount).toBe(6) // 5 + 1
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

        it('returns 200 with applied:true when siteId is valid and owned by user', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.applied).toBe(true)
            expect(body.siteId).toBe(101)
            expect(body.siteName).toBe('My Site')
            expect(body.templateName).toBe('Modern Business')
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

        it('deletes existing pages and creates new homepage with template defaultBlocks', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — old page deleted, new page created with template blocks
            expect(mockPayloadInstance.delete).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'pages', id: 201 })
            )
            const pageCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageCreateCall).toBeDefined()
            // Layout is sanitized (variants resolved, unknown blocks filtered)
            // Just verify blocks are present with correct blockTypes
            const layout = pageCreateCall[0].data.layout as Record<string, unknown>[]
            expect(layout.length).toBeGreaterThan(0)
            expect(layout[0].blockType).toBe('hero')
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

        it('increments template usageCount by 1 when applying to existing site', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert
            const templateUpdateCall = mockPayloadInstance.update.mock.calls.find(
                (c: any[]) => c[0].collection === 'templates'
            )
            expect(templateUpdateCall).toBeDefined()
            expect(templateUpdateCall[0].data.usageCount).toBe(6) // 5 + 1
        })

        it('creates new pages from template when applying to existing site (multi-page)', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — creates pages (delete old + create new is the new flow)
            const pageCreateCalls = mockPayloadInstance.create.mock.calls.filter(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageCreateCalls.length).toBeGreaterThanOrEqual(1)
        })

        it('finds all existing pages by site ID for deletion', async () => {
            // Arrange
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — verify the find() query shape for pages (all pages, not just homepage)
            const pageFindCall = mockPayloadInstance.find.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageFindCall).toBeDefined()
            expect(pageFindCall[0].where).toMatchObject({
                site: { equals: 101 },
            })
        })
    })

    // ── TC-F07.016: Authorization / tenant ownership ──────────────────────────

    describe('[TC-F07.016] Authorization and tenant ownership', () => {

        it('returns 403 when site belongs to a different tenant', async () => {
            // Arrange — site tenant does NOT match user's tenant
            mockSite = { ...DEFAULT_SITE, tenant: { id: 'tenant-DIFFERENT' } }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(403)
            expect(body.error).toMatch(/unauthorized/i)
        })

        it('returns 403 when site.tenant is a scalar ID not matching user tenant', async () => {
            // Arrange — tenant stored as plain ID string (non-populated relationship)
            mockSite = { ...DEFAULT_SITE, tenant: 'tenant-DIFFERENT' }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            const res = await POST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(403)
            expect(body.error).toMatch(/unauthorized/i)
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
            expect(body.applied).toBe(true)
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
            expect(body.error).toMatch(/site not found/i)
        })
    })

    // ── Edge cases ────────────────────────────────────────────────────────────

    describe('Edge cases', () => {

        it('uses empty array for blocks when template has no defaultBlocks', async () => {
            // Arrange
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultBlocks: undefined }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — page created with empty array layout (not undefined/null)
            const pageCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageCreateCall).toBeDefined()
            expect(pageCreateCall[0].data.layout).toEqual([])
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
            expect(typeof body.siteId).toBe('number')
            expect(body.siteId).toBe(101)
        })

        // ── TC-F07.040: null defaultBlocks ────────────────────────────────────

        it('TC-F07.040: apply template with null defaultBlocks uses empty array for layout', async () => {
            // Arrange — template.defaultBlocks is explicitly null (not undefined)
            mockTemplate = { ...DEFAULT_TEMPLATE, defaultBlocks: null }
            const req = makeRequest({ templateId: 'tpl-modern', siteId: '101' })

            // Act
            await POST(req)

            // Assert — page created with [] layout, not null
            const pageCreateCall = mockPayloadInstance.create.mock.calls.find(
                (c: any[]) => c[0].collection === 'pages'
            )
            expect(pageCreateCall).toBeDefined()
            expect(pageCreateCall[0].data.layout).toEqual([])
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
            expect(body.applied).toBe(true)
            const templateFindCall = mockPayloadInstance.findByID.mock.calls.find(
                (c: any[]) => c[0].collection === 'templates'
            )
            expect(templateFindCall).toBeDefined()
            expect(typeof templateFindCall[0].id).toBe('string')
            expect(templateFindCall[0].id).toBe('42')
        })
    })
})

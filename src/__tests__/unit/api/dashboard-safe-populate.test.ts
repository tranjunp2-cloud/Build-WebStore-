/**
 * TC-PERF-126 — dashboard REST reads (`GET /api/blogs`, `GET /api/blogs/[id]`, `GET /api/users/me`) populate
 * users / tenants / sites with display fields only. The Local API skips field read access, so a plain depth-1
 * read returned the whole tenant row (xenditSecretKey, xenditCallbackToken, echIntegration.apiKey) and the
 * author's otpHash / keyString to the browser (found by the LEAKCANARY demo-host check). The same leak reached the
 * RSC payload of /settings/profile, /settings/staff (initialUser.tenants) and /sites (whole depth-2 site rows).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFind = vi.fn()
const mockFindByID = vi.fn()
const owner = { id: 3, email: 'owner@example.com', roles: ['tenant-owner'], tenants: [{ tenant: 1, status: 'active' }] }

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find: mockFind, findByID: mockFindByID })),
}))
vi.mock('@payloadcms/next/utilities', () => ({
    getPayloadHMR: vi.fn(async () => ({ find: mockFind, findByID: mockFindByID })),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/app/(dashboard)/settings/profile/_components/account-settings-client', () => ({ AccountSettingsClient: () => null }))
vi.mock('@/app/(dashboard)/settings/staff/_components/TeamAccountTabs', () => ({ TeamAccountTabs: () => null }))
vi.mock('@/app/(dashboard)/sites/SitesPageClient', () => ({ SitesPageClient: () => null }))
vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(async () => '1'),
    getCurrentUser: vi.fn(async () => owner),
    withAuth: (handler: (...args: unknown[]) => unknown) => (req: unknown, ctx: unknown) => handler(owner, req, ctx),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: () => (handler: unknown) => handler,
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => null),
    canUse: vi.fn(async () => true),
}))

import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'
import { GET as listBlogs } from '@/app/api/blogs/route'
import { GET as getBlog } from '@/app/api/blogs/[id]/route'
import { GET as getMe } from '@/app/api/users/me/route'
import AccountSettingsPage from '@/app/(dashboard)/settings/profile/page'
import StaffPage from '@/app/(dashboard)/settings/staff/page'
import MySitesPage from '@/app/(dashboard)/sites/page'

const SECRET_FIELDS = [
    'xenditSecretKey', 'xenditCallbackToken', 'easyParcelIntegration', 'echIntegration',
    'otpHash', 'keyString', 'sessions', 'hash', 'salt',
]

describe('dashboard REST reads populate display fields only [TC-PERF-126]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1, limit: 20 })
        mockFindByID.mockResolvedValue({ id: 7, tenant: { id: 1 }, tenants: [] })
    })

    it('the shared populate selects no secret or credential field', () => {
        // Arrange
        const selected = Object.values(SAFE_RELATION_POPULATE).flatMap((fields) => Object.keys(fields))

        // Act
        const leaked = selected.filter((field) => SECRET_FIELDS.includes(field))

        // Assert
        expect(leaked).toEqual([])
        expect(Object.keys(SAFE_RELATION_POPULATE).sort()).toEqual(['sites', 'tenants', 'users'])
    })

    it('GET /api/blogs passes the safe populate to the depth-1 list read', async () => {
        // Arrange
        const req = new Request('https://shop.example.com/api/blogs?limit=5')

        // Act
        const res = await (listBlogs as unknown as (r: Request) => Promise<Response>)(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs', depth: 1, populate: SAFE_RELATION_POPULATE,
        }))
    })

    it('GET /api/blogs/[id] passes the safe populate to the depth-1 post read', async () => {
        // Arrange
        const req = new Request('https://shop.example.com/api/blogs/7')
        const ctx = { params: Promise.resolve({ id: '7' }) }

        // Act
        const res = await (getBlog as unknown as (r: Request, c: typeof ctx) => Promise<Response>)(req, ctx)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blogs', id: '7', depth: 1, populate: SAFE_RELATION_POPULATE,
        }))
    })

    it('GET /api/users/me passes the safe populate so memberships never carry the tenant row', async () => {
        // Arrange
        const { NextRequest } = await import('next/server')
        const req = new NextRequest('https://shop.example.com/api/users/me')

        // Act
        const res = await getMe(req)

        // Assert
        expect(res.status).toBe(200)
        expect(mockFindByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users', id: 3, depth: 1, populate: SAFE_RELATION_POPULATE,
        }))
    })

    it('/settings/profile and /settings/staff read the viewer with the safe populate', async () => {
        // Arrange
        const userReads = () => mockFindByID.mock.calls.map(([args]) => args).filter((a) => a.collection === 'users')

        // Act
        await AccountSettingsPage()
        await StaffPage()

        // Assert
        expect(userReads()).toHaveLength(2)
        for (const args of userReads()) {
            expect(args).toEqual(expect.objectContaining({ id: 3, depth: 1, populate: SAFE_RELATION_POPULATE }))
        }
    })

    it('/sites reads the card columns at depth 0 (no populated tenant row)', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [{ id: 1, name: 'Shop', generationStatus: 'completed' }], totalDocs: 1 })

        // Act
        await MySitesPage()

        // Assert
        const [args] = mockFind.mock.calls[0]
        expect(args).toEqual(expect.objectContaining({ collection: 'sites', depth: 0 }))
        expect(Object.keys(args.select)).not.toContain('tenant')
        expect(args.select).toEqual(expect.objectContaining({ name: true, domain: true, generationStatus: true }))
    })
})

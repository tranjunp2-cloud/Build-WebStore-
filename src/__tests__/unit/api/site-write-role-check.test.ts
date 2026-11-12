/**
 * Unit Tests: editor write APIs enforce builder role (#2092)
 * TC-ID: TC-F12.17 (save), TC-F12.18 (publish), TC-F12.19 (unpublish), TC-F12.20 (pending/non-member), TC-F12.21 (regression)
 * Real: save/publish routes, publishSite, canBuildSite. Faked: auth, Payload, plan gate, rate limit.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH as savePatch } from '@/app/api/sites/[siteId]/save/route'
import { PATCH as publishPatch, DELETE as unpublish } from '@/app/api/sites/[siteId]/publish/route'
import { publishSite } from '@/lib/sites/publish-site'
import { getCurrentUser } from '@/lib/auth'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
    checkTwoTierRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
}))
vi.mock('@/lib/migration/pw1-publish-grant', () => ({
    PW1_PUBLISH_HEADER: 'x-pw1-publish',
    hasCompletedPw1PublishGrant: vi.fn(async () => false),
    readPw1PublishGrant: vi.fn(() => null),
}))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PROFESSIONAL' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({
    TenantSiteLockError: class TenantSiteLockError extends Error {},
    withTenantRowLock: vi.fn(async (_p: unknown, _t: unknown, op: (req: { transactionID: string }) => Promise<unknown>) => op({ transactionID: 'tx' })),
    lockTenantSiteRows: vi.fn().mockResolvedValue(undefined),
    executeTenantTransaction: vi.fn().mockResolvedValue({ rows: [] }),
}))

const cms = {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
    update: vi.fn().mockResolvedValue({ id: 'site-1', status: 'draft' }),
    db: { drizzle: { execute: vi.fn().mockResolvedValue({ rows: [] }) } },
}
vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))

type Membership = { tenant: string; role?: string; status?: string; permissions?: string[] }
const userWith = (...tenants: Membership[]) => ({ id: 'user-1', email: 's@example.com', tenants })
const params = { params: Promise.resolve({ siteId: 'site-1' }) }
const req = (method: string) =>
    new NextRequest('http://localhost:3000/api/sites/site-1/x', {
        method,
        body: method === 'DELETE' ? undefined : JSON.stringify({ blocks: [] }),
        headers: { 'Content-Type': 'application/json' },
    })

const DENIED: Array<[string, Membership[]]> = [
    ['custom without builder', [{ tenant: 'tenant-1', role: 'custom', status: 'active', permissions: ['orders'] }]],
    ['pending membership', [{ tenant: 'tenant-1', role: 'owner', status: 'pending' }]],
    ['other tenant only', [{ tenant: 'tenant-2', role: 'owner', status: 'active' }]],
]
const ALLOWED: Array<[string, Membership]> = [
    ['owner', { tenant: 'tenant-1', role: 'owner', status: 'active' }],
    ['admin', { tenant: 'tenant-1', role: 'admin', status: 'active' }],
    ['editor', { tenant: 'tenant-1', role: 'editor', status: 'active' }],
    ['viewer', { tenant: 'tenant-1', role: 'viewer', status: 'active' }],
    ['custom with builder', { tenant: 'tenant-1', role: 'custom', status: 'active', permissions: ['builder'] }],
]

beforeEach(() => {
    vi.clearAllMocks()
    cms.findByID.mockResolvedValue({ id: 'site-1', tenant: 'tenant-1', status: 'published' })
})

describe('TC-F12.17/20 — PATCH save', () => {
    it.each(DENIED)('403 and no write for %s', async (_n, tenants) => {
        vi.mocked(getCurrentUser).mockResolvedValue(userWith(...tenants) as never)
        const res = await savePatch(req('PATCH'), params)
        expect(res.status).toBe(403)
        expect(cms.update).not.toHaveBeenCalled()
    })
})

describe('TC-F12.18/20 — PATCH publish', () => {
    it.each(DENIED)('403 and no write for %s', async (_n, tenants) => {
        vi.mocked(getCurrentUser).mockResolvedValue(userWith(...tenants) as never)
        const res = await publishPatch(req('PATCH'), params)
        expect(res.status).toBe(403)
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('publishSite itself is fail-closed for a caller without builder', async () => {
        const result = await publishSite({
            payload: cms as never, user: userWith(DENIED[0][1][0]) as never, siteId: 'site-1', body: {}, pw1Grant: null,
        })
        expect(result.status).toBe(403)
        expect(cms.update).not.toHaveBeenCalled()
    })
})

describe('TC-F12.19/20 — DELETE publish (unpublish)', () => {
    it.each(DENIED)('403 and site stays published for %s', async (_n, tenants) => {
        vi.mocked(getCurrentUser).mockResolvedValue(userWith(...tenants) as never)
        const res = await unpublish(req('DELETE'), params)
        expect(res.status).toBe(403)
        expect(cms.update).not.toHaveBeenCalled()
    })
})

describe('TC-F12.21 — allowed roles keep working', () => {
    it.each(ALLOWED)('%s is not blocked by the role check', async (_n, membership) => {
        vi.mocked(getCurrentUser).mockResolvedValue(userWith(membership) as never)

        const unpub = await unpublish(req('DELETE'), params)
        expect(unpub.status).toBe(200)
        expect(cms.update).toHaveBeenCalledTimes(1)

        const published = await publishSite({ payload: cms as never, user: userWith(membership) as never, siteId: 'site-1', body: {}, pw1Grant: null })
        expect(published.status).not.toBe(403)

        const saved = await savePatch(req('PATCH'), params)
        expect(saved.status).not.toBe(403)
    })
})

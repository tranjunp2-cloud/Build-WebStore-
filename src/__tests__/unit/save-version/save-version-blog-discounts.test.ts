// @vitest-environment node
/**
 * TC-AICP-327 — saveBlogForUser with `expectedUpdatedAt`: the loaded version saves and returns the post with its new
 * updatedAt; a stale version answers `{ ok: false, code: 'VERSION_CONFLICT', current }` and writes nothing (also for a
 * super-admin, who otherwise reads nothing first); no version = as before; the tenant check still comes first.
 * TC-AICP-328 — updateDiscountAs + PUT /api/v1/discounts/[id]: same rules; the route answers HTTP 409 with the typed body,
 * the expectedUpdatedAt field is never written to the discount, a body without it behaves as before.
 * Real: save-blog, discount-service, the PUT route + its schema, save-version. Faked: Payload, auth, plan gate.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cms = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn(), update: vi.fn(), create: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'PRO' })),
    canUse: vi.fn(async () => true),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: unknown, ctx: unknown) => unknown) => (req: unknown, ctx: unknown) => handler({ id: 'u1', tenants: [{ tenant: { id: 't1' } }] }, req, ctx),
    extractTenantId: () => 't1',
}))

import { PUT } from '@/app/api/v1/discounts/[id]/route'
import { saveBlogForUser } from '@/lib/blog/save-blog'
import { updateDiscountAs } from '@/lib/discounts/discount-service'
import { VersionConflictError } from '@/lib/save-version/save-version'

const LOADED = '2026-10-22T01:00:00.000Z'
const NEWER = '2026-10-22T02:30:00.000Z'
const NEXT = '2026-10-22T02:31:00.000Z'

const owner = { id: 'u1', email: 'o@x.my', tenants: [{ tenant: 't1' }] } as never
const admin = { id: 'u9', email: 'a@x.my', roles: ['super-admin'] } as never
const post = (over: Record<string, unknown> = {}) => ({ id: 7, tenant: 't1', title: 'Old', updatedAt: LOADED, ...over })
const input = (over: Record<string, unknown> = {}) => ({ id: '7', title: 'Mine', slug: 'mine', content: 'c', status: 'draft', ...over })

beforeEach(() => {
    vi.clearAllMocks()
    cms.find.mockResolvedValue({ docs: [{ id: 3 }] })
    cms.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 7, ...data, updatedAt: NEXT }))
})

describe('saveBlogForUser with expectedUpdatedAt [TC-AICP-327]', () => {
    it('TC-AICP-327: the loaded version saves and returns the post with its new updatedAt', async () => {
        cms.findByID.mockResolvedValue(post())

        const saved = await saveBlogForUser(owner, input({ expectedUpdatedAt: LOADED }) as never)

        expect(cms.update).toHaveBeenCalledTimes(1)
        expect(saved).toMatchObject({ id: 7, title: 'Mine', updatedAt: NEXT })
        // the version is a guard, never a stored field
        expect(cms.update.mock.calls[0]![0].data).not.toHaveProperty('expectedUpdatedAt')
    })

    it('TC-AICP-327: a stale version is refused with the stored version; nothing is written', async () => {
        cms.findByID.mockResolvedValue(post({ updatedAt: NEWER }))

        const out = await saveBlogForUser(owner, input({ expectedUpdatedAt: LOADED }) as never)

        expect(out).toEqual({ ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('TC-AICP-327: a super-admin is checked too; without a version nothing is read or checked', async () => {
        cms.findByID.mockResolvedValue(post({ updatedAt: NEWER }))
        expect(await saveBlogForUser(admin, input({ expectedUpdatedAt: LOADED }) as never)).toMatchObject({ code: 'VERSION_CONFLICT' })
        expect(cms.update).not.toHaveBeenCalled()

        cms.findByID.mockClear()
        await saveBlogForUser(admin, input() as never)
        expect(cms.findByID).not.toHaveBeenCalled()
        await saveBlogForUser(owner, input() as never)
        expect(cms.update).toHaveBeenCalledTimes(2)
    })

    it('TC-AICP-327: another tenant\'s post is Unauthorized, not a conflict', async () => {
        cms.findByID.mockResolvedValue(post({ tenant: 'other', updatedAt: NEWER }))
        expect(await saveBlogForUser(owner, input({ expectedUpdatedAt: LOADED }) as never)).toEqual({ error: 'Unauthorized update access' })
    })

    it('TC-AICP-327: two saves from one editor: the second sends the version the first returned', async () => {
        cms.findByID.mockResolvedValueOnce(post()).mockResolvedValueOnce(post({ updatedAt: NEXT }))
        const first = await saveBlogForUser(owner, input({ expectedUpdatedAt: LOADED }) as never)
        const second = await saveBlogForUser(owner, input({ title: 'Mine 2', expectedUpdatedAt: first.updatedAt }) as never)
        expect(second.title).toBe('Mine 2')
        expect(cms.update).toHaveBeenCalledTimes(2)
    })
})

const actor = { user: { id: 'u1' } as never, tenantId: 't1' }

describe('discount update with expectedUpdatedAt [TC-AICP-328]', () => {
    const discount = (updatedAt = LOADED) => ({ id: 'd1', code: 'SAVE10', tenant: 't1', updatedAt })

    it('TC-AICP-328: updateDiscountAs saves the loaded version, refuses a stale one without writing, ignores a missing one', async () => {
        cms.findByID.mockResolvedValue(discount())
        await updateDiscountAs(actor, 'd1', { value: 20 }, LOADED)
        expect(cms.update).toHaveBeenCalledTimes(1)

        cms.update.mockClear()
        cms.findByID.mockResolvedValue(discount(NEWER))
        const err = await updateDiscountAs(actor, 'd1', { value: 30 }, LOADED).catch((e) => e)
        expect(err).toBeInstanceOf(VersionConflictError)
        expect(err.current).toBe(NEWER)
        expect(cms.update).not.toHaveBeenCalled()

        await updateDiscountAs(actor, 'd1', { value: 30 })
        expect(cms.update).toHaveBeenCalledTimes(1)
    })

    const put = (body: Record<string, unknown>) => PUT(
        new NextRequest('http://localhost/api/v1/discounts/d1', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) as never,
        { params: Promise.resolve({ id: 'd1' }) },
    )

    it('TC-AICP-328: PUT with the loaded version answers 200 with the new updatedAt; the field is not written', async () => {
        cms.findByID.mockResolvedValue(discount())
        cms.update.mockResolvedValue({ ...discount(), value: 20, updatedAt: NEXT })

        const res = await put({ value: 20, expectedUpdatedAt: LOADED })

        expect(res.status).toBe(200)
        expect((await res.json()).data.updatedAt).toBe(NEXT)
        expect(cms.update.mock.calls[0]![0].data).toEqual({ value: 20 })
    })

    it('TC-AICP-328: PUT with a stale version answers HTTP 409 with the typed body and writes nothing', async () => {
        cms.findByID.mockResolvedValue(discount(NEWER))

        const res = await put({ value: 20, expectedUpdatedAt: LOADED })

        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(cms.update).not.toHaveBeenCalled()
    })

    it('TC-AICP-328: PUT without a version behaves as before; a malformed version is a 400', async () => {
        cms.findByID.mockResolvedValue(discount(NEWER))
        cms.update.mockResolvedValue({ ...discount(NEWER), value: 20 })
        expect((await put({ value: 20 })).status).toBe(200)

        cms.update.mockClear()
        expect((await put({ value: 20, expectedUpdatedAt: 'yesterday' })).status).toBe(400)
        expect(cms.update).not.toHaveBeenCalled()
    })
})

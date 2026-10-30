/**
 * TC-AICAP-PW-030..039 — /api/admin/ai-settings/shops and /shops/[tenantId], /api/admin/ai-caps/status: auth, happy and
 * validation paths. Real: routes, withSuperAdmin, ShopLimitInputSchema. Faked: session, the shop-overrides / status libs.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(), listShopOverrides: vi.fn(), getShopLimitView: vi.fn(), saveShopOverride: vi.fn(), removeShopOverride: vi.fn(), loadCapsStatus: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/admin/ai-caps/shop-overrides', () => ({
    listShopOverrides: mocks.listShopOverrides, getShopLimitView: mocks.getShopLimitView, saveShopOverride: mocks.saveShopOverride, removeShopOverride: mocks.removeShopOverride,
}))
vi.mock('@/lib/admin/ai-caps/status', () => ({ loadCapsStatus: mocks.loadCapsStatus }))

import { GET as getStatus } from '@/app/api/admin/ai-caps/status/route'
import { GET as listShops } from '@/app/api/admin/ai-settings/shops/route'
import { DELETE, GET, PUT } from '@/app/api/admin/ai-settings/shops/[tenantId]/route'

const url = 'https://prime.test/api/admin/ai-settings/shops/12'
const ctx = (tenantId = '12') => ({ params: Promise.resolve({ tenantId }) })
const req = (method: string, body?: unknown) =>
    new NextRequest(url, { method, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) })
const valid = { mode: 'custom', aiBudgetUsd: 1.5, reason: 'VIP shop' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 4, roles: ['super-admin'] })
    mocks.getShopLimitView.mockResolvedValue({ tenantId: 12, shopName: 'Demo', plan: 'FREEMIUM', override: null })
    mocks.saveShopOverride.mockResolvedValue({ ok: true })
    mocks.removeShopOverride.mockResolvedValue(true)
    mocks.listShopOverrides.mockResolvedValue([{ tenantId: 12 }])
    mocks.loadCapsStatus.mockResolvedValue({ day: '2026-10-29' })
})

describe('auth', () => {
    it('TC-AICAP-PW-030 every route answers 401 without a session and 403 for a non super-admin, before touching data', async () => {
        const calls = [
            () => listShops(new NextRequest('https://prime.test/x'), undefined),
            () => getStatus(new NextRequest('https://prime.test/y'), undefined),
            () => GET(req('GET'), ctx()),
            () => PUT(req('PUT', valid), ctx()),
            () => DELETE(req('DELETE'), ctx()),
        ]
        for (const call of calls) {
            mocks.getCurrentUser.mockResolvedValueOnce(null)
            expect((await call()).status).toBe(401)
            mocks.getCurrentUser.mockResolvedValueOnce({ id: 2, roles: ['tenant-owner'] })
            expect((await call()).status).toBe(403)
        }
        for (const fn of [mocks.listShopOverrides, mocks.getShopLimitView, mocks.saveShopOverride, mocks.removeShopOverride, mocks.loadCapsStatus]) {
            expect(fn).not.toHaveBeenCalled()
        }
    })
})

describe('list and status', () => {
    it('TC-AICAP-PW-031 lists overrides; a failure is a 500 with a fixed message', async () => {
        const res = await listShops(new NextRequest('https://prime.test/x'), undefined)
        expect(await res.json()).toEqual({ overrides: [{ tenantId: 12 }] })
        mocks.listShopOverrides.mockRejectedValueOnce(new Error('db'))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const bad = await listShops(new NextRequest('https://prime.test/x'), undefined)
        expect(bad.status).toBe(500)
        expect(await bad.json()).toEqual({ error: 'Could not load shop overrides' })
    })

    it('TC-AICAP-PW-032 status returns the loaded status, 500 when loading fails', async () => {
        expect(await (await getStatus(new NextRequest('https://prime.test/y'), undefined)).json()).toEqual({ day: '2026-10-29' })
        mocks.loadCapsStatus.mockRejectedValueOnce(new Error('db'))
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        expect((await getStatus(new NextRequest('https://prime.test/y'), undefined)).status).toBe(500)
    })
})

describe('GET one shop', () => {
    it('TC-AICAP-PW-033 returns the view; 404 for an unknown shop; 400 for a bad id', async () => {
        expect((await GET(req('GET'), ctx())).status).toBe(200)
        expect(mocks.getShopLimitView).toHaveBeenCalledWith(12)
        mocks.getShopLimitView.mockResolvedValueOnce(null)
        expect((await GET(req('GET'), ctx())).status).toBe(404)
        for (const bad of ['abc', '0', '-1', '1.5', '12abc', '99999999999']) expect((await GET(req('GET'), ctx(bad))).status).toBe(400)
    })
})

describe('PUT', () => {
    it('TC-AICAP-PW-034 saves with the signed-in user as setBy and returns the reloaded view', async () => {
        const res = await PUT(req('PUT', { ...valid, expiresAt: '2030-01-01T00:00:00Z' }), ctx())
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ tenantId: 12, shopName: 'Demo' })
        expect(mocks.saveShopOverride).toHaveBeenCalledWith(12, expect.objectContaining({ mode: 'custom', aiBudgetUsd: 1.5, reason: 'VIP shop', expiresAt: '2030-01-01T00:00:00Z' }), 4)
    })

    it('TC-AICAP-PW-035 answers 400 for non-JSON and 422 with field paths for a bad body, saving nothing', async () => {
        expect((await PUT(req('PUT', 'nope'), ctx())).status).toBe(400)
        const missing = await PUT(req('PUT', { mode: 'custom', aiBudgetUsd: 1 }), ctx())
        expect(missing.status).toBe(422)
        expect((await missing.json()).errors).toEqual([expect.objectContaining({ path: ['reason'] })])
        for (const body of [{ ...valid, mode: 'vip' }, { ...valid, aiBudgetUsd: -1 }, { ...valid, picturesPerDay: 1.2 }, { ...valid, expiresAt: 'soon' }, { ...valid, reason: ' ' }]) {
            expect((await PUT(req('PUT', body), ctx())).status).toBe(422)
        }
        expect((await PUT(req('PUT', valid), ctx('x'))).status).toBe(400)
        expect(mocks.saveShopOverride).not.toHaveBeenCalled()
    })

    it('TC-AICAP-PW-036 maps the store result: 404 unknown shop, 422 with the sentence, 500 on failure; a failed reload still says ok', async () => {
        mocks.saveShopOverride.mockResolvedValueOnce({ ok: false, status: 404, message: 'Shop not found.' })
        expect((await PUT(req('PUT', valid), ctx())).status).toBe(404)
        mocks.saveShopOverride.mockResolvedValueOnce({ ok: false, status: 422, message: 'The end time must be in the future.' })
        const past = await PUT(req('PUT', valid), ctx())
        expect(past.status).toBe(422)
        expect(await past.json()).toEqual({ errors: [{ path: ['mode'], message: 'The end time must be in the future.' }] })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.getShopLimitView.mockRejectedValueOnce(new Error('reload'))
        const reloadFailed = await PUT(req('PUT', valid), ctx())
        expect(reloadFailed.status).toBe(200)
        expect(await reloadFailed.json()).toEqual({ ok: true })
        mocks.saveShopOverride.mockRejectedValueOnce(new Error('db'))
        expect((await PUT(req('PUT', valid), ctx())).status).toBe(500)
    })
})

describe('DELETE', () => {
    it('TC-AICAP-PW-037 removes the override; 404 when there is none; 400 for a bad id; 500 on failure', async () => {
        expect(await (await DELETE(req('DELETE'), ctx())).json()).toEqual({ ok: true })
        expect(mocks.removeShopOverride).toHaveBeenCalledWith(12)
        mocks.removeShopOverride.mockResolvedValueOnce(false)
        expect((await DELETE(req('DELETE'), ctx())).status).toBe(404)
        expect((await DELETE(req('DELETE'), ctx('abc'))).status).toBe(400)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.removeShopOverride.mockRejectedValueOnce(new Error('db'))
        expect((await DELETE(req('DELETE'), ctx())).status).toBe(500)
    })
})

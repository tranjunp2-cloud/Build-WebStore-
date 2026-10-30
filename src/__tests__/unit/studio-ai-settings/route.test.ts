/**
 * TC-AIS-LIM-021..025 — /api/admin/ai-settings auth and body handling.
 * Real: route, withSuperAdmin. Faked: getCurrentUser, settings-store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), loadAiSettings: vi.fn(), saveAiSettings: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/admin/ai-settings/settings-store', () => ({ loadAiSettings: mocks.loadAiSettings, saveAiSettings: mocks.saveAiSettings }))

import { GET, PUT } from '@/app/api/admin/ai-settings/route'

const put = (body: unknown) =>
  new NextRequest('https://prime.test/api/admin/ai-settings', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) })
const get = () => new NextRequest('https://prime.test/api/admin/ai-settings')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: 1, roles: ['super-admin'] })
  mocks.loadAiSettings.mockResolvedValue({ limits: {} })
})

describe('[TC-AIS-LIM-021] auth', () => {
  it('answers 401 without a session and 403 for a non super-admin, on GET and PUT', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect((await GET(get())).status).toBe(401)
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 2, roles: ['tenant-owner'] })
    expect((await GET(get())).status).toBe(403)
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect((await PUT(put({ limits: [] }))).status).toBe(401)
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 2, roles: ['tenant-owner'] })
    expect((await PUT(put({ limits: [] }))).status).toBe(403)
    expect(mocks.saveAiSettings).not.toHaveBeenCalled()
    expect(mocks.loadAiSettings).not.toHaveBeenCalled()
  })
})

describe('[TC-AIS-LIM-022] GET', () => {
  it('returns the settings, and 500 when loading fails', async () => {
    expect(await (await GET(get())).json()).toEqual({ limits: {} })
    mocks.loadAiSettings.mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect((await GET(get())).status).toBe(500)
  })
})

describe('[TC-AIS-LIM-023] PUT body validation', () => {
  it('answers 400 for non-JSON, an empty body or a malformed limit', async () => {
    expect((await PUT(put('not json'))).status).toBe(400)
    expect((await PUT(put({}))).status).toBe(400)
    expect((await PUT(put({ limits: [{ planCode: 'FREEMIUM', kind: 'nope', value: '1' }] }))).status).toBe(400)
    expect(mocks.saveAiSettings).not.toHaveBeenCalled()
  })
})

describe('[TC-AIS-LIM-024] PUT results', () => {
  it('passes the body to the store and returns the reloaded settings', async () => {
    mocks.saveAiSettings.mockResolvedValue({ ok: true, written: 2 })
    const limits = [{ planCode: 'FREEMIUM', kind: 'budget', value: '0.1' }]
    const res = await PUT(put({ limits }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, written: 2, settings: { limits: {} } })
    expect(mocks.saveAiSettings).toHaveBeenCalledWith({ limits, config: undefined })
  })

  it('answers 422 with field errors when the store rejects the values', async () => {
    const errors = [{ path: ['limits', 'FREEMIUM', 'budget'], message: 'bad' }]
    mocks.saveAiSettings.mockResolvedValue({ ok: false, errors })
    const res = await PUT(put({ limits: [{ planCode: 'FREEMIUM', kind: 'budget', value: '-1' }] }))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ errors })
  })

  it('answers 500 when the write throws, but not when only the reload fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.saveAiSettings.mockRejectedValueOnce(new Error('db'))
    expect((await PUT(put({ limits: [] }))).status).toBe(500)
    mocks.saveAiSettings.mockResolvedValueOnce({ ok: true, written: 0 })
    mocks.loadAiSettings.mockRejectedValueOnce(new Error('reload'))
    const res = await PUT(put({ limits: [] }))
    expect(res.status).toBe(200)
    expect((await res.json()).settings).toBeNull()
  })
})

describe('[TC-AIS-LIM-025] platform config in the body', () => {
  it('forwards config untouched for the store to validate', async () => {
    mocks.saveAiSettings.mockResolvedValue({ ok: true, written: 1 })
    const config = { prices: {}, images: {}, models: {} }
    await PUT(put({ config }))
    expect(mocks.saveAiSettings).toHaveBeenCalledWith({ limits: undefined, config })
  })
})

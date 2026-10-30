/**
 * TC-AIPROV-PW-001..008 — signing, allow-list, auth, error mapping and logging of /api/admin/ai-providers/**.
 * Real: route, withSuperAdmin, upstream client, token signing. Faked: getCurrentUser, fetch (ai-platform).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))

import { DELETE, GET, POST, PUT } from '@/app/api/admin/ai-providers/[[...path]]/route'
import { matchCall } from '@/lib/admin/ai-providers/allow-list'

const SECRET = 'test-secret-test-secret-test-secret-123'
const fetchMock = vi.fn()
const upstream = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const ctx = (path: string[] = []) => ({ params: Promise.resolve({ path }) })
const req = (method: string, path: string, body?: unknown) =>
  new NextRequest(`https://prime.test/api/admin/ai-providers${path}`, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
const segs = (path: string) => path.split('/').filter(Boolean)

beforeEach(() => {
  process.env.AI_PLATFORM_URL = 'https://ai.test/'
  process.env.AI_PLATFORM_CONTEXT_SECRET = SECRET
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(upstream(200, { providers: [] }))
  mocks.getCurrentUser.mockResolvedValue({ id: 7, email: 'minh@primecommerce.asia', roles: ['super-admin'] })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })

describe('[TC-AIPROV-PW-001] settings token', () => {
  it('is HS256 with iss prime-web, aud ai-platform:internal, sub settings-admin, 2 min and the actor', async () => {
    await GET(req('GET', ''), ctx())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://ai.test/internal/settings')
    const token = String((init.headers as Record<string, string>).authorization).replace('Bearer ', '')
    const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode(SECRET), { issuer: 'prime-web', audience: 'ai-platform:internal', subject: 'settings-admin' })
    expect(protectedHeader.alg).toBe('HS256')
    expect(payload.actor).toEqual({ id: '7', email: 'minh@primecommerce.asia' })
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(120)
  })
})

describe('[TC-AIPROV-PW-002] allow-list', () => {
  it('maps exactly the contract calls', () => {
    const q = new URLSearchParams()
    const cases: Array<[string, string, string]> = [
      ['GET', '', '/internal/settings'], ['PUT', 'providers/openai', '/internal/settings/providers/openai'],
      ['PUT', 'providers/compat-local/key', '/internal/settings/providers/compat-local/key'], ['DELETE', 'providers/anthropic/key', '/internal/settings/providers/anthropic/key'],
      ['POST', 'providers/google/test', '/internal/settings/providers/google/test'], ['POST', 'endpoints', '/internal/settings/endpoints'],
      ['DELETE', 'endpoints/local', '/internal/settings/endpoints/local'], ['PUT', 'gateway', '/internal/settings/gateway'], ['PUT', 'routing', '/internal/settings/routing'],
      ['PUT', 'tasks', '/internal/settings/tasks'], ['PUT', 'runtime', '/internal/settings/runtime'], ['GET', 'history', '/internal/settings/history'],
      ['POST', 'history/h-1_x/restore', '/internal/settings/history/h-1_x/restore'],
    ]
    for (const [method, path, expected] of cases) expect(matchCall(method, segs(path), q)?.path, `${method} ${path}`).toBe(expected)
    expect(matchCall('POST', segs('providers/openai/test'), q)?.slow).toBe(true)
  })
  it('refuses everything else, odd ids and bad history queries', () => {
    const q = new URLSearchParams()
    for (const [method, path] of [['DELETE', ''], ['PUT', 'providers/evil'], ['PUT', 'providers/compat-/key'], ['PUT', 'providers/../key'], ['POST', 'routing'], ['GET', 'routing'],
      ['PATCH', 'routing'], ['DELETE', 'providers/openai'], ['POST', 'history/a b/restore'], ['GET', 'internal/settings']]) {
      expect(matchCall(method, segs(path), q), `${method} ${path}`).toBeNull()
    }
    expect(matchCall('GET', ['history'], new URLSearchParams('area=routing&limit=20'))?.path).toBe('/internal/settings/history?area=routing&limit=20')
    expect(matchCall('GET', ['history'], new URLSearchParams('area=secrets'))).toBeNull()
    expect(matchCall('GET', ['history'], new URLSearchParams('limit=9999'))).toBeNull()
  })
  it('answers 404 without calling ai-platform for a call outside the list', async () => {
    expect((await PUT(req('PUT', '/providers/evil'), ctx(['providers', 'evil']))).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('[TC-AIPROV-PW-003] auth', () => {
  it('is 401 without a session and 403 for a non super-admin, on every method, before any upstream call', async () => {
    for (const handler of [GET, POST, PUT, DELETE]) {
      mocks.getCurrentUser.mockResolvedValueOnce(null)
      expect((await handler(req('GET', ''), ctx())).status).toBe(401)
      mocks.getCurrentUser.mockResolvedValueOnce({ id: 2, roles: ['tenant-owner'] })
      expect((await handler(req('GET', ''), ctx())).status).toBe(403)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('[TC-AIPROV-PW-004] forwarding', () => {
  it('forwards a JSON body as is and returns the SettingsView', async () => {
    const body = { tiers: { fast: { chain: ['a:b'], effort: null, timeoutMs: 60000 } } }
    const res = await PUT(req('PUT', '/routing', body), ctx(['routing']))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ providers: [] })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual(body)
  })
  it('sends {} for a body-less POST and rejects non-object or oversized bodies', async () => {
    await POST(req('POST', '/history/h1/restore'), ctx(['history', 'h1', 'restore']))
    expect(fetchMock.mock.calls[0][1].body).toBe('{}')
    expect((await PUT(req('PUT', '/routing', 'nope'), ctx(['routing']))).status).toBe(400)
    expect((await PUT(req('PUT', '/routing', '[1]'), ctx(['routing']))).status).toBe(400)
    expect((await PUT(req('PUT', '/routing', JSON.stringify({ x: 'y'.repeat(70_000) })), ctx(['routing']))).status).toBe(413)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('[TC-AIPROV-PW-005] upstream errors', () => {
  const put = () => PUT(req('PUT', '/runtime', { values: {} }), ctx(['runtime']))
  it('passes 422 field errors through', async () => {
    fetchMock.mockResolvedValueOnce(upstream(422, { errors: [{ path: 'tiers.fast.chain', message: 'unknown model' }] }))
    const res = await put()
    expect(res.status).toBe(422)
    expect((await res.json()).errors).toEqual([{ path: 'tiers.fast.chain', message: 'unknown model' }])
  })
  it('maps 401 to 502 without echoing upstream text, 503 to 503, 429 to 429', async () => {
    fetchMock.mockResolvedValueOnce(upstream(401, { detail: 'bad token abc' }))
    const unauthorised = await put()
    expect(unauthorised.status).toBe(502)
    expect(JSON.stringify(await unauthorised.json())).not.toContain('abc')
    fetchMock.mockResolvedValueOnce(upstream(503, {}))
    expect((await put()).status).toBe(503)
    fetchMock.mockResolvedValueOnce(upstream(429, {}))
    expect((await put()).status).toBe(429)
    fetchMock.mockResolvedValueOnce(upstream(500, { detail: 'stack' }))
    expect((await put()).status).toBe(502)
  })
  it('answers 503 "AI service unreachable" when ai-platform is down', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const res = await GET(req('GET', ''), ctx())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'AI service unreachable' })
  })
  it('answers 503 when ai-platform is not configured', async () => {
    delete process.env.AI_PLATFORM_URL
    const res = await GET(req('GET', ''), ctx())
    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('[TC-AIPROV-PW-006] bodies are never logged', () => {
  it('writes no key text to any console channel, on success or failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => undefined))
    const secret = 'sk-live-very-secret-key-0000'
    await PUT(req('PUT', '/providers/openai/key', { apiKey: secret }), ctx(['providers', 'openai', 'key']))
    fetchMock.mockRejectedValueOnce(new Error(`boom ${secret}`))
    await PUT(req('PUT', '/providers/openai/key', { apiKey: secret }), ctx(['providers', 'openai', 'key']))
    fetchMock.mockResolvedValueOnce(upstream(422, { errors: [{ path: 'apiKey', message: 'bad' }] }))
    await PUT(req('PUT', '/providers/openai/key', { apiKey: secret }), ctx(['providers', 'openai', 'key']))
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(secret)
  })
})

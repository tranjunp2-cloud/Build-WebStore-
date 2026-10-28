/**
 * TC-AIWB-97 — one-shot editor routes (translate, rewrite-text) that name a siteId bill and cache-scope to
 * the SITE's workspace after the site access check, never the cookie workspace; a site the caller cannot
 * use is refused before any model call; without a siteId behaviour is unchanged (cookie workspace).
 * Real: routes, schemas, ai-tasks.resolveSiteBillingTenant, task client. Faked: session, site access,
 * actor resolution (records the tenant it was asked for), network.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { resolveActor, resolveSite } = vi.hoisted(() => ({ resolveActor: vi.fn(), resolveSite: vi.fn() }))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler({ id: 7, email: 'owner@shop.my' }, req, ctx),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10 })) }))
vi.mock('@/lib/sites/site-access', () => ({ resolveSiteForUser: resolveSite }))
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {},
    resolveActorForUser: resolveActor,
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

import { POST as translatePOST } from '@/app/api/ai/translate/route'
import { POST as rewritePOST } from '@/app/api/ai/rewrite-text/route'
import { clearTranslationCache } from '@/lib/ai/translate-cache'

const fetchMock = vi.fn<typeof fetch>()
const post = (path: string, body: unknown) => new NextRequest(`http://localhost:3000${path}`, { method: 'POST', body: JSON.stringify(body) })
const actorIn = (tenantId: string) => ({ user: { id: 7 }, tenantId, organizationId: `org_${tenantId}`, role: 'owner' })

const taskResponse = (taskId: string, output: unknown) => Response.json({
    taskId,
    promptVersion: `${taskId}@1`,
    requestId: 'r1',
    output,
    usage: { provider: 'openai', model: 'gpt-4.1-nano', costUsdMicros: 1, latencyMs: 5, fallbacks: [] },
})

const translateBody = { blockType: 'hero', targetLocale: 'ms', content: { headline: 'Fresh bread daily' } }
const rewriteBody = { text: 'Fresh bread daily', instruction: 'shorter' }

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    resolveActor.mockReset().mockImplementation(async (_u: unknown, _r: unknown, o?: { tenantId?: string }) => actorIn(o?.tenantId ?? 'cookie'))
    resolveSite.mockReset().mockResolvedValue({ ok: true, site: { id: 5 }, tenantId: '42' })
    clearTranslationCache?.()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

const tenantsAsked = () => resolveActor.mock.calls.map((c) => (c[2] as { tenantId?: string } | undefined)?.tenantId)

describe('rewrite-text bills the site workspace [TC-AIWB-97]', () => {
    it('resolves the actor in the site tenant after the access check', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('copy.rewrite-text', { rewritten: 'Fresh bread' }))

        const res = await rewritePOST(post('/api/ai/rewrite-text', { ...rewriteBody, siteId: 5 }), undefined as never)

        expect(res.status).toBe(200)
        expect(resolveSite).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), '5')
        expect(tenantsAsked()).toEqual(['42'])
    })

    it('refuses a site the caller cannot use, before any model call', async () => {
        resolveSite.mockResolvedValue({ ok: false, status: 403 })

        const res = await rewritePOST(post('/api/ai/rewrite-text', { ...rewriteBody, siteId: 9 }), undefined as never)

        expect(res.status).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(resolveActor).not.toHaveBeenCalled()
    })

    it('without a siteId keeps the cookie workspace and skips the site check', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('copy.rewrite-text', { rewritten: 'Fresh bread' }))

        await rewritePOST(post('/api/ai/rewrite-text', rewriteBody), undefined as never)

        expect(resolveSite).not.toHaveBeenCalled()
        expect(tenantsAsked()).toEqual([undefined])
    })
})

describe('translate bills and caches in the site workspace [TC-AIWB-97]', () => {
    it('resolves the actor in the site tenant', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('i18n.translate-blocks', { fields: { f0: 'Roti segar setiap hari' } }))

        const res = await translatePOST(post('/api/ai/translate', { ...translateBody, siteId: '5' }), undefined as never)

        expect(res.status).toBe(200)
        expect(tenantsAsked()).toEqual(['42'])
    })

    it('returns 404 for a missing site instead of the original-content fallback', async () => {
        resolveSite.mockResolvedValue({ ok: false, status: 404 })

        const res = await translatePOST(post('/api/ai/translate', { ...translateBody, siteId: 5 }), undefined as never)

        expect(res.status).toBe(404)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('without a siteId keeps the cookie workspace', async () => {
        fetchMock.mockResolvedValueOnce(taskResponse('i18n.translate-blocks', { fields: { f0: 'Roti segar setiap hari' } }))

        await translatePOST(post('/api/ai/translate', translateBody), undefined as never)

        expect(resolveSite).not.toHaveBeenCalled()
        expect(tenantsAsked()).toEqual([undefined])
    })
})

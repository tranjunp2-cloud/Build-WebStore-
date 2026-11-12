/**
 * F26-04: POST /api/ai/translate — route-level tests
 * TC-IDs: TC-F26-04-07 → TC-F26-04-12
 *
 * Covers:
 *   TC-F26-04-07: Rate limit exceeded → 429
 *   TC-F26-04-08: targetLocale 'en' accepted; output HTML-sanitized
 *   TC-F26-04-09: Cache hit → {translated, cached: true}, no platform call
 *   TC-F26-04-10: AI platform not configured → {translated: originalContent, status: 'fallback'}
 *   TC-F26-04-11: Successful platform translation → {translated, cached: false}, cached for next call
 *   TC-F26-04-12: Platform output off-contract or outage → fallback with original content, not cached
 *   TC-AICP-24:   cache hit is served before the rate limit
 *   TC-AISEC-01:  not configured → fallback, OpenAI client never constructed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as TranslatePOST } from '@/app/api/ai/translate/route'
// withAuth-wrapped handler takes (req, ctx); the route does not read ctx.
const translate = (req: NextRequest) => TranslatePOST(req, undefined as never)
import { clearTranslationCache } from '@/lib/ai/translate-cache'
import { checkRateLimit } from '@/lib/rateLimit'
import { AgentAccessError, resolveActorForUser } from '@/lib/ai-platform/context'

// Bypass withAuth HOC — inject mock user directly
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
            return handler(user, req, ctx)
        }
    }),
}))

// Mock RateLimiter — allowed by default, toggled per test
let mockRateLimitAllowed = true
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockImplementation(() => ({
        allowed: mockRateLimitAllowed,
        remaining: 10,
        resetAt: Date.now() + 60000,
    })),
}))

// The caller's verified workspace: the platform bills and caches per organization.
vi.mock('@/lib/ai-platform/context', () => ({
    AgentAccessError: class AgentAccessError extends Error {
        constructor(message: string, readonly status: number) { super(message) }
    },
    resolveActorForUser: vi.fn(async () => ({ user: { id: 'user-xyz' }, tenantId: 'tenant-1', organizationId: 'org_1', role: 'owner' })),
    signAgentContextToken: vi.fn(async () => 'ctx-token'),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const fetchMock = vi.fn<typeof fetch>()

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/ai/translate', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

function platformReply(fields: Record<string, string>) {
    return Response.json({
        taskId: 'i18n.translate-blocks',
        promptVersion: 'i18n-translate-blocks@2',
        requestId: 'req_1',
        output: { fields },
        usage: { provider: 'openai', model: 'gpt-4.1-mini', costUsdMicros: 30, latencyMs: 800, fallbacks: [] },
    })
}

function sentTaskInput(call = 0) {
    const [, init] = fetchMock.mock.calls[call]!
    return JSON.parse(String(init?.body)).input as Record<string, unknown>
}

const VALID_BODY = {
    blockType: 'hero',
    targetLocale: 'ms',
    content: { headline: 'Welcome', subheadline: 'Your Business' },
}

const TRANSLATED = { headline: 'Selamat Datang', subheadline: 'Perniagaan Anda' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/translate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRateLimitAllowed = true
        clearTranslationCache()
        vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    // TC-F26-04-07: Rate limit exceeded
    describe('TC-F26-04-07: rate limit exceeded → 429', () => {
        it('returns 429 with error message when rate limit is hit', async () => {
            // Arrange
            mockRateLimitAllowed = false
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await translate(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(429)
            expect(body.error).toMatch(/rate limit/i)
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    // TC-F26-04-08: targetLocale 'en' accepted (F26 multilingual — translating non-EN site to EN)
    describe('TC-F26-04-08: targetLocale "en" accepted as valid translation target', () => {
        it('accepts targetLocale "en" since EN sites can now be source for VI/EL/etc.', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(platformReply({ headline: 'Welcome', subheadline: 'Your Business' }))
            const req = makeRequest({ ...VALID_BODY, targetLocale: 'en' })

            // Act
            const res = await translate(req)

            // Assert — not rejected as validation error
            expect(res.status).toBe(200)
            expect(sentTaskInput()).toMatchObject({ targetLocale: 'en' })
        })
    })

    // TC-F26-04-09: Cache hit
    describe('TC-F26-04-09: cache hit → {translated, cached: true}, no platform call', () => {
        it('returns cached translation and skips AI when cache is warm', async () => {
            // Arrange — warm the cache with one real translation
            fetchMock.mockResolvedValueOnce(platformReply(TRANSLATED))
            await translate(makeRequest(VALID_BODY))
            fetchMock.mockClear()

            // Act
            const res = await translate(makeRequest(VALID_BODY))
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.cached).toBe(true)
            expect(body.translated).toEqual(TRANSLATED)
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    // TC-AICP-24: cache hits must not consume the caller's rate-limit quota
    describe('TC-AICP-24: cache hit is served before the rate limit', () => {
        it('returns the cached translation even when the rate limit is exhausted', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(platformReply(TRANSLATED))
            await translate(makeRequest(VALID_BODY))
            vi.mocked(checkRateLimit).mockClear()
            mockRateLimitAllowed = false

            // Act
            const hit = await translate(makeRequest(VALID_BODY))
            const miss = await translate(makeRequest({ ...VALID_BODY, content: { headline: 'Edited' } }))

            // Assert
            expect(hit.status).toBe(200)
            expect((await hit.json()).cached).toBe(true)
            expect(miss.status).toBe(429)
            expect(checkRateLimit).toHaveBeenCalledTimes(1)
            expect(checkRateLimit).toHaveBeenCalledWith('ai:translate:user-xyz', 30)
        })
    })

    // TC-F26-04-10 / TC-AISEC-01: platform not configured
    describe('TC-F26-04-10: AI platform not configured → 503, no translation [TC-AIREL-240]', () => {
        it('answers 503 { ok:false, status:"fallback" } with no `translated`, and never builds an OpenAI client [TC-AISEC-01]', async () => {
            // Arrange
            vi.stubEnv('AI_PLATFORM_URL', '')
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await translate(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(503)
            expect(body).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
            expect(body).not.toHaveProperty('translated')
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    // TC-F26-04-11: Successful AI translation
    describe('TC-F26-04-11: successful AI translation → {translated, cached: false}, stored in cache', () => {
        it('returns AI translation with cached:false and writes to cache', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(platformReply(TRANSLATED))

            // Act
            const res = await translate(makeRequest(VALID_BODY))
            const body = await res.json()

            // Assert — response shape and the task the platform received
            expect(res.status).toBe(200)
            expect(body.cached).toBe(false)
            expect(body.translated).toEqual(TRANSLATED)
            const [url] = fetchMock.mock.calls[0]!
            expect(url).toBe('http://ai.internal:8300/v1/tasks/i18n.translate-blocks/run')
            expect(sentTaskInput()).toEqual({ targetLocale: 'ms', fields: { headline: 'Welcome', subheadline: 'Your Business' } })

            // Assert — cache was populated for subsequent calls with the same content
            const again = await translate(makeRequest(VALID_BODY))
            expect(await again.json()).toEqual({ translated: TRANSLATED, cached: true })
            expect(fetchMock).toHaveBeenCalledTimes(1)
        })

        it('writes translated strings back at their nested paths', async () => {
            // Arrange
            const content = { headline: 'Welcome', items: [{ title: 'Shop' }] }
            fetchMock.mockResolvedValueOnce(platformReply({ headline: 'Selamat Datang', 'items.0.title': 'Kedai' }))

            // Act
            const res = await translate(makeRequest({ ...VALID_BODY, content }))

            // Assert
            expect(await res.json()).toEqual({ translated: { headline: 'Selamat Datang', items: [{ title: 'Kedai' }] }, cached: false })
            expect(sentTaskInput()).toMatchObject({ fields: { headline: 'Welcome', 'items.0.title': 'Shop' } })
        })
    })

    // TC-F26-04-12: platform output off-contract, or platform outage
    describe('TC-F26-04-12: platform output invalid or outage → 502, never the original text [TC-AIREL-240]', () => {
        it('answers 502 with no `translated` when the platform output does not match the task contract', async () => {
            // Arrange — `fields` must be a record of strings
            fetchMock.mockResolvedValueOnce(Response.json({
                taskId: 'i18n.translate-blocks',
                promptVersion: 'i18n-translate-blocks@2',
                requestId: 'req_1',
                output: { fields: 'This is not JSON at all!!!' },
                usage: { provider: 'openai', model: 'gpt-4.1-mini', costUsdMicros: 30, latencyMs: 800, fallbacks: [] },
            }))

            // Act
            const res = await translate(makeRequest(VALID_BODY))
            const body = await res.json()

            // Assert
            expect(res.status).toBe(502)
            expect(body).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
            expect(body).not.toHaveProperty('translated')
        })

        it('does not cache a fallback, so the next call asks the platform again', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce(Response.json({ detail: 'upstream 503 from provider x' }, { status: 503 }))
            fetchMock.mockResolvedValueOnce(platformReply(TRANSLATED))

            // Act
            const failed = await translate(makeRequest(VALID_BODY))
            const retried = await translate(makeRequest(VALID_BODY))

            // Assert
            expect(failed.status).toBe(502)
            expect(await failed.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
            expect(await retried.json()).toEqual({ translated: TRANSLATED, cached: false })
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })

        it('fails without calling the platform when the caller has no active workspace', async () => {
            // Arrange
            vi.mocked(resolveActorForUser).mockRejectedValueOnce(new AgentAccessError('You are not an active member of this workspace.', 403))

            // Act
            const res = await translate(makeRequest(VALID_BODY))

            // Assert
            expect(res.status).toBe(502)
            expect(await res.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    // QA TC-F26-04-07: Phase 1 locale allowlist — only en/ms accepted
    describe('QA TC-F26-04-07: unsupported targetLocale → 400', () => {
        it('rejects "zh" (and other non en/ms locales) with 400', async () => {
            // Arrange
            const req = makeRequest({ ...VALID_BODY, targetLocale: 'zh' })

            // Act
            const res = await translate(req)

            // Assert — zod enum rejects Phase-2 locales
            expect(res.status).toBe(400)
            expect(fetchMock).not.toHaveBeenCalled()
        })
    })

    // QA TC-F26-04-08: AI output is HTML-sanitized before it is cached/returned
    describe('QA TC-F26-04-08: XSS in AI output stripped before insert', () => {
        it('removes <script> tags from translated string values', async () => {
            // Arrange — model returns an XSS payload inside a translated field
            fetchMock.mockResolvedValueOnce(platformReply({ headline: "<script>alert('xss')</script>Selamat Datang", subheadline: 'Perniagaan Anda' }))
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await translate(req)
            const body = await res.json()

            // Assert — script tag stripped, safe text retained
            expect(res.status).toBe(200)
            expect(JSON.stringify(body.translated)).not.toContain('<script>')
            expect(body.translated.headline).toContain('Selamat Datang')
        })
    })
})

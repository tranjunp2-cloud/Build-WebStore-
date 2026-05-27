/**
 * F26-04: POST /api/ai/translate — route-level tests
 * TC-IDs: TC-F26-04-07 → TC-F26-04-12
 *
 * Covers:
 *   TC-F26-04-07: Rate limit exceeded → 429
 *   TC-F26-04-08: Invalid targetLocale 'en' → 400 validation error
 *   TC-F26-04-09: Cache hit → {translated, cached: true}, no OpenAI call
 *   TC-F26-04-10: Missing OPENAI_API_KEY → {translated: originalContent, status: 'fallback'}
 *   TC-F26-04-11: Successful AI translation → {translated, cached: false}, cached for next call
 *   TC-F26-04-12: AI returns malformed JSON → fallback with original content
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as TranslatePOST } from '@/app/api/ai/translate/route'

// Bypass withAuth HOC — inject mock user directly
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-xyz', tenants: [{ tenant: 'tenant-1' }] }
            return handler(user, req, ctx)
        }
    }),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
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

// Mock translate-cache — controlled per test
let mockCacheStore: Record<string, Record<string, unknown>> = {}
vi.mock('@/lib/ai/translate-cache', () => ({
    getCachedTranslation: vi.fn().mockImplementation((blockType: string, locale: string) => {
        const key = `${blockType}||${locale}`
        return mockCacheStore[key] ?? null
    }),
    setCachedTranslation: vi.fn().mockImplementation(
        (blockType: string, locale: string, content: Record<string, unknown>) => {
            mockCacheStore[`${blockType}||${locale}`] = content
        },
    ),
}))

// Top-level OpenAI mock — vi.mock() must be top-level per testing.md
vi.mock('openai', () => {
    const OpenAI = vi.fn()
    OpenAI.prototype.chat = {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                headline: 'Selamat Datang',
                                subheadline: 'Perniagaan Anda',
                            }),
                        },
                    },
                ],
            }),
        },
    }
    return { default: OpenAI }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/ai/translate', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

const VALID_BODY = {
    blockType: 'hero',
    targetLocale: 'ms',
    content: { headline: 'Welcome', subheadline: 'Your Business' },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/translate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRateLimitAllowed = true
        mockCacheStore = {}
    })

    // TC-F26-04-07: Rate limit exceeded
    describe('TC-F26-04-07: rate limit exceeded → 429', () => {
        it('returns 429 with error message when rate limit is hit', async () => {
            // Arrange
            mockRateLimitAllowed = false
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(429)
            expect(body.error).toMatch(/rate limit/i)
        })
    })

    // TC-F26-04-08: Invalid targetLocale 'en'
    describe('TC-F26-04-08: invalid targetLocale "en" → 400 validation error', () => {
        it('returns 400 VALIDATION_ERROR when targetLocale is "en" (not in enum)', async () => {
            // Arrange
            const req = makeRequest({ ...VALID_BODY, targetLocale: 'en' })

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(400)
            expect(body.error.code).toBe('VALIDATION_ERROR')
            expect(body.error.details.fieldErrors).toHaveProperty('targetLocale')
        })
    })

    // TC-F26-04-09: Cache hit
    describe('TC-F26-04-09: cache hit → {translated, cached: true}, no OpenAI call', () => {
        it('returns cached translation and skips AI when cache is warm', async () => {
            // Arrange — pre-populate cache
            const cachedContent = { headline: 'Selamat Datang (cached)', subheadline: 'Perniagaan' }
            mockCacheStore['hero||ms'] = cachedContent
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.cached).toBe(true)
            expect(body.translated).toEqual(cachedContent)

            // OpenAI must NOT have been called
            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            expect(OpenAI.prototype.chat.completions.create).not.toHaveBeenCalled()
        })
    })

    // TC-F26-04-10: Missing OPENAI_API_KEY
    describe('TC-F26-04-10: missing OPENAI_API_KEY → fallback with original content', () => {
        it('returns original content with status "fallback" when API key is absent', async () => {
            // Arrange
            const prev = process.env.OPENAI_API_KEY
            delete process.env.OPENAI_API_KEY
            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.status).toBe('fallback')
            expect(body.translated).toEqual(VALID_BODY.content)

            // Restore
            if (prev !== undefined) process.env.OPENAI_API_KEY = prev
        })
    })

    // TC-F26-04-11: Successful AI translation
    describe('TC-F26-04-11: successful AI translation → {translated, cached: false}, stored in cache', () => {
        it('returns AI translation with cached:false and writes to cache', async () => {
            // Arrange
            process.env.OPENAI_API_KEY = 'test-key'
            const expectedTranslation = { headline: 'Selamat Datang', subheadline: 'Perniagaan Anda' }

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify(expectedTranslation) } }],
            })

            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert — response shape
            expect(res.status).toBe(200)
            expect(body.cached).toBe(false)
            expect(body.translated).toEqual(expectedTranslation)

            // Assert — cache was populated for subsequent calls
            const { setCachedTranslation } = await import('@/lib/ai/translate-cache')
            expect(setCachedTranslation).toHaveBeenCalledWith('hero', 'ms', expectedTranslation)
        })
    })

    // TC-F26-04-12: AI returns malformed JSON
    describe('TC-F26-04-12: AI returns malformed JSON → fallback with original content', () => {
        it('returns original content with status "fallback" when AI response is not valid JSON', async () => {
            // Arrange
            process.env.OPENAI_API_KEY = 'test-key'

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: 'This is not JSON at all!!!' } }],
            })

            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.status).toBe('fallback')
            expect(body.translated).toEqual(VALID_BODY.content)
        })

        it('strips markdown fences and parses successfully when AI wraps JSON in ```json blocks', async () => {
            // Arrange — valid JSON wrapped in code fences (common model behaviour)
            process.env.OPENAI_API_KEY = 'test-key'
            const inner = { headline: 'Selamat Datang', subheadline: 'Perniagaan Anda' }

            const OpenAIMod = await import('openai')
            const OpenAI = OpenAIMod.default as any
            OpenAI.prototype.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(inner)}\n\`\`\`` } }],
            })

            const req = makeRequest(VALID_BODY)

            // Act
            const res = await TranslatePOST(req)
            const body = await res.json()

            // Assert — fence-stripped JSON is parsed correctly, NOT treated as fallback
            expect(res.status).toBe(200)
            expect(body.cached).toBe(false)
            expect(body.translated).toEqual(inner)
        })
    })
})

/**
 * TC-AISEC-01 — AI platform not configured: the cut-over routes answer 503 (translate: 503, no translation)
 * and never reach an in-process OpenAI client.
 *
 * Covers: rewrite-text, product-description, seo-generate, generate-blog,
 * products-bulk-parse, seo/fix, translate.
 *
 * The static source check reads files relative to the working directory, so run from apps/prime-web
 * (the documented `npx vitest run` location).
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AI_UNAVAILABLE_MESSAGE } from '@/lib/ai-platform/config'
import { resolveSiteForUser } from '@/lib/sites/site-access'

// ─── Mocks (top-level) ─────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
    user: {} as Record<string, unknown>,
    payload: { findByID: vi.fn(), find: vi.fn(), update: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler(state.user, req, ctx),
    getCurrentUser: vi.fn(async () => null),
    tenantIdForQuery: () => 1,
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: 0 })) }))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: () => (handler: unknown) => handler,
}))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => state.payload) }))
vi.mock('@/lib/sites/site-access', () => ({
    resolveSiteForUser: vi.fn(async () => ({ ok: true, site: { id: 5, name: 'Kedai' }, tenantId: '1' })),
}))

import { POST as rewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as productDescriptionPOST } from '@/app/api/ai/product-description/route'
import { POST as seoGeneratePOST } from '@/app/api/ai/seo-generate/route'
import { POST as generateBlogPOST } from '@/app/api/ai/generate-blog/route'
import { POST as bulkParsePOST } from '@/app/api/ai/products-bulk-parse/route'
import { POST as seoFixPOST } from '@/app/api/seo/fix/route'
import { POST as translatePOST } from '@/app/api/ai/translate/route'

const OWNER = {
    id: 7,
    email: 'owner@shop.my',
    roles: ['tenant-owner'],
    tenants: [{ tenant: { id: 1 }, status: 'active' }],
}

function post(route: string, body: unknown) {
    return new NextRequest(`http://localhost:3000${route}`, { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
    state.user = OWNER
    // The URL is what is missing; a valid secret alone must not enable AI.
    vi.stubEnv('AI_PLATFORM_URL', '')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubGlobal('fetch', vi.fn(() => {
        throw new Error('no platform call expected')
    }))
    vi.mocked(resolveSiteForUser).mockClear()
    state.payload.findByID.mockReset().mockResolvedValue({ id: 5, name: 'Kedai', tenant: { id: 1 }, seo: {} })
    state.payload.find.mockReset().mockResolvedValue({ docs: [{ id: 'p1', title: 'Home', seo: {}, layout: [] }] })
    state.payload.update.mockReset().mockResolvedValue({})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

const CASES: Array<{
    name: string
    call: () => Promise<Response>
    status: number
    body: unknown
}> = [
    {
        name: 'rewrite-text',
        call: () => rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'Hello', instruction: 'Make it formal' }), undefined as never),
        status: 503,
        body: { error: AI_UNAVAILABLE_MESSAGE },
    },
    {
        name: 'product-description',
        call: () => productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee' }), undefined as never),
        status: 503,
        body: { success: false, error: AI_UNAVAILABLE_MESSAGE },
    },
    {
        name: 'seo-generate',
        call: () => seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik' }), undefined as never),
        status: 503,
        body: { success: false, error: AI_UNAVAILABLE_MESSAGE },
    },
    {
        name: 'generate-blog',
        call: () => generateBlogPOST(post('/api/ai/generate-blog', { prompt: 'Coffee in KL' }), undefined as never),
        status: 503,
        body: { success: false, error: AI_UNAVAILABLE_MESSAGE },
    },
    {
        name: 'products-bulk-parse',
        call: () => bulkParsePOST(post('/api/ai/products-bulk-parse', { promptText: 'tee 5rm' }), undefined as never),
        status: 503,
        body: { error: 'aiUnavailable' },
    },
    {
        name: 'seo/fix',
        call: () => seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never),
        status: 503,
        body: { success: false, error: { code: 'AI_UNAVAILABLE', message: AI_UNAVAILABLE_MESSAGE } },
    },
]

describe('AI routes with the ECH AI platform not configured [TC-AISEC-01]', () => {
    it.each(CASES)('$name answers $status with the user-safe message and never builds an OpenAI client', async ({ call, status, body }) => {
        const res = await call()

        expect(res.status).toBe(status)
        expect(await res.json()).toEqual(body)
    })

    it('translate answers 503 and no translation instead of the original content [TC-AISEC-01, TC-AIREL-240]', async () => {
        const content = { headline: 'Welcome' }

        const res = await translatePOST(post('/api/ai/translate', { blockType: 'hero', targetLocale: 'ms', content }), undefined as never)

        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ ok: false, status: 'fallback', error: expect.any(String) })
    })

    it('seo/fix still returns the site-level result when no page needs fixing (the AI gate is reached only when work exists)', async () => {
        state.payload.find.mockReset().mockResolvedValue({ docs: [{ id: 'p1', title: 'Home', seo: { title: 'T', description: 'D' }, layout: [] }] })
        state.payload.findByID.mockReset().mockResolvedValue({ id: 5, name: 'Kedai', tenant: { id: 1 }, seo: { metaTitle: 'T', metaDescription: 'D' } })

        const res = await seoFixPOST(post('/api/seo/fix', { siteId: '5' }), undefined as never)

        expect(res.status).toBe(200)
        expect((await res.json()).data.message).toBe('All pages already have SEO metadata')
    })

    it('a valid secret without AI_PLATFORM_URL still counts as not configured [TC-AISEC-01]', async () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(64))

        const res = await rewriteTextPOST(post('/api/ai/rewrite-text', { text: 'Hello', instruction: 'Shorter' }), undefined as never)

        expect(res.status).toBe(503)
    })
})

describe('cut-over route sources no longer import the OpenAI SDK [TC-AISEC-01]', () => {
    const SOURCES = [
        'src/app/api/ai/rewrite-text/route.ts',
        'src/app/api/ai/product-description/route.ts',
        'src/app/api/ai/seo-generate/route.ts',
        'src/app/api/ai/generate-blog/route.ts',
        'src/app/api/ai/products-bulk-parse/route.ts',
        'src/app/api/ai/translate/route.ts',
        'src/app/api/seo/fix/route.ts',
        'src/lib/ai/generate-meta.ts',
        'src/lib/ai/seo-queue.ts',
    ]

    it.each(SOURCES)('%s has no openai import', (relativePath) => {
        const source = readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

        expect(source).not.toMatch(/from\s+['"]openai['"]/)
        expect(source).not.toMatch(/require\(['"]openai['"]\)/)
    })
})

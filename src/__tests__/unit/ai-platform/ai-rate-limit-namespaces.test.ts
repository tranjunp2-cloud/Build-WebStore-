/**
 * TC-AISEC-11 — AI rate limits are per feature and per user.
 * Before: every AI route shared one bucket, so a burst on one feature blocked the others.
 * After: `ai:${feature}:${user.id}` keys. Real in-memory limiter (Redis forced off for determinism).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { clearRateLimitMap } from '@/lib/rateLimit'

vi.mock('@/lib/redis', () => ({ redis: null }))

const state = vi.hoisted(() => ({ user: { id: 7 } as { id: number } }))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler(state.user, req, ctx),
    getCurrentUser: vi.fn(async () => null),
    tenantIdForQuery: () => 1,
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: () => (handler: unknown) => handler,
}))
vi.mock('@/lib/sites/site-access', () => ({
    resolveSiteForUser: vi.fn(async () => ({ ok: true, site: { id: 5 }, tenantId: '1' })),
}))

import { POST as productDescriptionPOST } from '@/app/api/ai/product-description/route'
import { POST as rewriteTextPOST } from '@/app/api/ai/rewrite-text/route'
import { POST as seoGeneratePOST } from '@/app/api/ai/seo-generate/route'

function post(route: string, body: unknown) {
    return new NextRequest(`http://localhost:3000${route}`, { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
    clearRateLimitMap()
    state.user = { id: 7 }
    // Platform off: calls that get past the limiter answer 400/503, never 429.
    vi.stubEnv('AI_PLATFORM_URL', '')
})

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('AI rate limits are per feature [TC-AISEC-11]', () => {
    it('a rewrite-text burst does not consume the seo-generate budget', async () => {
        for (let i = 0; i < 20; i++) {
            await rewriteTextPOST(post('/api/ai/rewrite-text', {}), undefined as never)
        }

        const rewriteBlocked = await rewriteTextPOST(post('/api/ai/rewrite-text', {}), undefined as never)
        const seo = await seoGeneratePOST(post('/api/ai/seo-generate', { name: 'Kemeja Batik' }), undefined as never)

        expect(rewriteBlocked.status).toBe(429)
        expect(seo.status).toBe(503)
    })

    it('the budget belongs to the user, so another member of the platform is not limited by it', async () => {
        for (let i = 0; i < 20; i++) {
            await productDescriptionPOST(post('/api/ai/product-description', {}), undefined as never)
        }

        state.user = { id: 8 }
        const otherUser = await productDescriptionPOST(post('/api/ai/product-description', { name: 'Cotton tee' }), undefined as never)

        expect(otherUser.status).toBe(503)
    })
})

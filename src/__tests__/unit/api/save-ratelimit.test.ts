/**
 * Unit Tests: PATCH /api/sites/[siteId]/save — rate limit behavior
 * TC-ID: TC-F01.RL.SAVE — BUG-F01-05 rate limit verification
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('@payload-config', () => ({ default: {} }))

let mockAuthUser: { id: string; email: string; tenants: Array<{ tenant: string }> } | null = {
    id: 'user-1',
    email: 'owner@example.com',
    tenants: [{ tenant: 'tenant-1' }],
}

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => mockAuthUser),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn().mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'draft',
        }),
        update: vi.fn().mockResolvedValue({ id: 'site-1' }),
    }),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
}))

vi.mock('@/lib/payload-retry', () => ({
    withPayloadRetry: vi.fn().mockImplementation(async (fn: () => unknown) => fn()),
    classifyTransientError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ai/media-injector', () => ({
    stripOrphanMediaRefs: vi.fn((blocks: unknown[]) => blocks),
    cleanupNonNumericImageFields: vi.fn((blocks: unknown[]) => blocks),
}))

vi.mock('@/lib/block-normalization', () => ({
    normalizeBlocksForPersistence: vi.fn((blocks: unknown[]) => blocks),
}))

const makeReq = (siteId: string, body: Record<string, unknown>) =>
    new NextRequest(`http://localhost:3000/api/sites/${siteId}/save`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })

const makeParams = (siteId: string) => ({ params: Promise.resolve({ siteId }) })

describe('PATCH /api/sites/[siteId]/save — rate limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
    })

    it('TC-F01.RL.SAVE.01 — allows save when rate limit not exceeded', async () => {
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })

        const res = await PATCH(makeReq('site-1', { blocks: [] }), makeParams('site-1'))
        expect(res.status).not.toBe(429)
    })

    it('TC-F01.RL.SAVE.02 — returns 429 when rate limit exceeded', async () => {
        const resetAt = Date.now() + 30000
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt })

        const res = await PATCH(makeReq('site-1', { blocks: [] }), makeParams('site-1'))
        const body = await res.json()

        expect(res.status).toBe(429)
        expect(body.error).toContain('Too many save requests')
        expect(body.retryAfter).toBeGreaterThan(0)
        expect(res.headers.get('Retry-After')).toBeTruthy()
    })

    it('TC-F01.RL.SAVE.03 — rate limit key includes user id', async () => {
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })

        await PATCH(makeReq('site-1', { blocks: [] }), makeParams('site-1'))

        expect(checkRateLimit).toHaveBeenCalledWith('save:user-1', 60, 60_000)
    })

    it('TC-F01.RL.SAVE.04 — returns 401 before rate limit check when not authenticated', async () => {
        mockAuthUser = null

        const res = await PATCH(makeReq('site-1', { blocks: [] }), makeParams('site-1'))

        expect(res.status).toBe(401)
        expect(checkRateLimit).not.toHaveBeenCalled()
    })
})

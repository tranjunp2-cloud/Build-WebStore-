/**
 * TC-AIWB-98 — apply-template's rate-limit bucket is namespaced (`ai:apply-template:<user>`). The bare
 * `<user id>` key shared one bucket with any other feature that keyed on the same id.
 * Real: route up to the limiter. Faked: session and limiter (to read the key and refuse before any work).
 */

import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { limiter } = vi.hoisted(() => ({ limiter: vi.fn() }))

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (user: unknown, req: Request, ctx: unknown) => Promise<Response>) =>
        (req: Request, ctx: unknown) => handler({ id: 'user-42' }, req, ctx),
    getCurrentUser: vi.fn(async () => null),
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: limiter }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => { throw new Error('limiter must refuse first') }) }))

import { POST } from '@/app/api/ai/apply-template/route'

describe('apply-template rate-limit key [TC-AIWB-98]', () => {
    it('uses the ai:apply-template:<user> namespace and refuses with 429 before touching the database', async () => {
        limiter.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })

        const res = await POST(new NextRequest('http://localhost:3000/api/ai/apply-template', { method: 'POST', body: '{}' }), undefined as never)

        expect(res.status).toBe(429)
        expect(limiter).toHaveBeenCalledWith('ai:apply-template:user-42', 20)
    })
})

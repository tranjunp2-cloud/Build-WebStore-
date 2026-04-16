/**
 * Unit Tests: POST /api/account/reset — rate limit behavior
 * TC-ID: TC-F01.RL.RESET — BUG-F01-05 rate limit verification
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/account/reset/route'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/env', () => ({
    assertStaging: vi.fn(), // no-op — allow in tests
}))

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
        find: vi.fn().mockResolvedValue({ docs: [] }),
        delete: vi.fn(),
        update: vi.fn(),
    }),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 3600000 }),
}))

describe('POST /api/account/reset — rate limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
    })

    it('TC-F01.RL.RESET.01 — allows request when rate limit not exceeded', async () => {
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 3600000 })

        const res = await POST()
        expect(res.status).toBe(200)
    })

    it('TC-F01.RL.RESET.02 — returns 429 when rate limit exceeded', async () => {
        const resetAt = Date.now() + 1800000 // 30 min from now
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt })

        const res = await POST()
        const body = await res.json()

        expect(res.status).toBe(429)
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(body.retryAfter).toBeGreaterThan(0)
        expect(res.headers.get('Retry-After')).toBeTruthy()
    })

    it('TC-F01.RL.RESET.03 — rate limit key includes user id', async () => {
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 3600000 })

        await POST()

        expect(checkRateLimit).toHaveBeenCalledWith('account-reset:user-1', 3, 3_600_000)
    })

    it('TC-F01.RL.RESET.04 — returns 401 when not authenticated', async () => {
        mockAuthUser = null

        const res = await POST()
        const body = await res.json()

        expect(res.status).toBe(401)
        expect(body.error.code).toBe('AUTH_REQUIRED')
        // Rate limiter should NOT be called for unauthenticated requests
        expect(checkRateLimit).not.toHaveBeenCalled()
    })
})

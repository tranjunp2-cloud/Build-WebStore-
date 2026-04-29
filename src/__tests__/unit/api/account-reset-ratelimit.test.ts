/**
 * Unit Tests: POST /api/account/reset — auth & staging guard behavior
 * TC-ID: TC-F01.RL.RESET — BUG-F01-05 (rate limit removed per GH-820 — staging-only endpoint)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/account/reset/route'
import { getCurrentUser } from '@/lib/auth'

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

describe('POST /api/account/reset — auth & staging guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
    })

    it('TC-F01.RL.RESET.01 — allows authenticated reset (no rate limit — staging only endpoint)', async () => {
        const res = await POST()
        expect(res.status).toBe(200)
    })

    it('TC-F01.RL.RESET.04 — returns 401 when not authenticated', async () => {
        mockAuthUser = null

        const res = await POST()
        const body = await res.json()

        expect(res.status).toBe(401)
        expect(body.error.code).toBe('AUTH_REQUIRED')
    })
})

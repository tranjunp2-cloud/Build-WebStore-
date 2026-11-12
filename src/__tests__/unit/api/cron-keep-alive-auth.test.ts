/**
 * TC-AISEC-113 — GET /api/cron/keep-alive fails closed.
 *
 * With CRON_SECRET unset the old check compared against the literal "Bearer undefined",
 * so anyone sending that header got in. The route now refuses when the secret is unset
 * and compares in constant time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockExecute = vi.fn()
const mockGetPayload = vi.fn()
vi.mock('payload', () => ({ getPayload: (...args: unknown[]) => mockGetPayload(...args) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/cron/keep-alive/route'

const call = (authorization?: string) =>
    GET(new Request('https://app.test/api/cron/keep-alive', {
        headers: authorization ? { authorization } : {},
    }))

describe('TC-AISEC-113 — keep-alive cron auth', () => {
    beforeEach(() => {
        mockExecute.mockReset().mockResolvedValue(undefined)
        mockGetPayload.mockReset().mockResolvedValue({ db: { drizzle: { execute: mockExecute } } })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('refuses "Bearer undefined" when CRON_SECRET is unset', async () => {
        // Arrange
        vi.stubEnv('CRON_SECRET', undefined)

        // Act
        const res = await call('Bearer undefined')

        // Assert
        expect(res.status).toBe(401)
        expect(mockGetPayload).not.toHaveBeenCalled()
    })

    it('refuses a missing or wrong bearer when CRON_SECRET is set', async () => {
        vi.stubEnv('CRON_SECRET', 'cron-secret-123')

        expect((await call()).status).toBe(401)
        expect((await call('Bearer wrong-secret-12')).status).toBe(401)
        expect((await call('Bearer cron-secret-1234')).status).toBe(401)
        expect(mockGetPayload).not.toHaveBeenCalled()
    })

    it('accepts the right bearer and pings the database', async () => {
        vi.stubEnv('CRON_SECRET', 'cron-secret-123')

        const res = await call('Bearer cron-secret-123')
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.status).toBe('alive')
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })
})

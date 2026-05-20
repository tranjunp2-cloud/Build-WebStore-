import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── TC-F16.14: Notification cleanup cron endpoint ──────────────────────

const mockExecute = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        db: {
            drizzle: { execute: mockExecute },
        },
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}))

import { GET } from '@/app/api/cron/notifications/cleanup/route'

function makeRequest(authHeader?: string) {
    return {
        headers: {
            get: (name: string) => name === 'authorization' ? authHeader ?? null : null,
        },
    } as any
}

describe('GET /api/cron/notifications/cleanup [TC-F16.14]', () => {
    const originalEnv = process.env.NODE_ENV

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.NODE_ENV = 'test'
    })

    afterEach(() => {
        process.env.NODE_ENV = originalEnv
    })

    it('deletes expired notifications and returns count', async () => {
        // Arrange
        mockExecute.mockResolvedValue({ rowCount: 5 })

        // Act
        const res = await GET(makeRequest('Bearer dev-cron-secret'))
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.deleted).toBe(5)
        expect(body.message).toBe('Cleaned up 5 expired notifications')
    })

    it('returns 0 deleted when no expired notifications', async () => {
        mockExecute.mockResolvedValue({ rowCount: 0 })

        const res = await GET(makeRequest('Bearer dev-cron-secret'))
        const body = await res.json()

        expect(body.deleted).toBe(0)
    })

    it('returns 500 on database error', async () => {
        mockExecute.mockRejectedValue(new Error('DB down'))

        const res = await GET(makeRequest('Bearer dev-cron-secret'))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.success).toBe(false)
    })

    it('rejects unauthorized request in production', async () => {
        process.env.NODE_ENV = 'production'

        const res = await GET(makeRequest('Bearer wrong-secret'))

        expect(res.status).toBe(401)
    })

    it('allows request without auth in non-production', async () => {
        process.env.NODE_ENV = 'development'
        mockExecute.mockResolvedValue({ rowCount: 0 })

        const res = await GET(makeRequest())

        expect(res.status).toBe(200)
    })
})

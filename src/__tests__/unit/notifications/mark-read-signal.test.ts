import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── TC-F16.49: mark-read rings the user's doorbell so other devices refresh (#1972) ──

const mockExecute = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ db: { drizzle: { execute: mockExecute } } })),
}))
vi.mock('@/payload.config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: (u: unknown, r: unknown) => unknown) => async (request: unknown) =>
        handler({ id: 100, tenants: [{ tenant: 200 }] }, request),
}))
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }),
}))

const mockSignal = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/notifications/signal-notification', () => ({
    signalNotificationUsers: (...a: unknown[]) => mockSignal(...a),
}))
// Run the "after response" task immediately so we can assert on it.
vi.mock('@/lib/runtime/run-after-response', () => ({
    runAfterResponse: (_label: string, task: () => Promise<unknown>) => { void task() },
}))

import { POST } from '@/app/api/notifications/mark-read/route'

const post = (body: unknown) =>
    POST(new NextRequest(new URL('/api/notifications/mark-read', 'http://localhost:3000'), {
        method: 'POST', body: JSON.stringify(body),
    }), undefined as never)

beforeEach(() => {
    vi.clearAllMocks()
})

describe('[TC-F16.49] mark-read signal', () => {
    it('signals the user after mark_all updated rows', async () => {
        mockExecute.mockResolvedValue({ rowCount: 3 })

        const res = await post({ mark_all: true })

        expect(res.status).toBe(200)
        await vi.waitFor(() => expect(mockSignal).toHaveBeenCalledWith([100]))
    })

    it('signals the user after marking specific ids', async () => {
        mockExecute.mockResolvedValue({ rowCount: 1 })

        await post({ notificationIds: ['5'] })

        await vi.waitFor(() => expect(mockSignal).toHaveBeenCalledWith([100]))
    })

    it('does NOT signal when nothing changed (already read)', async () => {
        mockExecute.mockResolvedValue({ rowCount: 0 })

        const res = await post({ mark_all: true })

        expect(res.status).toBe(200)
        expect(mockSignal).not.toHaveBeenCalled()
    })
})

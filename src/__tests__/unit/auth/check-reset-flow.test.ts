import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/check-reset-flow/route'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'

// Mock next/server
vi.mock('next/server', () => {
    return {
        NextRequest: vi.fn(),
        NextResponse: {
            json: vi.fn((data, init) => ({
                data,
                status: init?.status || 200,
            })),
        },
    }
})

// Mock payload configured imports
vi.mock('@payload-config', () => ({ default: {} }))

// Mock payload
vi.mock('payload', () => {
    return {
        getPayload: vi.fn(),
    }
})

// Mock rate limiter (added by PR #589)
import { checkRateLimit } from '@/lib/rateLimit'
vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
}))

describe('POST /api/auth/check-reset-flow', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            find: vi.fn(),
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    const createMockRequest = (body: any) => {
        return {
            json: vi.fn().mockResolvedValue(body),
            headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
        } as unknown as NextRequest
    }

    it('returns internal flow if no email provided', async () => {
        const req = createMockRequest({})
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.data).toEqual({ flow: 'internal' })
        expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('returns internal flow if email not found', async () => {
        mockPayload.find.mockResolvedValue({ docs: [] })

        const req = createMockRequest({ email: 'notfound@test.com' })
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.data).toEqual({ flow: 'internal' })
        expect(mockPayload.find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            where: { email: { equals: 'notfound@test.com' } }
        }))
    })

    it('returns sso flow and redirectUrl for tenant-owner', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [{ roles: ['tenant-owner'] }]
        })

        const req = createMockRequest({ email: 'owner@test.com' })
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.data).toEqual({
            flow: 'sso',
            redirectUrl: expect.any(String)
        })
    })

    it('returns internal flow for staff (editor)', async () => {
        mockPayload.find.mockResolvedValue({
            docs: [{ roles: ['editor'] }]
        })

        const req = createMockRequest({ email: 'staff@test.com' })
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.data).toEqual({ flow: 'internal' })
    })

    it('returns internal flow on exception', async () => {
        mockPayload.find.mockRejectedValue(new Error('DB Error'))

        const req = createMockRequest({ email: 'error@test.com' })
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.data).toEqual({ flow: 'internal' })
    })

    it('TC-F01.RL.CHECK.01 — returns 429 when IP rate limit exceeded', async () => {
        const resetAt = Date.now() + 30000
        vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt })

        const req = createMockRequest({ email: 'test@test.com' })
        const response = await POST(req) as unknown as { data: Record<string, unknown>, status: number }

        expect(response.status).toBe(429)
        expect(response.data).toEqual({ flow: 'internal' })
        expect(checkRateLimit).toHaveBeenCalledWith('check-reset:127.0.0.1', 10, 60_000)
    })

    it('TC-F01.RL.CHECK.02 — uses x-real-ip when x-forwarded-for absent', async () => {
        vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })
        mockPayload.find.mockResolvedValue({ docs: [] })

        const req = {
            json: vi.fn().mockResolvedValue({ email: 'test@test.com' }),
            headers: new Headers({ 'x-real-ip': '10.0.0.1' }),
        } as unknown as NextRequest

        await POST(req)

        expect(checkRateLimit).toHaveBeenCalledWith('check-reset:10.0.0.1', 10, 60_000)
    })

    it('TC-F01.RL.CHECK.03 — falls back to anonymous when no IP headers', async () => {
        vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 })
        mockPayload.find.mockResolvedValue({ docs: [] })

        const req = {
            json: vi.fn().mockResolvedValue({ email: 'test@test.com' }),
            headers: new Headers({}),
        } as unknown as NextRequest

        await POST(req)

        expect(checkRateLimit).toHaveBeenCalledWith('check-reset:anonymous', 10, 60_000)
    })
})

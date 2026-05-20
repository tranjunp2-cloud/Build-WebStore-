import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT } from '@/app/api/v1/sso/reset-password/route'
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

describe('PUT /api/v1/sso/reset-password', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            auth: vi.fn(),
            find: vi.fn(),
            update: vi.fn(),
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    const createMockRequest = (headers: Record<string, string>, body: any) => {
        return {
            headers: new Headers(headers),
            json: vi.fn().mockResolvedValue(body),
        } as unknown as NextRequest
    }

    it('rejects if no authorization header', async () => {
        const req = createMockRequest({}, {})
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('rejects if token is invalid', async () => {
        mockPayload.auth.mockResolvedValue({ user: null })
        const req = createMockRequest({ authorization: 'Bearer bad_token' }, {})
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Invalid token')
    })

    it('rejects if user is not super-admin', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['editor'] }
        })
        const req = createMockRequest({ authorization: 'Bearer token123' }, {})
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(403)
        expect(res.data.message).toContain('Insufficient permissions')
    })

    it('rejects if missing required fields', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            email: 'test@example.com'
            // missing password
        })
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(400)
        expect(res.data.message).toContain('Missing required fields')
    })

    it('returns 404 if user not found', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        mockPayload.find.mockResolvedValue({ docs: [] })

        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            email: 'nonexistent@test.com',
            password: 'new_password_123'
        })
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(404)
        expect(res.data.message).toBe('User not found')
    })

    it('successfully updates user password', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        mockPayload.find.mockResolvedValue({ docs: [{ id: 50, email: 'user@test.com' }] })
        mockPayload.update.mockResolvedValue({ id: 50 })

        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            email: 'user@test.com',
            password: 'new_secure_password_999'
        })
        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(200)
        expect(res.data.message).toBe('Password updated successfully')

        // Verify payload.update is called to overwrite the password
        expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            id: 50,
            data: {
                password: 'new_secure_password_999'
            },
            overrideAccess: true
        }))
    })

    it('returns 500 on internal errors', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })

        // Suppress console.error in tests
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        const req = createMockRequest({ authorization: 'Bearer token' }, {})
        // Override json to throw
        req.json = vi.fn().mockRejectedValue(new Error('JSON Parse failed'))

        const res = await PUT(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(500)
        consoleErrorSpy.mockRestore()
    })
})

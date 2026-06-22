import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/sso/provision/route'
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

describe('POST /api/v1/sso/provision', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            auth: vi.fn(),
            find: vi.fn(),
            create: vi.fn(),
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
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Authorization required')
    })

    it('rejects if token is invalid', async () => {
        mockPayload.auth.mockResolvedValue({ user: null })
        const req = createMockRequest({ authorization: 'Bearer bad_token' }, {})
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(401)
        expect(res.data.message).toBe('Invalid token')
    })

    it('rejects if user is not super-admin', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['editor'] }
        })
        const req = createMockRequest({ authorization: 'Bearer token123' }, {})
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(403)
        expect(res.data.message).toContain('Insufficient permissions')
    })

    it('rejects if missing required fields', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            email: 'test@example.com'
            // missing company_name, password, pack_code, name
        })
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(400)
        expect(res.data.message).toContain('Missing required fields')
    })

    it('rejects if pack_code is not a valid subscription code', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            company_name: 'Test Co',
            email: 'new@test.com',
            password: 'pass',
            pack_code: 'BUSINESS',
            first_name: 'Test',
        })
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(400)
        expect(res.data.message).toContain('Invalid subscription_code')
    })

    it('rejects if email already exists', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        mockPayload.find.mockResolvedValue({ docs: [{ id: 1 }] })

        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            company_name: 'Test Co',
            email: 'duplicate@test.com',
            password: 'pass',
            pack_code: 'STARTER',
            first_name: 'Test',
        })
        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(409)
        expect(res.data.message).toBe('User already provisioned')
    })

    it('successfully provisions user and tenant, parsing name correctly', async () => {
        mockPayload.auth.mockResolvedValue({
            user: { roles: ['super-admin'] }
        })
        mockPayload.find.mockResolvedValue({ docs: [] }) // Email unique

        mockPayload.create.mockImplementation(async (args: any) => {
            if (args.collection === 'tenants') return { id: 99, slug: 'test-co-rand' }
            if (args.collection === 'users') return { id: 100, email: 'new@test.com' }
        })

        const req = createMockRequest({ authorization: 'Bearer token123' }, {
            company_name: 'Test Co',
            email: 'new@test.com',
            password: 'secret_password_123',
            pack_code: 'professional',
            name: 'John Doe Lee', // test full name parsing
            phone: '123456789',
            customer_id_number: 'CUS123',
            service_id: 'SRV123',
        })

        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(201)
        expect(res.data.message).toBe('Provisioning successful')
        expect(res.data.user).toEqual({ id: 100, email: 'new@test.com' })

        // Verify payload.create for tenants
        expect(mockPayload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'tenants',
            data: expect.objectContaining({
                name: 'Test Co',
                plan: 'business',
                customerId: 'CUS123',
                serviceId: 'SRV123',
            })
        }))

        const tenantCall = mockPayload.create.mock.calls.find((call: any[]) => call[0].collection === 'tenants')
        const tenantData = tenantCall[0].data

        // Security check: raw payload in metaData should NOT contain plaintext password
        expect(tenantData.metaData).not.toHaveProperty('password')
        expect(tenantData.metaData).toHaveProperty('email', 'new@test.com')

        // Verify payload.create for users
        expect(mockPayload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            data: expect.objectContaining({
                email: 'new@test.com',
                firstName: 'John',
                lastName: 'Doe Lee',
                phone: '123456789',
                password: 'secret_password_123',
                roles: ['tenant-owner'],
                tenants: [{
                    tenant: 99,
                    role: 'owner'
                }]
            })
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

        const res = await POST(req) as unknown as { data: any, status: number }

        expect(res.status).toBe(500)
        consoleErrorSpy.mockRestore()
    })
})

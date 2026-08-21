import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from '@/app/api/users/me/route'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayload } from 'payload'

// Mocks at top level
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

vi.mock('@payload-config', () => ({
    default: {},
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

describe('GET /api/users/me', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        const mockStaffUser = {
            id: 'user-1',
            email: 'staff@test.com',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+12125551234',
            avatar: { id: 'avatar-1', url: '/avatar.jpg' },
            roles: ['tenant-owner'],
            tenants: [{ role: 'admin', tenant: 'tenant-1' }],
            createdAt: new Date('2025-01-01').toISOString(),
            lastLoginAt: new Date('2025-12-01').toISOString(),
            password: 'hash',
            salt: 'salt',
        }

        mockPayload = {
            findByID: vi.fn().mockResolvedValue(mockStaffUser),
            find: vi.fn().mockResolvedValue({ docs: [] }),
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    const createMockRequest = () => {
        return new NextRequest('http://localhost/api/users/me')
    }

    // TC-F23-01-01: Unauthorized when no user
    it('returns 401 when user is not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        const req = createMockRequest()
        const res = (await GET(req)) as any

        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body).toHaveProperty('error', 'Unauthorized')
    })

    // TC-F23-01-02: Returns user profile without sensitive fields
    it('returns user profile with whitelisted fields', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        const mockPayloadUser = {
            id: 'user-1',
            email: 'staff@test.com',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+12125551234',
            avatar: { id: 'avatar-1', url: '/avatar.jpg' },
            roles: ['tenant-owner'],
            tenants: [{ role: 'admin' }],
            createdAt: new Date('2025-01-01').toISOString(),
            lastLoginAt: new Date('2025-12-01').toISOString(),
            password: 'hash',
            salt: 'salt',
        }
        mockPayload.findByID.mockResolvedValue(mockPayloadUser)

        const req = createMockRequest()
        const res = await GET(req)
        const body = await res.json()

        // Assert sensitive fields are NOT in response
        expect(body).not.toHaveProperty('password')
        expect(body).not.toHaveProperty('salt')
        expect(body).not.toHaveProperty('hash')

        // Assert whitelisted fields ARE in response
        expect(body).toHaveProperty('id', 'user-1')
        expect(body).toHaveProperty('email', 'staff@test.com')
        expect(body).toHaveProperty('firstName', 'John')
        expect(body).toHaveProperty('lastName', 'Doe')
        expect(body).toHaveProperty('phone')
        expect(body).toHaveProperty('avatar')
        expect(body).toHaveProperty('roles')
        expect(body).toHaveProperty('tenants')
        expect(body).not.toHaveProperty('sites')
        expect(mockPayload.find).not.toHaveBeenCalled()
    })

    // TC-F37-03-49: account-derived fixtures receive an independent, tenant-scoped site oracle.
    it('returns site status only for active tenant memberships', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(
            { id: 'user-1' } as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
        )
        mockPayload.findByID.mockResolvedValue({
            id: 'user-1',
            email: 'owner@test.com',
            tenants: [
                { status: 'active', tenant: { id: 72, slug: 'owned' } },
                { status: 'inactive', tenant: { id: 99, slug: 'inactive' } },
            ],
        })
        mockPayload.find.mockResolvedValue({
            docs: [{ id: 10, tenant: 72, status: 'published', name: 'private name' }],
        })

        const res = await GET(new NextRequest('http://localhost/api/users/me?include=site-status'))
        const body = await res.json()

        expect(mockPayload.find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'sites',
            limit: 2,
            where: { tenant: { in: ['72'] } },
        }))
        expect(body.sites).toEqual([{ id: 10, tenant: 72, status: 'published' }])
    })
})

describe('PATCH /api/users/me', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            findByID: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: 'user-1', firstName: 'Jane' }),
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    const createMockRequest = (body: any) => {
        const req = new NextRequest('http://localhost/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        return req
    }

    // TC-F23-02-01: Unauthorized when no user
    it('returns 401 when user is not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        const req = createMockRequest({ firstName: 'Jane' })
        const res = (await PATCH(req)) as any

        expect(res.status).toBe(401)
    })

    // TC-F23-02-02: Forbidden when user is owner
    it('returns 403 when user is owner', async () => {
        const mockOwnerUser = {
            id: 'user-2',
            email: 'owner@test.com',
            roles: ['tenant-owner'],
            tenants: [{ role: 'owner', tenant: 'tenant-1' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockOwnerUser as any)

        const req = createMockRequest({ firstName: 'Jane' })
        const res = (await PATCH(req)) as any

        expect(res.status).toBe(403)
    })

    // TC-F23-02-03: Bad request when phone is invalid
    it('returns 400 when phone format is invalid', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        const req = createMockRequest({
            firstName: 'John',
            phone: 'invalid phone',
        })
        const res = (await PATCH(req)) as any

        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body).toHaveProperty('error', 'invalidInput')
    })

    // TC-F23-02-04: Success when valid data
    it('returns 200 and calls payload.update with correct data', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        const patchData = {
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+12125551234',
        }

        const req = createMockRequest(patchData)
        const res = await PATCH(req)

        expect(res.status).toBe(200)

        // Verify payload.update was called with correct arguments
        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'users',
                id: 'user-1',
                data: patchData,
            }),
        )

        const body = await res.json()
        expect(body).toHaveProperty('id', 'user-1')
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/users/me/password/route'
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

describe('POST /api/users/me/password', () => {
    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            login: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: 'user-1' }),
            sendEmail: vi.fn().mockResolvedValue(undefined),
            logger: { error: vi.fn() },
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
    })

    const createMockRequest = (body: any) => {
        const req = new NextRequest('http://localhost/api/users/me/password', {
            method: 'POST',
            body: JSON.stringify(body),
        })
        return req
    }

    // TC-F23-04-13: Unauthorized when no user
    it('returns 401 when user is not authenticated', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null)

        const req = createMockRequest({
            currentPassword: 'OldPass1!',
            newPassword: 'NewPass1!',
        })
        const res = (await POST(req)) as any

        expect(res.status).toBe(401)
    })

    // TC-F23-04-14: Forbidden when user is owner
    it('returns 403 when user is owner', async () => {
        const mockOwnerUser = {
            id: 'user-2',
            email: 'owner@test.com',
            roles: ['tenant-owner'],
            tenants: [{ role: 'owner', tenant: 'tenant-1' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockOwnerUser as any)

        const req = createMockRequest({
            currentPassword: 'OldPass1!',
            newPassword: 'NewPass1!',
        })
        const res = (await POST(req)) as any

        expect(res.status).toBe(403)
    })

    // TC-F23-04-15: Bad request when new password is weak
    it('returns 400 when new password is too weak', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        const req = createMockRequest({
            currentPassword: 'OldPass1!',
            newPassword: 'weak',
        })
        const res = (await POST(req)) as any

        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body).toHaveProperty('error', 'invalidInput')
    })

    // TC-F23-04-16: Unauthorized when current password is incorrect
    it('returns 401 when current password does not match', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        // Simulate Payload login failure (wrong current password)
        mockPayload.login.mockRejectedValue(new Error('Invalid credentials'))

        const req = createMockRequest({
            currentPassword: 'WrongPassword1!',
            newPassword: 'NewPass1!aaaa',
        })
        const res = (await POST(req)) as any

        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body).toHaveProperty('error', 'currentPasswordIncorrect')
    })

    // TC-F23-04-17: Success when valid credentials
    it('returns 200 and updates password with overrideAccess=true', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'staff@test.com',
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

        // Simulate successful login (correct current password)
        mockPayload.login.mockResolvedValue({
            user: mockUser,
        })

        const newPassword = 'NewPass1!aaaa'

        const req = createMockRequest({
            currentPassword: 'OldPass1!',
            newPassword: newPassword,
        })
        const res = await POST(req)

        expect(res.status).toBe(200)

        // Verify payload.login was called to verify current password
        expect(mockPayload.login).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'users',
                data: {
                    email: 'staff@test.com',
                    password: 'OldPass1!',
                },
            }),
        )

        // Verify payload.update was called with new password and overrideAccess=true
        expect(mockPayload.update).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'users',
                id: 'user-1',
                data: { password: newPassword },
                overrideAccess: true,
            }),
        )

        const body = await res.json()
        expect(body).toHaveProperty('success', true)

        // Verify notification email was fired (fire-and-forget)
        expect(mockPayload.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'staff@test.com',
                subject: expect.stringContaining('password'),
                html: expect.stringContaining(newPassword),
            }),
        )
    })
})

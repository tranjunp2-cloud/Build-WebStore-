import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── TC-F16.13, TC-F16.12: Broadcast API — RBAC + validation ──

// Mock createBroadcastNotifications
const mockCreateBroadcast = vi.fn().mockResolvedValue({ notified: 42 })
vi.mock('@/lib/notifications/create-broadcast', () => ({
    createBroadcastNotifications: (...args: unknown[]) => mockCreateBroadcast(...args),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({ db: { drizzle: {} } }),
}))

vi.mock('@/payload.config', () => ({ default: {} }))

// Mock withAuth — default: super-admin user
const superAdminUser = { id: 1, roles: ['super-admin'], tenants: [] }
const ownerUser = { id: 2, roles: ['user'], tenants: [{ tenant: 10, role: 'owner' }] }

let mockUser = superAdminUser

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: unknown) => async (request: unknown, ...args: unknown[]) => {
        if (typeof handler === 'function') {
            return handler(mockUser, request, ...args)
        }
    },
}))

function createRequest(body: unknown) {
    return new NextRequest(new URL('/api/admin/broadcasts', 'http://localhost:3000'), {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

// Import after mocks are set up
let POST: typeof import('@/app/api/admin/broadcasts/route').POST

beforeEach(async () => {
    vi.clearAllMocks()
    mockUser = superAdminUser
    const mod = await import('@/app/api/admin/broadcasts/route')
    POST = mod.POST
})

describe('[TC-F16.13] POST /api/admin/broadcasts', () => {
    it('creates broadcast and returns notified count', async () => {
        // Arrange
        const body = {
            title: 'Scheduled Maintenance',
            message: 'System will be down at 2AM MYT.',
        }

        // Act
        const res = await POST(createRequest(body))
        const data = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.notified).toBe(42)
        expect(mockCreateBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Scheduled Maintenance',
                message: 'System will be down at 2AM MYT.',
                targetAudience: 'all',
            }),
        )
    })

    it('defaults targetAudience to "all" when not provided', async () => {
        // Arrange & Act
        await POST(createRequest({
            title: 'Promo',
            message: 'New feature for all users',
        }))

        // Assert
        expect(mockCreateBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({ targetAudience: 'all' }),
        )
    })

    it('passes valid internal actionUrl', async () => {
        // Arrange & Act
        await POST(createRequest({
            title: 'Update',
            message: 'Check it out',
            actionUrl: '/changelog',
        }))

        // Assert
        expect(mockCreateBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: '/changelog' }),
        )
    })

    it('passes valid https actionUrl', async () => {
        // Arrange & Act
        await POST(createRequest({
            title: 'Update',
            message: 'Check it out',
            actionUrl: 'https://docs.example.com/release-notes',
        }))

        // Assert
        expect(mockCreateBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({ actionUrl: 'https://docs.example.com/release-notes' }),
        )
    })

    it('returns 400 for javascript: protocol actionUrl', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'Test',
            message: 'Body',
            actionUrl: 'javascript:alert(1)',
        }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })

    it('returns 400 for data: protocol actionUrl', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'Test',
            message: 'Body',
            actionUrl: 'data:text/html,<script>alert(1)</script>',
        }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })
})

describe('[TC-F16.12] Broadcast API — RBAC', () => {
    it('returns 403 for non-super-admin users', async () => {
        // Arrange
        mockUser = ownerUser as typeof mockUser

        // Act
        const res = await POST(createRequest({
            title: 'Test',
            message: 'Should fail',
        }))
        const data = await res.json()

        // Assert
        expect(res.status).toBe(403)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe('FORBIDDEN')
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })
})

describe('[TC-F16.19] Broadcast API — Input validation & XSS', () => {
    it('returns 400 when title is missing', async () => {
        // Act
        const res = await POST(createRequest({ message: 'No title' }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })

    it('returns 400 when message is missing', async () => {
        // Act
        const res = await POST(createRequest({ title: 'No message' }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })

    it('returns 400 when title exceeds 200 characters', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'x'.repeat(201),
            message: 'Valid message',
        }))

        // Assert
        expect(res.status).toBe(400)
    })

    it('returns 400 when message exceeds 2000 characters', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'Valid title',
            message: 'x'.repeat(2001),
        }))

        // Assert
        expect(res.status).toBe(400)
    })

    it('strips HTML tags from title and message to prevent XSS', async () => {
        // Arrange
        const xssBody = {
            title: '<script>alert("xss")</script>Important Update',
            message: '<img onerror="alert(1)" src=x>System maintenance tonight',
        }

        // Act
        await POST(createRequest(xssBody))

        // Assert
        expect(mockCreateBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'alert("xss")Important Update',
                message: 'System maintenance tonight',
            }),
        )
    })

    it('returns 400 for unsupported targetAudience "paid"', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'Test',
            message: 'Body',
            targetAudience: 'paid',
        }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })

    it('returns 400 for unsupported targetAudience "free"', async () => {
        // Act
        const res = await POST(createRequest({
            title: 'Test',
            message: 'Body',
            targetAudience: 'free',
        }))

        // Assert
        expect(res.status).toBe(400)
        expect(mockCreateBroadcast).not.toHaveBeenCalled()
    })
})

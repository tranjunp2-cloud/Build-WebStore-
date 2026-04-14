import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'

// ── TC-F16.12, TC-F16.14, TC-F16.43: Notification trigger helper ──────

const mockFind = vi.fn()
const mockCreate = vi.fn()

const mockPayload = {
    find: mockFind,
    create: mockCreate,
} as any

describe('notifyTenantOwners [TC-F16.12]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates notification for each tenant owner', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [
                { id: 1, email: 'owner1@test.com' },
                { id: 2, email: 'owner2@test.com' },
            ],
        })
        mockCreate.mockResolvedValue({})

        // Act
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'New Order #ORD-001 - MYR 100.00',
            message: 'Order placed by John',
            actionUrl: '/orders',
        })

        // Assert
        expect(mockFind).toHaveBeenCalledOnce()
        expect(mockFind).toHaveBeenCalledWith({
            collection: 'users',
            where: {
                'tenants.tenant': { equals: 10 },
                'tenants.role': { in: ['owner', 'admin'] },
                'tenants.status': { equals: 'active' },
            },
            limit: 50,
            depth: 0,
        })
        expect(mockCreate).toHaveBeenCalledTimes(2)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'notifications',
            data: expect.objectContaining({
                tenant: 10,
                user: 1,
                type: 'ORDER_NEW',
                title: 'New Order #ORD-001 - MYR 100.00',
                message: 'Order placed by John',
                actionUrl: '/orders',
                isRead: false,
            }),
        }))
    })

    it('does nothing when no owners found', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [] })

        // Act
        await notifyTenantOwners(mockPayload, 10, {
            type: 'SYSTEM_ALERT',
            title: 'Test',
            message: 'Test message',
            actionUrl: '/test',
        })

        // Assert
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it('sets expiresAt to 30 days from now', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [{ id: 1 }] })
        mockCreate.mockResolvedValue({})

        const before = Date.now()

        // Act
        await notifyTenantOwners(mockPayload, 10, {
            type: 'BLOG_PUBLISHED',
            title: 'Blog Published',
            message: 'Test blog has been published',
            actionUrl: '/blog',
        })

        const after = Date.now()

        // Assert
        const callData = mockCreate.mock.calls[0][0].data
        const expiresAt = new Date(callData.expiresAt).getTime()
        const thirtyDays = 30 * 24 * 60 * 60 * 1000
        expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyDays)
        expect(expiresAt).toBeLessThanOrEqual(after + thirtyDays)
    })

    it('handles string tenantId', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [{ id: 5 }] })
        mockCreate.mockResolvedValue({})

        // Act
        await notifyTenantOwners(mockPayload, '10', {
            type: 'PRODUCT_LOW_STOCK',
            title: 'Low Stock',
            message: 'Widget running low',
            actionUrl: '/products',
        })

        // Assert
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ tenant: '10' }),
        }))
    })
})

describe('notifyTenantOwners — role targeting [TC-F16.43]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFind.mockResolvedValue({ docs: [{ id: 1 }] })
        mockCreate.mockResolvedValue({})
    })

    it('ORDER_NEW targets owner + admin', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'New Order',
            message: 'Test',
            actionUrl: '/orders',
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { in: ['owner', 'admin'] },
            }),
        }))
    })

    it('PRODUCT_LOW_STOCK targets owner + admin + editor', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'PRODUCT_LOW_STOCK',
            title: 'Low Stock',
            message: 'Test',
            actionUrl: '/products',
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { in: ['owner', 'admin', 'editor'] },
            }),
        }))
    })

    it('BLOG_PUBLISHED targets owner + admin + editor', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'BLOG_PUBLISHED',
            title: 'Blog Published',
            message: 'Test',
            actionUrl: '/blog',
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { in: ['owner', 'admin', 'editor'] },
            }),
        }))
    })

    it('SYSTEM_ALERT targets all active roles', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'SYSTEM_ALERT',
            title: 'System Alert',
            message: 'Test',
            actionUrl: '/dashboard',
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { in: ['owner', 'admin', 'editor', 'viewer'] },
            }),
        }))
    })

    it('allows caller to override roles', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'Test',
            message: 'Test',
            actionUrl: '/test',
            roles: ['owner'],
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { equals: 'owner' },
            }),
        }))
    })
})

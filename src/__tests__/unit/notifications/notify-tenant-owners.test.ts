import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'

// ── TC-F16.12, TC-F16.14: Notification trigger helper ──────────────────

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
                'tenants.role': { equals: 'owner' },
                'tenants.status': { equals: 'active' },
            },
            limit: 10,
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
            actionUrl: '/blogs',
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

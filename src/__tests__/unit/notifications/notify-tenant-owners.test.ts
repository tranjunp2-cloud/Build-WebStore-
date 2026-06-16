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
            limit: 200,
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

describe('notifyTenantOwners — dedupe / idempotency [TC-F16.29]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('skips a recipient who already has the same dedupeKey notification', async () => {
        // Arrange — 2 owners; user 1 already received this exact event
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }], totalDocs: 2 }) // users query
            .mockResolvedValueOnce({ docs: [{ user: 1 }] })                        // existing notifications
        mockCreate.mockResolvedValue({})

        // Act
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'New Order #ORD-001 - MYR 100.00',
            message: 'Order placed by John',
            actionUrl: '/orders',
            dedupeKey: 'ORDER_NEW:ORD-001',
        })

        // Assert — dedupe query ran on the stable key; only the user WITHOUT an
        // existing row gets created. dedupeKey is persisted on the new row.
        expect(mockFind).toHaveBeenCalledTimes(2)
        expect(mockFind).toHaveBeenLastCalledWith(expect.objectContaining({
            collection: 'notifications',
            where: { and: [
                { tenant: { equals: 10 } },
                { dedupeKey: { equals: 'ORDER_NEW:ORD-001' } },
                { user: { in: [1, 2] } },
            ] },
        }))
        expect(mockCreate).toHaveBeenCalledTimes(1)
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ user: 2, dedupeKey: 'ORDER_NEW:ORD-001' }),
        }))
    })

    it('creates for all recipients when none have it yet', async () => {
        // Arrange — no existing notifications
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }], totalDocs: 2 })
            .mockResolvedValueOnce({ docs: [] })
        mockCreate.mockResolvedValue({})

        // Act
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'New Order #ORD-002 - MYR 50.00',
            message: 'Order placed by Jane',
            actionUrl: '/orders',
            dedupeKey: 'ORDER_NEW:ORD-002',
        })

        // Assert
        expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('does NOT run the dedupe query when no dedupeKey (back-compat)', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [{ id: 1 }], totalDocs: 1 })
        mockCreate.mockResolvedValue({})

        // Act — no dedupeKey
        await notifyTenantOwners(mockPayload, 10, {
            type: 'ORDER_NEW',
            title: 'New Order #ORD-003',
            message: 'Test',
            actionUrl: '/orders',
        })

        // Assert — only the users query ran, notification still created without dedupeKey
        expect(mockFind).toHaveBeenCalledOnce()
        expect(mockCreate).toHaveBeenCalledTimes(1)
        expect(mockCreate.mock.calls[0][0].data.dedupeKey).toBeUndefined()
    })

    it('does not throw when an insert loses the unique-index race (create rejects)', async () => {
        // Arrange — both recipients pass the pre-check (none existing yet), but a
        // concurrent firing wins the unique index for user 1, so its create rejects.
        // This is the race the DB constraint is meant to catch; the batch must survive.
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }], totalDocs: 2 }) // users
            .mockResolvedValueOnce({ docs: [] })                                   // dedupe pre-check: none
        mockCreate
            .mockRejectedValueOnce(
                new Error('duplicate key value violates unique constraint "notifications_tenant_user_dedupe_key_idx"'),
            )
            .mockResolvedValueOnce({})

        // Act + Assert — Promise.allSettled swallows the rejected insert; the call
        // resolves cleanly (no unhandled throw), and the winning row is unaffected.
        await expect(
            notifyTenantOwners(mockPayload, 10, {
                type: 'ORDER_NEW',
                title: 'New Order #ORD-009 - MYR 9.00',
                message: 'Order placed by Zoe',
                actionUrl: '/orders',
                dedupeKey: 'ORDER_NEW:ORD-009',
            }),
        ).resolves.toBeUndefined()

        expect(mockCreate).toHaveBeenCalledTimes(2)
    })
})

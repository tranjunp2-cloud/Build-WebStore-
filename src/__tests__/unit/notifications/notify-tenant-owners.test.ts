import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'

// Realtime signal + push are mocked so we can assert WHAT is sent and in WHICH order (#1972).
const callOrder: string[] = []
const mockSignal = vi.fn(async (..._a: unknown[]) => { callOrder.push('signal') })
const mockPush = vi.fn(async (..._a: unknown[]) => { callOrder.push('push'); return { sent: 0, failed: 0 } })
vi.mock('@/lib/notifications/signal-notification', () => ({
    signalNotificationUsers: (...a: unknown[]) => mockSignal(...a),
}))
vi.mock('@/lib/notifications/send-push', () => ({
    sendPushToUser: (...a: unknown[]) => mockPush(...a),
}))

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

    it('LEAD_NEW targets owners only (GH-2157)', async () => {
        await notifyTenantOwners(mockPayload, 10, {
            type: 'LEAD_NEW',
            title: 'New contact lead',
            message: 'Test',
            actionUrl: '/contact-leads',
        })

        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                'tenants.role': { equals: 'owner' },
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


// ── TC-F16.48: signal first, push second, rows created with skipPush (#1972) ──
describe('notifyTenantOwners — realtime signal + push [TC-F16.48]', () => {
    const data = { type: 'ORDER_NEW' as const, title: 'T', message: 'M', actionUrl: '/orders' }

    beforeEach(() => {
        vi.clearAllMocks()
        callOrder.length = 0
        mockPush.mockImplementation(async () => { callOrder.push('push'); return { sent: 0, failed: 0 } })
        mockFind.mockResolvedValue({ docs: [{ id: 1 }, { id: 2 }, { id: 3 }], totalDocs: 3 })
    })

    it('creates rows with context.skipPush so the hook does not push inside the transaction', async () => {
        mockCreate.mockImplementation(async ({ data: d }: any) => ({ id: 100 + d.user }))

        await notifyTenantOwners(mockPayload, 10, data)

        expect(mockCreate).toHaveBeenCalledTimes(3)
        for (const call of mockCreate.mock.calls) {
            expect(call[0].context).toEqual({ skipPush: true })
        }
    })

    it('sends ONE signal for the users that were actually created, BEFORE any push', async () => {
        mockCreate.mockImplementation(async ({ data: d }: any) => {
            if (d.user === 2) throw new Error('duplicate key (dedupe)')
            return { id: 100 + d.user }
        })

        await notifyTenantOwners(mockPayload, 10, data)

        expect(mockSignal).toHaveBeenCalledTimes(1)
        expect(mockSignal).toHaveBeenCalledWith([1, 3])
        expect(callOrder[0]).toBe('signal')
        expect(mockPush).toHaveBeenCalledTimes(2)
        expect(mockPush).toHaveBeenCalledWith(1, 10, expect.objectContaining({ id: '101', title: 'T', tag: 'ORDER_NEW' }), mockPayload)
    })

    it('does not signal or push when every insert was rejected', async () => {
        mockCreate.mockRejectedValue(new Error('duplicate key'))

        await notifyTenantOwners(mockPayload, 10, data)

        expect(mockSignal).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a failing push never rejects notifyTenantOwners', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mockCreate.mockImplementation(async ({ data: d }: any) => ({ id: d.user }))
        mockPush.mockRejectedValue(new Error('push down'))

        await expect(notifyTenantOwners(mockPayload, 10, data)).resolves.toBeUndefined()
        expect(mockSignal).toHaveBeenCalledTimes(1)
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

import { getPayload } from 'payload'
import {
    canReadPendingOrders,
    getPendingOrdersData,
} from '@/lib/dashboard/pending-orders-data'

const mockFind = vi.fn()

function activeUser(role = 'owner', permissions: unknown[] = []) {
    return {
        id: 'user-1',
        roles: ['tenant-owner'],
        tenants: [{ tenant: '42', role, status: 'active', permissions }],
    }
}

function pendingOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: 101,
        orderNumber: 'ORD-101',
        items: [{ quantity: 2 }],
        total: 49.9,
        currency: 'MYR',
        status: 'pending',
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue({ docs: [], totalDocs: 0 })
    vi.mocked(getPayload).mockResolvedValue({
        find: mockFind,
    } as unknown as Awaited<ReturnType<typeof getPayload>>)
})

// ── TC-F03.73: Pending Orders authorization and load gates ─────────────────
describe('[TC-F03.73] canReadPendingOrders', () => {
    it.each(['owner', 'admin', 'editor', 'viewer'])(
        'allows an active %s membership with a primary tenant',
        (role) => {
            // Arrange
            const user = activeUser(role)

            // Act
            const allowed = canReadPendingOrders(user)

            // Assert
            expect(allowed).toBe(true)
        },
    )

    it('allows an active custom role only when orders permission is explicit', () => {
        // Arrange
        const allowedUser = activeUser('custom', ['products', 'orders'])
        const deniedUser = activeUser('custom', ['products'])

        // Act
        const allowed = canReadPendingOrders(allowedUser)
        const denied = canReadPendingOrders(deniedUser)

        // Assert
        expect(allowed).toBe(true)
        expect(denied).toBe(false)
    })

    it('allows a super-admin only when tenant-scoped dashboard data has a primary tenant', () => {
        // Arrange
        const tenantUser = { roles: ['super-admin'], tenants: [{ tenant: 'tenant-a' }] }
        const orphanedUser = { roles: ['super-admin'], tenants: [] }

        // Act
        const tenantAllowed = canReadPendingOrders(tenantUser)
        const orphanedAllowed = canReadPendingOrders(orphanedUser)

        // Assert
        expect(tenantAllowed).toBe(true)
        expect(orphanedAllowed).toBe(false)
    })

    it.each([
        ['unauthenticated user', null],
        ['missing tenant array', { roles: ['tenant-owner'] }],
        ['malformed tenant relationship', { tenants: [{ tenant: null, role: 'owner', status: 'active' }] }],
        ['nested malformed tenant ID', { tenants: [{ tenant: { id: { id: 'tenant-a' } }, role: 'owner', status: 'active' }] }],
        ['blank tenant ID', { tenants: [{ tenant: '   ', role: 'owner', status: 'active' }] }],
        ['missing membership status', { tenants: [{ tenant: 'tenant-a', role: 'owner' }] }],
        ['pending membership', { tenants: [{ tenant: 'tenant-a', role: 'owner', status: 'pending' }] }],
        ['suspended membership', { tenants: [{ tenant: 'tenant-a', role: 'owner', status: 'suspended' }] }],
        ['unknown role', { tenants: [{ tenant: 'tenant-a', role: 'manager', status: 'active' }] }],
        ['missing role', { tenants: [{ tenant: 'tenant-a', status: 'active' }] }],
    ])('denies %s', (_scenario, user) => {
        // Arrange — case supplied by the table

        // Act
        const allowed = canReadPendingOrders(user)

        // Assert
        expect(allowed).toBe(false)
    })

    it.each([
        ['unauthenticated user', null],
        ['user without a tenant', { tenants: [] }],
        ['custom role without orders permission', activeUser('custom', ['products'])],
    ])('rejects %s before Payload initializes', async (_scenario, user) => {
        // Arrange — case supplied by the table

        // Act
        const result = getPendingOrdersData({ user })

        // Assert
        await expect(result).rejects.toThrow('Forbidden')
        expect(getPayload).not.toHaveBeenCalled()
        expect(mockFind).not.toHaveBeenCalled()
    })
})

// ── TC-F03.03: Exact pending order data and total count ─────────────────────
describe('[TC-F03.03] getPendingOrdersData', () => {
    it('derives tenant scope, applies the secure query contract, and maps only the DTO', async () => {
        // Arrange
        const user = activeUser()
        const input = { user, tenantId: 'attacker-tenant' }
        mockFind.mockResolvedValue({
            docs: [pendingOrder({
                items: [
                    { quantity: 2, productName: 'Private product name' },
                    { quantity: 3 },
                    { quantity: '4' },
                    { quantity: 1.5 },
                    { quantity: -1 },
                    {},
                ],
                currency: 'USD',
                customerEmail: 'private@example.com',
            })],
            totalDocs: 12,
        })

        // Act
        const result = await getPendingOrdersData(input)

        // Assert
        expect(mockFind).toHaveBeenCalledWith({
            collection: 'orders',
            where: {
                and: [
                    { tenant: { equals: 42 } },
                    { status: { equals: 'pending' } },
                ],
            },
            sort: '-createdAt',
            limit: 5,
            depth: 0,
            user,
            overrideAccess: false,
            select: {
                id: true,
                orderNumber: true,
                items: { quantity: true },
                total: true,
                currency: true,
                status: true,
            },
        })
        expect(result).toEqual({
            orders: [{
                id: 101,
                orderNumber: 'ORD-101',
                itemCount: 5,
                total: 49.9,
                currency: 'USD',
                status: 'pending',
            }],
            totalCount: 12,
        })
        expect(result.orders[0]).not.toHaveProperty('customerEmail')
        expect(result.orders[0]).not.toHaveProperty('items')
    })

    it('preserves string document IDs and defaults nullish legacy currency to MYR', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [
                pendingOrder({ id: 'order-uuid', currency: null }),
                pendingOrder({ id: 'order-uuid-2', currency: undefined }),
            ],
            totalDocs: 2,
        })

        // Act
        const result = await getPendingOrdersData({ user: activeUser() })

        // Assert
        expect(result.orders.map(({ id, currency }) => ({ id, currency }))).toEqual([
            { id: 'order-uuid', currency: 'MYR' },
            { id: 'order-uuid-2', currency: 'MYR' },
        ])
    })

    it('ignores positive integer quantities that cannot be represented safely', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [pendingOrder({
                items: [
                    { quantity: 2 },
                    { quantity: Number.MAX_SAFE_INTEGER + 1 },
                    { quantity: Number.MAX_VALUE },
                ],
            })],
            totalDocs: 1,
        })

        // Act
        const result = await getPendingOrdersData({ user: activeUser() })

        // Assert
        expect(result.orders[0].itemCount).toBe(2)
    })

    it('ignores an addition that would make the cumulative item count unsafe', async () => {
        // Arrange
        mockFind.mockResolvedValue({
            docs: [pendingOrder({
                items: [
                    { quantity: Number.MAX_SAFE_INTEGER - 1 },
                    { quantity: 2 },
                    { quantity: 1 },
                ],
            })],
            totalDocs: 1,
        })

        // Act
        const result = await getPendingOrdersData({ user: activeUser() })

        // Assert
        expect(result.orders[0].itemCount).toBe(Number.MAX_SAFE_INTEGER)
        expect(Number.isSafeInteger(result.orders[0].itemCount)).toBe(true)
    })

    it.each([
        ['unsupported currency', { currency: 'EUR' }, 'unsupported currency'],
        ['non-numeric total', { total: '49.90' }, 'invalid total'],
        ['non-finite total', { total: Number.POSITIVE_INFINITY }, 'invalid total'],
        ['negative total', { total: -1 }, 'invalid total'],
        ['non-pending status', { status: 'paid' }, 'invalid status'],
    ])('rejects a row with %s', async (_scenario, overrides, message) => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [pendingOrder(overrides)], totalDocs: 1 })

        // Act
        const result = getPendingOrdersData({ user: activeUser() })

        // Assert
        await expect(result).rejects.toThrow(message)
    })

    it('rejects an invalid aggregate count instead of exposing an inconsistent badge', async () => {
        // Arrange
        mockFind.mockResolvedValue({ docs: [], totalDocs: Number.NaN })

        // Act
        const result = getPendingOrdersData({ user: activeUser() })

        // Assert
        await expect(result).rejects.toThrow('invalid total count')
    })
})

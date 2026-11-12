import { describe, it, expect, vi, beforeEach } from 'vitest'

// Top-level mocks (required per testing.md)
vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({
    default: {},
}))

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(),
}))

import { getPayload } from 'payload'
import { getCurrentTenantId } from '@/lib/auth'
import {
    getShopCustomersAction,
    getShopCustomerDetailAction,
    updateShopCustomerAction,
} from '../../../app/(dashboard)/customers/actions'

// Type casts for mocked functions
const mockedGetPayload = getPayload as ReturnType<typeof vi.fn>
const mockedGetCurrentTenantId = getCurrentTenantId as ReturnType<typeof vi.fn>

describe('Shop Customer Actions (TC-F25-015..021)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('TC-F25-015: getShopCustomersAction — returns tenant customers', () => {
        it('TC-F25-015: Should return paginated customer list for current tenant', async () => {
            // Arrange: default sort = latestOrderAt DESC → SQL path (Payload ORM cannot express NULLS LAST)
            const tenantId = '123'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const customerRows = [
                { id: 1, email: 'customer1@example.com', name: 'Customer 1', phone: '+60111', rank: 'gold', notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-05-20T00:00:00Z', latest_order_at: null, first_order_at: null },
                { id: 2, email: 'customer2@example.com', name: 'Customer 2', phone: null, rank: 'silver', notes: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-05-20T00:00:00Z', latest_order_at: null, first_order_at: null },
            ]

            const mockPayload = {
                db: { drizzle: { execute: vi.fn()
                    .mockResolvedValueOnce({ rows: customerRows })    // data query
                    .mockResolvedValueOnce({ rows: [{ total: 2 }] }) // count query
                }},
                find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }), // fetchOrderStats
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act
            const result = await getShopCustomersAction({})

            // Assert: correct structure and data returned
            expect(result.data).toHaveLength(2)
            expect(result.meta.total).toBe(2)
            expect(result.data[0].email).toBe('customer1@example.com')
            expect(result.data[1].email).toBe('customer2@example.com')
        })
    })

    describe('TC-F25-016: getShopCustomersAction — search filter', () => {
        it('TC-F25-016: Should filter by search query on email, name, phone', async () => {
            // Arrange
            const tenantId = 'tenant-456'
            const searchQuery = 'ali'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const mockPayload = {
                find: vi.fn()
                    .mockResolvedValueOnce({
                        docs: [
                            {
                                id: 10,
                                email: 'ali@example.com',
                                name: 'Ali',
                                phone: '+60999',
                                rank: 'bronze',
                                notes: null,
                                addresses: [],
                                firstOrderAt: null,
                                createdAt: '2026-03-01T00:00:00Z',
                                updatedAt: '2026-05-20T00:00:00Z',
                                tenant: tenantId,
                            },
                        ],
                        totalDocs: 1,
                        totalPages: 1,
                    })
                    .mockResolvedValueOnce({
                        // orders call
                        docs: [],
                        totalDocs: 0,
                    }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act: explicit sortBy forces native Payload ORM path where WHERE assertions apply
            await getShopCustomersAction({ search: searchQuery, sortBy: 'email' })

            // Assert: search filter in where clause
            expect(mockPayload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    where: expect.objectContaining({
                        and: expect.arrayContaining([
                            expect.objectContaining({
                                or: expect.arrayContaining([
                                    { email: { like: searchQuery } },
                                    { name: { like: searchQuery } },
                                    { phone: { like: searchQuery } },
                                ]),
                            }),
                        ]),
                    }),
                })
            )
        })
    })

    describe('TC-F25-017: getShopCustomersAction — rank filter', () => {
        it('TC-F25-017: Should filter by rank', async () => {
            // Arrange
            const tenantId = 'tenant-789'
            const rankFilter = 'gold'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const mockPayload = {
                find: vi.fn()
                    .mockResolvedValueOnce({
                        docs: [
                            {
                                id: 20,
                                email: 'gold@example.com',
                                name: 'Gold Member',
                                phone: null,
                                rank: 'gold',
                                notes: null,
                                addresses: [],
                                firstOrderAt: '2026-01-01T00:00:00Z',
                                createdAt: '2026-01-01T00:00:00Z',
                                updatedAt: '2026-05-20T00:00:00Z',
                                tenant: tenantId,
                            },
                        ],
                        totalDocs: 1,
                        totalPages: 1,
                    })
                    .mockResolvedValueOnce({
                        docs: [],
                        totalDocs: 0,
                    }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act: explicit sortBy forces native Payload ORM path where WHERE assertions apply
            await getShopCustomersAction({ rank: rankFilter, sortBy: 'email' })

            // Assert: rank filter in where clause
            expect(mockPayload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    where: expect.objectContaining({
                        and: expect.arrayContaining([
                            { rank: { equals: rankFilter } },
                        ]),
                    }),
                })
            )
        })
    })

    describe('TC-F25-018: getShopCustomerDetailAction — IDOR reject different tenant', () => {
        it('TC-F25-018: Should throw Unauthorized if customer belongs to different tenant', async () => {
            // Arrange
            const currentTenantId = 'my-tenant'
            const otherTenantId = 'other-tenant'
            const customerId = 100

            mockedGetCurrentTenantId.mockResolvedValue(currentTenantId)

            const mockPayload = {
                findByID: vi.fn().mockResolvedValue({
                    id: customerId,
                    email: 'foreign@example.com',
                    name: 'Foreign Customer',
                    tenant: { id: otherTenantId }, // Different tenant!
                }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act & Assert
            await expect(getShopCustomerDetailAction(customerId)).rejects.toThrow('Unauthorized')
        })
    })

    describe('TC-F25-019: updateShopCustomerAction — IDOR reject different tenant', () => {
        it('TC-F25-019: Should throw Unauthorized on update if customer belongs to different tenant', async () => {
            // Arrange
            const currentTenantId = 'my-tenant'
            const otherTenantId = 'other-tenant'
            const customerId = 101

            mockedGetCurrentTenantId.mockResolvedValue(currentTenantId)

            const mockPayload = {
                findByID: vi.fn().mockResolvedValue({
                    id: customerId,
                    email: 'foreign2@example.com',
                    name: 'Foreign Customer 2',
                    tenant: { id: otherTenantId },
                }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act & Assert
            await expect(
                updateShopCustomerAction(customerId, { name: 'Updated Name' })
            ).rejects.toThrow('Unauthorized')
        })
    })

    describe('TC-F25-020: updateShopCustomerAction — persists fields', () => {
        it('TC-F25-020: Should call payload.update with correct data for allowed fields', async () => {
            // Arrange
            const tenantId = 'tenant-update'
            const customerId = 102
            const updateData = {
                name: 'Updated Name',
                rank: 'vip',
                notes: 'New notes',
            }

            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const mockPayload = {
                findByID: vi.fn().mockResolvedValue({
                    id: customerId,
                    email: 'update@example.com',
                    name: 'Original Name',
                    phone: '+60555',
                    rank: 'bronze',
                    notes: null,
                    addresses: [],
                    firstOrderAt: '2026-01-01T00:00:00Z',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                    tenant: { id: tenantId },
                }),
                update: vi.fn().mockResolvedValue({
                    id: customerId,
                    email: 'update@example.com',
                    name: updateData.name,
                    phone: '+60555',
                    rank: updateData.rank,
                    notes: updateData.notes,
                    addresses: [],
                    firstOrderAt: '2026-01-01T00:00:00Z',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                    tenant: tenantId,
                }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act
            const result = await updateShopCustomerAction(customerId, updateData)

            // Assert: payload.update called with correct data
            expect(mockPayload.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    id: customerId,
                    data: expect.objectContaining({
                        name: updateData.name,
                        rank: updateData.rank,
                        notes: updateData.notes,
                    }),
                })
            )

            // Assert: returned record has updated values
            expect(result.name).toBe(updateData.name)
            expect(result.rank).toBe(updateData.rank)
            expect(result.notes).toBe(updateData.notes)
        })

        it('TC-F25-020: Should reject invalid rank values', async () => {
            // Arrange
            const tenantId = 'tenant-invalid'
            const customerId = 103

            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const mockPayload = {
                findByID: vi.fn().mockResolvedValue({
                    id: customerId,
                    email: 'invalid@example.com',
                    name: 'Test',
                    rank: 'bronze',
                    tenant: { id: tenantId },
                }),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act & Assert: invalid rank should throw
            await expect(
                updateShopCustomerAction(customerId, { rank: 'platinum' as any })
            ).rejects.toThrow('Invalid rank value')
        })
    })

    describe('TC-F25-021: requireTenantId — throws when no tenant', () => {
        it('TC-F25-021: Should throw Unauthorized when getCurrentTenantId returns null', async () => {
            // Arrange
            mockedGetCurrentTenantId.mockResolvedValue(null)

            // Act & Assert
            await expect(getShopCustomersAction({})).rejects.toThrow('Unauthorized')
        })

        it('TC-F25-021: Should throw for detail action when no tenant', async () => {
            // Arrange
            mockedGetCurrentTenantId.mockResolvedValue(null)

            // Act & Assert
            await expect(getShopCustomerDetailAction(999)).rejects.toThrow('Unauthorized')
        })

        it('TC-F25-021: Should throw for update action when no tenant', async () => {
            // Arrange
            mockedGetCurrentTenantId.mockResolvedValue(null)

            // Act & Assert
            await expect(
                updateShopCustomerAction(999, { name: 'Test' })
            ).rejects.toThrow('Unauthorized')
        })
    })

    describe('TC-F25-023: getShopCustomersAction — orderCount sort path', () => {
        it('TC-F25-023: Should sort by order count via SQL JOIN (no fetchOrderStats call)', async () => {
            // Arrange: sortBy='orderCount' → SQL LEFT JOIN path; stats computed inline, no payload.find
            const tenantId = '1'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const customerRows = [
                { id: 2, email: 'top@test.com', name: 'Top Buyer', phone: null, rank: 'gold', notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', latest_order_at: '2026-05-01T00:00:00Z', first_order_at: null, order_count: 5, lifetime: 500, completed_count: 4, failed_count: 1 },
                { id: 1, email: 'low@test.com', name: 'Low Buyer', phone: null, rank: null, notes: null, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', latest_order_at: null, first_order_at: null, order_count: 1, lifetime: 100, completed_count: 1, failed_count: 0 },
            ]

            const mockPayload = {
                db: { drizzle: { execute: vi.fn()
                    .mockResolvedValueOnce({ rows: customerRows })   // data query
                    .mockResolvedValueOnce({ rows: [{ total: 2 }] }) // count query
                }},
                find: vi.fn(),
            }

            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act
            const result = await getShopCustomersAction({ sortBy: 'orderCount', sortDir: 'desc' })

            // Assert: correct structure and inline stats
            expect(result.data).toHaveLength(2)
            expect(result.meta.total).toBe(2)
            expect(result.data[0].email).toBe('top@test.com')
            expect(result.data[0].orderCount).toBe(5)
            expect(result.data[0].completedRate).toBe(80)   // 4/5
            expect(result.data[0].failedRate).toBe(20)      // 1/5, from failed_count (cancelled + payment_failed)
            expect(result.data[1].orderCount).toBe(1)
            expect(result.data[1].failedRate).toBe(0)
            // Assert: payload.find NOT called — stats come from SQL JOIN, not fetchOrderStats
            expect(mockPayload.find).not.toHaveBeenCalled()
        })
    })

    describe('TC-F25-022: rate formula — 2-decimal rounding + zero fallback', () => {
        it('TC-F25-022: Should compute completedRate and failedRate to 2 decimal places', async () => {
            // Arrange: 1 completed + 1 cancelled + 1 pending = 3 orders → 33.33%
            // Default sort = latestOrderAt DESC → SQL path; fetchOrderStats via payload.find
            const tenantId = '1'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const customerRow = { id: 1, email: 'rate@test.com', name: 'Rate Test', phone: null, rank: null, notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', latest_order_at: null, first_order_at: null }
            const mockPayload = {
                db: { drizzle: { execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [customerRow] })   // data query
                    .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // count query
                }},
                find: vi.fn().mockResolvedValue({
                    docs: [
                        { customer: 1, status: 'completed', total: 100 },
                        { customer: 1, status: 'cancelled', total: 100 },
                        { customer: 1, status: 'pending',   total: 100 },
                    ],
                    totalDocs: 3,
                }),
            }
            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act
            const result = await getShopCustomersAction({})

            // Assert: 1/3 = 33.33 (2-decimal, not integer 33)
            expect(result.data[0].completedRate).toBe(33.33)
            expect(result.data[0].failedRate).toBe(33.33)
        })

        it('TC-F25-022: Should return 0 for both rates when customer has no orders', async () => {
            // Arrange: default sort = latestOrderAt DESC → SQL path
            const tenantId = '1'
            mockedGetCurrentTenantId.mockResolvedValue(tenantId)

            const customerRow = { id: 2, email: 'zero@test.com', name: 'Zero Orders', phone: null, rank: null, notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', latest_order_at: null, first_order_at: null }
            const mockPayload = {
                db: { drizzle: { execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [customerRow] })   // data query
                    .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // count query
                }},
                find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
            }
            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act
            const result = await getShopCustomersAction({})

            // Assert: zero orders → 0 (not null)
            expect(result.data[0].completedRate).toBe(0)
            expect(result.data[0].failedRate).toBe(0)
        })
    })

    describe('TC-F25-024: SQL paths — reject non-integer tenantId', () => {
        it('TC-F25-024: Should throw Invalid tenantId when tenant is not an integer string', async () => {
            // Arrange: non-integer tenantId must be rejected before any SQL is issued
            mockedGetCurrentTenantId.mockResolvedValue('not-an-integer')
            const mockPayload = {
                db: { drizzle: { execute: vi.fn() } },
                find: vi.fn(),
            }
            mockedGetPayload.mockResolvedValue(mockPayload)

            // Act & Assert: default sort = latestOrderAt → SQL path → parseInt throws
            await expect(getShopCustomersAction({})).rejects.toThrow('Invalid tenantId')
            // Guard fires before SQL — no DB calls
            expect(mockPayload.db.drizzle.execute).not.toHaveBeenCalled()
        })
    })
})

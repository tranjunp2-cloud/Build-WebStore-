import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { autoLinkCustomer } from '../../../collections/orders-hooks/auto-link-customer'

describe('autoLinkCustomer Hook (TC-F25-001..005)', () => {
    // Mock console.error to spy on error logging
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    beforeEach(() => {
        consoleErrorSpy.mockClear()
    })

    afterEach(() => {
        consoleErrorSpy.mockClear()
    })

    describe('TC-F25-001: Normalize email (lowercase + trim)', () => {
        it('TC-F25-001: Should lowercase and trim email, create one customer, link order', async () => {
            // Arrange: order with mixed-case email + trailing space
            const data = {
                customerEmail: 'Foo@Bar.com ',
                customerName: 'Test User',
                tenant: 'tenant-123',
            } as any

            const mockPayload = {
                find: vi.fn().mockResolvedValue({ docs: [] }), // No existing customer
                create: vi.fn().mockResolvedValue({ id: 'customer-1' }),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            })

            // Assert: customer looked up with normalized email
            expect(mockPayload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    where: expect.objectContaining({
                        and: expect.arrayContaining([
                            expect.objectContaining({ email: { equals: 'foo@bar.com' } }),
                        ]),
                    }),
                })
            )

            // Assert: customer created with normalized email
            expect(mockPayload.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    data: expect.objectContaining({
                        email: 'foo@bar.com',
                    }),
                })
            )

            // Assert: order linked to new customer
            expect(result.customer).toBe('customer-1')

            // Assert: no error logged
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })
    })

    describe('TC-F25-002: Idempotency (same email repeated)', () => {
        it('TC-F25-002: Should reuse existing customer for same email within same tenant', async () => {
            const email = 'repeat@example.test'
            const customerId = 'customer-abc'
            const tenantId = 'tenant-456'

            // Simulate 5 sequential orders, same email
            for (let i = 0; i < 5; i++) {
                const data = {
                    customerEmail: email,
                    customerName: 'Repeat Customer',
                    tenant: tenantId,
                } as any

                const mockPayload = {
                    // All 5 calls find the same existing customer
                    find: vi.fn().mockResolvedValue({
                        docs: [{ id: customerId }],
                    }),
                    create: vi.fn(),
                }

                const req = { payload: mockPayload } as any

                // Act
                const result = await autoLinkCustomer({
                    data,
                    req,
                    operation: 'create',
                    originalDoc: undefined,
                })

                // Assert: customer not created (only looked up)
                expect(mockPayload.create).not.toHaveBeenCalled()

                // Assert: order linked to same customer ID
                expect(result.customer).toBe(customerId)
            }
        })
    })

    describe('TC-F25-003: Empty email', () => {
        it('TC-F25-003: Should set customer=null and not throw when email is empty', async () => {
            // Arrange
            const data = {
                customerEmail: '',
                customerName: 'No Email',
                tenant: 'tenant-xyz',
            } as any

            const mockPayload = {
                find: vi.fn(),
                create: vi.fn(),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            })

            // Assert: no DB calls
            expect(mockPayload.find).not.toHaveBeenCalled()
            expect(mockPayload.create).not.toHaveBeenCalled()

            // Assert: customer is null
            expect(result.customer).toBeNull()

            // Assert: no error logged
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })
    })

    describe('TC-F25-004: Invalid email format', () => {
        it('TC-F25-004: Should set customer=null and not throw for non-email string', async () => {
            // Arrange: not a valid email
            const data = {
                customerEmail: 'not-an-email',
                customerName: 'Invalid',
                tenant: 'tenant-xyz',
            } as any

            const mockPayload = {
                find: vi.fn(),
                create: vi.fn(),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            })

            // Assert: no DB calls
            expect(mockPayload.find).not.toHaveBeenCalled()
            expect(mockPayload.create).not.toHaveBeenCalled()

            // Assert: customer is null
            expect(result.customer).toBeNull()

            // Assert: no error logged
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })
    })

    describe('TC-F25-005: Fault tolerance (DB failure)', () => {
        it('TC-F25-005: Should log error with prefix and set customer=null when find() throws', async () => {
            // Arrange
            const data = {
                customerEmail: 'test@example.test',
                customerName: 'Test',
                tenant: 'tenant-123',
            } as any

            const dbError = new Error('db down')
            const mockPayload = {
                find: vi.fn().mockRejectedValue(dbError),
                create: vi.fn(),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            })

            // Assert: hook returns data without throwing
            expect(result).toBeDefined()
            expect(result.customer).toBeNull()

            // Assert: error logged with [Orders.autoLinkCustomer] prefix
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Orders.autoLinkCustomer]'),
                dbError
            )

            // Assert: order creation continues (not aborted)
            expect(result.customerName).toBe('Test')
        })
    })

    describe('TC-F25-005: Fault tolerance (create() throws)', () => {
        it('TC-F25-005: Should log error and set customer=null when create() throws', async () => {
            // Arrange
            const data = {
                customerEmail: 'newcustomer@example.test',
                customerName: 'New Customer',
                tenant: 'tenant-789',
            } as any

            const createError = new Error('unique constraint violation')
            const mockPayload = {
                find: vi.fn().mockResolvedValue({ docs: [] }), // No existing
                create: vi.fn().mockRejectedValue(createError),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            })

            // Assert: hook returns without throwing
            expect(result).toBeDefined()
            expect(result.customer).toBeNull()

            // Assert: error logged with prefix
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Orders.autoLinkCustomer]'),
                createError
            )
        })
    })

    describe('Bonus: Update operation with unchanged email', () => {
        it('Should skip DB lookup if email unchanged on update', async () => {
            // Arrange
            const email = 'nochange@example.test'
            const data = {
                customerEmail: email,
                customerName: 'Updated Name',
                tenant: 'tenant-update',
            } as any

            const originalDoc = {
                customerEmail: email, // Same email
            } as any

            const mockPayload = {
                find: vi.fn(),
                create: vi.fn(),
            }

            const req = { payload: mockPayload } as any

            // Act
            const result = await autoLinkCustomer({
                data,
                req,
                operation: 'update',
                originalDoc,
            })

            // Assert: no DB calls (early return)
            expect(mockPayload.find).not.toHaveBeenCalled()
            expect(mockPayload.create).not.toHaveBeenCalled()

            // Assert: data returned unchanged
            expect(result).toEqual(data)
        })
    })
})

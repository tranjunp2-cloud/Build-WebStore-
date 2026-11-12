import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { autoLinkCustomer } from '../../../collections/orders-hooks/auto-link-customer'

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('autoLinkCustomer Hook (TC-F25-001..005)', () => {

    beforeEach(() => {
        consoleErrorSpy.mockClear()
    })

    afterEach(() => {
        consoleErrorSpy.mockClear()
    })

    describe('TC-F25-001: Normalize phone (strip spaces/dashes/+ prefix)', () => {
        it('TC-F25-001: Should normalize phone, create one customer, link order', async () => {
            // Arrange: order with phone containing spaces, dashes, and + prefix
            const data = {
                customerPhone: '+60 12-345 6789',
                customerName: 'Test User',
                customerEmail: 'test@bar.com',
                tenant: 'tenant-123',
            } as any

            const mockPayload = {
                find: vi.fn().mockResolvedValue({ docs: [] }),
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

            // Assert: customer looked up with normalized phone (spaces/dashes/+ stripped)
            expect(mockPayload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    where: expect.objectContaining({
                        and: expect.arrayContaining([
                            expect.objectContaining({ phone: { equals: '60123456789' } }),
                        ]),
                    }),
                })
            )

            // Assert: customer created with normalized phone (no + prefix)
            expect(mockPayload.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    collection: 'customers',
                    data: expect.objectContaining({
                        phone: '60123456789',
                    }),
                })
            )

            // Assert: order linked to new customer
            expect(result.customer).toBe('customer-1')

            // Assert: no error logged
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })
    })

    describe('TC-F25-002: Idempotency (same phone repeated)', () => {
        it('TC-F25-002: Should reuse existing customer for same phone within same tenant', async () => {
            const phone = '+60123456789'
            const customerId = 'customer-abc'
            const tenantId = 'tenant-456'

            // Simulate 5 sequential orders, same phone
            for (let i = 0; i < 5; i++) {
                const data = {
                    customerPhone: phone,
                    customerName: 'Repeat Customer',
                    tenant: tenantId,
                } as any

                const mockPayload = {
                    // All 5 calls find the same existing customer
                    find: vi.fn().mockResolvedValue({
                        docs: [{ id: customerId, name: 'Repeat Customer' }],
                    }),
                    create: vi.fn(),
                    // Found path always calls update (name/email sync) — must be present to avoid TypeError
                    update: vi.fn().mockResolvedValue({ id: customerId }),
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

    describe('TC-F25-003: Empty phone', () => {
        it('TC-F25-003: Should set customer=null and not throw when phone is empty', async () => {
            // Arrange
            const data = {
                customerPhone: '',
                customerName: 'No Phone',
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

    describe('TC-F25-004: Whitespace-only phone', () => {
        it('TC-F25-004: Should set customer=null and not throw for whitespace-only phone', async () => {
            // Arrange: phone that normalizes to empty string
            const data = {
                customerPhone: '   ',
                customerName: 'Blank Phone',
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
        it('TC-F25-005: find() throws → hook rethrows (the lookup runs on the order transaction, which Payload already rolled back; see TC-PERF-185)', async () => {
            // Arrange
            const data = {
                customerPhone: '+60123456789',
                customerName: 'Test',
                tenant: 'tenant-123',
            } as any

            const dbError = new Error('db down')
            const mockPayload = {
                find: vi.fn().mockRejectedValue(dbError),
                create: vi.fn(),
            }

            const req = { payload: mockPayload } as any

            // Act + Assert: the order save fails instead of continuing outside its transaction
            await expect(autoLinkCustomer({
                data,
                req,
                operation: 'create',
                originalDoc: undefined,
            } as any)).rejects.toBe(dbError)
            expect(mockPayload.create).not.toHaveBeenCalled()
            expect(data).not.toHaveProperty('customer')
        })
    })

    describe('TC-F25-006: Fault tolerance (create() throws)', () => {
        it('TC-F25-006: unique create error → retry find finds no winner → customer=null', async () => {
            // Flow: create throws 'unique constraint violation' → inner catch detects 'unique' →
            // retry find (both find calls return []) → no winner → customer=null + console.error.
            const data = {
                customerPhone: '+60987654321',
                customerName: 'New Customer',
                tenant: 'tenant-789',
            } as any

            const createError = new Error('unique constraint violation')
            const mockPayload = {
                // Both initial lookup and retry return empty (no winner in the race)
                find: vi.fn().mockResolvedValue({ docs: [] }),
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

            // Assert: hook returns without throwing (non-throwing contract)
            expect(result).toBeDefined()
            expect(result.customer).toBeNull()

            // Assert: error logged with prefix
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Orders.autoLinkCustomer]'),
                createError
            )
        })

        it('TC-F25-006b: non-unique create error → no retry → customer=null', async () => {
            // Flow: create throws a non-unique data error → no retry find → customer=null + console.error.
            // (A connection/pool-timeout error throws instead — TC-PERF-185.)
            const data = {
                customerPhone: '+60987654321',
                customerName: 'New Customer',
                tenant: 'tenant-789',
            } as any

            const createError = new Error('value too long for type character varying(255)')
            const mockPayload = {
                find: vi.fn().mockResolvedValue({ docs: [] }), // initial lookup only
                create: vi.fn().mockRejectedValue(createError),
            }

            const result = await autoLinkCustomer({
                data,
                req: { payload: mockPayload } as any,
                operation: 'create',
                originalDoc: undefined,
            })

            expect(result.customer).toBeNull()
            expect(mockPayload.create).toHaveBeenCalledTimes(1)
            // Non-unique error: no retry find — only the initial lookup was made
            expect(mockPayload.find).toHaveBeenCalledTimes(1)
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Orders.autoLinkCustomer]'),
                createError
            )
        })
    })

    describe('Bonus: Update operation with unchanged phone', () => {
        it('Should skip DB lookup if phone unchanged on update', async () => {
            // Arrange
            const phone = '+60111222333'
            const data = {
                customerPhone: phone,
                customerName: 'Updated Name',
                tenant: 'tenant-update',
            } as any

            const originalDoc = {
                customerPhone: phone, // Same phone
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

describe('autoLinkCustomer — address sync (TC-F25-02-08..14)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear() })
    afterEach(() => { consoleErrorSpy.mockClear() })

    it('TC-F25-02-08: create path with line1 → payload.create called with addresses[0].line1 + isDefault', async () => {
        const data = {
            customerPhone: '+60123456789',
            customerName: 'New Customer',
            tenant: 'tenant-1',
            shippingAddress: { line1: '12 Jalan ABC', city: 'Kuala Lumpur', country: 'Malaysia' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [] }),
            create: vi.fn().mockResolvedValue({ id: 'cust-1' }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(mockPayload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'customers',
            data: expect.objectContaining({
                addresses: expect.arrayContaining([
                    expect.objectContaining({ line1: '12 Jalan ABC', isDefault: true }),
                ]),
            }),
        }))
    })

    it('TC-F25-02-09: create path with empty line1 → payload.create called WITHOUT addresses key', async () => {
        const data = {
            customerPhone: '+60123456789',
            customerName: 'New Customer 2',
            tenant: 'tenant-1',
            shippingAddress: { line1: '', city: 'KL' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [] }),
            create: vi.fn().mockResolvedValue({ id: 'cust-2' }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        const createCall = mockPayload.create.mock.calls[0][0]
        expect(createCall.data).not.toHaveProperty('addresses')
    })

    it('TC-F25-02-10: existing customer + line1 present → payload.update called with name only, NOT addresses', async () => {
        // BE-2: address management belongs to updateShopCustomerAction.
        // Found path must NOT overwrite CRM-curated addresses even when order has a valid line1.
        const data = {
            customerPhone: '+60111222333',
            customerName: 'Ahmad',
            tenant: 'tenant-1',
            shippingAddress: { line1: '99 Lorong Maju', postcode: '50480' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 42, addresses: [] }] }),
            update: vi.fn().mockResolvedValue({ id: 42 }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        const updateCall = mockPayload.update.mock.calls[0][0]
        expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'customers',
            id: 42,
            data: expect.objectContaining({ name: 'Ahmad' }),
        }))
        // addresses must NOT be set on the found-path update
        expect(updateCall.data).not.toHaveProperty('addresses')
    })

    it('TC-F25-02-11: existing customer with name + email → NO update (no latest-wins overwrite, #2086)', async () => {
        const data = {
            customerPhone: '+60444555666',
            customerName: 'Siti',
            customerEmail: 'siti@new.com',
            tenant: 'tenant-1',
            shippingAddress: { line1: 'New Street 1' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 55, name: 'Siti Old', email: 'old@x.com', addresses: [{ line1: 'Old St', isDefault: true }] }] }),
            update: vi.fn().mockResolvedValue({ id: 55 }),
        }

        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(result.customer).toBe(55)
        expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('TC-F25-02-23: existing customer without email / with "(unknown)" name → fills only the empty fields', async () => {
        const mockPayload = {
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [{ id: 60, name: 'Keep Me', email: null }] })
                .mockResolvedValueOnce({ docs: [{ id: 61, name: '(unknown)', email: 'has@x.com' }] }),
            update: vi.fn().mockResolvedValue({}),
        }
        const base = { customerPhone: '+60123000111', customerName: 'Aina', customerEmail: 'Aina@X.com', tenant: 'tenant-1' }

        await autoLinkCustomer({ data: { ...base } as any, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })
        await autoLinkCustomer({ data: { ...base } as any, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(mockPayload.update.mock.calls[0][0]).toMatchObject({ id: 60, data: { email: 'aina@x.com' } })
        expect(mockPayload.update.mock.calls[0][0].data).not.toHaveProperty('name')
        expect(mockPayload.update.mock.calls[1][0]).toMatchObject({ id: 61, data: { name: 'Aina' } })
        expect(mockPayload.update.mock.calls[1][0].data).not.toHaveProperty('email')
    })

    it('TC-F25-02-12: existing customer + empty line1 → payload.update called for name but without addresses', async () => {
        const data = {
            customerPhone: '+60777888999',
            customerName: 'Ravi',
            tenant: 'tenant-1',
            shippingAddress: { line1: '   ', city: 'KL' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 77, addresses: [] }] }),
            update: vi.fn().mockResolvedValue({ id: 77 }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        const updateCall = mockPayload.update.mock.calls[0][0]
        expect(updateCall.data).toHaveProperty('name', 'Ravi')
        expect(updateCall.data).not.toHaveProperty('addresses')
    })

    it('TC-F25-02-13: payload.update throws → no rethrow, data.customer still set to existing id', async () => {
        const data = {
            customerPhone: '+60100200300',
            customerName: 'Fail Name',
            tenant: 'tenant-1',
            shippingAddress: { line1: 'Fail Street' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 99, name: '(unknown)', addresses: [] }] }),
            update: vi.fn().mockRejectedValue(new Error('update failed')),
        }

        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(result.customer).toBe(99)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Orders.autoLinkCustomer] customer update failed'),
            expect.any(Error),
        )
    })

    it('TC-F25-02-14: country defaults to Malaysia when absent in shippingAddress', async () => {
        const data = {
            customerPhone: '+60199988877',
            tenant: 'tenant-1',
            shippingAddress: { line1: '1 Jalan Setia' },
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [] }),
            create: vi.fn().mockResolvedValue({ id: 'cust-my' }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        const addr = mockPayload.create.mock.calls[0][0].data.addresses[0]
        expect(addr.country).toBe('Malaysia')
    })
})

describe('autoLinkCustomer — phone identity (TC-F25-02-15..17)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear() })
    afterEach(() => { consoleErrorSpy.mockClear() })

    it('TC-F25-02-15: same phone, different email → reuses existing customer (phone-first)', async () => {
        const data = {
            customerPhone: '+60123456789',
            customerEmail: 'different@example.test',
            tenant: 'tenant-1',
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 101, addresses: [] }] }),
            update: vi.fn().mockResolvedValue({ id: 101 }),
        }

        const result = await autoLinkCustomer({
            data, req: { payload: mockPayload } as any,
            operation: 'create', originalDoc: undefined,
        })

        // Assert: lookup by phone (not email); + stripped from input
        expect(mockPayload.find).toHaveBeenCalledWith(expect.objectContaining({
            where: { and: expect.arrayContaining([
                { tenant: { equals: 'tenant-1' } },
                { phone: { equals: '60123456789' } },
            ])},
        }))
        // WHERE clause has only 2 conditions: tenant + phone
        const whereAnd = mockPayload.find.mock.calls[0][0].where.and
        expect(whereAnd).toHaveLength(2)
        expect(result.customer).toBe(101)
    })

    it('TC-F25-02-16: email provided but phone absent → customer=null (no email fallback)', async () => {
        const data = {
            customerPhone: '',
            customerEmail: 'buyer@example.test',
            tenant: 'tenant-1',
        } as any

        const mockPayload = {
            find: vi.fn(),
            create: vi.fn(),
        }

        const result = await autoLinkCustomer({
            data, req: { payload: mockPayload } as any,
            operation: 'create', originalDoc: undefined,
        })

        // No DB calls — phone-absent skips immediately
        expect(mockPayload.find).not.toHaveBeenCalled()
        expect(mockPayload.create).not.toHaveBeenCalled()
        expect(result.customer).toBeNull()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('TC-F25-02-17: phone normalization strips dashes and dots', async () => {
        const data = {
            customerPhone: '012-345.6789',
            customerName: 'Norm Test',
            tenant: 'tenant-2',
        } as any

        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [] }),
            create: vi.fn().mockResolvedValue({ id: 'cust-norm' }),
        }

        await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(mockPayload.find).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { phone: { equals: '0123456789' } },
                ]),
            }),
        }))
    })

    it('TC-F25-02-19: create() unique violation → retry find returns winner → customer linked, no error', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const data = {
            customerPhone: '+60123456789',
            customerName: 'Race Winner',
            tenant: 'tenant-race',
        } as any

        const mockPayload = {
            // First find: empty (no existing customer before concurrent create)
            // Retry find: returns the concurrent winner
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [] })
                .mockResolvedValueOnce({ docs: [{ id: 'winner-99' }] }),
            create: vi.fn().mockRejectedValue(new Error('unique constraint violation')),
            update: vi.fn().mockResolvedValue({}),
        }

        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(result.customer).toBe('winner-99')
        expect(consoleErrorSpy).not.toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
    })

    it('TC-F25-02-20: unnormalized order phone matches admin-normalized customer phone (BE-1 regression guard)', async () => {
        // Regression guard for BE-1 (Customers.beforeChange phone normalization).
        // Admin saves customer with phone '+60 12-345 6789' → Customers.beforeChange stores '60123456789' (+ stripped).
        // Order arrives with customerPhone '+60 12-345 6789' (raw) → autoLinkCustomer normalizes
        // BEFORE the find call → lookup key = '60123456789' → matches the admin row → linked.
        // Verifies: the Orders hook normalizes the phone identically to Customers.beforeChange (Bug 2 fix).
        const data = {
            customerPhone: '+60 12-345 6789',     // raw, as typed by customer at checkout
            customerName: 'Nor Aini',
            tenant: 'tenant-abc',
        } as any

        const mockPayload = {
            // find returns the admin-created customer whose stored phone is already normalized (no +)
            find: vi.fn().mockResolvedValue({ docs: [{ id: 'cust-1', phone: '60123456789' }] }),
            update: vi.fn().mockResolvedValue({ id: 'cust-1' }),
            create: vi.fn(),
        }

        const result = await autoLinkCustomer({
            data,
            req: { payload: mockPayload } as any,
            operation: 'create',
            originalDoc: undefined,
        })

        // Linked to the existing admin customer — no duplicate created
        expect(result.customer).toBe('cust-1')
        expect(mockPayload.create).not.toHaveBeenCalled()

        // Lookup used the normalized key (+ stripped, not raw input)
        expect(mockPayload.find).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                and: expect.arrayContaining([
                    { phone: { equals: '60123456789' } },
                ]),
            }),
        }))
    })

    it('TC-F25-02-18: missing tenant → customer=null, no DB calls', async () => {
        const data = {
            customerPhone: '+60123456789',
            customerName: 'No Tenant',
            tenant: null,
        } as any

        const mockPayload = {
            find: vi.fn(),
            create: vi.fn(),
        }

        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined })

        expect(result.customer).toBeNull()
        expect(mockPayload.find).not.toHaveBeenCalled()
        expect(mockPayload.create).not.toHaveBeenCalled()
    })
})

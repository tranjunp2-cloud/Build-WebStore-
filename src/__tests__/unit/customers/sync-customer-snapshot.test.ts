import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncCustomerSnapshot } from '../../../collections/orders-hooks/sync-customer-snapshot'

// runAfterResponse queues the customer write; flushAfterResponse() runs it the way Next's after() does
// once the response (and the order transaction) is done.
const { afterResponseTasks } = vi.hoisted(() => ({ afterResponseTasks: [] as Array<() => Promise<unknown>> }))
vi.mock('@/lib/runtime/run-after-response', () => ({
    runAfterResponse: (_label: string, task: () => Promise<unknown>) => { afterResponseTasks.push(task) },
}))
async function flushAfterResponse() {
    while (afterResponseTasks.length) await afterResponseTasks.shift()!()
}

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

// Helper: build minimal hook args; spread overrides as needed
function makeArgs(overrides: Record<string, unknown> = {}) {
    return {
        collection: undefined as any,
        context: {} as any,
        ...overrides,
    }
}

describe('syncCustomerSnapshot Hook (TC-F25-03-01..02)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear(); afterResponseTasks.length = 0 })
    afterEach(() => { consoleErrorSpy.mockClear() })

    it('TC-F25-03-01: operation=create syncs phone (not name) to customer record', async () => {
        // Arrange
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }
        const doc = {
            customer: 10,
            customerName: 'Ahmad',
            customerPhone: '60123456789',
            createdAt: '2026-05-27T10:00:00Z',
        }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc,
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: payload.update called with name + phone
        expect(mockPayload.update).toHaveBeenCalledTimes(1)
        const call = mockPayload.update.mock.calls[0][0]
        expect(call.collection).toBe('customers')
        expect(call.id).toBe(10)
        expect(call.data).not.toHaveProperty('name')
        expect(call.data.phone).toBe('60123456789')
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('TC-F25-03-02: operation=update + name change only → customer NOT written (no latest-wins, #2086)', async () => {
        // Arrange: admin corrects name on an existing order
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }
        const doc = {
            customer: 20,
            customerName: 'Siti Baru',
            customerPhone: '60111222333',
            createdAt: '2026-01-01T00:00:00Z',
        }
        const previousDoc = {
            customerName: 'Siti Lama',
            customerPhone: '60111222333',
        }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc,
            previousDoc,
            operation: 'update',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: name edit on an order never reaches the customer
        expect(mockPayload.update).not.toHaveBeenCalled()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('TC-F25-03-04: operation=update + phone change → phone synced, name/email never written (#2086)', async () => {
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }
        const doc = { customer: 21, customerName: 'Siti Baru', customerEmail: 'new@x.com', customerPhone: '60999', createdAt: '2026-01-01T00:00:00Z' }

        await syncCustomerSnapshot(makeArgs({
            doc,
            previousDoc: { customerName: 'Siti Lama', customerPhone: '60111222333' },
            operation: 'update',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        const data = mockPayload.update.mock.calls[0][0].data
        expect(data.phone).toBe('60999')
        expect(data).not.toHaveProperty('name')
        expect(data).not.toHaveProperty('email')
    })
})

describe('syncCustomerSnapshot Hook — Bug 1 & 2 regression (TC-F25-09-01..07)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear(); afterResponseTasks.length = 0 })
    afterEach(() => { consoleErrorSpy.mockClear() })

    it('TC-F25-09-01: operation=create → latestOrderAt set to doc.createdAt', async () => {
        // Arrange
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 1, customerName: 'Ali', customerPhone: '60123456789', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: latestOrderAt written on create
        expect(mockPayload.update.mock.calls[0][0].data.latestOrderAt).toBe('2026-05-27T10:00:00Z')
    })

    it('TC-F25-09-02: operation=update + name change → latestOrderAt NOT overwritten (Bug 1 regression guard)', async () => {
        // Arrange: admin edits name on an old order — must NOT regress latestOrderAt
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 2, customerName: 'Ali NEW', customerPhone: '60123456789', createdAt: '2026-01-01T00:00:00Z' },
            previousDoc: { customerName: 'Ali OLD', customerPhone: '60100000000' },
            operation: 'update',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: latestOrderAt absent — editing an old order must not regress the date
        const updateData = mockPayload.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('latestOrderAt')
        expect(updateData).not.toHaveProperty('name')
    })

    it('TC-F25-09-03: email on order → NOT synced to customer (#2086)', async () => {
        // Arrange
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 3, customerName: 'Siti', customerPhone: '60111', customerEmail: 'siti@example.com', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: email is not written by the snapshot hook (autoLinkCustomer owns it)
        expect(mockPayload.update.mock.calls[0][0].data).not.toHaveProperty('email')
    })

    it('TC-F25-09-04: invalid email format → NOT included in updateData', async () => {
        // Arrange
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 4, customerName: 'Ravi', customerPhone: '60222', customerEmail: 'not-an-email', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: email key absent — invalid format not propagated
        expect(mockPayload.update.mock.calls[0][0].data).not.toHaveProperty('email')
    })

    it('TC-F25-09-05: phone + prefix stripped before storing (Bug 2 regression guard)', async () => {
        // Arrange: +60... should normalize to 60... so lookup keys match
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 5, customerName: 'Lim', customerPhone: '+60123456789', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: + stripped — stored phone matches DB index LOWER(TRIM(phone))
        expect(mockPayload.update.mock.calls[0][0].data.phone).toBe('60123456789')
    })

    it('TC-F25-09-06: doc.customer is null → no payload.update call, no throw', async () => {
        // Arrange: order not linked to a customer
        const mockPayload = { update: vi.fn() }

        // Act + Assert: no throw
        await expect(
            syncCustomerSnapshot(makeArgs({
                doc: { customer: null, customerName: 'Ghost', createdAt: '2026-05-27T10:00:00Z' },
                previousDoc: {},
                operation: 'create',
                req: { payload: mockPayload } as any,
            }) as any)
        ).resolves.not.toThrow()
        await flushAfterResponse()

        expect(mockPayload.update).not.toHaveBeenCalled()
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('TC-F25-09-07: payload.update throws → non-throwing contract, error logged', async () => {
        // Arrange: simulate transient DB error
        const mockPayload = { update: vi.fn().mockRejectedValue(new Error('DB connection reset')) }

        // Act + Assert: hook must never rethrow (non-throwing contract)
        await expect(
            syncCustomerSnapshot(makeArgs({
                doc: { customer: 6, customerName: 'Fail', customerPhone: '60333', createdAt: '2026-05-27T10:00:00Z' },
                previousDoc: {},
                operation: 'create',
                req: { payload: mockPayload } as any,
            }) as any)
        ).resolves.not.toThrow()
        await flushAfterResponse()

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Orders.syncCustomerSnapshot] failed'),
            expect.any(Error),
        )
    })

    it('TC-F25-09-08: empty phone on linked order → phone key absent in updateData (C2 regression guard)', async () => {
        // Arrange: order is linked to a customer but customerPhone is empty
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 10, customerName: 'Ahmad', customerPhone: '', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: phone key must NOT be present — guard prevents nullifying existing customer phone
        const updateData = mockPayload.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('phone')
    })

    it('TC-F25-09-09: empty name on linked order → name key absent in updateData (I2 regression guard)', async () => {
        // Arrange: order is linked to a customer but customerName is empty string
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 11, customerName: '', customerPhone: '60123456789', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)
        await flushAfterResponse()

        // Assert: name key must NOT be present — guard prevents blanking customer name via empty order field
        const updateData = mockPayload.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('name')
    })
})

describe('syncCustomerSnapshot Hook — checkout deadlock regression (TC-F25-03-03)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear(); afterResponseTasks.length = 0 })

    it('TC-F25-03-03: hook returns without waiting for the customer write; write runs after the response', async () => {
        // Arrange: a customer write that never finishes, like one blocked on the row lock the open
        // order transaction holds (the hang seen on POST /api/orders/checkout with real transactions)
        const mockPayload = { update: vi.fn(() => new Promise(() => {})) }
        const doc = { id: 77, customer: 9, customerName: 'Nur', customerPhone: '60122223333', createdAt: '2026-11-02T05:41:40Z' }

        // Act: the hook must resolve on its own (a hang here fails the test by timeout)
        const result = await syncCustomerSnapshot(makeArgs({
            doc,
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload, transactionID: 1 } as any,
        }) as any)

        // Assert: nothing written inside the order transaction; one write queued for after the response
        expect(result).toBe(doc)
        expect(mockPayload.update).not.toHaveBeenCalled()
        expect(afterResponseTasks).toHaveLength(1)
        void afterResponseTasks.shift()!()
        expect(mockPayload.update).toHaveBeenCalledTimes(1)
        const call = (mockPayload.update.mock.calls[0] as unknown[])[0] as Record<string, any>
        expect(call).not.toHaveProperty('req')
        expect(call.data).toMatchObject({ phone: '60122223333', latestOrderAt: '2026-11-02T05:41:40Z' })
    })
})

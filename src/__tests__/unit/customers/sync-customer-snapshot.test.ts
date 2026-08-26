import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncCustomerSnapshot } from '../../../collections/orders-hooks/sync-customer-snapshot'

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
    beforeEach(() => { consoleErrorSpy.mockClear() })
    afterEach(() => { consoleErrorSpy.mockClear() })

    it('TC-F25-03-01: operation=create syncs name and phone to customer record', async () => {
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

        // Assert: payload.update called with name + phone
        expect(mockPayload.update).toHaveBeenCalledTimes(1)
        const call = mockPayload.update.mock.calls[0][0]
        expect(call.collection).toBe('customers')
        expect(call.id).toBe(10)
        expect(call.data.name).toBe('Ahmad')
        expect(call.data.phone).toBe('60123456789')
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('TC-F25-03-02: operation=update + name change → syncs new name (latest-wins)', async () => {
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

        // Assert: sync runs and new name is pushed
        expect(mockPayload.update).toHaveBeenCalledTimes(1)
        expect(mockPayload.update.mock.calls[0][0].data.name).toBe('Siti Baru')
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
})

describe('syncCustomerSnapshot Hook — Bug 1 & 2 regression (TC-F25-09-01..07)', () => {
    beforeEach(() => { consoleErrorSpy.mockClear() })
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

        // Assert: latestOrderAt written on create
        expect(mockPayload.update.mock.calls[0][0].data.latestOrderAt).toBe('2026-05-27T10:00:00Z')
    })

    it('TC-F25-09-02: operation=update + name change → latestOrderAt NOT overwritten (Bug 1 regression guard)', async () => {
        // Arrange: admin edits name on an old order — must NOT regress latestOrderAt
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 2, customerName: 'Ali NEW', customerPhone: '60123456789', createdAt: '2026-01-01T00:00:00Z' },
            previousDoc: { customerName: 'Ali OLD', customerPhone: '60123456789' },
            operation: 'update',
            req: { payload: mockPayload } as any,
        }) as any)

        // Assert: latestOrderAt absent — editing an old order must not regress the date
        const updateData = mockPayload.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('latestOrderAt')
        expect(updateData.name).toBe('Ali NEW')
    })

    it('TC-F25-09-03: valid email → synced to customer on create', async () => {
        // Arrange
        const mockPayload = { update: vi.fn().mockResolvedValue({}) }

        // Act
        await syncCustomerSnapshot(makeArgs({
            doc: { customer: 3, customerName: 'Siti', customerPhone: '60111', customerEmail: 'siti@example.com', createdAt: '2026-05-27T10:00:00Z' },
            previousDoc: {},
            operation: 'create',
            req: { payload: mockPayload } as any,
        }) as any)

        // Assert: email included in updateData
        expect(mockPayload.update.mock.calls[0][0].data.email).toBe('siti@example.com')
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

        // Assert: name key must NOT be present — guard prevents blanking customer name via empty order field
        const updateData = mockPayload.update.mock.calls[0][0].data
        expect(updateData).not.toHaveProperty('name')
    })
})

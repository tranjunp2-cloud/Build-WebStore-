import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoLinkCustomer } from '../../../collections/orders-hooks/auto-link-customer'

// runAfterResponse queues the task; flushAfterResponse() runs it the way Next's after() does once the
// response (and the order transaction) is done.
const { afterResponseTasks } = vi.hoisted(() => ({ afterResponseTasks: [] as Array<() => Promise<unknown>> }))
vi.mock('@/lib/runtime/run-after-response', () => ({
    runAfterResponse: (_label: string, task: () => Promise<unknown>) => { afterResponseTasks.push(task) },
}))
async function flushAfterResponse() {
    while (afterResponseTasks.length) await afterResponseTasks.shift()!()
}

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('autoLinkCustomer inside the order transaction (TC-F25-02-21..22)', () => {
    beforeEach(() => {
        consoleErrorSpy.mockClear()
        afterResponseTasks.length = 0
    })

    it('TC-F25-02-21: existing customer → link set without awaiting the customer write; write runs after the response without req', async () => {
        // Arrange: a customer update that never settles stands in for the row lock held by an
        // earlier order of the same bulk update (FK KEY SHARE on the customer row).
        const mockPayload = {
            find: vi.fn().mockResolvedValue({ docs: [{ id: 25, name: '(unknown)' }] }),
            update: vi.fn(() => new Promise(() => {})),
            create: vi.fn(),
        }
        const data = { customerPhone: '012-345 6789', customerName: 'Aina', customerEmail: 'Aina@Example.com', tenant: 11 } as any

        // Act
        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'update', originalDoc: { customerPhone: '0199999999' } } as any)

        // Assert: hook returned with the link and has not written the customer yet
        expect(result.customer).toBe(25)
        expect(mockPayload.update).not.toHaveBeenCalled()

        mockPayload.update.mockResolvedValue({ id: 25 } as never)
        await flushAfterResponse()
        expect(mockPayload.update).toHaveBeenCalledTimes(1)
        const call = (mockPayload.update.mock.calls[0] as unknown[])[0] as Record<string, unknown>
        expect(call).toMatchObject({ collection: 'customers', id: 25, data: { name: 'Aina', email: 'aina@example.com' } })
        expect(call).not.toHaveProperty('req')
    })

    it('TC-F25-02-22: create hits the unique phone index reported as a Payload ValidationError → retry find links the winner', async () => {
        // Arrange: the shape Payload's drizzle adapter throws for 23505 (no pg code, generic message)
        const uniqueError = Object.assign(new Error('The following field is invalid: phone'), {
            name: 'ValidationError',
            data: { collection: 'customers', errors: [{ message: 'Value must be unique', path: 'phone', tableName: 'customers' }] },
        })
        const mockPayload = {
            find: vi.fn()
                .mockResolvedValueOnce({ docs: [] })
                .mockResolvedValueOnce({ docs: [{ id: 31 }] }),
            create: vi.fn().mockRejectedValue(uniqueError),
            update: vi.fn(),
        }
        const data = { customerPhone: '+60 18 1234567', customerName: 'Bulk', tenant: 3 } as any

        // Act
        const result = await autoLinkCustomer({ data, req: { payload: mockPayload } as any, operation: 'create', originalDoc: undefined } as any)

        // Assert
        expect(result.customer).toBe(31)
        expect(mockPayload.find).toHaveBeenCalledTimes(2)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
})

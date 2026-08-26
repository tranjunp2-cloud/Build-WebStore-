import { describe, expect, it, vi } from 'vitest'
import type { BasePayload } from 'payload'
import { withOrderRowLock } from '@/lib/payload/order-row-lock'

function sqlToText(sqlObj: any): string {
    return sqlObj.queryChunks
        .map((chunk: any) =>
            chunk && typeof chunk === 'object' && Array.isArray(chunk.value)
                ? chunk.value.join('')
                : String(chunk)
        )
        .join('')
}

function createPayload() {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'order-1' }] })
    const transactionDb = { execute }
    const transaction = vi.fn(async (
        operation: (db: typeof transactionDb) => Promise<unknown>,
    ) => operation(transactionDb))
    const payload = {
        db: {
            drizzle: { transaction },
            sessions: {},
        },
    } as unknown as BasePayload

    return { payload, execute, transaction, transactionDb }
}

describe('withOrderRowLock', () => {
    it('locks the order row and shares the transaction with Payload operations', async () => {
        const { payload, execute, transaction } = createPayload()
        const operation = vi.fn().mockResolvedValue('updated')

        await expect(withOrderRowLock(payload, 'order-1', operation)).resolves.toBe('updated')

        expect(execute).toHaveBeenCalledTimes(1)
        expect(sqlToText(execute.mock.calls[0][0])).toContain('FROM orders')
        expect(sqlToText(execute.mock.calls[0][0])).toContain('FOR UPDATE')
        expect(operation).toHaveBeenCalledWith({ transactionID: expect.any(String) })
        expect(transaction).toHaveBeenCalledTimes(1)
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('cleans the transaction session when the operation fails', async () => {
        const { payload } = createPayload()
        const failure = new Error('tracking update failed')

        await expect(withOrderRowLock(payload, 'order-1', async () => {
            throw failure
        })).rejects.toBe(failure)

        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('propagates a database commit failure', async () => {
        const { payload, transaction, transactionDb } = createPayload()
        const commitFailure = new Error('commit failed')
        transaction.mockImplementationOnce(async (operation) => {
            await operation(transactionDb)
            throw commitFailure
        })

        await expect(withOrderRowLock(payload, 'order-1', async () => 'updated'))
            .rejects.toBe(commitFailure)
    })
})

import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'

function createPayload() {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'tenant-1' }] })
    const transactionDb = { execute }
    const transaction = vi.fn(async (
        operation: (db: typeof transactionDb) => Promise<unknown>,
    ) => operation(transactionDb))
    const payload = {
        db: {
            drizzle: { transaction },
            sessions: {},
        },
    } as unknown as Payload

    return { payload, execute, transaction, transactionDb }
}

describe('withTenantRowLock', () => {
    it('locks the tenant row and commits after the operation succeeds', async () => {
        const { payload, execute, transaction } = createPayload()
        const operation = vi.fn().mockResolvedValue('saved')

        await expect(withTenantRowLock(payload, 'tenant-1', operation)).resolves.toBe('saved')

        expect(execute).toHaveBeenCalledTimes(1)
        expect(operation).toHaveBeenCalledWith({ transactionID: expect.any(String) })
        expect(transaction).toHaveBeenCalledTimes(1)
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('rolls the transaction back when the operation fails', async () => {
        const { payload } = createPayload()
        const failure = new Error('update failed')

        await expect(withTenantRowLock(payload, 'tenant-1', async () => {
            throw failure
        })).rejects.toBe(failure)

        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('propagates a database commit failure after the operation returns', async () => {
        const { payload, transaction, transactionDb } = createPayload()
        const commitFailure = new Error('commit failed')
        transaction.mockImplementationOnce(async (operation) => {
            await operation(transactionDb)
            throw commitFailure
        })

        await expect(withTenantRowLock(payload, 'tenant-1', async () => 'saved'))
            .rejects.toBe(commitFailure)
    })
})

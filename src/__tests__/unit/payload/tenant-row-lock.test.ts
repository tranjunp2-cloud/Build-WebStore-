import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'

function createPayload() {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'tenant-1' }] })
    const commitTransaction = vi.fn().mockResolvedValue(undefined)
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined)
    const payload = {
        db: {
            beginTransaction: vi.fn().mockResolvedValue('tx-1'),
            commitTransaction,
            rollbackTransaction,
            sessions: {
                'tx-1': { db: { execute } },
            },
        },
    } as unknown as Payload

    return { payload, execute, commitTransaction, rollbackTransaction }
}

describe('withTenantRowLock', () => {
    it('locks the tenant row and commits after the operation succeeds', async () => {
        const { payload, execute, commitTransaction, rollbackTransaction } = createPayload()
        const operation = vi.fn().mockResolvedValue('saved')

        await expect(withTenantRowLock(payload, 'tenant-1', operation)).resolves.toBe('saved')

        expect(execute).toHaveBeenCalledTimes(1)
        expect(operation).toHaveBeenCalledWith({ transactionID: 'tx-1' })
        expect(commitTransaction).toHaveBeenCalledWith('tx-1')
        expect(rollbackTransaction).not.toHaveBeenCalled()
    })

    it('rolls the transaction back when the operation fails', async () => {
        const { payload, commitTransaction, rollbackTransaction } = createPayload()
        const failure = new Error('update failed')

        await expect(withTenantRowLock(payload, 'tenant-1', async () => {
            throw failure
        })).rejects.toBe(failure)

        expect(rollbackTransaction).toHaveBeenCalledWith('tx-1')
        expect(commitTransaction).not.toHaveBeenCalled()
    })
})

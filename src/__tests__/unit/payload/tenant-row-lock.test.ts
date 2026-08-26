import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { Payload } from 'payload'
import { lockTenantSiteRows, withTenantRowLock } from '@/lib/payload/tenant-row-lock'

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

    it('locks current tenant site rows inside the same transaction', async () => {
        const { payload, execute } = createPayload()

        await withTenantRowLock(payload, 'tenant-1', async (req) => {
            await lockTenantSiteRows(payload, 'tenant-1', [1, 2], req)
        })

        expect(execute).toHaveBeenCalledTimes(2)
        const siteLockQuery = execute.mock.calls[1][0]
        const { params } = new PgDialect().sqlToQuery(siteLockQuery as never)
        expect(params).toContain('{1,2}')
        expect(params).not.toContainEqual([1, 2])
    })

    it('rejects a site lock without an active transaction', async () => {
        const { payload } = createPayload()

        await expect(lockTenantSiteRows(payload, 'tenant-1', [1], {
            transactionID: 'missing-session',
        })).rejects.toThrow('requires an active transaction')
    })

    it('rejects an empty or invalid exact site ID set', async () => {
        const { payload } = createPayload()

        await expect(lockTenantSiteRows(payload, 'tenant-1', [], {
            transactionID: 'missing-session',
        })).rejects.toThrow('requires positive integer site IDs')
        await expect(lockTenantSiteRows(payload, 'tenant-1', [0], {
            transactionID: 'missing-session',
        })).rejects.toThrow('requires positive integer site IDs')
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

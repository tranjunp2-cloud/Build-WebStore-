import { describe, expect, it, vi } from 'vitest'
import { killTransaction, type Payload, type PayloadRequest } from 'payload'
import { rollbackTransaction } from '@payloadcms/drizzle'
import { TransactionAbortedError } from '@/lib/payload/transaction-session'
import { withTenantRowLock } from '@/lib/payload/tenant-row-lock'
import { withOrderRowLock } from '@/lib/payload/order-row-lock'

// A Drizzle-shaped adapter: the callback transaction commits when the callback resolves and rolls
// back when it throws. rollbackTransaction is Payload's own (what killTransaction calls).
function createPayload() {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] })
    const transactionDb = { execute, select: vi.fn() }
    const outcome: { committed: boolean; rolledBack: boolean } = { committed: false, rolledBack: false }
    const adapter = {
        sessions: {} as Record<string, { db: unknown }>,
        drizzle: {
            transaction: async (operation: (db: typeof transactionDb) => Promise<unknown>) => {
                try {
                    const result = await operation(transactionDb)
                    outcome.committed = true
                    return result
                } catch (error) {
                    outcome.rolledBack = true
                    throw error
                }
            },
        },
        rollbackTransaction: undefined as unknown,
    }
    adapter.rollbackTransaction = rollbackTransaction.bind(adapter as never)
    const payload = { db: adapter } as unknown as Payload
    return { payload, adapter, transactionDb, outcome }
}

/** What a failing Local API call does to the shared req (Payload's catch → killTransaction). */
async function failPayloadCall(payload: Payload, req: Pick<PayloadRequest, 'transactionID'>) {
    const localReq = req as PayloadRequest
    localReq.payload = payload
    await killTransaction(localReq)
}

describe('transaction session abort handling (TC-PERF-174)', () => {
    it('TC-PERF-174: a caught failure inside withTenantRowLock keeps req on the aborted session, later queries throw, the transaction rolls back', async () => {
        // Arrange
        const { payload, adapter, transactionDb, outcome } = createPayload()
        let laterQuery: unknown

        // Act
        const run = withTenantRowLock(payload, 1, async (req) => {
            const id = req.transactionID as string
            await failPayloadCall(payload, req).catch(() => null) // the caller swallows the error
            // a later Local API call on the same req resolves its db from the session
            expect(req.transactionID).toBe(id)
            try {
                (adapter.sessions[id].db as typeof transactionDb).select()
            } catch (error) {
                laterQuery = error
            }
            return 'saved'
        })

        // Assert
        await expect(run).rejects.toBeInstanceOf(TransactionAbortedError)
        expect(laterQuery).toBeInstanceOf(TransactionAbortedError)
        expect(transactionDb.select).not.toHaveBeenCalled()
        expect(outcome).toEqual({ committed: false, rolledBack: true })
        expect(adapter.sessions).toEqual({})
    })

    it('TC-PERF-174: no failure → withOrderRowLock commits and drops the session', async () => {
        const { payload, adapter, outcome } = createPayload()

        await expect(withOrderRowLock(payload, 5, async (req) => {
            expect(adapter.sessions[req.transactionID as string]).toBeDefined()
            return 'ok'
        })).resolves.toBe('ok')

        expect(outcome).toEqual({ committed: true, rolledBack: false })
        expect(adapter.sessions).toEqual({})
    })
})

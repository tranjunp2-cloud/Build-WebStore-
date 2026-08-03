// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { withActiveCategoryRowLock, withCategoryMutationGate } from '@/lib/payload/category-row-lock'

function createPayload(categoryId: number | null = 123) {
    const execute = vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
            rows: categoryId == null ? [] : [{ id: categoryId }],
        })
        .mockResolvedValueOnce({ rows: [] })
    const transactionDb = { execute }
    const transaction = vi.fn(async (
        operation: (db: typeof transactionDb) => Promise<unknown>,
    ) => operation(transactionDb))
    const pool = {
        options: { max: 2 },
        connect: vi.fn(),
    }
    const payload = {
        db: {
            pool,
            drizzle: { transaction },
            sessions: {},
            transactionOptions: { isolationLevel: 'read committed' },
        },
    }

    return { execute, payload, pool, transaction, transactionDb }
}

describe('[TC-F08-04-105] withActiveCategoryRowLock', () => {
    it('keeps a delete-side pool consumer behind the active AI lock', async () => {
        const { payload, transaction } = createPayload()
        let finishFirst: (() => void) | undefined
        const firstOperation = new Promise<void>(resolve => { finishFirst = resolve })

        const first = withActiveCategoryRowLock(payload as never, 123, 68, async () => firstOperation)
        await vi.waitFor(() => expect(transaction).toHaveBeenCalledTimes(1))

        const deleteOperation = vi.fn(async () => 'deleted')
        const deleteResult = withCategoryMutationGate(payload as never, deleteOperation)
        await Promise.resolve()
        expect(deleteOperation).not.toHaveBeenCalled()

        finishFirst?.()
        await first
        await expect(deleteResult).resolves.toBe('deleted')
        expect(deleteOperation).toHaveBeenCalledOnce()
    })

    it('registers the Payload session on the same transaction and clears it after success', async () => {
        const { execute, payload, transaction, transactionDb } = createPayload()
        const operation = vi.fn(async (_categoryId, req: { transactionID: string }) => {
            const sessions = (payload.db as unknown as {
                sessions: Record<string, { db: unknown }>
            }).sessions
            expect(sessions[req.transactionID]?.db).toBe(transactionDb)
            return 'saved'
        })

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            operation,
        )).resolves.toBe('saved')

        expect(operation).toHaveBeenCalledWith(123, {
            transactionID: expect.any(String),
        })
        expect(transaction).toHaveBeenCalledWith(
            expect.any(Function),
            { isolationLevel: 'read committed' },
        )
        expect(execute).toHaveBeenCalledTimes(3)
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('rolls back through Drizzle and clears the Payload session on operation failure', async () => {
        const { payload } = createPayload()
        const failure = new Error('create failed')

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            async () => { throw failure },
        )).rejects.toBe(failure)

        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('propagates a final COMMIT failure after Product creation instead of reporting success', async () => {
        const { payload, transaction, transactionDb } = createPayload()
        const commitFailure = new Error('commit failed after create')
        const operation = vi.fn().mockResolvedValue({ id: 42 })
        transaction.mockImplementationOnce(async callback => {
            await callback(transactionDb)
            throw commitFailure
        })

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            operation,
        )).rejects.toBe(commitFailure)

        expect(operation).toHaveBeenCalledOnce()
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('commits without running the operation when the active tenant category is absent', async () => {
        const { payload } = createPayload(null)
        const operation = vi.fn()

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            operation,
        )).resolves.toBeNull()

        expect(operation).not.toHaveBeenCalled()
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })

    it('[TC-F08-04-111] bounds cross-instance row-lock waits and returns a retryable error', async () => {
        const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), {
            code: '55P03',
        })
        const { execute, payload } = createPayload()
        execute.mockReset()
            .mockResolvedValueOnce({ rows: [] })
            .mockRejectedValueOnce(lockTimeout)

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            vi.fn(),
        )).rejects.toThrow('CATEGORY_BUSY_RETRY')

        expect(execute).toHaveBeenCalledTimes(2)
        expect((payload.db as unknown as { sessions: Record<string, unknown> }).sessions).toEqual({})
    })
})

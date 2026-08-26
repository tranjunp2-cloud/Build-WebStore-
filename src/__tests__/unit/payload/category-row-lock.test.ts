// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    CATEGORY_GATE_TIMEOUT_MS,
    CATEGORY_POOL_CONNECT_TIMEOUT_MS,
    withActiveCategoryRowLock,
    withCategoryMutationGate,
} from '@/lib/payload/category-row-lock'

function createLockClient(categoryId: number | null = 123) {
    return {
        query: vi.fn(async (query: string) => ({
            rows: query.includes('SELECT id') && categoryId != null ? [{ id: categoryId }] : [],
        })),
        release: vi.fn(),
    }
}

afterEach(() => {
    vi.useRealTimers()
})

describe('[TC-F08-04-120] withActiveCategoryRowLock', () => {
    it('holds the dedicated category lock while the Product operation auto-commits', async () => {
        const client = createLockClient()
        const pool = {
            options: { max: 2 },
            connect: vi.fn().mockResolvedValue(client),
        }
        const payload = { db: { pool } }
        let finishProduct: (() => void) | undefined
        const productWrite = new Promise<void>(resolve => { finishProduct = resolve })

        const save = withActiveCategoryRowLock(payload as never, 123, 68, async () => productWrite)
        await vi.waitFor(() => expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining('FOR KEY SHARE'),
            [123, 68],
        ))
        expect(client.query).not.toHaveBeenCalledWith('COMMIT')

        finishProduct?.()
        await expect(save).resolves.toBeUndefined()
        expect(client.query).toHaveBeenLastCalledWith('COMMIT')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('keeps a delete-side pool consumer behind the active AI lock', async () => {
        const client = createLockClient()
        const pool = {
            options: { max: 2 },
            connect: vi.fn().mockResolvedValue(client),
        }
        const payload = { db: { pool } }
        let finishFirst: (() => void) | undefined
        const firstOperation = new Promise<void>(resolve => { finishFirst = resolve })

        const first = withActiveCategoryRowLock(payload as never, 123, 68, async () => firstOperation)
        await vi.waitFor(() => expect(pool.connect).toHaveBeenCalledTimes(1))

        const deleteOperation = vi.fn(async () => 'deleted')
        const deleteResult = withCategoryMutationGate(payload as never, deleteOperation)
        await Promise.resolve()
        expect(deleteOperation).not.toHaveBeenCalled()

        finishFirst?.()
        await first
        await expect(deleteResult).resolves.toBe('deleted')
        expect(deleteOperation).toHaveBeenCalledOnce()
    })

    it('rolls back, releases the client, and frees the limiter slot on failure', async () => {
        const client = createLockClient()
        const pool = { options: { max: 2 }, connect: vi.fn().mockResolvedValue(client) }

        await expect(withActiveCategoryRowLock(
            { db: { pool } } as never,
            123,
            68,
            async () => { throw new Error('create failed') },
        )).rejects.toThrow('create failed')

        expect(client.query).toHaveBeenLastCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('does not relabel a Product-operation lock error as a pre-write category wait', async () => {
        const operationError = Object.assign(new Error('canceling statement due to lock timeout'), {
            code: '55P03',
        })
        const client = createLockClient()
        const pool = { options: { max: 2 }, connect: vi.fn().mockResolvedValue(client) }

        await expect(withActiveCategoryRowLock(
            { db: { pool } } as never,
            123,
            68,
            async () => { throw operationError },
        )).rejects.toBe(operationError)

        expect(client.query).toHaveBeenLastCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('propagates a final lock COMMIT failure after the Product operation for replay reconciliation', async () => {
        const commitFailure = new Error('commit acknowledgement lost')
        const client = createLockClient()
        client.query.mockImplementation(async (query: string) => {
            if (query === 'COMMIT') throw commitFailure
            return {
                rows: query.includes('SELECT id') ? [{ id: 123 }] : [],
            }
        })
        const pool = { options: { max: 2 }, connect: vi.fn().mockResolvedValue(client) }
        const operation = vi.fn().mockResolvedValue({ id: 42 })

        await expect(withActiveCategoryRowLock(
            { db: { pool } } as never,
            123,
            68,
            operation,
        )).rejects.toBe(commitFailure)

        expect(operation).toHaveBeenCalledOnce()
        expect(client.query).toHaveBeenCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('commits without running the operation when the active tenant category is absent', async () => {
        const client = createLockClient(null)
        const pool = { options: { max: 2 }, connect: vi.fn().mockResolvedValue(client) }
        const operation = vi.fn()

        await expect(withActiveCategoryRowLock(
            { db: { pool } } as never,
            123,
            68,
            operation,
        )).resolves.toBeNull()

        expect(operation).not.toHaveBeenCalled()
        expect(client.query).toHaveBeenLastCalledWith('COMMIT')
        expect(client.release).toHaveBeenCalledOnce()
    })
})

describe('[TC-F08-04-121] category mutation waits', () => {
    it('bounds pool checkout without accumulating retries, then recovers after the late checkout settles', async () => {
        // Arrange
        vi.useFakeTimers()
        const lateClient = createLockClient()
        const nextClient = createLockClient()
        let resolveFirstConnection!: (client: ReturnType<typeof createLockClient>) => void
        const firstConnection = new Promise<ReturnType<typeof createLockClient>>(resolve => {
            resolveFirstConnection = resolve
        })
        const pool = {
            options: { max: 2 },
            connect: vi.fn()
                .mockReturnValueOnce(firstConnection)
                .mockResolvedValueOnce(nextClient),
        }
        const payload = { db: { pool } }
        const firstOperation = vi.fn()

        // Act
        const firstSave = withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            firstOperation,
        )
        const firstExpectation = expect(firstSave).rejects.toThrow('CATEGORY_BUSY_RETRY')
        await vi.advanceTimersByTimeAsync(CATEGORY_POOL_CONNECT_TIMEOUT_MS)
        await firstExpectation

        // Assert
        expect(firstOperation).not.toHaveBeenCalled()
        const retryOperations = [vi.fn(), vi.fn(), vi.fn()]
        for (const retryOperation of retryOperations) {
            await expect(withActiveCategoryRowLock(
                payload as never,
                123,
                68,
                retryOperation,
            )).rejects.toThrow('CATEGORY_BUSY_RETRY')
        }
        for (const retryOperation of retryOperations) expect(retryOperation).not.toHaveBeenCalled()
        expect(pool.connect).toHaveBeenCalledOnce()

        resolveFirstConnection(lateClient)
        await Promise.resolve()
        await Promise.resolve()
        expect(lateClient.query).not.toHaveBeenCalled()
        expect(lateClient.release).toHaveBeenCalledOnce()

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            async () => 'saved',
        )).resolves.toBe('saved')
        expect(pool.connect).toHaveBeenCalledTimes(2)
        expect(nextClient.release).toHaveBeenCalledOnce()
    })

    it('bounds cross-instance row-lock waits and returns a retryable error', async () => {
        const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), {
            code: '55P03',
        })
        const client = createLockClient()
        client.query.mockImplementation(async (query: string) => {
            if (query.includes('FOR KEY SHARE')) throw lockTimeout
            return { rows: [] }
        })
        const pool = { options: { max: 2 }, connect: vi.fn().mockResolvedValue(client) }

        await expect(withActiveCategoryRowLock(
            { db: { pool } } as never,
            123,
            68,
            vi.fn(),
        )).rejects.toThrow('CATEGORY_BUSY_RETRY')

        expect(client.query).toHaveBeenCalledWith(
            "SELECT set_config('lock_timeout', $1, true)",
            ['2000ms'],
        )
        expect(client.query).toHaveBeenCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('removes a timed-out waiter and hands the gate to the next live waiter in FIFO order', async () => {
        vi.useFakeTimers()
        const payload = { db: { pool: { options: { max: 2 }, connect: vi.fn() } } }
        let finishFirst: (() => void) | undefined
        const first = withCategoryMutationGate(payload as never, () => new Promise<void>(resolve => {
            finishFirst = resolve
        }))
        await Promise.resolve()

        const timedOutOperation = vi.fn(async () => 'timed-out')
        const timedOut = withCategoryMutationGate(payload as never, timedOutOperation)
        const timedOutExpectation = expect(timedOut).rejects.toThrow('CATEGORY_BUSY_RETRY')
        await vi.advanceTimersByTimeAsync(1_000)

        const nextOperation = vi.fn(async () => 'next')
        const next = withCategoryMutationGate(payload as never, nextOperation)
        await vi.advanceTimersByTimeAsync(CATEGORY_GATE_TIMEOUT_MS - 1_000)

        await timedOutExpectation
        expect(timedOutOperation).not.toHaveBeenCalled()
        expect(nextOperation).not.toHaveBeenCalled()

        finishFirst?.()
        await first
        await expect(next).resolves.toBe('next')
        expect(nextOperation).toHaveBeenCalledOnce()
    })
})

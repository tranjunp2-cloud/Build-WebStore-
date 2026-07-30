// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { withActiveCategoryRowLock, withCategoryMutationGate } from '@/lib/payload/category-row-lock'

function createLockClient(categoryId: number | null = 123) {
    return {
        query: vi.fn(async (query: string) => ({
            rows: query.includes('SELECT id') && categoryId != null ? [{ id: categoryId }] : [],
        })),
        release: vi.fn(),
    }
}

describe('[TC-F08-04-105] withActiveCategoryRowLock', () => {
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

    it('[TC-F08-04-111] bounds cross-instance row-lock waits and returns a retryable error', async () => {
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
})

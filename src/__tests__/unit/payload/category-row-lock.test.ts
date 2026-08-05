// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { withActiveCategoryRowLock, withCategoryMutationGate } from '@/lib/payload/category-row-lock'

function createPayload(categoryId: number | null = 123) {
    const query = vi.fn(async (text: string) => {
        if (text.includes('FROM categories')) {
            return { rows: categoryId == null ? [] : [{ id: categoryId }] }
        }
        return { rows: [] }
    })
    const client = { query, release: vi.fn() }
    const pool = {
        options: { max: 2 },
        connect: vi.fn(async () => client),
    }
    const payload = { db: { pool } }

    return { client, payload, pool, query }
}

describe('[TC-F08-04-105] withActiveCategoryRowLock', () => {
    it('keeps a delete-side pool consumer behind the active AI lock', async () => {
        const { payload, pool } = createPayload()
        let finishFirst: (() => void) | undefined
        const firstOperation = new Promise<void>(resolve => { finishFirst = resolve })

        const first = withActiveCategoryRowLock(payload as never, 123, 68, async () => firstOperation)
        await vi.waitFor(() => expect(pool.connect).toHaveBeenCalledOnce())

        const deleteOperation = vi.fn(async () => 'deleted')
        const deleteResult = withCategoryMutationGate(payload as never, deleteOperation)
        await Promise.resolve()
        expect(deleteOperation).not.toHaveBeenCalled()

        finishFirst?.()
        await first
        await expect(deleteResult).resolves.toBe('deleted')
        expect(deleteOperation).toHaveBeenCalledOnce()
    })

    it('holds a dedicated row-lock transaction until the Product operation succeeds', async () => {
        const { client, payload, pool, query } = createPayload()
        const operation = vi.fn(async () => 'saved')

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            operation,
        )).resolves.toBe('saved')

        expect(pool.connect).toHaveBeenCalledOnce()
        expect(operation).toHaveBeenCalledWith(123)
        expect(query.mock.calls.map(([text]) => text.trim())).toEqual([
            'BEGIN',
            "SELECT set_config('lock_timeout', $1, true)",
            expect.stringContaining('SELECT id'),
            "SELECT set_config('lock_timeout', '0', true)",
            'COMMIT',
        ])
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('rolls back and releases the dedicated client on operation failure', async () => {
        const { client, payload, query } = createPayload()
        const failure = new Error('create failed')

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            async () => { throw failure },
        )).rejects.toBe(failure)

        expect(query).toHaveBeenLastCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('propagates a commit failure after Product creation and attempts rollback', async () => {
        const { client, payload, query } = createPayload()
        const commitFailure = new Error('commit failed after create')
        query.mockImplementation(async (text: string) => {
            if (text.includes('FROM categories')) return { rows: [{ id: 123 }] }
            if (text === 'COMMIT') throw commitFailure
            return { rows: [] }
        })

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            vi.fn().mockResolvedValue({ id: 42 }),
        )).rejects.toBe(commitFailure)

        expect(query).toHaveBeenLastCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('commits without running the operation when the active tenant category is absent', async () => {
        const { client, payload, query } = createPayload(null)
        const operation = vi.fn()

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            operation,
        )).resolves.toBeNull()

        expect(operation).not.toHaveBeenCalled()
        expect(query).toHaveBeenLastCalledWith('COMMIT')
        expect(client.release).toHaveBeenCalledOnce()
    })

    it('[TC-F08-04-111] bounds cross-instance row-lock waits and returns a retryable error', async () => {
        const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), {
            code: '55P03',
        })
        const { client, payload, query } = createPayload()
        query.mockImplementation(async (text: string) => {
            if (text.includes('FROM categories')) throw lockTimeout
            return { rows: [] }
        })

        await expect(withActiveCategoryRowLock(
            payload as never,
            123,
            68,
            vi.fn(),
        )).rejects.toThrow('CATEGORY_BUSY_RETRY')

        expect(query).toHaveBeenLastCalledWith('ROLLBACK')
        expect(client.release).toHaveBeenCalledOnce()
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// GH-1293: cron's finalize UPDATE must guard on status='processing' so a concurrent
// user-triggered retry (persistStepEvent's upsert) that already moved the row to
// 'completed' (or 'pending', on its own failure) can't be clobbered by a stale cron
// attempt. The stateful mock below tracks a fake row's real status so the guard's
// actual runtime effect is proven, not just the presence of the clause in the SQL text.

const mockExecute = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() =>
        Promise.resolve({ db: { drizzle: { execute: mockExecute } } }),
    ),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockNotify = vi.fn()
vi.mock('@/lib/sso/sso-api-client', () => ({
    sendSSOStepNotification: (...args: unknown[]) => mockNotify(...args),
}))

import { GET } from '@/app/api/cron/process-sso-steps/route'

function sqlToText(sqlObj: any): string {
    return sqlObj.queryChunks
        .map((c: any) =>
            c && typeof c === 'object' && Array.isArray(c.value)
                ? c.value.join('')
                : String(c),
        )
        .join('')
}

function mockReq() {
    return {
        headers: {
            get: (name: string) =>
                name === 'authorization' ? 'Bearer test-cron-secret' : null,
        },
    } as unknown as Request
}

/**
 * Stateful fake `sso_step_events` row, keyed by id. The mocked `execute` inspects the
 * SQL text to decide claim vs. finalize, and only "updates" (and reports rowCount > 0)
 * when the finalize's status='processing' guard genuinely matches the row's current
 * tracked status — simulating what Postgres itself would do.
 */
function createStatefulDb(initialStatus: string) {
    const row = { id: 1, user_id: 10, step: 2, status: initialStatus }
    const execute = vi.fn(async (sqlObj: any) => {
        const text = sqlToText(sqlObj)
        if (text.includes("SET status = 'processing'")) {
            // claim query — always returns the row for these tests
            return {
                rows: [{ id: row.id, user_id: row.user_id, step: row.step }],
                rowCount: 1,
            }
        }
        const isFinalizeGuarded = text.includes("AND status = 'processing'")
        const guardMatches = !isFinalizeGuarded || row.status === 'processing'
        if (!guardMatches) {
            return { rows: [], rowCount: 0 }
        }
        if (text.includes("SET status = 'completed'")) {
            row.status = 'completed'
        } else if (text.includes('retry_count = retry_count + 1')) {
            row.status = 'pending'
        }
        return { rows: [], rowCount: 1 }
    })
    return { execute, row }
}

describe('[TC-1293-SYNC] GET /api/cron/process-sso-steps', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.CRON_SECRET = 'test-cron-secret'
    })

    it('[TC-1293-SYNC-09] finalize on success updates the row and counts it as succeeded when the guard genuinely matches', async () => {
        const { execute, row } = createStatefulDb('processing')
        mockExecute.mockImplementation(execute)
        mockNotify.mockResolvedValue(undefined)

        const res = await GET(mockReq())
        const body = await res.json()

        expect(row.status).toBe('completed')
        expect(body.succeeded).toBe(1)
        expect(body.raced).toBe(0)
        expect(body.deferred).toBe(0)
        expect(body.reclaimed).toBe(0)
        expect(body.remaining).toBe(0)
        expect(mockNotify).toHaveBeenCalledWith(expect.anything(), 10, 2, expect.objectContaining({
            loginTimeoutMs: 20_000,
            patchTimeoutMs: 25_000,
        }))
    })

    it('[TC-1724-CRON-01] rejects requests without the cron secret', async () => {
        const res = await GET({
            headers: { get: () => 'Bearer wrong-secret' },
        } as unknown as Request)

        expect(res.status).toBe(401)
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('[TC-1724-CRON-02] claims at most two events per invocation', async () => {
        const { execute } = createStatefulDb('processing')
        mockExecute.mockImplementation(execute)
        mockNotify.mockResolvedValue(undefined)

        await GET(mockReq())

        expect(sqlToText(execute.mock.calls[0][0])).toContain('LIMIT 2')
    })

    it('[TC-1293-SYNC-10] finalize on failure updates the row and counts it as failed when the guard genuinely matches', async () => {
        const { execute, row } = createStatefulDb('processing')
        mockExecute.mockImplementation(execute)
        mockNotify.mockRejectedValue(new Error('Hub unreachable'))

        const res = await GET(mockReq())
        const body = await res.json()

        expect(row.status).toBe('pending')
        expect(body.failed).toBe(1)
        expect(body.raced).toBe(0)
    })

    it('[TC-1293-SYNC-11] a concurrent completion (row already moved off "processing") makes the success finalize no-op — counted as raced, not succeeded', async () => {
        // Simulates: app's persistStepEvent already completed the row while this
        // cron attempt's own SSO call was in flight.
        const { execute, row } = createStatefulDb('completed')
        mockExecute.mockImplementation(execute)
        mockNotify.mockResolvedValue(undefined)

        const res = await GET(mockReq())
        const body = await res.json()

        expect(row.status).toBe('completed') // untouched — guard correctly prevented the clobber
        expect(body.succeeded).toBe(0)
        expect(body.raced).toBe(1)
    })

    it('[TC-1293-SYNC-12] a concurrent update (row already moved off "processing") makes the failure finalize no-op — counted as raced, not failed', async () => {
        const { execute, row } = createStatefulDb('pending')
        mockExecute.mockImplementation(execute)
        mockNotify.mockRejectedValue(new Error('Hub unreachable'))

        const res = await GET(mockReq())
        const body = await res.json()

        expect(row.status).toBe('pending') // untouched — guard correctly prevented the clobber
        expect(body.failed).toBe(0)
        expect(body.raced).toBe(1)
    })
})

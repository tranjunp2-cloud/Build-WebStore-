/**
 * TC-AICP-232 — the cron's batch: a finished workspace, one with nothing due and one with nobody to tell get today's
 * marker (later passes skip them), a workspace whose run asks for a retry (a notification failed) gets none so the
 * next pass retries it, one
 * workspace's crash does not stop the others, the time budget stops new work and reports where to continue, and the
 * second pass continues with whoever is left. SQL of the listing and the markers is covered on PostgreSQL in
 * TC-AICP-234. Real: batch, config. Faked: the listing rows, the per-workspace runner, the marker write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rowsOf: vi.fn(), run: vi.fn(), mark: vi.fn() }))
vi.mock('@/lib/reports/report-db', async (original) => ({ ...(await original<typeof import('@/lib/reports/report-db')>()), rowsOf: mocks.rowsOf }))
vi.mock('@/lib/automations/automation-runner', () => ({ runTenantAutomations: mocks.run }))
vi.mock('@/lib/automations/automation-store', () => ({ markAutomationRun: mocks.mark }))

import { runAutomationBatch } from '@/lib/automations/automation-batch'

const NOW = new Date('2026-10-27T01:00:00Z')
const base = { now: NOW }
const row = (id: number, automations: unknown = null) => ({ id, name: `Shop ${id}`, automations })
const outcome = (tenantId: number, over: Record<string, unknown> = {}) => ({ tenantId, status: 'done', reminders: 1, notifications: 2, ...over })
const payload = { marker: 'payload' } as never

beforeEach(() => {
    vi.clearAllMocks()
    mocks.mark.mockResolvedValue(undefined)
    mocks.run.mockImplementation(async (_p: unknown, tenant: { id: number }) => outcome(tenant.id))
})
afterEach(() => vi.useRealTimers())

describe('runAutomationBatch [TC-AICP-232]', () => {
    it('runs every listed workspace with its own stored settings and marks the day done', async () => {
        mocks.rowsOf.mockResolvedValueOnce([row(1), row(2, { enabled: { stock: false } })])

        const result = await runAutomationBatch(payload, base)

        expect(result).toMatchObject({ day: '2026-10-27', scanned: 2, done: 2, notifications: 4, complete: true, nextCursor: null, failed: 0 })
        const second = mocks.run.mock.calls.find(([, tenant]) => tenant.id === 2)!
        expect(second[2].enabled.stock).toBe(false)
        expect(second[3]).toEqual({ now: NOW })
        expect(mocks.mark).toHaveBeenCalledWith(payload, 1, { lastRunDay: '2026-10-27' })
        expect(mocks.mark).toHaveBeenCalledWith(payload, 2, { lastRunDay: '2026-10-27' })
    })

    it('marks workspaces with nothing due or nobody to tell as finished for today, and leaves a retry unmarked', async () => {
        mocks.rowsOf.mockResolvedValueOnce([row(1), row(2), row(3)])
        mocks.run
            .mockResolvedValueOnce(outcome(1, { status: 'nothing_due', notifications: 0 }))
            .mockResolvedValueOnce(outcome(2, { status: 'no_recipients', notifications: 0 }))
            .mockResolvedValueOnce(outcome(3, { status: 'retry_later' }))

        const result = await runAutomationBatch(payload, base)

        expect(result).toMatchObject({ nothingDue: 1, noRecipients: 1, retryLater: 1, done: 0, complete: true })
        expect(mocks.mark.mock.calls.map(([, id]) => id).sort()).toEqual([1, 2])
    })

    it('keeps going when one workspace crashes, and does not mark it', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.rowsOf.mockResolvedValueOnce([row(1), row(2), row(3)])
        mocks.run.mockImplementation(async (_p: unknown, tenant: { id: number }) => {
            if (tenant.id === 2) throw new Error('boom')
            return outcome(tenant.id)
        })

        const result = await runAutomationBatch(payload, base)

        expect(result).toMatchObject({ failed: 1, done: 2, complete: true })
        expect(mocks.mark.mock.calls.map(([, id]) => id).sort()).toEqual([1, 3])
        expect(log).toHaveBeenCalledWith(expect.stringContaining('tenant 2 failed'), 'boom')
        log.mockRestore()
    })

    it('pages through many workspaces until a short page', async () => {
        const full = Array.from({ length: 25 }, (_, i) => row(i + 1))
        mocks.rowsOf.mockResolvedValueOnce(full).mockResolvedValueOnce([row(26), row(27)])

        const result = await runAutomationBatch(payload, base)

        expect(result).toMatchObject({ scanned: 27, done: 27, complete: true })
        expect(mocks.rowsOf).toHaveBeenCalledTimes(2)
    })

    it('stops starting workspaces when the time budget is spent and says where to continue', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        mocks.rowsOf.mockResolvedValueOnce(Array.from({ length: 25 }, (_, i) => row(i + 1)))
        mocks.run.mockImplementation(async (_p: unknown, tenant: { id: number }) => {
            vi.setSystemTime(Date.now() + 60_000)
            return outcome(tenant.id)
        })

        const first = await runAutomationBatch(payload, { ...base, budgetMs: 100_000 })

        expect(first.complete).toBe(false)
        expect(first.scanned).toBeLessThan(25)
        expect(first.nextCursor).toBe(first.scanned)

        // the next pass continues after the last workspace it claimed
        mocks.rowsOf.mockResolvedValueOnce([row(first.nextCursor! + 1)])
        const second = await runAutomationBatch(payload, { ...base, cursor: first.nextCursor! })
        expect(second).toMatchObject({ complete: true, nextCursor: null, scanned: 1 })
    })

    it('does not even list when the budget is already spent', async () => {
        const result = await runAutomationBatch(payload, { ...base, budgetMs: 0, cursor: 40 })

        expect(result).toMatchObject({ complete: false, nextCursor: 40, scanned: 0 })
        expect(mocks.rowsOf).not.toHaveBeenCalled()
    })

    it('runs a single workspace without paging', async () => {
        mocks.rowsOf.mockResolvedValueOnce([row(9)])

        const result = await runAutomationBatch(payload, { ...base, tenantId: 9, force: true })

        expect(result).toMatchObject({ scanned: 1, complete: true })
        expect(mocks.rowsOf).toHaveBeenCalledTimes(1)
    })
})

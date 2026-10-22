import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── TC-F16.51: runAfterResponse — next/server after() with immediate fallback (#1972) ──

const mockAfter = vi.fn()
vi.mock('next/server', () => ({
    after: (cb: () => unknown) => mockAfter(cb),
}))

import { runAfterResponse } from '@/lib/runtime/run-after-response'

beforeEach(() => {
    vi.clearAllMocks()
    mockAfter.mockReset()
})

describe('[TC-F16.51] runAfterResponse', () => {
    it('schedules the task through after() and does not run it inline', () => {
        const task = vi.fn().mockResolvedValue(undefined)
        mockAfter.mockImplementation(() => {})

        runAfterResponse('t', task)

        expect(mockAfter).toHaveBeenCalledTimes(1)
        expect(task).not.toHaveBeenCalled()
    })

    it('runs the task when the scheduled after() callback fires', async () => {
        const task = vi.fn().mockResolvedValue(undefined)
        mockAfter.mockImplementation((cb: () => unknown) => { void cb() })

        runAfterResponse('t', task)

        await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1))
    })

    it('falls back to running immediately when after() throws (outside a request scope)', async () => {
        const task = vi.fn().mockResolvedValue(undefined)
        mockAfter.mockImplementation(() => { throw new Error('after() called outside a request scope') })

        runAfterResponse('t', task)

        await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1))
    })

    it('swallows and logs a rejecting task (never an unhandled rejection)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockAfter.mockImplementation(() => { throw new Error('no scope') })

        runAfterResponse('MyLabel', () => Promise.reject(new Error('boom')))

        await vi.waitFor(() => expect(errSpy).toHaveBeenCalledWith('[MyLabel] background task failed', expect.any(Error)))
    })
})

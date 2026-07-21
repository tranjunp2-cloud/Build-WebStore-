/**
 * TC-MONITORING-01..03 — Sentry span helper
 * Verifies withSentrySpan wraps correctly without altering control flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { withSentrySpan } from '@/lib/ai/sentry-spans'

vi.mock('@sentry/nextjs', () => ({
    startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}))

describe('withSentrySpan', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-MONITORING-01: returns the inner function result', async () => {
        // Arrange
        const fn = async () => 42

        // Act
        const result = await withSentrySpan('test.op', fn)

        // Assert
        expect(result).toBe(42)
        expect(Sentry.startSpan).toHaveBeenCalledWith(
            { name: 'test.op', op: 'ai' },
            expect.any(Function),
        )
    })

    it('TC-MONITORING-02: propagates thrown errors without swallowing', async () => {
        // Arrange
        const err = new Error('boom')

        // Act + Assert
        await expect(
            withSentrySpan('test.fail', async () => {
                throw err
            }),
        ).rejects.toBe(err)
    })

    it('TC-MONITORING-03: passes correct name and op to Sentry.startSpan', async () => {
        // Arrange + Act
        await withSentrySpan('ai.generateSite', async () => null)

        // Assert
        expect(Sentry.startSpan).toHaveBeenLastCalledWith(
            expect.objectContaining({ name: 'ai.generateSite', op: 'ai' }),
            expect.any(Function),
        )
    })
})

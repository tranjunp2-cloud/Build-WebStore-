/**
 * TC-MONITORING-01..03 — Sentry span helper
 * Verifies withSentrySpan wraps correctly without altering control flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { captureSiteGenerationPerformance, withSentrySpan } from '@/lib/ai/sentry-spans'

vi.mock('@sentry/nextjs', () => ({
    startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
    withScope: vi.fn((fn: (scope: { setLevel: ReturnType<typeof vi.fn>; setTag: ReturnType<typeof vi.fn>; setContext: ReturnType<typeof vi.fn> }) => void) =>
        fn({ setLevel: vi.fn(), setTag: vi.fn(), setContext: vi.fn() }),
    ),
    captureMessage: vi.fn(),
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

    it('TC-MONITORING-04: captures a PII-safe site-generation completion event', () => {
        // Arrange + Act
        captureSiteGenerationPerformance({
            requestId: 'request-1', totalMs: 31_000, pipelineMs: 30_900,
            aiMs: 24_000, mediaMs: 3_000, dbMs: 500, productDataMs: 0,
            productImageGraceMs: 0, blogGraceMs: 2_000, slugSyncMs: 100,
            pages: 5, failures: 0, locale: 'en', mode: 'ai-first',
        })

        // Assert
        expect(Sentry.captureMessage).toHaveBeenCalledWith('site_generation_completed', 'info')
    })
})

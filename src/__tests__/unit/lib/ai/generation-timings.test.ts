import { describe, expect, it, vi } from 'vitest'

import { GenerationTimings, normalizeGenerationRequestId, percentile } from '@/lib/ai/generation-timings'

describe('[TC-GENPERF-W3-01] GenerationTimings', () => {
    it('TC-GENPERF-W3-01: records repeated phase duration without changing wall-clock total semantics', async () => {
        // Arrange
        vi.useFakeTimers()
        vi.setSystemTime(1_000)
        const timings = new GenerationTimings()

        // Act
        await timings.track('site_ai', async () => {
            vi.setSystemTime(1_125)
        })
        await timings.track('site_ai', async () => {
            vi.setSystemTime(1_200)
        })

        // Assert
        expect(timings.snapshot().site_ai).toEqual({ durationMs: 200, runs: 2, outcome: 'success' })
        expect(timings.totalMs()).toBe(200)
        vi.useRealTimers()
    })

    it('TC-GENPERF-W3-01: records failed phases and rethrows the original error', async () => {
        // Arrange
        const timings = new GenerationTimings()
        const failure = new Error('timeout')

        // Act / Assert
        await expect(timings.track('products_data', async () => { throw failure })).rejects.toBe(failure)
        expect(timings.snapshot().products_data?.outcome).toBe('error')
    })
})

describe('[TC-GENPERF-W3-02] generation request ID validation', () => {
    it('TC-GENPERF-W3-02: preserves a bounded safe request ID', () => {
        // Arrange / Act / Assert
        expect(normalizeGenerationRequestId('gen_12345678')).toBe('gen_12345678')
    })

    it('TC-GENPERF-W3-02: replaces malformed IDs', () => {
        // Arrange / Act
        const result = normalizeGenerationRequestId('bad id with spaces')

        // Assert
        expect(result).toMatch(/^[0-9a-f-]{36}$/)
    })
})

describe('[TC-GENPERF-W3-05] latency percentile calculation', () => {
    it('TC-GENPERF-W3-05: uses nearest-rank percentiles without mutating samples', () => {
        // Arrange
        const samples = [40, 10, 30, 20]

        // Act / Assert
        expect(percentile(samples, 0.5)).toBe(20)
        expect(percentile(samples, 0.95)).toBe(40)
        expect(samples).toEqual([40, 10, 30, 20])
    })
})

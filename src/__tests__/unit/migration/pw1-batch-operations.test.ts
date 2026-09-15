import { describe, expect, it } from 'vitest'
import { BatchControls, validateBatchLimits } from '@/lib/migration/pw1-batch-controls'
import { batchReportCsv, buildBatchReport, csvCell } from '@/lib/migration/pw1-batch-report'
import { summarizeReadiness } from '@/lib/migration/pw1-readiness'

describe('[TC-F35.M32] Operational budgets', () => {
    it.each([0, -1, 1.2, NaN, Infinity])('rejects invalid limit %s', value => {
        expect(() => validateBatchLimits({ maxGenerationAttempts: value })).toThrow('positive integer')
    })
    it('counts retries against the same generation budget and stops before the next call', () => {
        const controls = new BatchControls({ maxGenerationAttempts: 2 })
        controls.beginGeneration(); controls.beginGeneration()
        expect(() => controls.beginGeneration()).toThrow('attempt budget reached')
        expect(controls.generationAttempts).toBe(2)
    })
    it('permits the response that crosses a soft token limit, then blocks another generation', () => {
        const controls = new BatchControls({ maxDesignTokens: 100 })
        controls.beginGeneration(); controls.recordDesignTokens(110)
        expect(() => controls.checkGenerationBudget()).toThrow('token budget reached')
        expect(controls.designTokens).toBe(110)
    })
    it('bounds generation spacing by the store deadline and fails at that boundary', () => {
        let now = 1000
        const controls = new BatchControls({ maxStoreSeconds: 3, minGenerationIntervalSeconds: 60 }, () => now)
        controls.beginGeneration(); now = 2000
        expect(controls.waitMs(1000)).toBe(2000)
        now = 4000
        expect(() => controls.checkTime(1000)).toThrow('Store time budget')
    })
    it('checks the global deadline independently of store timing', () => {
        let now = 0
        const controls = new BatchControls({ maxBatchSeconds: 2 }, () => now)
        now = 2000
        expect(() => controls.checkTime(1999)).toThrow('Batch time budget')
        expect(() => validateBatchLimits({ minGenerationIntervalSeconds: 86401 })).toThrow()
    })
})

describe('[TC-F35.M33] Operator report', () => {
    it('includes pre-provision failures and deferred stores, with unknown usage as null', () => {
        const batch = { id: 'batch', status: 'failed', started_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:00:05Z', results: [
            { sourceStoreId: '1', error: 'invalid' }, { sourceStoreId: '2', status: 'completed_with_warnings' }, { sourceStoreId: '3', status: 'deferred' },
        ] }
        const report = buildBatchReport(batch, [{ source_store_id: '2', status: 'completed', stage: 'completed', error_code: null, duration_seconds: 4, model: null, design_tokens: null }])
        expect(report.totals).toMatchObject({ stores: 3, completed: 1, failed: 1, deferred: 1, observedDesignTokens: null })
        expect(report.durationSeconds).toBe(5)
        expect(report.stores[1].attemptSeconds).toBe(4)
        expect(report.costUsd).toBeNull()
    })
    it('sums observed usage from failed and successful attempts', () => {
        const report = buildBatchReport({ id: 'b', status: 'completed', started_at: '2026-01-01', finished_at: null, results: [{ sourceStoreId: '1', status: 'completed' }] }, [
            { source_store_id: '1', status: 'failed', stage: 'generation', error_code: 'invalid', duration_seconds: 2, model: 'model', design_tokens: 100 },
            { source_store_id: '1', status: 'completed', stage: 'completed', error_code: null, duration_seconds: 3, model: 'model', design_tokens: 150 },
        ])
        expect(report.stores[0]).toMatchObject({ attempts: 2, observedDesignTokens: 250, attemptSeconds: 5 })
    })
    it('includes a running attempt before a terminal result has been appended', () => {
        const report = buildBatchReport({ id: 'b', status: 'running', started_at: '2026-01-01', finished_at: null, results: [] }, [
            { source_store_id: '1', status: 'running', stage: 'generation', error_code: null, duration_seconds: null, model: null, design_tokens: null },
        ])
        expect(report.totals.running).toBe(1)
        expect(report.stores[0]).toMatchObject({ sourceStoreId: '1', status: 'running', stage: 'generation' })
    })
    it('escapes quotes/newlines and neutralizes spreadsheet formulas', () => {
        expect(csvCell(' \t=HYPERLINK("https://example.test")')).toBe('"\' \t=HYPERLINK(""https://example.test"")"')
        const report = buildBatchReport({ id: 'b', status: 'failed', started_at: '2026-01-01', finished_at: null, results: [{ error: 'line1\n"line2",text' }] }, [])
        expect(batchReportCsv(report)).toContain('"line1\n""line2"",text"')
    })
})

describe('[TC-F35.M34] BE readiness classification', () => {
    it('never equates record counts with source identity verification', () => {
        expect(summarizeReadiness(5, 2)).toMatchObject({ status: 'data-present-mapping-unverified', sourceMappingVerified: false })
        expect(summarizeReadiness(0, 2).status).toBe('missing-data')
        expect(summarizeReadiness(null, null)).toMatchObject({ status: 'not-required', warnings: [] })
    })
})

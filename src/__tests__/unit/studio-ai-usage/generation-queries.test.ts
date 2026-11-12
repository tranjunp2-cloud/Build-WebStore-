import { describe, expect, it } from 'vitest'
import { getGenerationSection, getGenerationStats, NO_CODE } from '@/lib/admin/ai-usage/generation-queries'
import { resolvePeriod } from '@/lib/admin/ai-usage/period'
import { fakeDb, fakeDbBy } from './fake-db'

const period = resolvePeriod({}, new Date('2026-10-29T06:12:00.000Z'))

describe('TC-AIS-GEN-001 which generations are counted', () => {
    it('counts only finished site-generator runs and leaves out form rejections', async () => {
        const { db, calls } = fakeDb([{ finished: '149', succeeded: '131', median_ms: '41000' }], [{ cost: '16.90' }])

        await getGenerationStats(db, period.start, period.end)

        const sql = calls[0].sql
        expect(sql).toContain('r.endpoint = $')
        expect(calls[0].params).toContain('site-generator')
        expect(sql).toContain("r.status IN ('success', 'failed')") // never 'running'
        expect(sql).toContain("e.code = 'FORM_INVALID'")
        expect(sql).toContain('NOT EXISTS')
        expect(sql).toContain("r.outcome IS DISTINCT FROM 'cancelled'")
        expect(sql).not.toContain('generate-meta') // SEO rows are excluded by the endpoint match, not listed
    })

    it('computes success rate, median and cost per success from the Website setup area', async () => {
        const { db, calls } = fakeDb([{ finished: '149', succeeded: '131', median_ms: '41000' }], [{ cost: '16.90' }])

        const stats = await getGenerationStats(db, period.start, period.end)

        expect(stats.successRate).toBeCloseTo((131 / 149) * 100)
        expect(stats.medianMs).toBe(41000)
        expect(stats.costPerSuccess).toBeCloseTo(16.9 / 131)
        expect(calls[1].sql).toContain('FROM ai_usage_logs')
        expect(calls[1].params).toContain('website-setup')
    })

    it('has no rate or cost per success when nothing finished', async () => {
        const { db } = fakeDb([{ finished: '0', succeeded: '0', median_ms: null }], [{ cost: '3' }])
        const stats = await getGenerationStats(db, period.start, period.end)
        expect(stats).toMatchObject({ successRate: null, medianMs: null, costPerSuccess: null })
    })
})

describe('TC-AIS-GEN-002 failure reasons and recent failures', () => {
    it('uses the real incident code, then the failed page code, then "No code recorded"', async () => {
        const { db, calls } = fakeDbBy([
            ['percentile_cont', [{ finished: '10', succeeded: '6', median_ms: '1000' }]],
            ['FROM ai_usage_logs', [{ cost: '1' }]],
            ['AS running', [{ running: '9', rejected: '14', other: '1204' }]],
            ['GROUP BY 1 ORDER BY n DESC', [{ code: 'PROVIDER_TIMEOUT', n: '3' }, { code: NO_CODE, n: '1' }]],
            ['LEFT JOIN tenants', [{ id: 77, shop: null, code: 'PROVIDER_TIMEOUT', created_at: '2026-10-29T04:41:00.000Z', duration_ms: '120000' }]],
        ])

        const section = await getGenerationSection(db, period)

        const reasonSql = calls.find((c) => c.sql.includes('GROUP BY 1 ORDER BY n DESC'))!
        expect(reasonSql.sql.indexOf('ai_generation_records_generation_errors')).toBeLessThan(reasonSql.sql.indexOf('ai_generation_records_page_outcomes'))
        expect(reasonSql.params).toContain(NO_CODE)
        expect(reasonSql.sql).toContain("r.status = 'failed'")
        expect(section.failedTotal).toBe(4)
        expect(section.failReasons).toEqual([{ code: 'PROVIDER_TIMEOUT', count: 3 }, { code: NO_CODE, count: 1 }])
        expect(section.exclusions).toEqual({ running: 9, rejected: 14, otherEndpoints: 1204 })
        expect(section.recentFailed[0]).toEqual({ id: 77, shop: 'Unknown shop', code: 'PROVIDER_TIMEOUT', at: '2026-10-29T04:41:00.000Z', durationMs: 120000 })
        expect(section.finishedDeltaPct).toBe(0) // both windows get the same fake rows
    })
})

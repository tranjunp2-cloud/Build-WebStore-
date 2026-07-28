import { describe, expect, it } from 'vitest'
import { getGuidance } from '@/lib/admin/live-errors/guidance'

// ── TC-F39-AC09–10: Deterministic suggested checks ─────────────────────────
describe('[TC-F39-AC09–10] deterministic live-error guidance', () => {
    const cases = [
        { statusCode: 500, message: 'failed', source: 'vercel' as const, frames: false, category: 'http-500-503' },
        { statusCode: 504, message: 'failed', source: 'vercel' as const, frames: false, category: 'timeout' },
        { statusCode: null, message: 'request timed out', source: 'vercel' as const, frames: false, category: 'timeout' },
        { statusCode: 403, message: 'denied', source: 'vercel' as const, frames: false, category: 'authentication' },
        { statusCode: 404, message: 'missing', source: 'vercel' as const, frames: false, category: 'not-found' },
        { statusCode: 429, message: 'limited', source: 'vercel' as const, frames: false, category: 'rate-limit' },
        { statusCode: null, message: 'exception', source: 'sentry' as const, frames: true, category: 'application-exception' },
        { statusCode: null, message: 'unknown', source: 'vercel' as const, frames: false, category: 'unmatched' },
    ]

    it.each(cases)('returns $category without claiming a root cause', testCase => {
        // Arrange
        const input = {
            source: testCase.source,
            statusCode: testCase.statusCode,
            message: testCase.message,
            hasApplicationFrames: testCase.frames,
        }

        // Act
        const result = getGuidance(input)

        // Assert
        expect(result.category).toBe(testCase.category)
        expect(result.label).toBe('Suggested next checks')
        expect(result.checks).toHaveLength(2)
        expect(result.escalationCondition).toMatch(/^Escalate when /)
    })
})

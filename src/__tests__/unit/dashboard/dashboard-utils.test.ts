/**
 * Unit Tests — F03 Dashboard Utility Functions
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.08  → formatCompactNumber
 *   TC-F03.13/14/15/16 → parsePeriod, periodToDays
 *   TC-F03.22  → processAnalyticsDocs
 *   TC-F03.24/25/26 → mapToTopList
 *   TC-F03.27  → calcDelta (positive growth)
 *   TC-F03.28  → calcDelta (negative decline)
 *   TC-F03.29  → calcDelta (zero change)
 *   TC-F03.33  → getSeoScoreStatus
 *   TC-F03.39  → truncateSeoTitle
 *   TC-F03.40  → truncateSeoDescription
 *   TC-F03.47  → canAddKeyword / MAX_KEYWORDS
 */

import { describe, it, expect } from 'vitest'
import {
    formatCompactNumber,
    calcDelta,
    getDeltaStatus,
    getSeoScoreStatus,
    truncateSeoTitle,
    truncateSeoDescription,
    canAddKeyword,
    MAX_KEYWORDS,
    processAnalyticsDocs,
    mapToTopList,
    parsePeriod,
    periodToDays,
    type AnalyticsDoc,
} from '@/lib/dashboard-utils'

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.08 — Compact number formatting
// ─────────────────────────────────────────────────────────────────────────────
describe('formatCompactNumber', () => {
    it('[TC-F03.08] formats 1520 as "1.5K"', () => {
        expect(formatCompactNumber(1520)).toBe('1.5K')
    })

    it('formats 1000 as "1.0K"', () => {
        expect(formatCompactNumber(1000)).toBe('1.0K')
    })

    it('formats 999 without suffix', () => {
        expect(formatCompactNumber(999)).toBe('999')
    })

    it('formats 0 without suffix', () => {
        expect(formatCompactNumber(0)).toBe('0')
    })

    it('formats 1_500_000 as "1.5M"', () => {
        expect(formatCompactNumber(1_500_000)).toBe('1.5M')
    })

    it('formats 10_000 as "10.0K"', () => {
        expect(formatCompactNumber(10_000)).toBe('10.0K')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.27/28/29 — Delta / Growth-rate calculation
// ─────────────────────────────────────────────────────────────────────────────
describe('calcDelta', () => {
    it('[TC-F03.27] calculates positive growth: 2000 vs 1500 → +33.33%', () => {
        const result = calcDelta(2000, 1500)
        expect(result).toBeCloseTo(33.33, 1)
    })

    it('[TC-F03.28] calculates negative decline: 200 vs 300 → -33.33%', () => {
        const result = calcDelta(200, 300)
        expect(result).toBeCloseTo(-33.33, 1)
    })

    it('[TC-F03.29] returns 0 when current === prev (no change)', () => {
        expect(calcDelta(500, 500)).toBe(0)
    })

    it('returns 100 when previous is 0 and current > 0 (new traffic)', () => {
        expect(calcDelta(100, 0)).toBe(100)
    })

    it('returns 0 when both values are 0', () => {
        expect(calcDelta(0, 0)).toBe(0)
    })

    it('handles large values correctly', () => {
        const result = calcDelta(10_000, 5_000)
        expect(result).toBeCloseTo(100, 1)
    })
})

describe('getDeltaStatus', () => {
    it('[TC-F03.27] returns "positive" for positive delta', () => {
        expect(getDeltaStatus(33.3)).toBe('positive')
    })

    it('[TC-F03.28] returns "negative" for negative delta', () => {
        expect(getDeltaStatus(-33.3)).toBe('negative')
    })

    it('[TC-F03.29] returns "zero" for delta = 0', () => {
        expect(getDeltaStatus(0)).toBe('zero')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.33 — SEO Health Score status classification
// ─────────────────────────────────────────────────────────────────────────────
describe('getSeoScoreStatus', () => {
    it('[TC-F03.33] returns "good" for score >= 80 (e.g. 80)', () => {
        expect(getSeoScoreStatus(80)).toBe('good')
    })

    it('returns "good" for score = 100', () => {
        expect(getSeoScoreStatus(100)).toBe('good')
    })

    it('returns "warning" for score 50–79 (e.g. 68)', () => {
        expect(getSeoScoreStatus(68)).toBe('warning')
    })

    it('returns "warning" for score = 50', () => {
        expect(getSeoScoreStatus(50)).toBe('warning')
    })

    it('returns "critical" for score < 50 (e.g. 30)', () => {
        expect(getSeoScoreStatus(30)).toBe('critical')
    })

    it('returns "critical" for score = 0', () => {
        expect(getSeoScoreStatus(0)).toBe('critical')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.39 — Truncate AI-generated SEO Title (max 60 chars)
// ─────────────────────────────────────────────────────────────────────────────
describe('truncateSeoTitle', () => {
    it('[TC-F03.39] truncates title exceeding 60 chars', () => {
        const rawTitle = 'A'.repeat(100)
        const result = truncateSeoTitle(rawTitle)
        expect(result.length).toBe(60)
    })

    it('does not truncate title within 60 chars', () => {
        const shortTitle = 'Short Title for SEO'
        expect(truncateSeoTitle(shortTitle)).toBe(shortTitle)
    })

    it('handles exact 60-char title without truncation', () => {
        const exactTitle = 'A'.repeat(60)
        expect(truncateSeoTitle(exactTitle)).toBe(exactTitle)
    })

    it('handles empty string', () => {
        expect(truncateSeoTitle('')).toBe('')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.40 — Truncate AI-generated SEO Description (max 160 chars)
// ─────────────────────────────────────────────────────────────────────────────
describe('truncateSeoDescription', () => {
    it('[TC-F03.40] truncates description exceeding 160 chars', () => {
        const rawDesc = 'B'.repeat(300)
        const result = truncateSeoDescription(rawDesc)
        expect(result.length).toBe(160)
    })

    it('does not truncate description within 160 chars', () => {
        const shortDesc = 'A concise meta description.'
        expect(truncateSeoDescription(shortDesc)).toBe(shortDesc)
    })

    it('handles exact 160-char description without truncation', () => {
        const exact = 'C'.repeat(160)
        expect(truncateSeoDescription(exact)).toBe(exact)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.47 — Keyword tracking limit (max 5 keywords)
// ─────────────────────────────────────────────────────────────────────────────
describe('canAddKeyword / MAX_KEYWORDS', () => {
    it('MAX_KEYWORDS constant equals 5', () => {
        expect(MAX_KEYWORDS).toBe(5)
    })

    it('[TC-F03.47] returns false when already at limit (5 keywords)', () => {
        expect(canAddKeyword(5)).toBe(false)
    })

    it('returns false when over limit (e.g. 6)', () => {
        expect(canAddKeyword(6)).toBe(false)
    })

    it('returns true when under limit (e.g. 4)', () => {
        expect(canAddKeyword(4)).toBe(true)
    })

    it('returns true when list is empty', () => {
        expect(canAddKeyword(0)).toBe(true)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.22 — Analytics doc processing (views vs clicks)
// ─────────────────────────────────────────────────────────────────────────────
describe('processAnalyticsDocs', () => {
    const baseDoc = (event: string): AnalyticsDoc => ({
        event,
        pageUrl: '/test',
        createdAt: new Date().toISOString(),
    })

    it('[TC-F03.22] counts pageview events as views', () => {
        const docs = [baseDoc('pageview'), baseDoc('pageview')]
        expect(processAnalyticsDocs(docs)).toEqual({ views: 2, clicks: 0 })
    })

    it('counts click events as clicks', () => {
        const docs = [baseDoc('click'), baseDoc('add_to_cart'), baseDoc('checkout')]
        expect(processAnalyticsDocs(docs)).toEqual({ views: 0, clicks: 3 })
    })

    it('counts purchase events as clicks', () => {
        const docs = [baseDoc('purchase')]
        expect(processAnalyticsDocs(docs)).toEqual({ views: 0, clicks: 1 })
    })

    it('handles mixed events correctly', () => {
        const docs = [
            baseDoc('pageview'),
            baseDoc('pageview'),
            baseDoc('click'),
            baseDoc('add_to_cart'),
        ]
        expect(processAnalyticsDocs(docs)).toEqual({ views: 2, clicks: 2 })
    })

    it('returns zeros for empty array', () => {
        expect(processAnalyticsDocs([])).toEqual({ views: 0, clicks: 0 })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.24/25/26 — Top list aggregation (limit = 10)
// ─────────────────────────────────────────────────────────────────────────────
describe('mapToTopList', () => {
    it('[TC-F03.24/25/26] limits result to 10 items when more than 10 pages exist', () => {
        const data: Record<string, number> = {}
        for (let i = 1; i <= 50; i++) {
            data[`/page-${i}`] = i
        }
        const result = mapToTopList(data)
        expect(result.length).toBe(10)
    })

    it('sorts by value descending', () => {
        const data = { '/a': 10, '/b': 50, '/c': 30 }
        const result = mapToTopList(data)
        expect(result[0].value).toBe(50)
        expect(result[1].value).toBe(30)
        expect(result[2].value).toBe(10)
    })

    it('maps "/" url to name "Home"', () => {
        const data = { '/': 100 }
        const result = mapToTopList(data)
        expect(result[0].name).toBe('Home')
    })

    it('extracts last path segment as name', () => {
        const data = { '/blog/my-first-post': 5 }
        const result = mapToTopList(data)
        expect(result[0].name).toBe('my-first-post')
    })

    it('returns fewer than 10 when data has fewer entries', () => {
        const data = { '/a': 1, '/b': 2 }
        expect(mapToTopList(data).length).toBe(2)
    })

    it('returns empty array for empty data', () => {
        expect(mapToTopList({})).toEqual([])
    })

    it('respects custom limit parameter', () => {
        const data: Record<string, number> = {}
        for (let i = 1; i <= 20; i++) data[`/p${i}`] = i
        expect(mapToTopList(data, 5).length).toBe(5)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.13/14/15/16 — Period selector parsing & session persistence helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('parsePeriod', () => {
    it('[TC-F03.13] parses "today" as "today"', () => {
        expect(parsePeriod('today')).toBe('today')
    })

    it('[TC-F03.14] parses "7d" as "7d"', () => {
        expect(parsePeriod('7d')).toBe('7d')
    })

    it('[TC-F03.15] parses "30d" as "30d"', () => {
        expect(parsePeriod('30d')).toBe('30d')
    })

    it('falls back to "7d" for invalid input', () => {
        expect(parsePeriod('invalid')).toBe('7d')
    })

    it('falls back to "7d" for undefined', () => {
        expect(parsePeriod(undefined)).toBe('7d')
    })

    it('falls back to "7d" for null', () => {
        expect(parsePeriod(null)).toBe('7d')
    })
})

describe('periodToDays', () => {
    it('returns 1 for "today"', () => {
        expect(periodToDays('today')).toBe(1)
    })

    it('returns 7 for "7d"', () => {
        expect(periodToDays('7d')).toBe(7)
    })

    it('returns 30 for "30d"', () => {
        expect(periodToDays('30d')).toBe(30)
    })
})

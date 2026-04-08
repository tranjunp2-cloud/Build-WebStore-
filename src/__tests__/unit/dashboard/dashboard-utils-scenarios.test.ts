/**
 * Unit Tests — F03 Dashboard Utility Functions (Scenario Coverage)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.34  → classifySeoCategoryIssues
 *   TC-F03.42  → shouldTriggerUndo
 *   TC-F03.45  → filterApprovedFixes
 *   TC-F03.48  → getMockRank
 *   TC-F03.50  → generateAIInsight
 *   TC-F03.51  → extractReferrerDomain
 *   TC-F03.52  → getSeoScoreColorClass
 *
 * Scenario dimensions covered:
 *   #2 Input Extremes — boundary values, empty/null/unicode
 *   #4 Scale — 0 items, many items
 *   #9 Data Integrity — malformed referrers, unknown event types
 *   #12 Business Logic — boundary scores, delta edge cases
 */

import { describe, it, expect } from 'vitest'
import {
    classifySeoCategoryIssues,
    shouldTriggerUndo,
    filterApprovedFixes,
    generateAIInsight,
    getMockRank,
    extractReferrerDomain,
    getSeoScoreColorClass,
    type PageAnalysis,
    type SEOIssue,
} from '@/lib/dashboard-utils'

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.34 — classifySeoCategoryIssues
// ─────────────────────────────────────────────────────────────────────────────
describe('classifySeoCategoryIssues', () => {
    const makeIssue = (field: string, type: SEOIssue['type'] = 'warning'): SEOIssue => ({
        type,
        field,
        message: `Issue with ${field}`,
        autoFixable: true,
    })

    const makePage = (issues: SEOIssue[]): PageAnalysis => ({
        pageId: '1',
        title: 'Test Page',
        slug: '/test',
        score: 50,
        issues,
    })

    it('[TC-F03.34] classifies meta issues (metaTitle, metaDescription)', () => {
        const pages = [makePage([makeIssue('metaTitle'), makeIssue('metaDescription')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.meta).toHaveLength(2)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })

    it('classifies content issues', () => {
        const pages = [makePage([makeIssue('content')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.content).toHaveLength(1)
        expect(result.meta).toHaveLength(0)
    })

    it('classifies technical issues (images, schema, speed)', () => {
        const pages = [makePage([makeIssue('images'), makeIssue('schema'), makeIssue('speed')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.technical).toHaveLength(3)
    })

    it('handles empty pages array', () => {
        const result = classifySeoCategoryIssues([])
        expect(result.meta).toHaveLength(0)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })

    it('handles multiple pages with mixed issues', () => {
        const pages = [
            makePage([makeIssue('metaTitle'), makeIssue('content')]),
            makePage([makeIssue('images'), makeIssue('metaDescription')]),
        ]
        const result = classifySeoCategoryIssues(pages)
        expect(result.meta).toHaveLength(2)
        expect(result.content).toHaveLength(1)
        expect(result.technical).toHaveLength(1)
    })

    it('unknown field type falls into no category', () => {
        const pages = [makePage([makeIssue('unknownField')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.meta).toHaveLength(0)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.42 — shouldTriggerUndo
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldTriggerUndo', () => {
    it('[TC-F03.42] returns true for Ctrl+Z with backup data', () => {
        expect(shouldTriggerUndo({ ctrlKey: true, metaKey: false, key: 'z' }, 3)).toBe(true)
    })

    it('returns true for Cmd+Z (Mac) with backup data', () => {
        expect(shouldTriggerUndo({ ctrlKey: false, metaKey: true, key: 'z' }, 1)).toBe(true)
    })

    it('returns false when no backup data (length 0)', () => {
        expect(shouldTriggerUndo({ ctrlKey: true, metaKey: false, key: 'z' }, 0)).toBe(false)
    })

    it('returns false when key is not "z"', () => {
        expect(shouldTriggerUndo({ ctrlKey: true, metaKey: false, key: 'a' }, 3)).toBe(false)
    })

    it('returns false when neither ctrl nor meta pressed', () => {
        expect(shouldTriggerUndo({ ctrlKey: false, metaKey: false, key: 'z' }, 3)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.45 — filterApprovedFixes
// ─────────────────────────────────────────────────────────────────────────────
describe('filterApprovedFixes', () => {
    const fixes = [
        { id: 'a', name: 'Fix A' },
        { id: 'b', name: 'Fix B' },
        { id: 'c', name: 'Fix C' },
    ]

    it('[TC-F03.45] filters to only approved IDs', () => {
        const approved = new Set(['a', 'c'])
        const result = filterApprovedFixes(fixes, approved)
        expect(result).toHaveLength(2)
        expect(result.map(f => f.id)).toEqual(['a', 'c'])
    })

    it('returns empty array when no approvals', () => {
        const result = filterApprovedFixes(fixes, new Set())
        expect(result).toHaveLength(0)
    })

    it('returns all when all approved', () => {
        const result = filterApprovedFixes(fixes, new Set(['a', 'b', 'c']))
        expect(result).toHaveLength(3)
    })

    it('handles empty fixes array', () => {
        const result = filterApprovedFixes([], new Set(['a']))
        expect(result).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.50 — generateAIInsight
// ─────────────────────────────────────────────────────────────────────────────
describe('generateAIInsight', () => {
    it('[TC-F03.50] returns null when both views and prevViews are 0', () => {
        expect(generateAIInsight(0, 0)).toBeNull()
    })

    it('returns "up" type when prevViews=0 and views>0 (new traffic)', () => {
        const result = generateAIInsight(100, 0)
        expect(result).not.toBeNull()
        expect(result!.type).toBe('up')
        expect(result!.message).toContain('picking up')
    })

    it('returns viral alert when growth > 50%', () => {
        const result = generateAIInsight(200, 100)
        expect(result!.type).toBe('up')
        expect(result!.message).toContain('surged')
        expect(result!.message).toContain('100%')
    })

    it('returns trending message for moderate growth (<=50%)', () => {
        const result = generateAIInsight(130, 100)
        expect(result!.type).toBe('up')
        expect(result!.message).toContain('Trending')
        expect(result!.message).toContain('30%')
    })

    it('returns warning for significant drop (>30%)', () => {
        const result = generateAIInsight(50, 100)
        expect(result!.type).toBe('down')
        expect(result!.message).toContain('Warning')
        expect(result!.message).toContain('50%')
    })

    it('returns moderate drop message for <=30% decline', () => {
        const result = generateAIInsight(80, 100)
        expect(result!.type).toBe('down')
        expect(result!.message).toContain('dropped')
        expect(result!.message).toContain('20%')
    })

    it('returns neutral when views equal prevViews', () => {
        const result = generateAIInsight(100, 100)
        expect(result!.type).toBe('neutral')
        expect(result!.message).toContain('stable')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.48 — getMockRank
// ─────────────────────────────────────────────────────────────────────────────
describe('getMockRank', () => {
    it('[TC-F03.48] returns rank between 1 and 50', () => {
        const rank = getMockRank('test keyword')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })

    it('is deterministic (same keyword → same rank)', () => {
        const rank1 = getMockRank('seo malaysia')
        const rank2 = getMockRank('seo malaysia')
        expect(rank1).toBe(rank2)
    })

    it('different keywords can produce different ranks', () => {
        const rank1 = getMockRank('web design')
        const rank2 = getMockRank('mobile app')
        // They CAN be different; at minimum, function shouldn't crash
        expect(typeof rank1).toBe('number')
        expect(typeof rank2).toBe('number')
    })

    it('handles empty string', () => {
        const rank = getMockRank('')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })

    it('handles unicode keyword', () => {
        const rank = getMockRank('设计网页')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.51 — extractReferrerDomain
// ─────────────────────────────────────────────────────────────────────────────
describe('extractReferrerDomain', () => {
    it('[TC-F03.51] extracts domain from valid URL', () => {
        expect(extractReferrerDomain('https://www.google.com/search?q=test')).toBe('google.com')
    })

    it('strips www prefix', () => {
        expect(extractReferrerDomain('https://www.facebook.com/')).toBe('facebook.com')
    })

    it('returns null for empty string', () => {
        expect(extractReferrerDomain('')).toBeNull()
    })

    it('returns null for localhost', () => {
        expect(extractReferrerDomain('http://localhost:3000/page')).toBeNull()
    })

    it('returns null for internal host', () => {
        expect(extractReferrerDomain('https://mysite.com/page', 'mysite.com')).toBeNull()
    })

    it('treats short non-URL string as UTM source', () => {
        expect(extractReferrerDomain('facebook_ads')).toBe('facebook_ads')
    })

    it('returns null for long non-URL string (>100 chars)', () => {
        const longString = 'a'.repeat(101)
        expect(extractReferrerDomain(longString)).toBeNull()
    })

    it('returns null for path-like string starting with /', () => {
        expect(extractReferrerDomain('/internal/page')).toBeNull()
    })

    it('handles URL without www', () => {
        expect(extractReferrerDomain('https://twitter.com/post/123')).toBe('twitter.com')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.52 — getSeoScoreColorClass
// ─────────────────────────────────────────────────────────────────────────────
describe('getSeoScoreColorClass', () => {
    it('[TC-F03.52] returns green for score >= 80', () => {
        expect(getSeoScoreColorClass(80)).toBe('text-green-400')
        expect(getSeoScoreColorClass(100)).toBe('text-green-400')
    })

    it('returns yellow for score 50-79', () => {
        expect(getSeoScoreColorClass(50)).toBe('text-yellow-400')
        expect(getSeoScoreColorClass(79)).toBe('text-yellow-400')
    })

    it('returns red for score < 50', () => {
        expect(getSeoScoreColorClass(0)).toBe('text-red-400')
        expect(getSeoScoreColorClass(49)).toBe('text-red-400')
    })
})

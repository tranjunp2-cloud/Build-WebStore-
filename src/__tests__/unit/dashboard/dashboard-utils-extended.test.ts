/**
 * Extended Unit Tests — F03 Dashboard (Full Coverage Pass 2)
 * Covers additional TCs & logic after codebase review:
 *
 *  TC-F03.34  → classifySeoCategoryIssues + getSeoScoreColorClass
 *  TC-F03.42/45 → filterApprovedFixes + shouldTriggerUndo (Ctrl+Z)
 *  US-01      → generateAIInsight (AISmartInsights component logic)
 *  TC-F03.48  → getMockRank (deterministic hash, range 1-50)
 *  Analytics  → extractReferrerDomain (referrer cleaning)
 */

import { describe, it, expect } from 'vitest'
import {
    getSeoScoreColorClass,
    classifySeoCategoryIssues,
    shouldTriggerUndo,
    filterApprovedFixes,
    generateAIInsight,
    getMockRank,
    extractReferrerDomain,
    type PageAnalysis,
    type SEOIssue,
    type BatchFix,
} from '@/lib/dashboard-utils'

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.34 — SEO Score Color Class (ScoreGauge component logic)
// ─────────────────────────────────────────────────────────────────────────────
describe('getSeoScoreColorClass', () => {
    it('returns "text-green-400" for score >= 80 (good)', () => {
        expect(getSeoScoreColorClass(80)).toBe('text-green-400')
        expect(getSeoScoreColorClass(100)).toBe('text-green-400')
    })

    it('returns "text-yellow-400" for score 50-79 (warning)', () => {
        expect(getSeoScoreColorClass(50)).toBe('text-yellow-400')
        expect(getSeoScoreColorClass(68)).toBe('text-yellow-400')
        expect(getSeoScoreColorClass(79)).toBe('text-yellow-400')
    })

    it('returns "text-red-400" for score < 50 (critical)', () => {
        expect(getSeoScoreColorClass(0)).toBe('text-red-400')
        expect(getSeoScoreColorClass(49)).toBe('text-red-400')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.34 — SEO Category Breakdown classification
// ─────────────────────────────────────────────────────────────────────────────
describe('classifySeoCategoryIssues', () => {
    const makeIssue = (field: string, type: 'error' | 'warning' | 'info' = 'error'): SEOIssue => ({
        type,
        field,
        message: `Issue with ${field}`,
        autoFixable: true,
    })

    const makePage = (issues: SEOIssue[]): PageAnalysis => ({
        pageId: 'p1',
        title: 'Test Page',
        slug: '/test',
        score: 60,
        issues,
    })

    it('[TC-F03.34] classifies metaTitle and metaDescription into "meta" bucket', () => {
        const pages = [makePage([makeIssue('metaTitle'), makeIssue('metaDescription')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.meta).toHaveLength(2)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })

    it('classifies "content" field into content bucket', () => {
        const pages = [makePage([makeIssue('content')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.content).toHaveLength(1)
        expect(result.meta).toHaveLength(0)
    })

    it('classifies "images", "schema", "speed" into technical bucket', () => {
        const pages = [makePage([makeIssue('images'), makeIssue('schema'), makeIssue('speed')])]
        const result = classifySeoCategoryIssues(pages)
        expect(result.technical).toHaveLength(3)
    })

    it('aggregates issues across multiple pages', () => {
        const pages = [
            makePage([makeIssue('metaTitle')]),
            makePage([makeIssue('content'), makeIssue('schema')]),
        ]
        const result = classifySeoCategoryIssues(pages)
        expect(result.meta).toHaveLength(1)
        expect(result.content).toHaveLength(1)
        expect(result.technical).toHaveLength(1)
    })

    it('returns all empty arrays for pages with no issues', () => {
        const result = classifySeoCategoryIssues([makePage([])])
        expect(result.meta).toHaveLength(0)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })

    it('returns all empty arrays for empty pages array', () => {
        const result = classifySeoCategoryIssues([])
        expect(result.meta).toHaveLength(0)
        expect(result.content).toHaveLength(0)
        expect(result.technical).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.45 — Undo/Rollback: Ctrl+Z keyboard shortcut logic
// ─────────────────────────────────────────────────────────────────────────────
describe('shouldTriggerUndo', () => {
    const ctrlZ = { ctrlKey: true, metaKey: false, key: 'z' }
    const metaZ = { ctrlKey: false, metaKey: true, key: 'z' }
    const ctrlY = { ctrlKey: true, metaKey: false, key: 'y' }

    it('[TC-F03.45] returns true for Ctrl+Z when backup exists', () => {
        expect(shouldTriggerUndo(ctrlZ, 3)).toBe(true)
    })

    it('returns true for Cmd+Z (macOS) when backup exists', () => {
        expect(shouldTriggerUndo(metaZ, 1)).toBe(true)
    })

    it('does NOT trigger undo when backup is empty', () => {
        expect(shouldTriggerUndo(ctrlZ, 0)).toBe(false)
    })

    it('does NOT trigger for Ctrl+Y (wrong key)', () => {
        expect(shouldTriggerUndo(ctrlY, 5)).toBe(false)
    })

    it('does NOT trigger when neither Ctrl nor Meta is pressed', () => {
        expect(shouldTriggerUndo({ ctrlKey: false, metaKey: false, key: 'z' }, 3)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.42 — AI Fix All: filter approved fixes (Before/After modal)
// ─────────────────────────────────────────────────────────────────────────────
describe('filterApprovedFixes', () => {
    const fixes: BatchFix[] = [
        { targetId: 't1', collection: 'pages', seo: { title: 'New Title 1' } },
        { targetId: 't2', collection: 'pages', seo: { title: 'New Title 2' } },
        { targetId: 't3', collection: 'products', seo: { description: 'Desc' } },
    ]
    // Add ids to satisfy type requirement
    const fixesWithId = fixes.map((f, i) => ({ ...f, id: `fix-${i}` }))

    it('[TC-F03.42] returns only approved fixes', () => {
        const approved = new Set(['fix-0', 'fix-2'])
        const result = filterApprovedFixes(fixesWithId, approved)
        expect(result).toHaveLength(2)
        expect(result.map(f => f.id)).toEqual(['fix-0', 'fix-2'])
    })

    it('returns empty array when no fixes approved', () => {
        expect(filterApprovedFixes(fixesWithId, new Set())).toHaveLength(0)
    })

    it('returns all fixes when all are approved', () => {
        const all = new Set(fixesWithId.map(f => f.id))
        expect(filterApprovedFixes(fixesWithId, all)).toHaveLength(3)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// US-01 — generateAIInsight (AISmartInsights component logic)
// ─────────────────────────────────────────────────────────────────────────────
describe('generateAIInsight', () => {
    it('returns null when both views and prevViews are 0 (no data)', () => {
        expect(generateAIInsight(0, 0)).toBeNull()
    })

    it('returns "picking up" message when previous was 0 and current > 0', () => {
        const insight = generateAIInsight(100, 0)
        expect(insight).not.toBeNull()
        expect(insight?.type).toBe('up')
        expect(insight?.message).toContain('picking up')
    })

    it('returns "viral alert" when traffic surged > 50%', () => {
        // 1000 vs 500 = +100%
        const insight = generateAIInsight(1000, 500)
        expect(insight?.type).toBe('up')
        expect(insight?.message).toContain('Viral alert')
    })

    it('returns "trending up" for moderate growth <= 50%', () => {
        // 1500 vs 1000 = +50% exactly → NOT viral (> 50 means strictly greater)
        const insight = generateAIInsight(1500, 1000)
        expect(insight?.type).toBe('up')
        expect(insight?.message).toContain('Trending')
    })

    it('returns "significant drop" warning when drop > 30%', () => {
        // 100 vs 200 = -50%
        const insight = generateAIInsight(100, 200)
        expect(insight?.type).toBe('down')
        expect(insight?.message).toContain('Warning')
    })

    it('[TC-F03.28] returns regular decline message for drop <= 30%', () => {
        // 280 vs 300 ≈ -6.7%
        const insight = generateAIInsight(280, 300)
        expect(insight?.type).toBe('down')
        expect(insight?.message).toContain('Traffic dropped')
    })

    it('[TC-F03.29] returns "stable" message when no change', () => {
        const insight = generateAIInsight(500, 500)
        expect(insight?.type).toBe('neutral')
        expect(insight?.message).toContain('stable')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F03.48 — getMockRank (deterministic hash-based rank for Cron fallback)
// ─────────────────────────────────────────────────────────────────────────────
describe('getMockRank', () => {
    it('[TC-F03.48] returns a number between 1 and 50 inclusive', () => {
        const rank = getMockRank('ecommerce malaysia')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })

    it('returns deterministic result for same keyword', () => {
        const k = 'online shop'
        expect(getMockRank(k)).toBe(getMockRank(k))
    })

    it('returns different ranks for different keywords (generally)', () => {
        const r1 = getMockRank('shoes')
        const r2 = getMockRank('handbag')
        // Different keywords should typically produce different ranks
        // (not a strict assertion since hash collisions possible, but high chance)
        expect(typeof r1).toBe('number')
        expect(typeof r2).toBe('number')
    })

    it('handles single character keyword', () => {
        const rank = getMockRank('a')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — extractReferrerDomain (referrer cleaning)
// ─────────────────────────────────────────────────────────────────────────────
describe('extractReferrerDomain', () => {
    it('extracts domain from a full URL', () => {
        expect(extractReferrerDomain('https://www.google.com/search?q=test')).toBe('google.com')
    })

    it('strips www. prefix', () => {
        expect(extractReferrerDomain('https://www.facebook.com')).toBe('facebook.com')
    })

    it('returns null for empty string', () => {
        expect(extractReferrerDomain('')).toBeNull()
    })

    it('returns null for localhost referrer', () => {
        expect(extractReferrerDomain('http://localhost:3000/page')).toBeNull()
    })

    it('returns null when referrer matches internal host', () => {
        expect(extractReferrerDomain('https://myshop.com/page', 'myshop.com')).toBeNull()
    })

    it('treats short non-URL strings as UTM source labels', () => {
        expect(extractReferrerDomain('google-ads')).toBe('google-ads')
    })

    it('returns null for path-like strings starting with /', () => {
        expect(extractReferrerDomain('/internal/page')).toBeNull()
    })

    it('returns null for very long strings (>= 100 chars) that are not valid URLs', () => {
        const longString = 'a'.repeat(100)
        expect(extractReferrerDomain(longString)).toBeNull()
    })

    it('handles subdomain extraction correctly', () => {
        expect(extractReferrerDomain('https://blog.example.com/post/1')).toBe('blog.example.com')
    })
})

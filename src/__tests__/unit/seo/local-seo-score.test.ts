/**
 * @fileoverview Tests for calculateLocalSeoScore (F37 US-01 Phase 05)
 * TC-IDs: TC-F37-01-10, TC-F37-01-11 (provisional — docs/qa/F37*.md not yet formalized)
 */
import { describe, it, expect } from 'vitest'
import { calculateLocalSeoScore, type LocalSeoScoreInput } from '@/lib/seo/local-seo-score'

const bareSite: LocalSeoScoreInput = {
    businessName: true, address: false, phone: false, hours: false, category: false, website: true, description: false,
    localBusinessSchema: false, industrySubtype: false, faqSchema: false, orgSchema: true,
    allowsSearchBots: false, sitemapPresent: true,
    coreWebVitals: 80, mobileResponsive: true, httpsEnabled: true,
}

const fullSite: LocalSeoScoreInput = {
    businessName: true, address: true, phone: true, hours: true, category: true, website: true, description: true,
    localBusinessSchema: true, industrySubtype: true, faqSchema: true, orgSchema: true,
    allowsSearchBots: true, sitemapPresent: true,
    coreWebVitals: 100, mobileResponsive: true, httpsEnabled: true,
}

const emptySite: LocalSeoScoreInput = {
    businessName: false, address: false, phone: false, hours: false, category: false, website: false, description: false,
    localBusinessSchema: false, industrySubtype: false, faqSchema: false, orgSchema: false,
    allowsSearchBots: false, sitemapPresent: false,
    coreWebVitals: 0, mobileResponsive: false, httpsEnabled: false,
}

// ── TC-F37-01-10: ≥20-point gain (AC-1) ─────────────────────────────────────

describe('[TC-F37-01-10] calculateLocalSeoScore — AC-1 gain when business data saved', () => {
    it('raises score by >=20 when address+hours+category+localBusinessSchema+industrySubtype are saved', () => {
        const before = calculateLocalSeoScore(bareSite)
        const after = calculateLocalSeoScore({
            ...bareSite,
            address: true,
            hours: true,
            category: true,
            localBusinessSchema: true,
            industrySubtype: true,
        })
        expect(after.score - before.score).toBeGreaterThanOrEqual(20)
    })
})

// ── TC-F37-01-11: bounded 0..100 ────────────────────────────────────────────

describe('[TC-F37-01-11] calculateLocalSeoScore — bounded 0..100', () => {
    it('fully complete input scores exactly 100', () => {
        expect(calculateLocalSeoScore(fullSite).score).toBe(100)
    })

    it('fully empty input scores exactly 0, never negative', () => {
        expect(calculateLocalSeoScore(emptySite).score).toBe(0)
    })

    it('score is always within [0, 100] for an arbitrary partial input', () => {
        const { score } = calculateLocalSeoScore(bareSite)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
    })

    it('bucket breakdown sums exactly to the total score', () => {
        const { score, breakdown } = calculateLocalSeoScore(bareSite)
        expect(breakdown.businessData + breakdown.structuredData + breakdown.aiDiscoverability + breakdown.technicalHealth).toBe(score)
    })

    it('does NOT include a "blocks suspicious bots" sub-signal (PRD §13.8 forbids it — contradicts BR-03 AI-crawler-allow default)', () => {
        // Type-level guarantee: LocalSeoScoreInput has no `blocksSuspiciousBots` field.
        // AI Discoverability bucket is exactly allowsSearchBots(12) + sitemapPresent(8) = 20.
        const allBotsAllowed = calculateLocalSeoScore({ ...emptySite, allowsSearchBots: true, sitemapPresent: true })
        expect(allBotsAllowed.breakdown.aiDiscoverability).toBe(20)
    })

    it('treats a non-finite coreWebVitals (NaN/Infinity) as failing, not silently passing', () => {
        // fullSite: mobileResponsive+httpsEnabled true, so a valid CWV=100 scores technicalHealth=15.
        // NaN/Infinity must NOT be treated as "passing" (NaN < 80 is false in JS) — deduct the 8pts.
        const nanResult = calculateLocalSeoScore({ ...fullSite, coreWebVitals: NaN })
        const infResult = calculateLocalSeoScore({ ...fullSite, coreWebVitals: Infinity })
        expect(nanResult.breakdown.technicalHealth).toBe(7)
        expect(infResult.breakdown.technicalHealth).toBe(7)
    })
})

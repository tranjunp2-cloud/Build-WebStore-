/**
 * @fileoverview Tests for F37 Local SEO score contracts.
 * TC-IDs: TC-F37-01-10, TC-F37-01-11
 */
import { describe, it, expect } from 'vitest'
import {
    calculateBusinessDataScore,
    calculateLocalSeoScore,
    type BusinessDataScoreInput,
    type LocalSeoScoreInput,
} from '@/lib/seo/local-seo-score'

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

// ── TC-F37-01-10: exact Minimal Business Data 7/8/5 contract ────────────────

describe('[TC-F37-01-10] calculateBusinessDataScore — exact 7/8/5 contract', () => {
    const completeBusinessData: BusinessDataScoreInput = {
        businessName: 'Kedai Kopi Prime',
        streetAddress: '12 Jalan Ampang',
        city: 'Kuala Lumpur',
        postcode: '50450',
        country: 'MY',
        phone: '+60 12-345 6789',
    }

    it('scores complete name, structured address, and phone as exactly 20 without requiring state', () => {
        // Arrange
        const input = completeBusinessData

        // Act
        const result = calculateBusinessDataScore(input)

        // Assert
        expect(result).toEqual({
            score: 20,
            breakdown: { name: 7, address: 8, phone: 5 },
        })
    })

    it('scores name and phone as 12 when the structured address is absent', () => {
        // Arrange
        const input: BusinessDataScoreInput = {
            businessName: 'Kedai Kopi Prime',
            streetAddress: null,
            city: undefined,
            postcode: '',
            country: '   ',
            phone: '+60 12-345 6789',
        }

        // Act
        const result = calculateBusinessDataScore(input)

        // Assert
        expect(result).toEqual({
            score: 12,
            breakdown: { name: 7, address: 0, phone: 5 },
        })
    })

    it('scores a complete structured address alone as 8', () => {
        // Arrange
        const input: BusinessDataScoreInput = {
            ...completeBusinessData,
            businessName: null,
            phone: undefined,
        }

        // Act
        const result = calculateBusinessDataScore(input)

        // Assert
        expect(result).toEqual({
            score: 8,
            breakdown: { name: 0, address: 8, phone: 0 },
        })
    })

    it.each(['streetAddress', 'city', 'postcode', 'country'] as const)(
        'scores address as 0 when %s is missing',
        (missingField) => {
            // Arrange
            const input: BusinessDataScoreInput = {
                ...completeBusinessData,
                [missingField]: '   ',
            }

            // Act
            const result = calculateBusinessDataScore(input)

            // Assert
            expect(result.score).toBe(12)
            expect(result.breakdown).toEqual({ name: 7, address: 0, phone: 5 })
        },
    )

    it('treats whitespace-only values as absent', () => {
        // Arrange
        const input: BusinessDataScoreInput = {
            businessName: ' ',
            streetAddress: '\t',
            city: '\n',
            postcode: '  ',
            country: '\r',
            phone: '   ',
        }

        // Act
        const result = calculateBusinessDataScore(input)

        // Assert
        expect(result).toEqual({
            score: 0,
            breakdown: { name: 0, address: 0, phone: 0 },
        })
    })

    it('does not award points for legacy address, hours, category, website, or description signals', () => {
        // Arrange — extra legacy/runtime properties intentionally document that
        // only the v2 helper's six declared inputs can earn Business points.
        const oldSignalsOnly = {
            businessName: null,
            streetAddress: null,
            city: null,
            postcode: null,
            country: null,
            phone: null,
            legacyAddress: '12 Legacy Road',
            hours: true,
            category: 'restaurant',
            website: 'https://example.com',
            description: 'Legacy description',
        }

        // Act
        const result = calculateBusinessDataScore(oldSignalsOnly)

        // Assert
        expect(result).toEqual({
            score: 0,
            breakdown: { name: 0, address: 0, phone: 0 },
        })
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

/**
 * @fileoverview Tests for F37 Local SEO score contracts.
 * TC-IDs: TC-F37-01-10, TC-F37-01-11
 */
import { describe, it, expect } from 'vitest'
import {
    calculateBusinessDataScore,
    calculateCoveragePoints,
    calculateLocalSeoScore,
    type BusinessDataScoreInput,
    type LocalSeoScoreInput,
} from '@/lib/seo/local-seo-score'

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

// ── TC-F37-04-01: authoritative 20/35/15/30 contract ───────────────────────

const fullSite: LocalSeoScoreInput = {
    businessDataScore: 20,
    schemaScore: 35,
    aiDiscoverability: {
        approvedAiCrawlersAllowed: true,
        sitemapPresent: true,
        llmsTxtReachable: true,
    },
    technicalHealth: {
        eligibleMetadataCount: 3,
        metaTitleCount: 3,
        metaDescriptionCount: 3,
        contentQualityScore: 100,
        googleVerificationConfigured: true,
        eligiblePageCount: 2,
        indexablePageCount: 2,
    },
}

describe('[TC-F37-04-09] calculateLocalSeoScore — exact authoritative contract', () => {
    it('scores a complete site as exactly 100 with 20/35/15/30 buckets', () => {
        expect(calculateLocalSeoScore(fullSite)).toMatchObject({
            score: 100,
            breakdown: {
                businessData: 20,
                schema: 35,
                aiDiscoverability: 15,
                technicalHealth: 30,
            },
        })
    })

    it('uses floor coverage and awards zero for an empty eligible set', () => {
        expect(calculateCoveragePoints(2, 3, 8)).toBe(5)
        expect(calculateCoveragePoints(0, 0, 8)).toBe(0)
        expect(calculateCoveragePoints(20, 10, 8)).toBe(8)
    })

    it('scores AI Discoverability as the exact independent 9/5/1 signals', () => {
        const result = calculateLocalSeoScore({
            ...fullSite,
            aiDiscoverability: {
                approvedAiCrawlersAllowed: true,
                sitemapPresent: false,
                llmsTxtReachable: true,
            },
        })

        expect(result.breakdown.aiDiscoverability).toBe(10)
        expect(result.details.aiDiscoverability).toEqual({
            approvedAiCrawlersAllowed: 9,
            sitemapPresent: 0,
            llmsTxtReachable: 1,
        })

        const noLlms = calculateLocalSeoScore({
            ...fullSite,
            aiDiscoverability: {
                approvedAiCrawlersAllowed: true,
                sitemapPresent: true,
                llmsTxtReachable: false,
            },
        })
        expect(noLlms.details.aiDiscoverability).toEqual({
            approvedAiCrawlersAllowed: 9,
            sitemapPresent: 5,
            llmsTxtReachable: 0,
        })

        const crawlersBlocked = calculateLocalSeoScore({
            ...fullSite,
            aiDiscoverability: {
                approvedAiCrawlersAllowed: false,
                sitemapPresent: true,
                llmsTxtReachable: true,
            },
        })
        expect(crawlersBlocked.details.aiDiscoverability).toEqual({
            approvedAiCrawlersAllowed: 0,
            sitemapPresent: 5,
            llmsTxtReachable: 1,
        })
    })

    it('scores Technical Health with exact 8/8/8/3/3 components', () => {
        const result = calculateLocalSeoScore({
            ...fullSite,
            technicalHealth: {
                eligibleMetadataCount: 3,
                metaTitleCount: 2,
                metaDescriptionCount: 1,
                contentQualityScore: 87,
                googleVerificationConfigured: false,
                eligiblePageCount: 3,
                indexablePageCount: 2,
            },
        })

        expect(result.details.technicalHealth).toEqual({
            metaTitleCoverage: 5,
            metaDescriptionCoverage: 2,
            contentQuality: 6,
            googleVerification: 0,
            indexability: 2,
        })
        expect(result.breakdown.technicalHealth).toBe(15)
    })

    it('clamps invalid and excessive bucket inputs without exceeding 100', () => {
        const result = calculateLocalSeoScore({
            ...fullSite,
            businessDataScore: Number.NaN,
            schemaScore: 999,
            technicalHealth: {
                ...fullSite.technicalHealth,
                contentQualityScore: Number.POSITIVE_INFINITY,
            },
        })

        expect(result.breakdown.businessData).toBe(0)
        expect(result.breakdown.schema).toBe(35)
        expect(result.details.technicalHealth.contentQuality).toBe(0)
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
    })
})

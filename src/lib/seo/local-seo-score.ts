/**
 * Authoritative F37 Local SEO score.
 *
 * The four buckets are activated together so a displayed score can never mix
 * the legacy dashboard formula with the F37 Business/Schema contracts.
 */

export interface BusinessDataScoreInput {
    businessName: string | null | undefined
    streetAddress: string | null | undefined
    city: string | null | undefined
    postcode: string | null | undefined
    country: string | null | undefined
    phone: string | null | undefined
}

export interface BusinessDataScoreResult {
    score: number
    breakdown: {
        name: number
        address: number
        phone: number
    }
}

/**
 * Pure US-F37-01 v2 Business Data score. Presence checks trim strings, while
 * address credit is all-or-nothing across the four required structured parts.
 */
export function calculateBusinessDataScore(
    input: BusinessDataScoreInput,
): BusinessDataScoreResult {
    const isPresent = (value: string | null | undefined) =>
        Boolean(value?.trim())

    const name = isPresent(input.businessName) ? 7 : 0
    const address = [
        input.streetAddress,
        input.city,
        input.postcode,
        input.country,
    ].every(isPresent)
        ? 8
        : 0
    const phone = isPresent(input.phone) ? 5 : 0

    return {
        score: name + address + phone,
        breakdown: { name, address, phone },
    }
}

export const LOCAL_SEO_BUCKET_MAX = {
    businessData: 20,
    schema: 35,
    aiDiscoverability: 15,
    technicalHealth: 30,
} as const

export interface AiDiscoverabilityScoreInput {
    approvedAiCrawlersAllowed: boolean
    sitemapPresent: boolean
    llmsTxtReachable: boolean
}

export interface TechnicalHealthScoreInput {
    eligibleMetadataCount: number
    metaTitleCount: number
    metaDescriptionCount: number
    contentQualityScore: number
    googleVerificationConfigured: boolean
    eligiblePageCount: number
    indexablePageCount: number
}

export interface LocalSeoScoreInput {
    businessDataScore: number
    schemaScore: number
    aiDiscoverability: AiDiscoverabilityScoreInput
    technicalHealth: TechnicalHealthScoreInput
}

export interface LocalSeoScoreBreakdown {
    businessData: number
    schema: number
    aiDiscoverability: number
    technicalHealth: number
}

export interface AiDiscoverabilityScoreBreakdown {
    approvedAiCrawlersAllowed: number
    sitemapPresent: number
    llmsTxtReachable: number
}

export interface TechnicalHealthScoreBreakdown {
    metaTitleCoverage: number
    metaDescriptionCoverage: number
    contentQuality: number
    googleVerification: number
    indexability: number
}

export interface LocalSeoScoreResult {
    score: number
    breakdown: LocalSeoScoreBreakdown
    details: {
        aiDiscoverability: AiDiscoverabilityScoreBreakdown
        technicalHealth: TechnicalHealthScoreBreakdown
    }
}

function clampInteger(value: number, maximum: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.min(maximum, Math.max(0, Math.floor(value)))
}

export function calculateCoveragePoints(
    completed: number,
    eligible: number,
    maximum: number,
): number {
    const safeEligible = clampInteger(eligible, Number.MAX_SAFE_INTEGER)
    if (safeEligible === 0) return 0
    const safeCompleted = Math.min(
        safeEligible,
        clampInteger(completed, Number.MAX_SAFE_INTEGER),
    )
    return Math.floor((maximum * safeCompleted) / safeEligible)
}

export function calculateAiDiscoverabilityScore(
    input: AiDiscoverabilityScoreInput,
): { score: number; breakdown: AiDiscoverabilityScoreBreakdown } {
    const breakdown: AiDiscoverabilityScoreBreakdown = {
        approvedAiCrawlersAllowed: input.approvedAiCrawlersAllowed ? 9 : 0,
        sitemapPresent: input.sitemapPresent ? 5 : 0,
        llmsTxtReachable: input.llmsTxtReachable ? 1 : 0,
    }
    return {
        score: Object.values(breakdown).reduce(
            (total, value) => total + value,
            0,
        ),
        breakdown,
    }
}

export function calculateTechnicalHealthScore(
    input: TechnicalHealthScoreInput,
): { score: number; breakdown: TechnicalHealthScoreBreakdown } {
    const breakdown: TechnicalHealthScoreBreakdown = {
        metaTitleCoverage: calculateCoveragePoints(
            input.metaTitleCount,
            input.eligibleMetadataCount,
            8,
        ),
        metaDescriptionCoverage: calculateCoveragePoints(
            input.metaDescriptionCount,
            input.eligibleMetadataCount,
            8,
        ),
        contentQuality: Math.floor(
            (clampInteger(input.contentQualityScore, 100) * 8) / 100,
        ),
        googleVerification: input.googleVerificationConfigured ? 3 : 0,
        indexability: calculateCoveragePoints(
            input.indexablePageCount,
            input.eligiblePageCount,
            3,
        ),
    }
    return {
        score: Object.values(breakdown).reduce(
            (total, value) => total + value,
            0,
        ),
        breakdown,
    }
}

export function calculateLocalSeoScore(
    input: LocalSeoScoreInput,
): LocalSeoScoreResult {
    const businessData = clampInteger(
        input.businessDataScore,
        LOCAL_SEO_BUCKET_MAX.businessData,
    )
    const schema = clampInteger(input.schemaScore, LOCAL_SEO_BUCKET_MAX.schema)
    const aiDiscoverability = calculateAiDiscoverabilityScore(
        input.aiDiscoverability,
    )
    const technicalHealth = calculateTechnicalHealthScore(input.technicalHealth)
    const score =
        businessData + schema + aiDiscoverability.score + technicalHealth.score

    return {
        score: Math.max(0, Math.min(100, score)),
        breakdown: {
            businessData,
            schema,
            aiDiscoverability: aiDiscoverability.score,
            technicalHealth: technicalHealth.score,
        },
        details: {
            aiDiscoverability: aiDiscoverability.breakdown,
            technicalHealth: technicalHealth.breakdown,
        },
    }
}

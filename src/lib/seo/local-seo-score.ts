/**
 * Local SEO Score — F37 US-01. Points-subtraction model (start 100, deduct
 * for missing signals), mirroring `technical-score.ts`. Phase 1 buckets sum
 * to 100: Business Data 35 / Structured Data 30 / AI Discoverability 20 /
 * Technical Health 15 (per PRD §13.8).
 *
 * AI Discoverability = allowsSearchBots (12) + sitemapPresent (8) — matches
 * PRD §13.8 EXACTLY. There is deliberately NO "blocks suspicious bots"
 * sub-signal: the PRD explicitly forbids one (§13.8 note) because it
 * contradicts BR-03 (AI crawlers must default to ALLOW) — rewarding both
 * "let bots crawl" and "block bots" would be internally contradictory.
 * (researcher-02-json-ld-and-scoring.md Part 4/5 proposed a 3-signal
 * 10/5/5 split including that forbidden sub-signal — that research doc
 * diverges from the canonical PRD and was NOT followed here.)
 *
 * Saving address + hours + category raises the score by ≥20pts vs. a bare
 * site (AC-1): LocalBusiness schema present (+10) + hours (+5) + industry
 * subtype (+5) = +20.
 */

export interface LocalSeoScoreInput {
    // Business Data (35pts = 7 signals x 5pts)
    businessName: boolean
    address: boolean
    phone: boolean
    hours: boolean
    category: boolean
    website: boolean
    description: boolean
    // Structured Data (30pts)
    localBusinessSchema: boolean
    industrySubtype: boolean
    faqSchema: boolean
    orgSchema: boolean
    // AI Discoverability (20pts) — allowsSearchBots(12) + sitemapPresent(8), per PRD §13.8
    allowsSearchBots: boolean
    sitemapPresent: boolean
    // Technical Health (15pts)
    coreWebVitals: number // 0-100
    mobileResponsive: boolean
    httpsEnabled: boolean
}

export interface LocalSeoScoreBreakdown {
    businessData: number
    structuredData: number
    aiDiscoverability: number
    technicalHealth: number
}

export interface LocalSeoScoreResult {
    score: number
    breakdown: LocalSeoScoreBreakdown
}

export function calculateLocalSeoScore(input: LocalSeoScoreInput): LocalSeoScoreResult {
    let businessData = 35
    if (!input.businessName) businessData -= 5
    if (!input.address) businessData -= 5
    if (!input.phone) businessData -= 5
    if (!input.hours) businessData -= 5
    if (!input.category) businessData -= 5
    if (!input.website) businessData -= 5
    if (!input.description) businessData -= 5
    businessData = Math.max(0, businessData)

    let structuredData = 30
    if (!input.localBusinessSchema) structuredData -= 10
    if (!input.industrySubtype) structuredData -= 5
    if (!input.faqSchema) structuredData -= 8
    if (!input.orgSchema) structuredData -= 7
    structuredData = Math.max(0, structuredData)

    let aiDiscoverability = 20
    if (!input.allowsSearchBots) aiDiscoverability -= 12
    if (!input.sitemapPresent) aiDiscoverability -= 8
    aiDiscoverability = Math.max(0, aiDiscoverability)

    let technicalHealth = 15
    if (!Number.isFinite(input.coreWebVitals) || input.coreWebVitals < 80) technicalHealth -= 8
    if (!input.mobileResponsive) technicalHealth -= 4
    if (!input.httpsEnabled) technicalHealth -= 3
    technicalHealth = Math.max(0, technicalHealth)

    const score = businessData + structuredData + aiDiscoverability + technicalHealth

    return {
        score: Math.max(0, Math.min(100, score)),
        breakdown: { businessData, structuredData, aiDiscoverability, technicalHealth },
    }
}

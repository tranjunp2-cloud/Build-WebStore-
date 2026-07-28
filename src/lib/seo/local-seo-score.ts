/**
 * Local SEO Score — F37.
 *
 * `calculateBusinessDataScore` locks the US-F37-01 v2 Business Data contract
 * (Name 7 / complete structured Address 8 / Phone 5). The legacy runtime
 * engine below intentionally remains on 35/30/20/15 until US-F37-04 (#1312)
 * can activate every 20/40/20/20 bucket atomically; wiring only the Business
 * helper now would cap the full score at 85.
 *
 * AI Discoverability = allowsSearchBots (12) + sitemapPresent (8) — matches
 * PRD §13.8 EXACTLY. There is deliberately NO "blocks suspicious bots"
 * sub-signal: the PRD explicitly forbids one (§13.8 note) because it
 * contradicts BR-03 (AI crawlers must default to ALLOW) — rewarding both
 * "let bots crawl" and "block bots" would be internally contradictory.
 * (researcher-02-json-ld-and-scoring.md Part 4/5 proposed a 3-signal
 * 10/5/5 split including that forbidden sub-signal — that research doc
 * diverges from the canonical PRD and was NOT followed here.)
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
export function calculateBusinessDataScore(input: BusinessDataScoreInput): BusinessDataScoreResult {
    const isPresent = (value: string | null | undefined) => Boolean(value?.trim())

    const name = isPresent(input.businessName) ? 7 : 0
    const address = [input.streetAddress, input.city, input.postcode, input.country].every(isPresent) ? 8 : 0
    const phone = isPresent(input.phone) ? 5 : 0

    return {
        score: name + address + phone,
        breakdown: { name, address, phone },
    }
}

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

/**
 * Technical SEO Score calculator.
 *
 * Scoring per docs/architecture/F11-seo-dashboard.md:
 * - OG image exists on site: -15 if missing
 * - Google verification token: -10 if missing
 * - Slug SEO-friendly: -5 per bad slug (max -15)
 * - noIndex pages: -5 per page (max -10)
 */

interface TechnicalScoreInput {
    siteHasOgImage: boolean
    siteHasGoogleVerification: boolean
    pageSlugs: string[]
    noIndexCount: number
}

// Bad slug: contains uppercase, spaces, special chars (excluding - and /)
const BAD_SLUG_PATTERN = /[A-Z\s!@#$%^&*()+=\[\]{}<>|\\;:'"?,]/

export function calculateTechnicalSeoScore(input: TechnicalScoreInput): number {
    let score = 100

    if (!input.siteHasOgImage) score -= 15
    if (!input.siteHasGoogleVerification) score -= 10

    const badSlugs = input.pageSlugs.filter(s => s && (BAD_SLUG_PATTERN.test(s) || s.includes('//')))
    score -= Math.min(15, badSlugs.length * 5)

    score -= Math.min(10, input.noIndexCount * 5)

    return Math.max(0, score)
}

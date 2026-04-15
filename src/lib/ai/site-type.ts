/**
 * Single source of truth for the `sites.siteType` enum + a resolver that
 * accepts any free-form category string and coerces it to a value Payload
 * will accept.
 *
 * Why this exists (plan 260415-1745-ai-gen-flow-fix-v2 fix 500):
 * Vercel logs showed ~7 x "The following field is invalid: Site Type" per 6h
 * window on `/api/ai/generate-site`. Root cause: the generator pipeline used
 * `BusinessIntent['type']` (5 values including `portfolio`) while the Payload
 * Sites collection uses an 11-value enum that includes `creative` but NOT
 * `portfolio`. When AI output category mapped to `portfolio` (via
 * `fallback-adapter.CATEGORY_TO_SITE_TYPE.creative = 'portfolio'`), the
 * payload.create/update call rejected the row and the handler 500'd.
 *
 * This module provides:
 *   - `SITES_VALID_SITE_TYPES` — exact tuple of the 11 Payload enum values
 *   - `SiteType` — the type alias
 *   - `resolveSiteType(input)` — coercer that maps aliases (portfolio →
 *     creative, fnb → restaurant, dental → health, etc.) and defaults to
 *     `business` for unknown input. NEVER throws.
 *
 * Kept intentionally small. If you add a new siteType to `src/collections/
 * Sites.ts`, add the literal to `SITES_VALID_SITE_TYPES` here too.
 */

export const SITES_VALID_SITE_TYPES = [
    'business',
    'ecommerce',
    'restaurant',
    'tech',
    'health',
    'education',
    'realestate',
    'fitness',
    'creative',
    'beauty',
    'blog',
] as const

export type SiteType = (typeof SITES_VALID_SITE_TYPES)[number]

const VALID_SET = new Set<string>(SITES_VALID_SITE_TYPES)

/**
 * Alias table — maps legacy / generator / user strings onto the valid 11
 * values. All keys are lowercase. Add here instead of widening the enum
 * unless you also add a new Sites collection option.
 */
const SITE_TYPE_ALIASES: Record<string, SiteType> = {
    // Legacy BusinessIntent values
    portfolio: 'creative',
    // Composer categories not in Sites enum
    fnb: 'restaurant',
    cafe: 'restaurant',
    events: 'business',
    travel: 'business',
    // Common industry synonyms we've seen in AI output + user input
    freelance: 'creative',
    freelancer: 'creative',
    agency: 'creative',
    studio: 'creative',
    photographer: 'creative',
    designer: 'creative',
    dental: 'health',
    clinic: 'health',
    hospital: 'health',
    medical: 'health',
    gym: 'fitness',
    yoga: 'fitness',
    pilates: 'fitness',
    spa: 'beauty',
    salon: 'beauty',
    wellness: 'beauty',
    saas: 'tech',
    it: 'tech',
    software: 'tech',
    startup: 'tech',
    property: 'realestate',
    realty: 'realestate',
    real_estate: 'realestate',
    'real-estate': 'realestate',
    training: 'education',
    school: 'education',
    tutor: 'education',
    academy: 'education',
    store: 'ecommerce',
    shop: 'ecommerce',
    retail: 'ecommerce',
}

/**
 * Resolve any input string to a valid Sites collection siteType.
 * Returns `'business'` for unknown / empty / non-string input.
 */
export function resolveSiteType(input: unknown): SiteType {
    if (typeof input !== 'string') return 'business'
    const lower = input.trim().toLowerCase()
    if (lower.length === 0) return 'business'
    if (VALID_SET.has(lower)) return lower as SiteType
    const alias = SITE_TYPE_ALIASES[lower]
    if (alias) return alias
    return 'business'
}

/** True if `input` is already a valid Sites siteType (no aliasing). */
export function isValidSiteType(input: unknown): input is SiteType {
    return typeof input === 'string' && VALID_SET.has(input)
}

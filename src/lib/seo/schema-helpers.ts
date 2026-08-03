/**
 * Shared Schema.org helpers for JSON-LD generation.
 *
 * Two distinct category vocabularies exist in this codebase and must NOT be
 * conflated:
 * - AI-gen site categories (`schemaTypeFor`/`deriveDefaultPriceRange` below) —
 *   loose codes like 'restaurant'/'fnb'/'health'/'ecommerce' from the AI site
 *   builder's `siteType`. Moved here verbatim from `lib/ai/json-ld-templates.ts`
 *   (no behavior change) so both the AI-gen path and F37 Local SEO can share
 *   one file, NOT one function — the two use different inputs.
 * - F37's broad category is separate from its validated Schema.org subtype.
 *   Only a compatible subtype may select a specific LocalBusiness `@type`.
 */

import { isCompatibleSchemaSubtype, SCHEMA_SUBTYPE_OPTIONS, type SchemaSubtype } from './local-business-constants'
// ── AI-gen site categories (moved from json-ld-templates.ts, unchanged) ─────

/**
 * Map AI-gen composer category to schema.org @type. Defaults to LocalBusiness
 * for unknown categories — Google accepts this as a generic fallback.
 */
export function schemaTypeFor(category: string): string {
    switch (category.toLowerCase()) {
        case 'restaurant':
        case 'fnb':
            return 'Restaurant'
        case 'health':
            return 'MedicalClinic'
        case 'education':
            return 'EducationalOrganization'
        case 'ecommerce':
            return 'Store'
        case 'beauty':
            return 'BeautySalon'
        default:
            return 'LocalBusiness'
    }
}

/** Derive a priceRange hint from an AI-gen category. Purely heuristic. */
export function deriveDefaultPriceRange(category: string): string | undefined {
    switch (category.toLowerCase()) {
        case 'restaurant':
        case 'fnb':
            return '$$'
        case 'health':
        case 'realestate':
            return '$$$'
        case 'beauty':
        case 'fitness':
            return '$$'
        case 'tech':
            return '$$$'
        default:
            return undefined
    }
}

const LOCAL_BUSINESS_SCHEMA_TYPES = new Set<string>([
    'LocalBusiness',
    ...SCHEMA_SUBTYPE_OPTIONS.map(option => option.value),
])

const LEGACY_LOCAL_BUSINESS_TYPE_MAP: Record<string, string> = {
    localBusiness: 'LocalBusiness',
    store: 'Store',
    restaurant: 'Restaurant',
    foodEstablishment: 'FoodEstablishment',
    healthAndBeautyBusiness: 'HealthAndBeautyBusiness',
    medicalClinic: 'MedicalClinic',
    professionalService: 'ProfessionalService',
    homeAndConstructionBusiness: 'HomeAndConstructionBusiness',
    automotiveBusiness: 'AutomotiveBusiness',
    financialService: 'FinancialService',
}

/** Preserve broad-category compatibility for legacy consumers. Strict v2
 * JSON-LD must use schemaTypeForValidatedLocalBusiness instead. */
export function schemaTypeForLocalBusiness(businessCategory: unknown): string {
    return typeof businessCategory === 'string'
        ? LEGACY_LOCAL_BUSINESS_TYPE_MAP[businessCategory] || 'LocalBusiness'
        : 'LocalBusiness'
}

export function schemaTypeForValidatedLocalBusiness(businessCategory: unknown, schemaSubtype?: unknown): 'LocalBusiness' | SchemaSubtype {
    return isCompatibleSchemaSubtype(businessCategory, schemaSubtype) ? schemaSubtype : 'LocalBusiness'
}

export function isLocalBusinessSchemaType(value: unknown): value is string {
    return typeof value === 'string' && LOCAL_BUSINESS_SCHEMA_TYPES.has(value)
}

/** Fallback priceRange heuristic when the seller hasn't set one explicitly,
 *  keyed by F37's own businessCategory vocabulary (distinct from the AI-gen
 *  category heuristic above — do not conflate the two). */
export function priceRangeForLocalBusinessCategory(businessCategory: unknown): string | undefined {
    switch (businessCategory) {
        case 'restaurant':
        case 'foodEstablishment':
        case 'healthAndBeautyBusiness':
            return '$$'
        case 'medicalClinic':
        case 'professionalService':
        case 'financialService':
        case 'automotiveBusiness':
        case 'homeAndConstructionBusiness':
            return '$$$'
        case 'store':
            return '$'
        default:
            return undefined
    }
}

export function normalizeHttpUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const hasControlCharacter = [...value].some(character => {
        const code = character.charCodeAt(0)
        return code <= 31 || code === 127
    })
    if (hasControlCharacter) return undefined
    const trimmed = value.trim()
    if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined
    const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    const candidate = hasExplicitScheme ? trimmed : 'https://' + trimmed
    try {
        const url = new URL(candidate)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
        if (!url.hostname || url.username || url.password) return undefined
        url.hash = ''
        const normalized = url.toString()
        return url.pathname === '/' && !url.search
            ? normalized.slice(0, -1)
            : normalized
    } catch {
        return undefined
    }
}


export function hasValidGeoCoordinates(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number'
        && Number.isFinite(latitude)
        && latitude >= -90
        && latitude <= 90
        && typeof longitude === 'number'
        && Number.isFinite(longitude)
        && longitude >= -180
        && longitude <= 180
}
export type StructuredAddressData = {
    streetAddress?: unknown
    city?: unknown
    postcode?: unknown
    country?: unknown
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

/** Require the four address fields used by the strict F37 v2 contract.
 *  State remains optional because not every supported address requires it. */
export function hasCompleteStructuredAddress(address: StructuredAddressData | null | undefined): boolean {
    return Boolean(
        address
        && isNonEmptyString(address.streetAddress)
        && isNonEmptyString(address.city)
        && isNonEmptyString(address.postcode)
        && isNonEmptyString(address.country),
    )
}
const OPENING_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/


export function isValidOpeningTimeRange(opens: unknown, closes: unknown): boolean {
    return typeof opens === 'string'
        && typeof closes === 'string'
        && OPENING_TIME_PATTERN.test(opens)
        && OPENING_TIME_PATTERN.test(closes)
        && opens < closes
}


// ── Opening hours day-of-week mapping (new, F37-only) ───────────────────────
const DAY_OF_WEEK_SCHEMA_MAP: Record<string, string> = {
    Mo: 'Monday',
    Tu: 'Tuesday',
    We: 'Wednesday',
    Th: 'Thursday',
    Fr: 'Friday',
    Sa: 'Saturday',
    Su: 'Sunday',
}

/** Map F37's short day-of-week code (Mo/Tu/We/Th/Fr/Sa/Su) to the Schema.org
 *  DayOfWeek enumeration member name (e.g. "Monday"). Returns null for an
 *  unrecognized code so callers can filter it out rather than emit garbage. */
export function dayOfWeekToSchema(code: string | null | undefined): string | null {
    if (!code) return null
    return DAY_OF_WEEK_SCHEMA_MAP[code] || null
}

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
 * - F37 `localBusiness.businessCategory` values — already schema.org-shaped
 *   (`foodEstablishment`, `healthAndBeautyBusiness`, ...), designed for a
 *   direct 1:1 capitalize mapping to the Schema.org @type (see Phase 01 note:
 *   "Each maps 1:1 to a schema.org @type in Phase 04"). `schemaTypeForLocalBusiness`
 *   below implements that direct mapping — it does NOT reuse `schemaTypeFor`.
 */

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

// ── F37 localBusiness.businessCategory (direct schema.org mapping) ─────────

/** businessCategory enum values (Phase 01, Sites.ts) map 1:1 to their
 *  Schema.org @type — this is a lookup, not a heuristic switch, because the
 *  enum was designed to already be schema.org-shaped. */
const LOCAL_BUSINESS_TYPE_MAP: Record<string, string> = {
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

/** Map F37 `businessCategory` to its Schema.org @type. Falls back to the
 *  generic `LocalBusiness` type for empty/unrecognized values (Google
 *  accepts this as a valid fallback). */
export function schemaTypeForLocalBusiness(businessCategory: string | null | undefined): string {
    if (!businessCategory) return 'LocalBusiness'
    return LOCAL_BUSINESS_TYPE_MAP[businessCategory] || 'LocalBusiness'
}

/** Fallback priceRange heuristic when the seller hasn't set one explicitly,
 *  keyed by F37's own businessCategory vocabulary (distinct from the AI-gen
 *  category heuristic above — do not conflate the two). */
export function priceRangeForLocalBusinessCategory(businessCategory: string | null | undefined): string | undefined {
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

import type { SchemaSubtype } from '@/lib/seo/local-business-constants'

/** F37 US-01: shared shapes for the Local Business accordion sub-components.
 *  Mirrors `localBusinessSchema` in `src/lib/validations/sites.ts` — keep
 *  fields in sync with that Zod schema (the save-route boundary). */

export interface OpeningHourRow {
    dayOfWeek?: string
    opens?: string
    closes?: string
    isClosed?: boolean
}

export interface LocalBusinessData {
    streetAddress?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    /** Real JS number — never a numeric string (Zod validates with `z.number()`, not `z.coerce.number()`). */
    latitude?: number
    /** Real JS number — never a numeric string (Zod validates with `z.number()`, not `z.coerce.number()`). */
    longitude?: number
    businessCategory?: string
    schemaSubtype?: SchemaSubtype | null
    priceRange?: string
    serviceAreaDescription?: string
    openingHours?: OpeningHourRow[]
}

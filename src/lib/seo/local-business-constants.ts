/** F37 US-01: shared option lists for Sites.localBusiness — single source of truth
 *  for both the Payload admin select fields (src/collections/Sites.ts) and the
 *  Zod save-route validation (src/lib/validations/sites.ts). Dependency-free so
 *  either side can import it without pulling in the other's runtime. */

export const BUSINESS_CATEGORY_OPTIONS = [
    { label: 'Local Business (Generic)', value: 'localBusiness' },
    { label: 'Store / Retail', value: 'store' },
    { label: 'Restaurant', value: 'restaurant' },
    { label: 'Food Establishment', value: 'foodEstablishment' },
    { label: 'Health & Beauty', value: 'healthAndBeautyBusiness' },
    { label: 'Medical Clinic', value: 'medicalClinic' },
    { label: 'Professional Service', value: 'professionalService' },
    { label: 'Home & Construction', value: 'homeAndConstructionBusiness' },
    { label: 'Automotive', value: 'automotiveBusiness' },
    { label: 'Financial Service', value: 'financialService' },
]

export const PRICE_RANGE_OPTIONS = [
    { label: '$ - Budget', value: '$' },
    { label: '$$ - Moderate', value: '$$' },
    { label: '$$$ - Expensive', value: '$$$' },
    { label: '$$$$ - Very Expensive', value: '$$$$' },
]

export const DAY_OF_WEEK_OPTIONS = [
    { label: 'Monday', value: 'Mo' },
    { label: 'Tuesday', value: 'Tu' },
    { label: 'Wednesday', value: 'We' },
    { label: 'Thursday', value: 'Th' },
    { label: 'Friday', value: 'Fr' },
    { label: 'Saturday', value: 'Sa' },
    { label: 'Sunday', value: 'Su' },
]

/** Zero-padded 24h "HH:MM" (e.g. "09:00", "23:59"). Every consumer of
 *  `openingHours.opens`/`.closes` (string comparison in `isRangeOrderValid`/
 *  `sortRows`, JSON-LD's schema.org time format) assumes this exact shape —
 *  enforced here at BOTH the Payload collection field and the Zod save-route
 *  boundary so malformed data (e.g. admin-panel-entered "9:00") can never be
 *  written via any path. */
export const OPENING_HOURS_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

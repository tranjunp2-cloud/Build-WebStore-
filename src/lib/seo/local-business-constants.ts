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

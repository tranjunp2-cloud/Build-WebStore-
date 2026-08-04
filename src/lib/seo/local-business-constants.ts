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
] as const

export type BusinessCategory = (typeof BUSINESS_CATEGORY_OPTIONS)[number]['value']

export const LOCAL_BUSINESS_SUBTYPE_MAPPING_VERSION = 'f37-local-business-subtypes-2026-07-29'

export const SCHEMA_SUBTYPE_OPTIONS = [
    { label: 'Store / Retail', value: 'Store' },
    { label: 'Restaurant', value: 'Restaurant' },
    { label: 'Bakery', value: 'Bakery' },
    { label: 'Cafe or coffee shop', value: 'CafeOrCoffeeShop' },
    { label: 'Fast-food restaurant', value: 'FastFoodRestaurant' },
    { label: 'Beauty salon', value: 'BeautySalon' },
    { label: 'Day spa', value: 'DaySpa' },
    { label: 'Hair salon', value: 'HairSalon' },
    { label: 'Health club', value: 'HealthClub' },
    { label: 'Nail salon', value: 'NailSalon' },
    { label: 'Tattoo parlour', value: 'TattooParlor' },
    { label: 'Medical clinic', value: 'MedicalClinic' },
    { label: 'Professional service', value: 'ProfessionalService' },
    { label: 'Electrician', value: 'Electrician' },
    { label: 'General contractor', value: 'GeneralContractor' },
    { label: 'HVAC business', value: 'HVACBusiness' },
    { label: 'House painter', value: 'HousePainter' },
    { label: 'Locksmith', value: 'Locksmith' },
    { label: 'Moving company', value: 'MovingCompany' },
    { label: 'Plumber', value: 'Plumber' },
    { label: 'Roofing contractor', value: 'RoofingContractor' },
    { label: 'Auto body shop', value: 'AutoBodyShop' },
    { label: 'Auto dealer', value: 'AutoDealer' },
    { label: 'Auto-parts store', value: 'AutoPartsStore' },
    { label: 'Auto rental', value: 'AutoRental' },
    { label: 'Auto repair', value: 'AutoRepair' },
    { label: 'Auto wash', value: 'AutoWash' },
    { label: 'Gas station', value: 'GasStation' },
    { label: 'Motorcycle dealer', value: 'MotorcycleDealer' },
    { label: 'Motorcycle repair', value: 'MotorcycleRepair' },
    { label: 'Accounting service', value: 'AccountingService' },
    { label: 'Automated teller', value: 'AutomatedTeller' },
    { label: 'Bank or credit union', value: 'BankOrCreditUnion' },
    { label: 'Insurance agency', value: 'InsuranceAgency' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

export type SchemaSubtype = (typeof SCHEMA_SUBTYPE_OPTIONS)[number]['value']

const SUBTYPES_BY_CATEGORY = {
    localBusiness: [], store: ['Store'], restaurant: ['Restaurant'],
    foodEstablishment: ['Restaurant', 'Bakery', 'CafeOrCoffeeShop', 'FastFoodRestaurant'],
    healthAndBeautyBusiness: ['BeautySalon', 'DaySpa', 'HairSalon', 'HealthClub', 'NailSalon', 'TattooParlor'],
    medicalClinic: ['MedicalClinic'], professionalService: ['ProfessionalService'],
    homeAndConstructionBusiness: ['Electrician', 'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany', 'Plumber', 'RoofingContractor'],
    automotiveBusiness: ['AutoBodyShop', 'AutoDealer', 'AutoPartsStore', 'AutoRental', 'AutoRepair', 'AutoWash', 'GasStation', 'MotorcycleDealer', 'MotorcycleRepair'],
    financialService: ['AccountingService', 'AutomatedTeller', 'BankOrCreditUnion', 'InsuranceAgency'],
} as const satisfies Record<BusinessCategory, readonly SchemaSubtype[]>

function isBusinessCategory(value: unknown): value is BusinessCategory {
    return typeof value === 'string'
        && BUSINESS_CATEGORY_OPTIONS.some(option => option.value === value)
}

export function getCompatibleSchemaSubtypes(category: unknown) {
    const values: readonly SchemaSubtype[] = isBusinessCategory(category)
        ? SUBTYPES_BY_CATEGORY[category]
        : []
    return SCHEMA_SUBTYPE_OPTIONS.filter(option => values.includes(option.value))
}

export function isCompatibleSchemaSubtype(category: unknown, subtype: unknown): subtype is SchemaSubtype {
    return typeof subtype === 'string' && getCompatibleSchemaSubtypes(category).some(option => option.value === subtype)
}

export function reconcileSchemaSubtype(category: unknown, currentSubtype: unknown): SchemaSubtype | null {
    const options = getCompatibleSchemaSubtypes(category)
    if (isCompatibleSchemaSubtype(category, currentSubtype)) return currentSubtype
    return options.length === 1 ? options[0].value : null
}

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

/**
 * Client-safe phone validation shared by the Editor and save boundary.
 * Empty values are allowed so sellers can clear the optional field.
 */
export function isValidBusinessPhone(value: string | null | undefined): boolean {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) return true

    return /^\+?[\d ().-]+$/.test(trimmed) && /\d/.test(trimmed)
}

import 'server-only'

/** Normalize a MY phone number to "60XXXXXXXXX" format. */
export function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('60')) return digits
    if (digits.startsWith('0')) return '60' + digits.slice(1)
    return '60' + digits
}

/**
 * Aggregate item weight (in grams) to kg.
 * Min floor: 0.1 kg (EP minimum). Rounds up to 1 decimal place.
 * @param weightGrams - total weight in grams
 * @returns weight in kg (float, min 0.1)
 */
export function aggregateWeightKg(weightGrams: number): number {
    const kg = weightGrams / 1000
    return Math.max(0.1, Math.ceil(kg * 10) / 10)
}

// Pickup/collection-date math moved to ./pickup-schedule (pure, client-safe — the
// Ready-to-Ship date picker imports it too). Re-exported here for server callers.
export { earliestPickupDate, clampCollectionDate, courierCutoffLabel, isBusinessDateString } from './pickup-schedule'

// MY state name → ISO 3166-2 subdivision code (New EP API)
const SUBDIVISION_CODE_MAP: Record<string, string> = {
    'Johor': 'MY-01',
    'Kedah': 'MY-02',
    'Kelantan': 'MY-03',
    'Melaka': 'MY-04',
    'Negeri Sembilan': 'MY-05',
    'Pahang': 'MY-06',
    'Penang': 'MY-07',
    'Perak': 'MY-08',
    'Perlis': 'MY-09',
    'Selangor': 'MY-10',
    'Terengganu': 'MY-11',
    'Sabah': 'MY-12',
    'Sarawak': 'MY-13',
    'Kuala Lumpur': 'MY-14',
    'Labuan': 'MY-15',
    'Putrajaya': 'MY-16',
}

/** Map a MY state name to ISO 3166-2 subdivision code (e.g. "Selangor" → "MY-10"). Returns input unchanged if not found. */
export function mapSubdivisionCode(stateName: string): string {
    return SUBDIVISION_CODE_MAP[stateName] ?? stateName
}

/**
 * Parse an EP money-string field (e.g. min_cod_amount) to integer sen.
 * Official docs (#quotation-response-2026-06) format these as "MYR1000.00" while the
 * sandbox returns bare "1000" — and "" / non-numeric also occurs. Currency letters and
 * thousand-separators are stripped before parsing; a non-finite result means "no limit"
 * → undefined (a NaN limit would silently fail every >=/<= comparison).
 */
export function rmStringToSen(value: string | null | undefined): number | undefined {
    if (value == null) return undefined
    const rm = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
    return Number.isFinite(rm) ? Math.round(rm * 100) : undefined
}

// Reverse of SUBDIVISION_CODE_MAP — built once for seeding warehouse.state from EP province_code.
const SUBDIVISION_NAME_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(SUBDIVISION_CODE_MAP).map(([name, code]) => [code, name]),
)

/** Map an ISO 3166-2 subdivision code back to MY state name (e.g. "MY-10" → "Selangor"). Returns input unchanged if not found. */
export function mapSubdivisionName(code: string): string {
    return SUBDIVISION_NAME_MAP[code] ?? code
}

/**
 * Split a raw MY phone number into country code + local number for New EP API.
 * Strips non-digit chars, removes leading "60" or "0" prefix.
 */
export function splitPhone(raw: string): { countryCode: string; number: string } {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('60')) return { countryCode: '60', number: digits.slice(2) }
    if (digits.startsWith('0')) return { countryCode: '60', number: digits.slice(1) }
    return { countryCode: '60', number: digits }
}

/**
 * Whether a raw phone is usable as an EP shipment contact number. EP accepts a
 * placeholder at submit time but the courier's AWB issuance rejects it later,
 * stranding the shipment at "Pending AWB" with the wallet already charged
 * (verified live 2026-07-13) — so callers must reject unusable phones BEFORE
 * submit instead of substituting a placeholder.
 */
export function hasUsablePhone(raw: string | null | undefined): boolean {
    const digits = (raw ?? '').replace(/\D/g, '')
    return digits.length >= 8 && !/^0+$/.test(digits)
}


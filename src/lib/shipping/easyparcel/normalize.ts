import 'server-only'

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

// Pickup/collection-date math lives in ./pickup-schedule (pure, client-safe — the Ready-to-Ship
// date picker imports it directly). Only re-export what a server caller actually reaches for:
// this module is `server-only`, so every name re-exported here is an invitation for a client
// component to pull it in through the wrong door and break `next build` (as warehouse.ts once did).
export { earliestPickupDate } from './pickup-schedule'

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

// Reverse of SUBDIVISION_CODE_MAP — built once for syncing warehouse.state from EP province_code.
const SUBDIVISION_NAME_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(SUBDIVISION_CODE_MAP).map(([name, code]) => [code, name]),
)

/** Map an ISO 3166-2 subdivision code back to MY state name (e.g. "MY-10" → "Selangor"). Returns input unchanged if not found. */
export function mapSubdivisionName(code: string): string {
    return SUBDIVISION_NAME_MAP[code] ?? code
}

// Phone helpers moved to ./phone (pure, client-safe — warehouse.ts is imported by
// the client Settings → Shipping tab and needs hasUsablePhone). Re-exported here
// for server callers, same as the pickup-schedule re-export above.
export { splitPhone, hasUsablePhone, normalizeMyPhone, normalizeMyPhone as normalizePhone } from './phone'

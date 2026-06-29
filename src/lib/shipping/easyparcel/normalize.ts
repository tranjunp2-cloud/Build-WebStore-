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

// Courier cut-off times (MYT = UTC+8)
const COURIER_CUTOFF_HH_MM: Record<string, { hh: number; mm: number }> = {
    jnt: { hh: 13, mm: 50 },
    flash: { hh: 14, mm: 0 },
    poslaju: { hh: 12, mm: 50 },
}
const DEFAULT_CUTOFF = { hh: 12, mm: 0 }

function isMytBusinessDay(date: Date): boolean {
    // Shift UTC date to MYT (UTC+8) to get correct local day-of-week
    const mytDay = new Date(date.getTime() + 8 * 3600 * 1000).getUTCDay()
    return mytDay !== 0 && mytDay !== 6  // 0=Sun, 6=Sat
}

function nextBusinessDay(date: Date): Date {
    const next = new Date(date.getTime() + 24 * 3600 * 1000)
    while (!isMytBusinessDay(next)) {
        next.setTime(next.getTime() + 24 * 3600 * 1000)
    }
    return next
}

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
 * Return earliest pickup date for a courier as "YYYY-MM-DD" (MYT).
 * If current MYT time is past cut-off, advances to next business day.
 * @param courier - courier id (e.g. 'jnt', 'flash', 'poslaju')
 * @param nowUtc - current UTC time (defaults to Date.now())
 */
export function earliestPickupDate(courier: string, nowUtc: Date = new Date()): string {
    const cutoff = COURIER_CUTOFF_HH_MM[courier.toLowerCase()] ?? DEFAULT_CUTOFF

    // Derive MYT hours/minutes from UTC
    const mytMs = nowUtc.getTime() + 8 * 3600 * 1000
    const myt = new Date(mytMs)
    const mytHH = myt.getUTCHours()
    const mytMM = myt.getUTCMinutes()

    const pastCutoff = mytHH > cutoff.hh || (mytHH === cutoff.hh && mytMM >= cutoff.mm)
    const candidate = pastCutoff ? nextBusinessDay(nowUtc) : nowUtc

    // Ensure candidate itself is a business day (handles weekend today + before cutoff)
    let pickup = new Date(candidate)
    while (!isMytBusinessDay(pickup)) {
        pickup = new Date(pickup.getTime() + 24 * 3600 * 1000)
    }

    // Format as MYT date string "YYYY-MM-DD"
    const mytPickup = new Date(pickup.getTime() + 8 * 3600 * 1000)
    const yyyy = mytPickup.getUTCFullYear()
    const mm = String(mytPickup.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(mytPickup.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

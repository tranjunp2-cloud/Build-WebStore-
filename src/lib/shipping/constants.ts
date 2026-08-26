export const WEST_MY_STATES = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
    'Pahang', 'Penang', 'Perak', 'Perlis', 'Selangor',
    'Terengganu', 'Kuala Lumpur', 'Putrajaya',
] as const

export const EAST_MY_STATES = ['Sabah', 'Sarawak', 'Labuan'] as const

export const MY_STATES = [...WEST_MY_STATES, ...EAST_MY_STATES] as const

export const SHIPPING_DEFAULTS = {
    westRate: 800,
    eastRate: 1500,
    freeAbove: 10_000,
} as const

export const RATE_MAX = 100_000
export const FREE_ABOVE_MAX = 10_000_000
export const HINT_HIGHLIGHT_THRESHOLD = 5_000

/** F37 FR-28: bilingual (EN / Bahasa Melayu) labels for `MY_STATES` — single
 *  source of truth reused by the `localBusiness.state` dropdown (CF-1, do
 *  NOT create a separate `src/lib/seo/my-states.ts`). Keys match `MY_STATES`
 *  values exactly (English state name), values are the "English / Bahasa
 *  Melayu" display label shown in the state <Select>. */
export const MY_STATE_LABELS: Record<(typeof MY_STATES)[number], string> = {
    Johor: 'Johor',
    Kedah: 'Kedah',
    Kelantan: 'Kelantan',
    Melaka: 'Melaka / Malacca',
    'Negeri Sembilan': 'Negeri Sembilan',
    Pahang: 'Pahang',
    Penang: 'Penang / Pulau Pinang',
    Perak: 'Perak',
    Perlis: 'Perlis',
    Selangor: 'Selangor',
    Terengganu: 'Terengganu',
    'Kuala Lumpur': 'Wilayah Persekutuan Kuala Lumpur',
    Putrajaya: 'Wilayah Persekutuan Putrajaya',
    Sabah: 'Sabah',
    Sarawak: 'Sarawak',
    Labuan: 'Wilayah Persekutuan Labuan',
}

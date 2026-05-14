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

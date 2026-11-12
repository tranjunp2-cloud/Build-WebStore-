/**
 * Copy and language of the "store temporarily unavailable" page (#2179 item 6, BA spec): shown to visitors when a
 * store is banned (tenant suspended) or its main subscription has lapsed. It never says why.
 * Edge-safe (imported by the middleware): no Payload or Node imports.
 */
export type StoreUnavailableLocale = 'en' | 'ms'

export const STORE_UNAVAILABLE_COPY: Record<StoreUnavailableLocale, { title: string; message: string }> = {
    en: { title: 'This store is temporarily unavailable.', message: 'Please check back later.' },
    // BM copy from BA, pending native review (#2179).
    ms: { title: 'Kedai ini tidak tersedia buat sementara waktu.', message: 'Sila cuba lagi kemudian.' },
}

/** The site's primary language → page language: Malay (`ms`, `ms-MY`, `ms_MY`) → BM, anything else → EN. */
export function storeUnavailableLocale(primary: unknown): StoreUnavailableLocale {
    const value = typeof primary === 'string' ? primary.trim().toLowerCase() : ''
    return value === 'ms' || value.startsWith('ms-') || value.startsWith('ms_') ? 'ms' : 'en'
}

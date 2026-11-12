/**
 * Maintenance mode utilities — shared between middleware and tests.
 * BUG-F05-006: 503 response for unpublished sites.
 * #2179 item 6: 503 "store temporarily unavailable" for banned / expired stores.
 */
import { STORE_UNAVAILABLE_COPY, storeUnavailableLocale } from '@/lib/storefront/store-unavailable'

/** HTML-escape a string to prevent XSS when injecting into HTML templates. */
export function escapeHtml(input: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return String(input).replace(/[&<>"']/g, (c) => map[c] || c)
}

/** Build the static 503 maintenance HTML page. */
export function buildMaintenanceHtml(siteName: string): string {
    const safeName = escapeHtml(siteName || 'Website')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Maintenance</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B1120;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif}.c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}p{opacity:.7;font-size:.875rem;max-width:28rem}</style></head><body><div class="c"><div class="icon">🔧</div><h1>${safeName} is under maintenance</h1><p>We&#39;re updating the website. Please check back later.</p></div></body></html>`
}

/** Determine whether a request should receive a 503 maintenance response. */
export function shouldReturn503(data: { maintenance?: boolean }, pathname: string): boolean {
    return !!data.maintenance && !pathname.startsWith('/api')
}

/** Headers of the 503 "store unavailable" response: retry later, never cached, never indexed. */
export const STORE_UNAVAILABLE_HEADERS = {
    'Content-Type': 'text/html; charset=utf-8',
    'Retry-After': '3600',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
} as const

/** Static 503 page for a banned or expired store. No store name, no reason (BA spec, #2179). */
export function buildStoreUnavailableHtml(locale: unknown): string {
    const lang = storeUnavailableLocale(locale)
    const copy = STORE_UNAVAILABLE_COPY[lang]
    const title = escapeHtml(copy.title)
    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif}.c{text-align:center;padding:2rem;max-width:28rem}h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}p{color:#475569;font-size:1rem}</style></head><body><div class="c"><h1>${title}</h1><p>${escapeHtml(copy.message)}</p></div></body></html>`
}

/** Internal lookup (`/api/slug/redirect`, `/api/domain-primary`) says the store must not be served. */
export function shouldReturnStoreUnavailable(data: { unavailable?: unknown } | null | undefined): boolean {
    return data?.unavailable === true
}


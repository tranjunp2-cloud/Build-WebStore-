/**
 * Maintenance mode utilities — shared between middleware and tests.
 * BUG-F05-006: 503 response for unpublished sites.
 */

/** HTML-escape a string to prevent XSS when injecting into HTML templates. */
export function escapeHtml(input: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return String(input).replace(/[&<>"']/g, (c) => map[c] || c)
}

/** Build the static 503 maintenance HTML page. */
export function buildMaintenanceHtml(siteName: string): string {
    const safeName = escapeHtml(siteName || 'Website')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Maintenance</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B1120;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif}.c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}p{opacity:.7;font-size:.875rem;max-width:28rem}</style></head><body><div class="c"><div class="icon">🔧</div><h1>${safeName} đang bảo trì</h1><p>Chúng tôi đang cập nhật website. Vui lòng quay lại sau.</p></div></body></html>`
}

/** Determine whether a request should receive a 503 maintenance response. */
export function shouldReturn503(data: { maintenance?: boolean }, pathname: string): boolean {
    return !!data.maintenance && !pathname.startsWith('/api')
}

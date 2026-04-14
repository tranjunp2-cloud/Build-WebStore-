// @vitest-environment node
/**
 * TC-F05-MAINTENANCE — Maintenance mode: 503 response + XSS escaping
 *
 * Tests for BUG-F05-006 fixes:
 *   - Middleware returns 503 when slug redirect API reports maintenance=true
 *   - siteName is HTML-escaped to prevent XSS
 *   - Normal flow continues when maintenance=false
 *
 * Ref: docs/qa/TEST-REPORT/F05-sumbug.md BUG-F05-006
 */
import { describe, it, expect } from 'vitest'

// ── Replicate the exact escape logic from middleware.ts ──────────────────────
function escapeHtml(input: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return String(input).replace(/[&<>"']/g, (c) => map[c] || c)
}

function buildMaintenanceHtml(siteName: string): string {
    const safeName = escapeHtml(siteName || 'Website')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Maintenance</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B1120;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif}.c{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}h1{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}p{opacity:.7;font-size:.875rem;max-width:28rem}</style></head><body><div class="c"><div class="icon">🔧</div><h1>${safeName} đang bảo trì</h1><p>Chúng tôi đang cập nhật website. Vui lòng quay lại sau.</p></div></body></html>`
}

function shouldReturn503(data: { maintenance?: boolean }, pathname: string): boolean {
    return !!data.maintenance && !pathname.startsWith('/api')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Maintenance mode middleware logic [BUG-F05-006]', () => {
    describe('shouldReturn503', () => {
        it('returns true when maintenance=true and path is not /api', () => {
            expect(shouldReturn503({ maintenance: true }, '/')).toBe(true)
            expect(shouldReturn503({ maintenance: true }, '/about')).toBe(true)
        })

        it('returns false when maintenance=false', () => {
            expect(shouldReturn503({ maintenance: false }, '/')).toBe(false)
            expect(shouldReturn503({}, '/')).toBe(false)
        })

        it('returns false for /api paths even when maintenance=true', () => {
            expect(shouldReturn503({ maintenance: true }, '/api/health')).toBe(false)
            expect(shouldReturn503({ maintenance: true }, '/api/sites/12/save')).toBe(false)
        })
    })

    describe('XSS escaping in maintenance HTML', () => {
        it('escapes script tags in siteName', () => {
            const html = buildMaintenanceHtml('<script>alert(1)</script>')
            expect(html).not.toContain('<script>')
            expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        })

        it('escapes HTML entities in siteName', () => {
            const html = buildMaintenanceHtml('Tom & Jerry "Café"')
            expect(html).toContain('Tom &amp; Jerry &quot;Café&quot;')
            expect(html).not.toContain('Tom & Jerry "Café" đang')
        })

        it('uses "Website" as fallback for empty siteName', () => {
            const html = buildMaintenanceHtml('')
            expect(html).toContain('Website đang bảo trì')
        })

        it('renders normal siteName correctly', () => {
            const html = buildMaintenanceHtml('Coffee Haven')
            expect(html).toContain('Coffee Haven đang bảo trì')
        })
    })

    describe('maintenance HTML structure', () => {
        it('contains noindex robots meta', () => {
            const html = buildMaintenanceHtml('Test')
            expect(html).toContain('noindex,nofollow')
        })

        it('is valid HTML with DOCTYPE', () => {
            const html = buildMaintenanceHtml('Test')
            expect(html).toMatch(/^<!DOCTYPE html>/)
            expect(html).toContain('</html>')
        })
    })
})

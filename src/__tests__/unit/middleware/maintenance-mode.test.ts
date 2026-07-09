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
import { escapeHtml, buildMaintenanceHtml, shouldReturn503 } from '@/lib/maintenance'

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

    describe('escapeHtml', () => {
        it('escapes all dangerous characters', () => {
            expect(escapeHtml('&')).toBe('&amp;')
            expect(escapeHtml('<')).toBe('&lt;')
            expect(escapeHtml('>')).toBe('&gt;')
            expect(escapeHtml('"')).toBe('&quot;')
            expect(escapeHtml("'")).toBe('&#39;')
        })

        it('escapes script tags', () => {
            expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
        })

        it('passes through safe strings unchanged', () => {
            expect(escapeHtml('Coffee Haven')).toBe('Coffee Haven')
        })
    })

    describe('buildMaintenanceHtml', () => {
        it('escapes script tags in siteName', () => {
            const html = buildMaintenanceHtml('<script>alert(1)</script>')
            expect(html).not.toContain('<script>')
            expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        })

        it('escapes HTML entities in siteName', () => {
            const html = buildMaintenanceHtml('Tom & Jerry "Café"')
            expect(html).toContain('Tom &amp; Jerry &quot;Café&quot;')
        })

        it('uses "Website" as fallback for empty siteName', () => {
            const html = buildMaintenanceHtml('')
            expect(html).toContain('Website is under maintenance')
        })

        it('renders normal siteName correctly', () => {
            const html = buildMaintenanceHtml('Coffee Haven')
            expect(html).toContain('Coffee Haven is under maintenance')
        })

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

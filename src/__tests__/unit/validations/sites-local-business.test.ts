/**
 * @fileoverview Tests for saveSiteSchema's localBusinessSchema (F37 US-01 Phase 02/06)
 * TC-IDs: TC-F37-01-01 to TC-F37-01-04 (provisional — docs/qa/F37*.md not yet formalized)
 */
import { describe, it, expect } from 'vitest'
import { saveSiteSchema } from '@/lib/validations/sites'

// ── TC-F37-01-01: latitude out of range fails ───────────────────────────────

describe('[TC-F37-01-01] saveSiteSchema.localBusiness — latitude range (AC-3)', () => {
    it('rejects latitude 200 (out of -90..90 range)', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { latitude: 200 } })
        expect(result.success).toBe(false)
    })

    it('accepts latitude within range', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { latitude: 3.1469 } })
        expect(result.success).toBe(true)
    })
})

// ── TC-F37-01-02: longitude out of range fails ──────────────────────────────

describe('[TC-F37-01-02] saveSiteSchema.localBusiness — longitude range (AC-3)', () => {
    it('rejects longitude -181 (out of -180..180 range)', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { longitude: -181 } })
        expect(result.success).toBe(false)
    })

    it('accepts longitude within range', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { longitude: 101.6955 } })
        expect(result.success).toBe(true)
    })
})

// ── TC-F37-01-03: postcode format (AC-3) ────────────────────────────────────

describe('[TC-F37-01-03] saveSiteSchema.localBusiness — MY postcode format (AC-3)', () => {
    it('rejects non-numeric postcode "ABZ"', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { postcode: 'ABZ' } })
        expect(result.success).toBe(false)
    })

    it('accepts valid 5-digit postcode "50000"', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { postcode: '50000' } })
        expect(result.success).toBe(true)
    })

    it('rejects 4-digit postcode', () => {
        const result = saveSiteSchema.safeParse({ localBusiness: { postcode: '5000' } })
        expect(result.success).toBe(false)
    })
})

// ── TC-F37-01-04: localBusiness-only body passes .refine() (AC-1) ──────────

describe('[TC-F37-01-04] saveSiteSchema — localBusiness-only save passes refine (AC-1)', () => {
    it('accepts a body containing ONLY localBusiness (no other top-level field)', () => {
        const result = saveSiteSchema.safeParse({
            localBusiness: { streetAddress: '123 Jalan Bukit Bintang', city: 'Kuala Lumpur' },
        })
        expect(result.success).toBe(true)
    })

    it('rejects an entirely empty body (no field at all)', () => {
        const result = saveSiteSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

// ── Security: XSS-in-address sanitization ───────────────────────────────────

describe('[Security] saveSiteSchema.localBusiness — XSS sanitization', () => {
    it('strips <script> tags from streetAddress before persistence', () => {
        const result = saveSiteSchema.safeParse({
            localBusiness: { streetAddress: '<script>alert(1)</script>123 Main St' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.localBusiness?.streetAddress).not.toContain('<script>')
            expect(result.data.localBusiness?.streetAddress).toContain('123 Main St')
        }
    })

    it('strips HTML tags from serviceAreaDescription', () => {
        const result = saveSiteSchema.safeParse({
            localBusiness: { serviceAreaDescription: '<img src=x onerror=alert(1)>Petaling Jaya' },
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.localBusiness?.serviceAreaDescription).not.toContain('<img')
        }
    })
})

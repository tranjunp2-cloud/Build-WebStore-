import { describe, it, expect } from 'vitest'
import { analyticsTrackSchema } from '@/lib/validations/analytics'
import { seoAnalyzeSchema, seoFixSchema } from '@/lib/validations/seo'
import { saveSiteSchema } from '@/lib/validations/sites'
import { generateDescriptionSchema } from '@/lib/validations/products'

// ─── TC-F22.02: Analytics tracking validation ─────────────────────────
// ─── TC-F22.03: GA4 field validation ──────────────────────────────────

describe('analyticsTrackSchema [TC-F22.02, TC-F22.03]', () => {
    const validTrack = {
        siteId: 'site-1',
        pageUrl: '/home',
    }

    it('accepts valid tracking event', () => {
        const result = analyticsTrackSchema.safeParse(validTrack)
        expect(result.success).toBe(true)
    })

    it('accepts with all optional fields', () => {
        const result = analyticsTrackSchema.safeParse({
            ...validTrack,
            event: 'page_view',
            referrer: 'https://google.com',
            sessionId: 'sess-abc',
            metadata: { browser: 'Chrome', screen: '1920x1080' },
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing siteId', () => {
        const result = analyticsTrackSchema.safeParse({ pageUrl: '/home' })
        expect(result.success).toBe(false)
    })

    it('rejects empty siteId', () => {
        const result = analyticsTrackSchema.safeParse({ siteId: '', pageUrl: '/home' })
        expect(result.success).toBe(false)
    })

    it('rejects missing pageUrl', () => {
        const result = analyticsTrackSchema.safeParse({ siteId: 'site-1' })
        expect(result.success).toBe(false)
    })

    it('rejects empty pageUrl', () => {
        const result = analyticsTrackSchema.safeParse({ siteId: 'site-1', pageUrl: '' })
        expect(result.success).toBe(false)
    })
})

describe('seoAnalyzeSchema', () => {
    it('accepts valid siteId', () => {
        const result = seoAnalyzeSchema.safeParse({ siteId: 'site-1' })
        expect(result.success).toBe(true)
    })

    it('rejects empty siteId', () => {
        const result = seoAnalyzeSchema.safeParse({ siteId: '' })
        expect(result.success).toBe(false)
    })

    it('rejects missing siteId', () => {
        const result = seoAnalyzeSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

describe('seoFixSchema', () => {
    it('accepts valid siteId', () => {
        const result = seoFixSchema.safeParse({ siteId: 'site-1' })
        expect(result.success).toBe(true)
    })

    it('rejects empty siteId', () => {
        const result = seoFixSchema.safeParse({ siteId: '' })
        expect(result.success).toBe(false)
    })
})

describe('saveSiteSchema', () => {
    it('accepts valid blocks', () => {
        const result = saveSiteSchema.safeParse({
            blocks: [{ type: 'hero', content: {} }],
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid theme', () => {
        const result = saveSiteSchema.safeParse({
            theme: { primaryColor: '#ff0000' },
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid locale (en)', () => {
        const result = saveSiteSchema.safeParse({ locale: 'en' })
        expect(result.success).toBe(true)
    })

    it('accepts valid locale (ms)', () => {
        const result = saveSiteSchema.safeParse({ locale: 'ms' })
        expect(result.success).toBe(true)
    })

    it('rejects invalid locale', () => {
        const result = saveSiteSchema.safeParse({ locale: 'fr' })
        expect(result.success).toBe(false)
    })

    it('accepts valid shippingConfig', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: {
                westRate: 8,
                eastRate: 15,
                freeAbove: 100,
            },
        })
        expect(result.success).toBe(true)
    })

    it('accepts shippingConfig with freeAbove null', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: {
                westRate: 8,
                freeAbove: null,
            },
        })
        expect(result.success).toBe(true)
    })

    // TC-F14.18: rate=0 is valid (free shipping for that zone)
    it('TC-F14.18 — accepts westRate=0 and eastRate=0 (free zone)', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 0, eastRate: 0 },
        })
        expect(result.success).toBe(true)
    })

    // TC-F14.20: rate=100_000 sen (RM 1,000) is the inclusive upper boundary
    it('TC-F14.20 — accepts westRate=100_000 sen (RM 1,000 boundary, inclusive)', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 100_000, eastRate: 100_000 },
        })
        expect(result.success).toBe(true)
    })

    // TC-F14.17: negative rate must be rejected
    it('TC-F14.17 — rejects negative westRate', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: -1, eastRate: 15 },
        })
        expect(result.success).toBe(false)
    })

    // TC-F14.19: rate above 100_000 sen (RM 1,000) must be rejected
    it('TC-F14.19 — rejects westRate above 100_000 sen (RM 1,000.01)', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 100_001, eastRate: 15 },
        })
        expect(result.success).toBe(false)
    })

    // TC-F14.57: freeAbove=1 sen (RM 0.01) is the minimum valid threshold
    it('TC-F14.57 — accepts freeAbove=1 sen (RM 0.01 minimum boundary)', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 800, eastRate: 1500, freeAbove: 1 },
        })
        expect(result.success).toBe(true)
    })

    // TC-F14.58: negative freeAbove must be rejected (prevents all-orders-ship-free exploit)
    it('TC-F14.58 — rejects negative freeAbove', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 800, eastRate: 1500, freeAbove: -1 },
        })
        expect(result.success).toBe(false)
    })

    // TC-F14.59: freeAbove above 10_000_000 sen (RM 100,000) must be rejected
    it('TC-F14.59 — rejects freeAbove above 10_000_000 sen (RM 100,000.01)', () => {
        const result = saveSiteSchema.safeParse({
            shippingConfig: { westRate: 800, eastRate: 1500, freeAbove: 10_000_001 },
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty object (refine: at least one field required)', () => {
        const result = saveSiteSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('accepts multiple fields together', () => {
        const result = saveSiteSchema.safeParse({
            blocks: [{ type: 'hero' }],
            theme: { primaryColor: '#000' },
            locale: 'en',
        })
        expect(result.success).toBe(true)
    })

    // BUG-F05-045: phone format validation
    describe('contactInfo.phone validation [BUG-F05-045]', () => {
        const parse = (phone: string | null) =>
            saveSiteSchema.safeParse({ contactInfo: { phone } })

        it('accepts valid international phone +60 12-345-6789', () => {
            expect(parse('+60 12-345-6789').success).toBe(true)
        })

        it('accepts digits only 0123456789', () => {
            expect(parse('0123456789').success).toBe(true)
        })

        it('accepts phone with parens and dots +84 (28) 3823.4567', () => {
            expect(parse('+84 (28) 3823.4567').success).toBe(true)
        })

        it('accepts empty string', () => {
            expect(parse('').success).toBe(true)
        })

        it('accepts null', () => {
            expect(parse(null).success).toBe(true)
        })

        it('rejects alphabetic characters "abc"', () => {
            expect(parse('abc').success).toBe(false)
        })

        it('rejects mixed alphanumeric "12-34 abc"', () => {
            expect(parse('12-34 abc').success).toBe(false)
        })

        it('strips HTML tags from phone input', () => {
            const result = parse('<script>alert(1)</script>')
            // After stripping HTML → "alert(1)" which contains letters → rejected
            expect(result.success).toBe(false)
        })
    })
})

describe('generateDescriptionSchema', () => {
    it('accepts valid product name', () => {
        const result = generateDescriptionSchema.safeParse({ name: 'Nasi Lemak' })
        expect(result.success).toBe(true)
    })

    it('accepts with optional category and features', () => {
        const result = generateDescriptionSchema.safeParse({
            name: 'Nasi Lemak',
            category: 'Malaysian Food',
            features: 'Coconut rice, sambal, anchovies',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing name', () => {
        const result = generateDescriptionSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects empty name', () => {
        const result = generateDescriptionSchema.safeParse({ name: '' })
        expect(result.success).toBe(false)
    })
})

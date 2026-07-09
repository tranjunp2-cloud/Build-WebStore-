/**
 * @fileoverview Tests for F37 US-01 LocalBusiness JSON-LD extension (Phase 04/06)
 * TC-IDs: TC-F37-01-05 to TC-F37-01-09, TC-F37-01-12 (provisional — docs/qa/F37*.md not yet formalized)
 */
import { describe, it, expect } from 'vitest'
import { generateLocalBusinessSchema, generatePageSchemas, serializeJsonLd } from '@/lib/seo/json-ld'
import { dayOfWeekToSchema } from '@/lib/seo/schema-helpers'

const siteWithLocalBusiness = {
    name: 'Kedai Kopi ABC',
    domain: 'kedaikopiabc.com',
    localBusiness: {
        streetAddress: 'No. 12, Jalan SS2/24',
        city: 'Petaling Jaya',
        state: 'Selangor',
        postcode: '47300',
        country: 'MY',
        latitude: 3.1201,
        longitude: 101.6231,
        businessCategory: 'foodEstablishment',
        priceRange: '$$',
        serviceAreaDescription: 'Petaling Jaya, Shah Alam',
        openingHours: [
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false },
            { dayOfWeek: 'Sa', opens: '', closes: '', isClosed: true },
            { dayOfWeek: 'Su', opens: '', closes: '', isClosed: true },
        ],
    },
}

// ── TC-F37-01-05: full PostalAddress + geo + priceRange (AC-1) ─────────────

describe('[TC-F37-01-05] generateLocalBusinessSchema — full structured output (AC-1)', () => {
    it('emits full PostalAddress, geo, and priceRange from localBusiness data', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'No. 12, Jalan SS2/24',
            addressLocality: 'Petaling Jaya',
            addressRegion: 'Selangor',
            postalCode: '47300',
            addressCountry: 'MY',
        })
        expect(schema.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 3.1201, longitude: 101.6231 })
        expect(schema.priceRange).toBe('$$')
        expect(schema.areaServed).toBe('Petaling Jaya, Shah Alam')
    })
})

// ── TC-F37-01-06: closed days filtered from openingHoursSpecification (AC-2) ─

describe('[TC-F37-01-06] generateLocalBusinessSchema — closed days filtered (AC-2)', () => {
    it('excludes Sat/Sun (isClosed: true) from openingHoursSpecification', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        const spec = schema.openingHoursSpecification as Array<{ dayOfWeek: string }>
        expect(spec).toHaveLength(1)
        expect(spec.map(s => s.dayOfWeek)).not.toContain('Saturday')
        expect(spec.map(s => s.dayOfWeek)).not.toContain('Sunday')
    })
})

// ── TC-F37-01-07: NO aggregateRating (FR-06) ────────────────────────────────

describe('[TC-F37-01-07] generateLocalBusinessSchema — no aggregateRating (FR-06)', () => {
    it('never emits aggregateRating at the LocalBusiness level', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        expect(schema.aggregateRating).toBeUndefined()
        expect(Object.keys(schema)).not.toContain('aggregateRating')
    })
})

// ── TC-F37-01-08: @type mapped to correct sub-type (FR-04) ─────────────────

describe('[TC-F37-01-08] generateLocalBusinessSchema — @type sub-type mapping (FR-04)', () => {
    it('maps businessCategory "foodEstablishment" to @type "FoodEstablishment"', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        expect(schema['@type']).toBe('FoodEstablishment')
    })

    it('falls back to generic "LocalBusiness" when businessCategory is absent', () => {
        const legacySite = { name: 'Old Site', domain: 'old.com', contactInfo: { address: '123 Old St' } }
        const schema = generateLocalBusinessSchema({ blockType: 'contact' }, legacySite)!
        expect(schema['@type']).toBe('LocalBusiness')
    })
})

// ── TC-F37-01-09: homepage trigger + dedupe (AC-1) ──────────────────────────

describe('[TC-F37-01-09] generatePageSchemas — homepage trigger + no double-inject (AC-1)', () => {
    it('emits LocalBusiness on homepage from localBusiness data alone (no Contact block)', () => {
        const schemas = generatePageSchemas({
            blocks: [{ blockType: 'hero' }],
            site: siteWithLocalBusiness,
            page: { slug: 'home' },
            isHomepage: true,
        })
        expect(schemas.some(s => s['@type'] === 'FoodEstablishment')).toBe(true)
    })

    it('does NOT emit LocalBusiness on non-homepage without a Contact block', () => {
        const schemas = generatePageSchemas({
            blocks: [{ blockType: 'features' }],
            site: siteWithLocalBusiness,
            page: { slug: 'about' },
            isHomepage: false,
        })
        expect(schemas.some(s => s['@type'] === 'FoodEstablishment')).toBe(false)
    })

    it('injects exactly ONE LocalBusiness schema when both Contact block and localBusiness data are present', () => {
        const schemas = generatePageSchemas({
            blocks: [{ blockType: 'contact', address: 'legacy address' }],
            site: siteWithLocalBusiness,
            page: { slug: 'home' },
            isHomepage: true,
        })
        expect(schemas.filter(s => s['@type'] === 'FoodEstablishment')).toHaveLength(1)
    })
})

// ── TC-F37-01-12: dayOfWeekToSchema exact string mapping (AC-2) ────────────

describe('[TC-F37-01-12] dayOfWeekToSchema — exact Schema.org day string (AC-2)', () => {
    it.each([
        ['Mo', 'Monday'], ['Tu', 'Tuesday'], ['We', 'Wednesday'], ['Th', 'Thursday'],
        ['Fr', 'Friday'], ['Sa', 'Saturday'], ['Su', 'Sunday'],
    ])('maps %s to exact string %s', (code, expected) => {
        expect(dayOfWeekToSchema(code)).toBe(expected)
    })

    it('returns null for an unrecognized day code (not a fabricated string)', () => {
        expect(dayOfWeekToSchema('XX')).toBeNull()
        expect(dayOfWeekToSchema(undefined)).toBeNull()
    })
})

// ── Security: XSS-safe JSON-LD serialization ────────────────────────────────

describe('[Security] serializeJsonLd — XSS-safe embedding', () => {
    it('escapes </script> so tenant-controlled strings cannot break out of the script tag', () => {
        const malicious = { name: '</script><script>alert(1)</script>' }
        const serialized = serializeJsonLd(malicious)
        expect(serialized).not.toContain('</script>')
        expect(serialized).toContain('\\u003c/script\\u003e')
    })
})

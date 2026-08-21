/**
 * @fileoverview Tests for F37 LocalBusiness JSON-LD generation and safe serialization.
 * TC-IDs: legacy TC-F37-01-05..22 plus v2.6 TC-F37-02-10/29..44.
 */
import { describe, it, expect } from 'vitest'
import {
    generateFAQSchema,
    generateSchemaGenerationArtifact,
    generateLocalBusinessSchema,
    generatePageSchemas,
    generateV2LocalBusinessSchema,
    serializeJsonLd,
} from '@/lib/seo/json-ld'
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
        schemaSubtype: 'Restaurant',
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

    it('uses Contact Info address and defaults the fixed country to Malaysia', () => {
        const schema = generateLocalBusinessSchema(null, {
            name: 'Kedai Kopi ABC',
            contactInfo: { address: '88 Jalan Contact' },
            localBusiness: {
                streetAddress: 'Legacy Local Business Address',
                city: 'Petaling Jaya',
                state: 'Selangor',
                postcode: '47300',
            },
        })!

        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '88 Jalan Contact',
            addressLocality: 'Petaling Jaya',
            addressRegion: 'Selangor',
            postalCode: '47300',
            addressCountry: 'MY',
        })
    })
})

// ── TC-F37-01-22: geo-cascade output (plain strings) still maps to PostalAddress (Phase 04) ─

describe('[TC-F37-01-22] generateLocalBusinessSchema — geo-cascade string output stays compatible (AC-1)', () => {
    it('city/state/postcode resolved via the DB-backed cascade are plain strings and map unchanged to addressLocality/addressRegion/postalCode', () => {
        // Arrange — shape identical to what GeoCascadeFields' onChange patch produces:
        // plain string names resolved from `/api/geo/districts` and `/api/geo/states`
        // (cascade ids never leave the component — see geo-cascade-fields.tsx).
        const siteFromCascade = {
            name: 'Kedai Kopi ABC',
            domain: 'kedaikopiabc.com',
            localBusiness: {
                streetAddress: 'No. 12, Jalan SS2/24',
                city: 'Petaling Jaya',
                state: 'Selangor',
                postcode: '47300',
                country: 'MY',
            },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, siteFromCascade)!

        // Assert — json-ld.ts's contract is untouched: it still just reads plain strings.
        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'No. 12, Jalan SS2/24',
            addressLocality: 'Petaling Jaya',
            addressRegion: 'Selangor',
            postalCode: '47300',
            addressCountry: 'MY',
        })
        expect(typeof (schema.address as { addressLocality: unknown }).addressLocality).toBe('string')
        expect(typeof (schema.address as { addressRegion: unknown }).addressRegion).toBe('string')
        expect(typeof (schema.address as { postalCode: unknown }).postalCode).toBe('string')
    })
})

// ── TC-F37-02-12: hasMap derived from coordinates (US-F37-02 Additional Criteria) ─

describe('[TC-F37-02-12] generateLocalBusinessSchema — hasMap fallback (US-F37-02)', () => {
    it('emits a Google Maps URL built from lat/lng when coordinates are present', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        expect(schema.hasMap).toBe('https://www.google.com/maps?q=3.1201,101.6231')
    })

    it('omits hasMap when coordinates are absent', () => {
        const siteWithoutCoords = {
            name: 'Kedai Kopi ABC',
            localBusiness: { streetAddress: 'No. 12, Jalan SS2/24' },
        }
        const schema = generateLocalBusinessSchema(null, siteWithoutCoords)!
        expect(schema.hasMap).toBeUndefined()
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
    it('maps businessCategory "foodEstablishment" to @type "Restaurant"', () => {
        const schema = generateLocalBusinessSchema(null, siteWithLocalBusiness)!
        expect(schema['@type']).toBe('Restaurant')
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
        expect(schemas.some(s => s['@type'] === 'Restaurant')).toBe(true)
    })

    it('does NOT emit LocalBusiness on non-homepage without a Contact block', () => {
        const schemas = generatePageSchemas({
            blocks: [{ blockType: 'features' }],
            site: siteWithLocalBusiness,
            page: { slug: 'about' },
            isHomepage: false,
        })
        expect(schemas.some(s => s['@type'] === 'Restaurant')).toBe(false)
    })

    it('injects exactly ONE LocalBusiness schema when both Contact block and localBusiness data are present', () => {
        const schemas = generatePageSchemas({
            blocks: [{ blockType: 'contact', address: 'legacy address' }],
            site: siteWithLocalBusiness,
            page: { slug: 'home' },
            isHomepage: true,
        })
        expect(schemas.filter(s => s['@type'] === 'Restaurant')).toHaveLength(1)
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

// ── TC-F37-02-21: split-shift openingHours produces N separate spec entries (US-F37-02) ─

describe('[TC-F37-02-21] generateLocalBusinessSchema — split-shift openingHours (US-F37-02)', () => {
    it('emits 2 separate openingHoursSpecification entries for a day with 2 time ranges (split-shift)', () => {
        const siteWithSplitShift = {
            name: 'Kedai Kopi ABC',
            domain: 'kedaikopiabc.com',
            localBusiness: {
                ...siteWithLocalBusiness.localBusiness,
                openingHours: [
                    { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00', isClosed: false },
                    { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00', isClosed: false },
                ],
            },
        }
        const schema = generateLocalBusinessSchema(null, siteWithSplitShift)!
        const spec = schema.openingHoursSpecification as Array<{ dayOfWeek: string; opens: string; closes: string }>
        expect(spec).toHaveLength(2)
        expect(spec.every(s => s.dayOfWeek === 'Monday')).toBe(true)
        expect(spec.map(s => `${s.opens}-${s.closes}`)).toEqual(['07:00-11:00', '13:00-18:00'])
    })
})

// ── Security: XSS-safe JSON-LD serialization ────────────────────────────────

describe('[TC-F37-02-10] serializeJsonLd — XSS-safe embedding', () => {
    it('escapes </script> so tenant-controlled strings cannot break out of the script tag', () => {
        // Arrange
        const malicious = { name: '</script><script>alert(1)</script>' }

        // Act
        const serialized = serializeJsonLd(malicious)

        // Assert
        expect(serialized).not.toContain('</script>')
        expect(serialized).toContain('\\u003c/script\\u003e')
    })

    it('escapes <, >, &, U+2028, and U+2029 in generated LocalBusiness and FAQ fields', () => {
        // Arrange
        const localBusiness = generateV2LocalBusinessSchema({
            name: 'Kedai <Kopi> & Teh\u2028Baru',
            localBusiness: {
                streetAddress: 'No. 1 > Jalan & Utama\u2029Suite',
                city: 'Petaling Jaya',
                postcode: '47300',
                country: 'MY',
            },
        })
        const faq = generateFAQSchema([{
            blockType: 'faq',
            items: [{
                question: 'Can <you> help & support\u2028today?',
                answer: 'Yes > now & later\u2029always.',
            }],
        }])

        // Act
        const serialized = serializeJsonLd([localBusiness, faq])

        // Assert
        expect(serialized).not.toMatch(/[<>&\u2028\u2029]/u)
        expect(serialized).toContain('\\u003c')
        expect(serialized).toContain('\\u003e')
        expect(serialized).toContain('\\u0026')
        expect(serialized).toContain('\\u2028')
        expect(serialized).toContain('\\u2029')
    })
})

// ── TC-F37-02-33/46: strict identity + weak fallback precedence ────────────────

describe('[TC-F37-02-33/46] generateV2LocalBusinessSchema — strict v2 identity contract', () => {
    it('emits a strict node when name and all required address fields are non-empty after trim', () => {
        // Arrange
        const site = {
            name: '  Kedai Kopi ABC  ',
            localBusiness: {
                streetAddress: '  No. 12, Jalan SS2/24  ',
                city: '  Petaling Jaya  ',
                postcode: '  47300  ',
                country: '  MY  ',
            },
        }

        // Act
        const schema = generateV2LocalBusinessSchema(site)

        // Assert
        expect(schema).not.toBeNull()
        expect(schema?.['@type']).toBe('LocalBusiness')
    })

    it.each([
        ['name', { name: '   ', localBusiness: siteWithLocalBusiness.localBusiness }],
        ['streetAddress', {
            name: 'Kedai Kopi ABC',
            localBusiness: { ...siteWithLocalBusiness.localBusiness, streetAddress: '   ' },
        }],
        ['city', {
            name: 'Kedai Kopi ABC',
            localBusiness: { ...siteWithLocalBusiness.localBusiness, city: undefined },
        }],
        ['postcode', {
            name: 'Kedai Kopi ABC',
            localBusiness: { ...siteWithLocalBusiness.localBusiness, postcode: null },
        }],
    ])('returns null when required identity field %s is incomplete', (_field, site) => {
        // Arrange — site supplied by the table.

        // Act
        const schema = generateV2LocalBusinessSchema(site)

        // Assert
        expect(schema).toBeNull()
    })

    it('does not require optional state for a strict node', () => {
        // Arrange
        const site = {
            name: 'Kedai Kopi ABC',
            localBusiness: {
                streetAddress: 'No. 12, Jalan SS2/24',
                city: 'Petaling Jaya',
                postcode: '47300',
                country: 'MY',
            },
        }

        // Act
        const schema = generateV2LocalBusinessSchema(site)

        // Assert
        expect(schema?.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'No. 12, Jalan SS2/24',
            addressLocality: 'Petaling Jaya',
            postalCode: '47300',
            addressCountry: 'MY',
        })
    })

    it('prefers one strict homepage node when strict data and a Contact block both exist', () => {
        // Arrange
        const input = {
            blocks: [{ blockType: 'contact', address: 'Legacy address' }],
            site: siteWithLocalBusiness,
            page: { slug: 'home' },
            isHomepage: true,
        }

        // Act
        const schemas = generatePageSchemas(input)
        const localBusinesses = schemas.filter(schema =>
            ['LocalBusiness', 'Restaurant'].includes(String(schema['@type'])),
        )

        // Assert
        expect(localBusinesses).toHaveLength(1)
        expect(localBusinesses[0]?.['@type']).toBe('Restaurant')
        expect((localBusinesses[0]?.address as Record<string, unknown>).streetAddress)
            .toBe('No. 12, Jalan SS2/24')
    })

    it('falls back to the legacy Contact node only when the strict homepage contract is incomplete', () => {
        // Arrange
        const input = {
            blocks: [{ blockType: 'contact', address: 'Legacy address' }],
            site: {
                name: 'Legacy Business',
                localBusiness: { streetAddress: 'Structured but incomplete' },
            },
            page: { slug: 'home' },
            isHomepage: true,
        }

        // Act
        const schemas = generatePageSchemas(input)
        const localBusinesses = schemas.filter(schema => schema['@type'] === 'LocalBusiness')

        // Assert
        expect(localBusinesses).toHaveLength(1)
        expect(localBusinesses[0]?.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'Structured but incomplete',
            addressCountry: 'MY',
        })
    })

    it('omits LocalBusiness when homepage strict data is incomplete and no Contact block exists', () => {
        // Arrange
        const input = {
            blocks: [{ blockType: 'hero' }],
            site: {
                name: 'Incomplete Business',
                localBusiness: { streetAddress: 'Street only' },
            },
            page: { slug: 'home' },
            isHomepage: true,
        }

        // Act
        const schemas = generatePageSchemas(input)

        // Assert
        expect(schemas.some(schema => schema['@type'] === 'LocalBusiness')).toBe(false)
    })
})

// ── TC-F37-02-04: malformed FAQ isolation + compatibility semantics ───────────

describe('[TC-F37-02-04] generateFAQSchema — malformed input and duplicate handling', () => {
    it('preserves legacy FAQ strings and exact deduplication while ignoring malformed containers', () => {
        // Arrange
        const blocks = [{
            blockType: 'faq',
            items: [
                { question: '  Where are you?  ', answer: '  Petaling Jaya.  ' },
                { question: '  Where are you?  ', answer: 'Duplicate answer' },
                { question: 'Missing answer', answer: '   ' },
                { question: 42, answer: 'Wrong question type' },
                null,
            ],
        }, { blockType: 'faq', items: 'not-an-array' }, null]

        // Act
        const schema = generateFAQSchema(blocks)

        // Assert
        expect(schema?.mainEntity).toEqual([{
            '@type': 'Question',
            name: '  Where are you?  ',
            acceptedAnswer: { '@type': 'Answer', text: '  Petaling Jaya.  ' },
        }, {
            '@type': 'Question',
            name: 'Missing answer',
            acceptedAnswer: { '@type': 'Answer', text: '   ' },
        }])
    })

    it.each([
        ['non-array blocks', { blockType: 'faq' }],
        ['empty block array', []],
        ['malformed block items', [{ blockType: 'faq', items: [null, 7, {}, []] }]],
        ['empty question', [{
            blockType: 'faq',
            items: [{ question: '', answer: 'Answer' }],
        }]],
    ])('returns null for %s', (_case, blocks) => {
        // Arrange — malformed input supplied by the table.

        // Act
        const schema = generateFAQSchema(blocks)

        // Assert
        expect(schema).toBeNull()
    })

    it('ignores malformed page blocks without suppressing valid schemas', () => {
        // Arrange
        const input = {
            blocks: [null, 7, { blockType: 'faq', items: null }, { blockType: 'hero' }],
            site: siteWithLocalBusiness,
            page: { slug: 'home' },
            isHomepage: true,
        }

        // Act
        const schemas = generatePageSchemas(input)

        // Assert
        expect(schemas.some(schema => schema['@type'] === 'Restaurant')).toBe(true)
        expect(schemas.some(schema => schema['@type'] === 'FAQPage')).toBe(false)
    })
})

// ── TC-F37-02-33/34: valid hours emit; malformed rows are omitted ──────────

describe('[TC-F37-02-33/34] generateLocalBusinessSchema — defensive opening-hours validation', () => {
    it('emits only valid open rows from a malformed opening-hours array', () => {
        // Arrange
        const site = {
            ...siteWithLocalBusiness,
            localBusiness: {
                ...siteWithLocalBusiness.localBusiness,
                openingHours: [
                    null,
                    7,
                    { dayOfWeek: 'XX', opens: '09:00', closes: '18:00' },
                    { dayOfWeek: 'Mo', opens: '9:00', closes: '18:00' },
                    { dayOfWeek: 'Tu', opens: '18:00', closes: '09:00' },
                    { dayOfWeek: 'We', opens: '09:00', closes: '09:00' },
                    { dayOfWeek: 'Th', opens: '09:00', closes: '18:00', isClosed: true },
                    { dayOfWeek: 'Fr', opens: '09:00', closes: '18:00' },
                ],
            },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, site)

        // Assert
        expect(schema?.openingHoursSpecification).toEqual([{
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: 'Friday',
            opens: '09:00',
            closes: '18:00',
        }])
    })

    it('omits openingHoursSpecification when openingHours is not an array', () => {
        // Arrange
        const site = {
            ...siteWithLocalBusiness,
            localBusiness: {
                ...siteWithLocalBusiness.localBusiness,
                openingHours: { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00' },
            },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, site)

        // Assert
        expect(schema?.openingHoursSpecification).toBeUndefined()
    })
})

// ── TC-F37-02-38: explicit, derived, and unavailable priceRange ─────────

describe('[TC-F37-02-38] generateLocalBusinessSchema — explicit and derived priceRange', () => {
    it.each([
        ['explicit', { businessCategory: 'store', priceRange: '$$$$' }, '$$$$'],
        ['derived', { businessCategory: 'store', priceRange: undefined }, '$'],
    ])('emits the %s priceRange', (_case, localBusinessPatch, expected) => {
        // Arrange
        const site = {
            ...siteWithLocalBusiness,
            localBusiness: { ...siteWithLocalBusiness.localBusiness, ...localBusinessPatch },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, site)

        // Assert
        expect(schema?.priceRange).toBe(expected)
    })

    it('omits priceRange when neither an explicit nor derived value exists', () => {
        // Arrange
        const site = {
            ...siteWithLocalBusiness,
            localBusiness: {
                ...siteWithLocalBusiness.localBusiness,
                businessCategory: 'unknown',
                priceRange: undefined,
            },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, site)

        // Assert
        expect(schema?.priceRange).toBeUndefined()
    })
})

describe('[TC-F37-02-35] generateLocalBusinessSchema — finite complete geo only', () => {
    it.each([
        ['missing longitude', { latitude: 3.1201, longitude: undefined }],
        ['missing latitude', { latitude: undefined, longitude: 101.6231 }],
        ['NaN latitude', { latitude: Number.NaN, longitude: 101.6231 }],
        ['infinite longitude', { latitude: 3.1201, longitude: Number.POSITIVE_INFINITY }],
        ['out-of-range latitude', { latitude: 91, longitude: 101.6231 }],
        ['out-of-range longitude', { latitude: 3.1201, longitude: -181 }],
    ])('omits geo and hasMap for %s', (_case, coordinates) => {
        // Arrange
        const site = {
            ...siteWithLocalBusiness,
            localBusiness: { ...siteWithLocalBusiness.localBusiness, ...coordinates },
        }

        // Act
        const schema = generateLocalBusinessSchema(null, site)

        // Assert
        expect(schema?.geo).toBeUndefined()
        expect(schema?.hasMap).toBeUndefined()
    })
})

// ── TC-F37-02-41/44: malformed nested values stay non-fatal ─────────

describe('[TC-F37-02-41/44] malformed LocalBusiness nested values', () => {
    function noPrimitiveConversionObject(): object {
        return {
            [Symbol.toPrimitive]: () => {
                throw new Error('must not attempt primitive conversion')
            },
        }
    }

    it('strict generation falls back or omits malformed nested values without throwing', () => {
        // Arrange
        const trigger = noPrimitiveConversionObject()
        const site = {
            name: 'Kedai Kopi ABC',
            contactInfo: { phone: trigger, email: 42, address: trigger },
            socialLinks: {
                facebook: trigger,
                instagram: ['not-a-string'],
                website: '  https://social.example/kedai  ',
            },
            localBusiness: {
                streetAddress: 'No. 12, Jalan SS2/24',
                city: 'Petaling Jaya',
                postcode: '47300',
                country: 'MY',
                businessCategory: trigger,
                priceRange: trigger,
                serviceAreaDescription: trigger,
            },
        }
        let schema: Record<string, unknown> | null = null

        // Act
        const generate = () => {
            schema = generateV2LocalBusinessSchema(site)
        }

        // Assert
        expect(generate).not.toThrow()
        expect(schema).toMatchObject({
            '@type': 'LocalBusiness',
            name: 'Kedai Kopi ABC',
            sameAs: ['https://social.example/kedai'],
        })
        expect(schema?.telephone).toBeUndefined()
        expect(schema?.email).toBeUndefined()
        expect(schema?.priceRange).toBeUndefined()
        expect(schema?.areaServed).toBeUndefined()
    })

    it('homepage aggregation preserves all valid schemas and a safe strict node', () => {
        // Arrange
        const trigger = noPrimitiveConversionObject()
        const input = {
            blocks: [{
                blockType: 'faq',
                items: [{ question: 'Where are you?', answer: 'Petaling Jaya.' }],
            }],
            site: {
                name: 'Kedai Kopi ABC',
                domain: 'kedaikopiabc.com',
                contactInfo: { phone: trigger, email: trigger },
                socialLinks: { facebook: trigger },
                localBusiness: {
                    streetAddress: 'No. 12, Jalan SS2/24',
                    city: 'Petaling Jaya',
                    postcode: '47300',
                    country: 'MY',
                    businessCategory: trigger,
                    priceRange: trigger,
                },
            },
            page: { slug: 'home' },
            isHomepage: true,
        }
        let schemas: Array<Record<string, unknown>> = []

        // Act
        const generate = () => {
            schemas = generatePageSchemas(input)
        }

        // Assert
        expect(generate).not.toThrow()
        expect(schemas.map(schema => schema['@type'])).toEqual([
            'BreadcrumbList',
            'Organization',
            'WebSite',
            'FAQPage',
            'LocalBusiness',
        ])
        const organization = schemas.find(schema => schema['@type'] === 'Organization')
        expect(organization).toBeDefined()
        expect(organization?.telephone).toBeUndefined()
        expect(organization?.email).toBeUndefined()
        expect(organization?.sameAs).toBeUndefined()
        const localBusiness = schemas.find(schema => schema['@type'] === 'LocalBusiness')
        expect(localBusiness).toBeDefined()
        expect(localBusiness?.telephone).toBeUndefined()
        expect(localBusiness?.email).toBeUndefined()
        expect(localBusiness?.sameAs).toBeUndefined()
        expect(localBusiness?.priceRange).toBeUndefined()
    })
})

// ── TC-F37-02-32/37/43/44/46: v2.6 trusted-output boundaries ──────────────

describe('[TC-F37-02-32/37/43/44/46] JSON-LD v2.6 trusted-output boundaries', () => {
    it('[TC-F37-02-32] emits exact compatible subtype and generic type for empty or invalid subtype', () => {
        // Arrange
        const base = { name: 'Business', localBusiness: { streetAddress: 'Street', city: 'City', postcode: '47300', country: 'MY' } }

        // Act
        const compatible = generateV2LocalBusinessSchema({ ...base, localBusiness: { ...base.localBusiness, businessCategory: 'store', schemaSubtype: 'Store' } })
        const empty = generateV2LocalBusinessSchema({ ...base, localBusiness: { ...base.localBusiness, businessCategory: 'store' } })
        const invalid = generateV2LocalBusinessSchema({ ...base, localBusiness: { ...base.localBusiness, businessCategory: 'store', schemaSubtype: 'Restaurant' } })

        // Assert
        expect(compatible?.['@type']).toBe('Store')
        expect(empty?.['@type']).toBe('LocalBusiness')
        expect(invalid?.['@type']).toBe('LocalBusiness')
    })

    it('[TC-F37-02-37] omits leading/trailing control-character and credential-bearing URLs', () => {
        // Arrange
        const base = { name: 'Business', localBusiness: { streetAddress: 'Street', city: 'City', postcode: '47300', country: 'MY' } }

        // Act
        const leadingLf = generateV2LocalBusinessSchema({ ...base, domain: '\nhttps://example.com' })
        const trailingTab = generateV2LocalBusinessSchema({ ...base, domain: 'https://example.com\t' })
        const credentials = generateV2LocalBusinessSchema({ ...base, domain: 'https://user:pass@example.com' })

        // Assert
        expect(leadingLf?.url).toBeUndefined()
        expect(trailingTab?.url).toBeUndefined()
        expect(credentials?.url).toBeUndefined()
    })

    it('[TC-F37-02-37] filters invalid logo and social URLs from every generated node', () => {
        // Arrange
        const site = {
            name: 'Business',
            domain: 'example.com',
            branding: { logo: 'javascript:alert(1)' },
            socialLinks: {
                facebook: 'not a url',
                instagram: 'https://user:pass@example.com',
                website: ' social.example/profile ',
            },
            localBusiness: {
                streetAddress: 'Street', city: 'City', postcode: '47300', country: 'MY',
            },
        }

        // Act
        const artifact = generateSchemaGenerationArtifact(site)

        // Assert
        expect(artifact.organization?.logo).toBeUndefined()
        expect(artifact.organization?.sameAs).toEqual(['https://social.example/profile'])
        expect(artifact.strictLocalBusiness?.sameAs).toEqual(['https://social.example/profile'])
    })

    it('[TC-F37-02-43] raw serialization escapes every breakout token and cannot inject a sentinel', () => {
        // Arrange
        const sentinel = '__F37_JSONLD_BREAKOUT__'
        const node = { name: `</script><img id="${sentinel}" onerror="globalThis.${sentinel}=1">&\u2028\u2029` }

        // Act
        const serialized = serializeJsonLd(node)

        // Assert
        expect(serialized).not.toMatch(/[<>&\u2028\u2029]/u)
        expect(serialized).not.toContain('</script>')
        expect(serialized).not.toContain(`<img id="${sentinel}"`)
        expect(serialized).toContain(sentinel)
    })

    it('[TC-F37-02-44] keeps generation non-fatal and never emits aggregateRating', () => {
        // Arrange
        const hostile = { [Symbol.toPrimitive]: () => { throw new Error('must not coerce') } }
        const site = {
            name: 'Business', domain: hostile,
            localBusiness: { streetAddress: 'Street', city: 'City', postcode: '47300', country: 'MY', schemaSubtype: hostile },
        }

        // Act
        const generate = () => generateSchemaGenerationArtifact(site)

        // Assert
        expect(generate).not.toThrow()
        expect(generate().strictLocalBusiness).not.toHaveProperty('aggregateRating')
    })

    it('[TC-F37-02-46] weak Contact fallback stays generic for an incompatible persisted pair', () => {
        // Arrange
        const input = {
            blocks: [{ blockType: 'contact', address: 'Legacy address' }],
            site: { name: 'Legacy', localBusiness: { businessCategory: 'store', schemaSubtype: 'Restaurant' } },
            page: { slug: 'home' }, isHomepage: true,
        }

        // Act
        const schemas = generatePageSchemas(input)
        const fallback = schemas.find(schema => schema['@type'] === 'LocalBusiness')

        // Assert
        expect(fallback).toBeDefined()
        expect(schemas.some(schema => schema['@type'] === 'Restaurant')).toBe(false)
    })
})

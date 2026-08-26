import { describe, expect, it } from 'vitest'
import { generateFAQSchema, generateSchemaGenerationArtifact, type SchemaGenerationArtifact } from '@/lib/seo/json-ld'
import { calculateSchemaScore, deriveSchemaScoreInput, type SchemaScoreBreakdown } from '@/lib/seo/schema-score'

const completeSite = {
    name: '  Kedai Kopi ABC  ',
    domain: 'HTTPS://Example.COM/',
    contactInfo: { phone: '  +60 12 345 6789  ' },
    localBusiness: {
        streetAddress: '  No. 12, Jalan SS2/24  ', city: '  Petaling Jaya  ',
        postcode: '  47300  ', country: '  MY  ', businessCategory: 'foodEstablishment',
        schemaSubtype: 'Restaurant', priceRange: '$$', latitude: 3.1201, longitude: 101.6231,
        openingHours: [{ dayOfWeek: 'Mo', opens: '09:00', closes: '18:00' }],
    },
}

const zeroBreakdown: SchemaScoreBreakdown = {
    localBusiness: 0, subtype: 0, openingHours: 0, geo: 0,
    telephone: 0, url: 0, priceRange: 0, organization: 0,
}

function artifactWith(
    strictLocalBusiness: Record<string, unknown> | null,
    organization: Record<string, unknown> | null = null,
    subtypeEvidence: SchemaGenerationArtifact['subtypeEvidence'] = null,
): SchemaGenerationArtifact {
    return Object.freeze({ strictLocalBusiness, organization, subtypeEvidence })
}

describe('[TC-F37-02-32/40/42] calculateSchemaScore — exact Schema 35 artifact contract', () => {
    it('[TC-F37-02-40] returns exactly 35 with the documented breakdown', () => {
        // Arrange
        const artifact = generateSchemaGenerationArtifact(completeSite)

        // Act
        const result = calculateSchemaScore(artifact)

        // Assert
        expect(result).toEqual({
            score: 35,
            breakdown: { localBusiness: 10, subtype: 4, openingHours: 5, geo: 4, telephone: 3, url: 3, priceRange: 3, organization: 3 },
        })
        expect(Object.values(result.breakdown).reduce((sum, points) => sum + points, 0)).toBe(result.score)
    })

    it.each([
        ['null artifact', null], ['undefined artifact', undefined], ['empty artifact', artifactWith(null)],
    ])('[TC-F37-02-40] returns exact zero for %s', (_case, artifact) => {
        // Arrange — artifact supplied by the table.

        // Act
        const result = calculateSchemaScore(artifact)

        // Assert
        expect(result).toEqual({ score: 0, breakdown: zeroBreakdown })
    })

    it('[TC-F37-02-42] consumes the immutable production generation artifact directly', () => {
        // Arrange
        const artifact = generateSchemaGenerationArtifact(completeSite)

        // Act
        const result = calculateSchemaScore(artifact)

        // Assert
        expect(Object.isFrozen(artifact)).toBe(true)
        expect(artifact.strictLocalBusiness?.['@type']).toBe('Restaurant')
        expect(artifact.subtypeEvidence).toEqual({ businessCategory: 'foodEstablishment', schemaSubtype: 'Restaurant' })
        expect(result.score).toBe(35)
    })

    it('[TC-F37-02-42] ignores FAQ because FAQ is absent from the artifact contract', () => {
        // Arrange
        const artifact = generateSchemaGenerationArtifact(completeSite)
        const faq = generateFAQSchema([{ blockType: 'faq', items: [{ question: 'Where?', answer: 'Here.' }] }])

        // Act
        const before = calculateSchemaScore(artifact)
        const after = calculateSchemaScore({ ...artifact, faq } as SchemaGenerationArtifact)

        // Assert
        expect(faq?.['@type']).toBe('FAQPage')
        expect(after).toEqual(before)
        expect(Object.keys(after.breakdown)).not.toContain('faqPage')
    })
})

describe('[TC-F37-02-32/33/40/41/46] deriveSchemaScoreInput — trusted parent gates', () => {
    it('[TC-F37-02-33/40] awards no parent or child points for incomplete identity', () => {
        // Arrange
        const incompleteParent = {
            '@type': 'Restaurant', name: 'Incomplete Business',
            address: { '@type': 'PostalAddress', streetAddress: 'Street only' },
            openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '09:00', closes: '18:00' }],
            geo: { '@type': 'GeoCoordinates', latitude: 3.1201, longitude: 101.6231 },
            telephone: '+60 12 345 6789', url: 'https://example.com', priceRange: '$$',
        }
        const artifact = artifactWith(incompleteParent, null, { businessCategory: 'foodEstablishment', schemaSubtype: 'Restaurant' })

        // Act
        const input = deriveSchemaScoreInput(artifact)

        // Assert
        expect(input).toEqual({ localBusiness: false, subtype: false, openingHours: false, geo: false, telephone: false, url: false, priceRange: false, organization: false })
    })

    it.each([
        ['missing evidence', null],
        ['incompatible evidence', { businessCategory: 'store', schemaSubtype: 'Restaurant' }],
        ['evidence mismatches emitted type', { businessCategory: 'foodEstablishment', schemaSubtype: 'Bakery' }],
    ])('[TC-F37-02-32/41] scores zero subtype points for %s', (_case, evidence) => {
        // Arrange
        const generated = generateSchemaGenerationArtifact(completeSite)
        const subtypeEvidence = evidence as unknown as SchemaGenerationArtifact['subtypeEvidence']

        // Act
        const result = calculateSchemaScore(artifactWith(generated.strictLocalBusiness, generated.organization, subtypeEvidence))

        // Assert
        expect(result.breakdown.localBusiness).toBe(10)
        expect(result.breakdown.subtype).toBe(0)
    })

    it('[TC-F37-02-46] excludes a weak Contact fallback outside the canonical artifact', () => {
        // Arrange
        const artifact = {
            strictLocalBusiness: null, organization: null, subtypeEvidence: null,
            weakContactFallback: { '@type': 'LocalBusiness', name: 'Legacy', address: { '@type': 'PostalAddress', streetAddress: 'Street', addressLocality: 'City', postalCode: '47300', addressCountry: 'MY' } },
        } as unknown as SchemaGenerationArtifact

        // Act
        const result = calculateSchemaScore(artifact)

        // Assert
        expect(result).toEqual({ score: 0, breakdown: zeroBreakdown })
    })
})

describe('[TC-F37-02-34/35/36/37/38/39/41] calculateSchemaScore — defensive child predicates', () => {
    it('[TC-F37-02-34] rejects invalid opening rows without suppressing the parent', () => {
        // Arrange
        const generated = generateSchemaGenerationArtifact(completeSite)
        const strict = { ...generated.strictLocalBusiness!, openingHoursSpecification: [
            { '@type': 'OpeningHoursSpecification', dayOfWeek: 'NotADay', opens: '09:00', closes: '18:00' },
            { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '18:00', closes: '09:00' },
        ] }

        // Act
        const result = calculateSchemaScore(artifactWith(strict))

        // Assert
        expect(result.breakdown.localBusiness).toBe(10)
        expect(result.breakdown.openingHours).toBe(0)
    })

    it.each([
        ['half coordinates', { latitude: 3.1201 }],
        ['NaN latitude', { latitude: Number.NaN, longitude: 101.6231 }],
        ['infinite longitude', { latitude: 3.1201, longitude: Number.POSITIVE_INFINITY }],
        ['out-of-range latitude', { latitude: 91, longitude: 101.6231 }],
        ['out-of-range longitude', { latitude: 3.1201, longitude: 181 }],
    ])('[TC-F37-02-35] rejects %s', (_case, geo) => {
        // Arrange
        const generated = generateSchemaGenerationArtifact(completeSite)
        const strict = { ...generated.strictLocalBusiness!, geo: { '@type': 'GeoCoordinates', ...geo } }

        // Act
        const result = calculateSchemaScore(artifactWith(strict))

        // Assert
        expect(result.breakdown.localBusiness).toBe(10)
        expect(result.breakdown.geo).toBe(0)
    })

    it.each([
        ['relative URL', '/relative'], ['credential-bearing URL', 'https://user:pass@example.com'],
        ['leading LF', '\nhttps://example.com'], ['trailing TAB', 'https://example.com\t'],
        ['malformed URL', 'not a URL'],
    ])('[TC-F37-02-37] rejects %s', (_case, url) => {
        // Arrange
        const generated = generateSchemaGenerationArtifact(completeSite)
        const strict = { ...generated.strictLocalBusiness!, url }

        // Act
        const result = calculateSchemaScore(artifactWith(strict))

        // Assert
        expect(result.breakdown.localBusiness).toBe(10)
        expect(result.breakdown.url).toBe(0)
    })

    it('[TC-F37-02-36/38] scores trimmed telephone and generated priceRange under the strict parent', () => {
        // Arrange
        const artifact = generateSchemaGenerationArtifact(completeSite)

        // Act
        const result = calculateSchemaScore(artifact)

        // Assert
        expect(artifact.strictLocalBusiness?.telephone).toBe('+60 12 345 6789')
        expect(artifact.strictLocalBusiness?.priceRange).toBe('$$')
        expect(result.breakdown.telephone).toBe(3)
        expect(result.breakdown.priceRange).toBe(3)
    })

    it('[TC-F37-02-39/41] rejects malformed Organization and ignores duplicate containers', () => {
        // Arrange
        const malformed = {
            strictLocalBusiness: null,
            organization: { '@type': 'Organization', name: 'Business', url: 'javascript:alert(1)' },
            subtypeEvidence: null,
            organizations: [{ '@type': 'Organization', name: 'Duplicate', url: 'https://duplicate.example' }],
        } as unknown as SchemaGenerationArtifact

        // Act
        const result = calculateSchemaScore(malformed)

        // Assert
        expect(result).toEqual({ score: 0, breakdown: zeroBreakdown })
    })
})

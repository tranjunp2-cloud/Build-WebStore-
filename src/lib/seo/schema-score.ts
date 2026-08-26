import { isCompatibleSchemaSubtype } from './local-business-constants'
import {
    hasValidGeoCoordinates,
    isLocalBusinessSchemaType,
    isValidOpeningTimeRange,
    normalizeHttpUrl,
} from './schema-helpers'
import type { SchemaGenerationArtifact } from './json-ld'

export type SchemaScoreInput = {
    localBusiness: boolean
    subtype: boolean
    openingHours: boolean
    geo: boolean
    telephone: boolean
    url: boolean
    priceRange: boolean
    organization: boolean
}

export type SchemaScoreBreakdown = {
    localBusiness: 0 | 10
    subtype: 0 | 4
    openingHours: 0 | 5
    geo: 0 | 4
    telephone: 0 | 3
    url: 0 | 3
    priceRange: 0 | 3
    organization: 0 | 3
}

export type SchemaScoreResult = {
    score: number
    breakdown: SchemaScoreBreakdown
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function hasCompletePostalAddress(value: unknown): boolean {
    if (!isRecord(value) || value['@type'] !== 'PostalAddress') return false
    return isNonEmptyString(value.streetAddress)
        && isNonEmptyString(value.addressLocality)
        && isNonEmptyString(value.postalCode)
        && isNonEmptyString(value.addressCountry)
}

function isStrictLocalBusiness(value: unknown): value is Record<string, unknown> {
    return isRecord(value)
        && isLocalBusinessSchemaType(value['@type'])
        && isNonEmptyString(value.name)
        && hasCompletePostalAddress(value.address)
}

const SCHEMA_DAY_OF_WEEK_VALUES = new Set([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
])

function hasValidOpeningHours(value: unknown): boolean {
    if (!Array.isArray(value)) return false
    return value.some(specification =>
        isRecord(specification)
        && specification['@type'] === 'OpeningHoursSpecification'
        && typeof specification.dayOfWeek === 'string'
        && SCHEMA_DAY_OF_WEEK_VALUES.has(specification.dayOfWeek)
        && isValidOpeningTimeRange(specification.opens, specification.closes),
    )
}

function hasValidGeo(value: unknown): boolean {
    return isRecord(value)
        && value['@type'] === 'GeoCoordinates'
        && hasValidGeoCoordinates(value.latitude, value.longitude)
}

function hasCanonicalUrl(value: unknown): value is string {
    return typeof value === 'string' && normalizeHttpUrl(value) === value
}

function isValidOrganization(value: unknown): boolean {
    return isRecord(value)
        && value['@type'] === 'Organization'
        && isNonEmptyString(value.name)
        && hasCanonicalUrl(value.url)
}

export function deriveSchemaScoreInput(
    artifact: SchemaGenerationArtifact | null | undefined,
): SchemaScoreInput {
    const safeArtifact = isRecord(artifact) ? artifact : null
    const localBusiness = isStrictLocalBusiness(safeArtifact?.strictLocalBusiness)
        ? safeArtifact.strictLocalBusiness
        : null
    const evidence = isRecord(safeArtifact?.subtypeEvidence)
        ? safeArtifact.subtypeEvidence
        : null
    const compatibleSubtype = localBusiness !== null
        && evidence !== null
        && isCompatibleSchemaSubtype(evidence.businessCategory, evidence.schemaSubtype)
        && localBusiness['@type'] === evidence.schemaSubtype

    return {
        localBusiness: localBusiness !== null,
        subtype: compatibleSubtype,
        openingHours: localBusiness !== null && hasValidOpeningHours(localBusiness.openingHoursSpecification),
        geo: localBusiness !== null && hasValidGeo(localBusiness.geo),
        telephone: localBusiness !== null && isNonEmptyString(localBusiness.telephone),
        url: localBusiness !== null && hasCanonicalUrl(localBusiness.url),
        priceRange: localBusiness !== null && isNonEmptyString(localBusiness.priceRange),
        organization: isValidOrganization(safeArtifact?.organization),
    }
}

export function calculateSchemaScore(
    artifact: SchemaGenerationArtifact | null | undefined,
): SchemaScoreResult {
    const input = deriveSchemaScoreInput(artifact)
    const breakdown: SchemaScoreBreakdown = {
        localBusiness: input.localBusiness ? 10 : 0,
        subtype: input.subtype ? 4 : 0,
        openingHours: input.openingHours ? 5 : 0,
        geo: input.geo ? 4 : 0,
        telephone: input.telephone ? 3 : 0,
        url: input.url ? 3 : 0,
        priceRange: input.priceRange ? 3 : 0,
        organization: input.organization ? 3 : 0,
    }
    const score = Object.values(breakdown).reduce<number>((total, points) => total + points, 0)
    return { score, breakdown }
}

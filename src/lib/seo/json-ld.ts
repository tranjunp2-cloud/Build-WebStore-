/**
 * JSON-LD Structured Data generators for SEO.
 * Auto-detected and injected by SiteRenderer based on blocks present.
 *
 * SECURITY: when embedding schema in a <script type="application/ld+json">, you
 * MUST serialize with `serializeJsonLd()` (below) — plain JSON.stringify does
 * NOT escape `</script>`, so tenant-controlled strings could break out and run
 * arbitrary JS (stored XSS). Never inject raw template literals either.
 */

import {
    dayOfWeekToSchema,
    hasCompleteStructuredAddress,
    hasValidGeoCoordinates,
    isValidOpeningTimeRange,
    normalizeHttpUrl,
    priceRangeForLocalBusinessCategory,
    schemaTypeForValidatedLocalBusiness,
} from './schema-helpers'
import { isCompatibleSchemaSubtype, type SchemaSubtype } from './local-business-constants'

/**
 * Serialize a JSON-LD object for safe embedding inside a
 * `<script type="application/ld+json">` via dangerouslySetInnerHTML.
 * Escapes `<` `>` `&` and U+2028/U+2029 so a `</script>` (or line separator) in
 * any tenant string can't terminate the script element early.
 */
export function serializeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

type BlockData = { blockType: string; [key: string]: unknown }

type PageSchemaInput = {
    blocks: unknown
    site: Record<string, unknown>
    page: Record<string, unknown>
    isHomepage: boolean
}

// F37 US-01: shape of Sites.localBusiness (Phase 01 schema) as returned by Payload.
export type LocalBusinessOpeningHour = { dayOfWeek?: string; opens?: string; closes?: string; isClosed?: boolean }
export type LocalBusinessSiteData = {
    streetAddress?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    latitude?: number
    longitude?: number
    businessCategory?: string
    schemaSubtype?: string
    priceRange?: string
    serviceAreaDescription?: string
    openingHours?: LocalBusinessOpeningHour[]
}

export type JsonLdNode = Record<string, unknown>

export type ValidatedSubtypeEvidence = {
    businessCategory: string
    schemaSubtype: SchemaSubtype
}

export type SchemaGenerationArtifact = Readonly<{
    strictLocalBusiness: JsonLdNode | null
    organization: JsonLdNode | null
    subtypeEvidence: ValidatedSubtypeEvidence | null
}>

function generateSafely(label: string, generator: () => JsonLdNode | null): JsonLdNode | null {
    try { return generator() } catch { console.error(`[json-ld] ${label} generation failed`); return null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}
function getHttpUrlValues(record: Record<string, unknown> | null): string[] {
    return record
        ? Object.values(record)
            .map(normalizeHttpUrl)
            .filter((value): value is string => Boolean(value))
        : []
}


function getOptionalString(value: unknown): string | undefined {
    return isNonEmptyString(value) ? value.trim() : undefined
}

function isBlockData(value: unknown): value is BlockData {
    return isRecord(value) && typeof value.blockType === 'string'
}

function getOpeningHoursSpecifications(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return []

    const rows: unknown[] = value
    return rows.flatMap(row => {
        if (!isRecord(row) || row.isClosed === true) return []
        if (!isValidOpeningTimeRange(row.opens, row.closes)) return []

        const dayOfWeek = typeof row.dayOfWeek === 'string'
            ? dayOfWeekToSchema(row.dayOfWeek)
            : null
        if (!dayOfWeek) return []

        return [{
            '@type': 'OpeningHoursSpecification',
            dayOfWeek,
            opens: row.opens,
            closes: row.closes,
        }]
    })
}

/** True when `site.localBusiness` has enough data to be worth emitting on its
 *  own (independent of any Contact block) — used to loosen the homepage
 *  LocalBusiness trigger (FR-04 AC-1). */
export function hasMeaningfulLocalBusinessData(localBusiness: LocalBusinessSiteData | undefined): boolean {
    if (!localBusiness) return false
    if (isNonEmptyString(localBusiness.streetAddress)) return true
    return getOpeningHoursSpecifications(localBusiness.openingHours).length > 0
}

// ── Schema Generators ──────────────────────────────────────────────────────

export function generateOrganizationSchema(site: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!site) return null
    const name = getOptionalString(site.name)
    if (!name) return null
    const url = normalizeHttpUrl(site.domain)
    const branding = isRecord(site.branding) ? site.branding : null
    const contactInfo = isRecord(site.contactInfo) ? site.contactInfo : null
    const socialLinks = isRecord(site.socialLinks) ? site.socialLinks : null
    const logo = normalizeHttpUrl(branding?.logo)
    const telephone = getOptionalString(contactInfo?.phone)
    const email = getOptionalString(contactInfo?.email)

    const sameAs = getHttpUrlValues(socialLinks)

    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        ...(url && { url }),
        ...(logo && { logo }),
        ...(sameAs.length > 0 && { sameAs }),
        ...(telephone && { telephone }),
        ...(email && { email }),
    }
}

export function generateWebSiteSchema(site: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!site) return null
    const name = getOptionalString(site.name) || 'Business Name'
    const url = normalizeHttpUrl(site.domain)

    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name,
        ...(url && { url }),
    }
}

export function generateBreadcrumbSchema(
    pages: Array<{ name?: string; slug?: string }> | null | undefined,
    currentPage: Record<string, unknown> | null | undefined,
    siteUrl?: string,
): Record<string, unknown> | null {
    if (!currentPage) return null

    const baseUrl = getOptionalString(siteUrl) || ''
    const items: Record<string, unknown>[] = [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: baseUrl || '/',
        },
    ]

    const pageName = getOptionalString(currentPage.name) || getOptionalString(currentPage.slug) || ''
    const pageSlug = getOptionalString(currentPage.slug) || ''
    // GH-2100: homepage slug may be '/' (encoded '/%2F') — treat '', '/', 'home' as the root
    const isRootSlug = pageSlug === '' || pageSlug === 'home' || /^\/+$/.test(pageSlug)
    if (pageName && !isRootSlug) {
        // Encode per segment so nested slugs keep their '/' separators
        const path = pageSlug.split('/').filter(Boolean).map(encodeURIComponent).join('/')
        items.push({
            '@type': 'ListItem',
            position: 2,
            name: pageName,
            item: `${baseUrl}/${path}`,
        })
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    }
}

export function generateFAQSchema(faqBlocks: unknown): Record<string, unknown> | null {
    if (!Array.isArray(faqBlocks)) return null

    const allItems: Record<string, unknown>[] = []
    const seenQuestions = new Set<string>()
    const blocks: unknown[] = faqBlocks

    for (const block of blocks) {
        if (!isRecord(block) || !Array.isArray(block.items)) continue
        const items: unknown[] = block.items
        for (const item of items) {
            if (!isRecord(item)) continue
            const question = typeof item.question === 'string' ? item.question : ''
            if (!question) continue
            if (seenQuestions.has(question)) continue

            seenQuestions.add(question)
            allItems.push({
                '@type': 'Question',
                name: question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: typeof item.answer === 'string' ? item.answer : '',
                },
            })
        }
    }

    if (!allItems.length) return null

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: allItems,
    }
}

export function generateLocalBusinessSchema(
    contactBlock: BlockData | null | undefined,
    site: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!contactBlock && !site) return null

    const name = getOptionalString(site?.name) || 'Business'
    const url = normalizeHttpUrl(site?.domain)
    const contactInfo = isRecord(site?.contactInfo) ? site.contactInfo : null
    const socialLinks = isRecord(site?.socialLinks) ? site.socialLinks : null
    const localBusiness = isRecord(site?.localBusiness) ? site.localBusiness : null

    const phone = getOptionalString(contactBlock?.phone)
        || getOptionalString(contactInfo?.phone)
        || ''
    const email = getOptionalString(contactBlock?.email)
        || getOptionalString(contactInfo?.email)
        || ''

    const streetAddress = getOptionalString(contactInfo?.address)
        || getOptionalString(localBusiness?.streetAddress)
        || getOptionalString(contactBlock?.address)
    const city = getOptionalString(localBusiness?.city)
    const state = getOptionalString(localBusiness?.state)
    const postcode = getOptionalString(localBusiness?.postcode)
    const country = 'MY'

    let address: Record<string, unknown> | undefined
    if (streetAddress) {
        address = {
            '@type': 'PostalAddress',
            streetAddress,
            ...(city && { addressLocality: city }),
            ...(state && { addressRegion: state }),
            ...(postcode && { postalCode: postcode }),
            ...(country && { addressCountry: country }),
        }
    }

    const sameAs = getHttpUrlValues(socialLinks)

    const lat = localBusiness?.latitude
    const lng = localBusiness?.longitude
    const hasValidCoords = hasValidGeoCoordinates(lat, lng)
    const geo = hasValidCoords ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } : undefined
    const hasMap = hasValidCoords ? `https://www.google.com/maps?q=${lat},${lng}` : undefined

    const openingHoursSpecification = getOpeningHoursSpecifications(localBusiness?.openingHours)
    const businessCategory = getOptionalString(localBusiness?.businessCategory)
    const schemaSubtype = getOptionalString(localBusiness?.schemaSubtype)
    const priceRange = getOptionalString(localBusiness?.priceRange)
        || priceRangeForLocalBusinessCategory(businessCategory)
    const areaServed = getOptionalString(localBusiness?.serviceAreaDescription)

    return {
        '@context': 'https://schema.org',
        '@type': schemaTypeForValidatedLocalBusiness(businessCategory, schemaSubtype),
        name,
        ...(url && { url }),
        ...(address && { address }),
        ...(phone && { telephone: phone }),
        ...(email && { email }),
        ...(sameAs.length > 0 && { sameAs }),
        ...(geo && { geo }),
        ...(hasMap && { hasMap }),
        ...(openingHoursSpecification.length > 0 && { openingHoursSpecification }),
        ...(priceRange && { priceRange }),
        ...(areaServed && { areaServed }),
        // FORBIDDEN (FR-06, Google policy 2025-26): never emit aggregateRating
        // at the LocalBusiness level. Do not add it here.
    }
}

/** Emit the strict F37 v2 LocalBusiness node only when its identity contract
 *  is complete. The legacy generator remains available for Contact blocks. */
export function generateV2LocalBusinessSchema(
    site: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!site || !isNonEmptyString(site.name)) return null

    const localBusiness = isRecord(site.localBusiness)
        ? site.localBusiness
        : null
    const contactInfo = isRecord(site.contactInfo) ? site.contactInfo : null
    const normalizedAddress = {
        ...localBusiness,
        streetAddress: getOptionalString(contactInfo?.address)
            || getOptionalString(localBusiness?.streetAddress),
        country: 'MY',
    }
    if (!hasCompleteStructuredAddress(normalizedAddress)) return null

    return generateLocalBusinessSchema(null, site)
}

export function generateSchemaGenerationArtifact(
    site: Record<string, unknown> | null | undefined,
): SchemaGenerationArtifact {
    const strictLocalBusiness = generateSafely('LocalBusiness', () => generateV2LocalBusinessSchema(site))
    const organization = generateSafely('Organization', () => generateOrganizationSchema(site))
    const localBusiness = isRecord(site?.localBusiness) ? site.localBusiness : null
    const businessCategory = getOptionalString(localBusiness?.businessCategory)
    const schemaSubtype = getOptionalString(localBusiness?.schemaSubtype)
    const subtypeEvidence = strictLocalBusiness && businessCategory
        && isCompatibleSchemaSubtype(businessCategory, schemaSubtype)
        ? { businessCategory, schemaSubtype }
        : null

    return Object.freeze({ strictLocalBusiness, organization, subtypeEvidence })
}

export function generateWebPageSchema(
    page: Record<string, unknown> | null | undefined,
    site: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!page) return null

    const seo = isRecord(page.seo) ? page.seo : null
    const name = getOptionalString(seo?.title) || getOptionalString(page.name) || ''
    const description = getOptionalString(seo?.description) || ''
    const siteUrl = normalizeHttpUrl(site?.domain)
    const slug = getOptionalString(page.slug) || ''
    const url = siteUrl
        ? (slug === 'home' ? siteUrl : siteUrl + '/' + slug)
        : undefined
    const siteName = getOptionalString(site?.name) || ''

    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        ...(name && { name }),
        ...(description && { description }),
        ...(url && { url }),
        ...(siteName && { isPartOf: { '@type': 'WebSite', name: siteName } }),
    }
}

// ── Page Schema Aggregator ─────────────────────────────────────────────────
// Called by SiteRenderer — auto-detects blocks and generates relevant schemas

export function generatePageSchemas({ blocks, site, page, isHomepage }: PageSchemaInput): Record<string, unknown>[] {
    const schemas: Record<string, unknown>[] = []
    const artifact = isHomepage ? generateSchemaGenerationArtifact(site) : null

    try {
        // BreadcrumbList — non-homepage pages (a homepage trail is just "Home", GH-2100)
        const safeBlocks = Array.isArray(blocks)
            ? (blocks as unknown[]).filter(isBlockData)
            : []

        const siteDomain = getOptionalString(site?.domain)
        if (!isHomepage) {
            const breadcrumb = generateSafely('Breadcrumb', () => generateBreadcrumbSchema(null, page, normalizeHttpUrl(siteDomain) || ''))
            if (breadcrumb) schemas.push(breadcrumb)
        }

        // Organization + WebSite — homepage only
        if (isHomepage) {
            const organization = artifact?.organization
            if (organization) schemas.push(organization)
            const ws = generateSafely('WebSite', () => generateWebSiteSchema(site))
            if (ws) schemas.push(ws)
        }

        // WebPage — non-homepage pages
        if (!isHomepage) {
            const wp = generateSafely('WebPage', () => generateWebPageSchema(page, site))
            if (wp) schemas.push(wp)
        }

        // FAQPage — if any FAQ blocks present (merged into single schema)
        const faqBlocks = safeBlocks.filter(b => b.blockType === 'faq')
        if (faqBlocks.length > 0) {
            const faq = generateSafely('FAQPage', () => generateFAQSchema(faqBlocks))
            if (faq) schemas.push(faq)
        }

        // Homepage prefers the strict v2 node. Contact blocks retain legacy
        // rendering only when the strict contract is unavailable.
        const contactBlock = safeBlocks.find(b => b.blockType === 'contact')
        const localBusiness = artifact?.strictLocalBusiness ?? null
        const localBusinessFallback = localBusiness
            || (contactBlock ? generateSafely('legacy LocalBusiness', () => generateLocalBusinessSchema(contactBlock, site)) : null)
        if (localBusinessFallback) schemas.push(localBusinessFallback)
    } catch {
        console.error('[json-ld] Schema generation failed')
    }

    return schemas
}

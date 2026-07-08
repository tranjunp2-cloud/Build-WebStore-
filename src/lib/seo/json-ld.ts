/**
 * JSON-LD Structured Data generators for SEO.
 * Auto-detected and injected by SiteRenderer based on blocks present.
 *
 * SECURITY: when embedding schema in a <script type="application/ld+json">, you
 * MUST serialize with `serializeJsonLd()` (below) — plain JSON.stringify does
 * NOT escape `</script>`, so tenant-controlled strings could break out and run
 * arbitrary JS (stored XSS). Never inject raw template literals either.
 */

import { schemaTypeForLocalBusiness, priceRangeForLocalBusinessCategory, dayOfWeekToSchema } from './schema-helpers'

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
    blocks: BlockData[]
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
    priceRange?: string
    serviceAreaDescription?: string
    openingHours?: LocalBusinessOpeningHour[]
}

/** True when `site.localBusiness` has enough data to be worth emitting on its
 *  own (independent of any Contact block) — used to loosen the homepage
 *  LocalBusiness trigger (FR-04 AC-1). */
export function hasMeaningfulLocalBusinessData(localBusiness: LocalBusinessSiteData | undefined): boolean {
    if (!localBusiness) return false
    if (localBusiness.streetAddress) return true
    return (localBusiness.openingHours || []).some(h => !h.isClosed && h.opens && h.closes)
}

// ── Schema Generators ──────────────────────────────────────────────────────

export function generateOrganizationSchema(site: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!site) return null
    const name = (site.name as string) || 'Business Name'
    const url = (site.domain as string) ? `https://${site.domain}` : ''
    const branding = site.branding as { logo?: string } | undefined
    const contactInfo = site.contactInfo as { phone?: string; email?: string } | undefined
    const socialLinks = site.socialLinks as Record<string, string | null | undefined> | undefined

    const sameAs = socialLinks
        ? Object.values(socialLinks).filter((v): v is string => Boolean(v))
        : []

    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        ...(url && { url }),
        ...(branding?.logo ? { logo: branding.logo } : {}),
        ...(sameAs.length > 0 && { sameAs }),
        ...(contactInfo?.phone && { telephone: contactInfo.phone }),
        ...(contactInfo?.email && { email: contactInfo.email }),
    }
}

export function generateWebSiteSchema(site: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!site) return null
    const name = (site.name as string) || 'Business Name'
    const url = (site.domain as string) ? `https://${site.domain}` : ''

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

    const baseUrl = siteUrl || ''
    const items: Record<string, unknown>[] = [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: baseUrl || '/',
        },
    ]

    const pageName = (currentPage.name as string) || (currentPage.slug as string) || ''
    const pageSlug = (currentPage.slug as string) || ''
    if (pageName && pageSlug !== 'home') {
        items.push({
            '@type': 'ListItem',
            position: 2,
            name: pageName,
            item: `${baseUrl}/${encodeURIComponent(pageSlug)}`,
        })
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
    }
}

export function generateFAQSchema(faqBlocks: BlockData[]): Record<string, unknown> | null {
    if (!faqBlocks.length) return null

    // Merge FAQ items from all FAQ blocks into single schema (Scenario #28)
    const allItems: Record<string, unknown>[] = []
    const seenQuestions = new Set<string>()

    for (const block of faqBlocks) {
        const items = (block.items as Array<{ question?: string; answer?: string }>) || []
        for (const item of items) {
            const q = item.question || ''
            if (q && !seenQuestions.has(q)) {
                seenQuestions.add(q)
                allItems.push({
                    '@type': 'Question',
                    name: q,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        // JSON.stringify in SiteRenderer handles XSS escaping
                        text: item.answer || '',
                    },
                })
            }
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

    const name = (site?.name as string) || 'Business'
    const domain = site?.domain as string | undefined
    const url = domain ? `https://${domain}` : ''
    const contactInfo = site?.contactInfo as { phone?: string; email?: string; address?: string } | undefined
    const socialLinks = site?.socialLinks as Record<string, string | null | undefined> | undefined
    const localBusiness = site?.localBusiness as LocalBusinessSiteData | undefined

    const phone = (contactBlock?.phone as string) || contactInfo?.phone || ''
    const email = (contactBlock?.email as string) || contactInfo?.email || ''

    // BR-02: structured localBusiness address is the source of truth once the
    // seller has entered one; legacy free-text (contactBlock/contactInfo) is
    // only used as a fallback when the structured group is still empty.
    let address: Record<string, unknown> | undefined
    if (localBusiness?.streetAddress) {
        address = {
            '@type': 'PostalAddress',
            streetAddress: localBusiness.streetAddress,
            ...(localBusiness.city && { addressLocality: localBusiness.city }),
            ...(localBusiness.state && { addressRegion: localBusiness.state }),
            ...(localBusiness.postcode && { postalCode: localBusiness.postcode }),
            ...(localBusiness.country && { addressCountry: localBusiness.country }),
        }
    } else {
        const legacyAddress = (contactBlock?.address as string) || contactInfo?.address || ''
        if (legacyAddress) address = { '@type': 'PostalAddress', streetAddress: legacyAddress }
    }

    const sameAs = socialLinks
        ? Object.values(socialLinks).filter((v): v is string => Boolean(v))
        : []

    // geo — GeoCoordinates only when both lat+lng are present, finite numbers.
    const { latitude: lat, longitude: lng } = localBusiness || {}
    const geo = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
        ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
        : undefined

    // openingHoursSpecification — drop closed days and incomplete rows (AC-2).
    const openingHoursSpecification = (localBusiness?.openingHours || [])
        .filter(row => !row.isClosed && row.opens && row.closes)
        .map(row => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: dayOfWeekToSchema(row.dayOfWeek), opens: row.opens, closes: row.closes }))
        .filter((spec): spec is { '@type': string; dayOfWeek: string; opens: string; closes: string } => spec.dayOfWeek !== null)

    const priceRange = localBusiness?.priceRange || priceRangeForLocalBusinessCategory(localBusiness?.businessCategory)
    const areaServed = localBusiness?.serviceAreaDescription || undefined

    return {
        '@context': 'https://schema.org',
        '@type': schemaTypeForLocalBusiness(localBusiness?.businessCategory),
        name,
        ...(url && { url }),
        ...(address && { address }),
        ...(phone && { telephone: phone }),
        ...(email && { email }),
        ...(sameAs.length > 0 && { sameAs }),
        ...(geo && { geo }),
        ...(openingHoursSpecification.length > 0 && { openingHoursSpecification }),
        ...(priceRange && { priceRange }),
        ...(areaServed && { areaServed }),
        // FORBIDDEN (FR-06, Google policy 2025-26): never emit aggregateRating
        // at the LocalBusiness level. Do not add it here.
    }
}

export function generateWebPageSchema(
    page: Record<string, unknown> | null | undefined,
    site: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
    if (!page) return null

    const seo = page.seo as { title?: string; description?: string } | undefined
    const name = seo?.title || (page.name as string) || ''
    const description = seo?.description || ''
    const siteDomain = site?.domain as string | undefined
    const siteUrl = siteDomain ? `https://${siteDomain}` : ''
    const slug = (page.slug as string) || ''
    const url = slug === 'home' ? siteUrl : `${siteUrl}/${slug}`
    const siteName = (site?.name as string) || ''

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

    try {
        // BreadcrumbList — every page
        const breadcrumb = generateBreadcrumbSchema(null, page, (site?.domain as string) ? `https://${site.domain}` : '')
        if (breadcrumb) schemas.push(breadcrumb)

        // Organization + WebSite — homepage only
        if (isHomepage) {
            const org = generateOrganizationSchema(site)
            if (org) schemas.push(org)
            const ws = generateWebSiteSchema(site)
            if (ws) schemas.push(ws)
        }

        // WebPage — non-homepage pages
        if (!isHomepage) {
            const wp = generateWebPageSchema(page, site)
            if (wp) schemas.push(wp)
        }

        // FAQPage — if any FAQ blocks present (merged into single schema)
        const faqBlocks = blocks.filter(b => b.blockType === 'faq')
        if (faqBlocks.length > 0) {
            const faq = generateFAQSchema(faqBlocks)
            if (faq) schemas.push(faq)
        }

        // LocalBusiness — Contact block present, OR homepage with meaningful
        // structured localBusiness data (FR-04 AC-1). Build once, push once —
        // no double injection when both conditions are true simultaneously.
        const contactBlock = blocks.find(b => b.blockType === 'contact')
        const localBusiness = site?.localBusiness as LocalBusinessSiteData | undefined
        if (contactBlock || (isHomepage && hasMeaningfulLocalBusinessData(localBusiness))) {
            const lb = generateLocalBusinessSchema(contactBlock, site)
            if (lb) schemas.push(lb)
        }
    } catch {
        // Schema generation should never crash the page
    }

    return schemas
}

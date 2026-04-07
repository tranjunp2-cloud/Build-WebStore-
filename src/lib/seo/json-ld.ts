/**
 * JSON-LD Structured Data generators for SEO.
 * Auto-detected and injected by SiteRenderer based on blocks present.
 *
 * SECURITY: All output uses JSON.stringify() — safe against XSS.
 * Never use dangerouslySetInnerHTML with raw template literals for schema content.
 */

type BlockData = { blockType: string; [key: string]: unknown }

type PageSchemaInput = {
    blocks: BlockData[]
    site: Record<string, unknown>
    page: Record<string, unknown>
    isHomepage: boolean
}

// ── Schema Generators ──────────────────────────────────────────────────────

export function generateOrganizationSchema(site: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!site) return null
    const name = (site.name as string) || 'Business Name'
    const url = (site.domain as string) ? `https://${site.domain}` : ''

    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        ...(url && { url }),
        ...(site.logo ? { logo: site.logo } : {}),
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
    const address = (contactBlock?.address as string) || (site?.address as string) || ''
    const phone = (contactBlock?.phone as string) || (site?.phone as string) || ''
    const email = (contactBlock?.email as string) || (site?.email as string) || ''

    return {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name,
        ...(address && { address }),
        ...(phone && { telephone: phone }),
        ...(email && { email }),
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

        // FAQPage — if any FAQ blocks present (merged into single schema)
        const faqBlocks = blocks.filter(b => b.blockType === 'faq')
        if (faqBlocks.length > 0) {
            const faq = generateFAQSchema(faqBlocks)
            if (faq) schemas.push(faq)
        }

        // LocalBusiness — if Contact block present
        const contactBlock = blocks.find(b => b.blockType === 'contact')
        if (contactBlock) {
            const lb = generateLocalBusinessSchema(contactBlock, site)
            if (lb) schemas.push(lb)
        }
    } catch {
        // Schema generation should never crash the page
    }

    return schemas
}

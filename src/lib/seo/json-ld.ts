/**
 * JSON-LD Structured Data generators for SEO.
 * Auto-detected and injected by SiteRenderer based on blocks present.
 *
 * SECURITY: when embedding schema in a <script type="application/ld+json">, you
 * MUST serialize with `serializeJsonLd()` (below) — plain JSON.stringify does
 * NOT escape `</script>`, so tenant-controlled strings could break out and run
 * arbitrary JS (stored XSS). Never inject raw template literals either.
 */

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

    const address = (contactBlock?.address as string) || contactInfo?.address || ''
    const phone = (contactBlock?.phone as string) || contactInfo?.phone || ''
    const email = (contactBlock?.email as string) || contactInfo?.email || ''

    const sameAs = socialLinks
        ? Object.values(socialLinks).filter((v): v is string => Boolean(v))
        : []

    return {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name,
        ...(url && { url }),
        ...(address && { address: { '@type': 'PostalAddress', streetAddress: address } }),
        ...(phone && { telephone: phone }),
        ...(email && { email }),
        ...(sameAs.length > 0 && { sameAs }),
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

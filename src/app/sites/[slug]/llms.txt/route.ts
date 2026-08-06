import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { encodePublicSlugPath, encodePublicSlugSegment, hasActiveCustomDomain, resolveStorefrontOrigin, type TenantLike } from '@/lib/seo/canonical'
import {
    canSerializePublicLlmsTxt,
    PUBLIC_DISCOVERY_SITE_LIMIT,
    PUBLIC_DISCOVERY_SITE_SORT,
    PUBLIC_STOREFRONT_STATUS,
    publicDiscoverySiteWhere,
} from '@/lib/seo/public-discovery-facts'
import { dayOfWeekToSchema } from '@/lib/seo/schema-helpers'

function markdownInline(value: unknown): string {
    if (typeof value !== 'string') return ''
    const collapsed = value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim()
    return collapsed.replace(/([\\`*_[\]{}()<>#!|])/g, '\\$1')
}

const MAX_KEY_URLS = 10

function selectKeyUrls(baseUrl: string, candidateGroups: string[][]): string[] {
    const selected: string[] = []
    const seen = new Set<string>()
    const indexes = candidateGroups.map(() => 0)

    const add = (url: string): boolean => {
        if (!url || seen.has(url) || selected.length >= MAX_KEY_URLS) return false
        seen.add(url)
        selected.push(url)
        return true
    }

    add(baseUrl)
    while (selected.length < MAX_KEY_URLS) {
        let addedInRound = false
        for (let groupIndex = 0; groupIndex < candidateGroups.length; groupIndex++) {
            const group = candidateGroups[groupIndex]
            while (indexes[groupIndex] < group.length) {
                const candidate = group[indexes[groupIndex]++]
                if (add(candidate)) {
                    addedInRound = true
                    break
                }
            }
            if (selected.length >= MAX_KEY_URLS) break
        }
        if (!addedInRound) break
    }

    return selected
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params
        const payload = await getPayload({ config })

        let tenant;
        let hostname = '';

        if (slug === 'custom') {
            hostname = _req.headers.get('x-tenant-hostname') || ''
            if (!hostname) return new Response('Not found', { status: 404 })
            const tenantsResult = await payload.find({
                collection: 'tenants',
                where: { 'customDomains.domain': { equals: hostname } },
                limit: 1,
            })
            tenant = tenantsResult.docs[0]
            if (!hasActiveCustomDomain(tenant, hostname)) {
                return new Response('Not found', { status: 404 })
            }
        } else {
            const tenantsResult = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: slug } },
                limit: 1,
            })
            tenant = tenantsResult.docs[0]
        }

        if (!tenant) {
            return new Response('Not found', { status: 404 })
        }

        const siteResults = await payload.find({
            collection: 'sites',
            where: publicDiscoverySiteWhere(tenant.id),
            // Deterministic tie-break for tenants with 2+ published sites (schema
            // allows it, no unique constraint) — oldest site wins consistently
            // rather than an arbitrary DB-order pick. Real fix (domain-based
            // per-site resolution) tracked in OPEN_BLOCKERS.
            sort: PUBLIC_DISCOVERY_SITE_SORT,
            limit: PUBLIC_DISCOVERY_SITE_LIMIT,
        })
        const [site] = siteResults.docs
        if (!site) {
            return new Response('Not found', { status: 404 })
        }

        const [pagesResult, productsResult, blogsResult] = await Promise.all([
            payload.find({
                collection: 'pages',
                where: {
                    and: [
                        { site: { equals: site.id } },
                        { _status: { equals: 'published' } },
                        { 'seo.noIndex': { not_equals: true } },
                        { isVisible: { not_equals: false } },
                        { deletedAt: { exists: false } },
                    ],
                },
                pagination: false,
                depth: 0,
                sort: ['createdAt', 'id'],
                select: { slug: true, isHomepage: true },
            }),
            payload.find({
                collection: 'products',
                where: {
                    and: [
                        { site: { equals: site.id } },
                        { status: { equals: 'active' } },
                        { deletedAt: { exists: false } },
                    ],
                },
                pagination: false,
                depth: 0,
                sort: ['createdAt', 'id'],
                select: { slug: true },
            }),
            payload.find({
                collection: 'blogs',
                where: {
                    and: [
                        { site: { equals: site.id } },
                        { status: { equals: PUBLIC_STOREFRONT_STATUS } },
                    ],
                },
                pagination: false,
                depth: 0,
                sort: ['createdAt', 'id'],
                select: { slug: true },
            }),
        ])

        if (!canSerializePublicLlmsTxt({
            pages: pagesResult.docs,
            products: productsResult.docs,
            blogs: blogsResult.docs,
            openingHours: site.localBusiness?.openingHours,
        })) {
            throw new Error('llms.txt document cannot be serialized')
        }

        // Payload Local API uses a generic JsonObject here even though the queried collection is tenants.
        const canonicalTenant = tenant as unknown as TenantLike
        const baseUrl = resolveStorefrontOrigin(canonicalTenant, { fallbackHostname: slug === 'custom' ? hostname : null, slug })

        // Start with the storefront home and add only content proven public by
        // the scoped queries above. Never advertise checkout or private order
        // lookup routes merely to reach an arbitrary URL count.
        const pageUrls = pagesResult.docs
            .filter(p => !(p.isHomepage || p.slug === '/' || p.slug === 'home' || !p.slug))
            .flatMap(p => {
                const slugPath = encodePublicSlugPath(p.slug)
                return slugPath ? [`${baseUrl}/${slugPath}`] : []
            })

        const productUrls = productsResult.docs
            .flatMap(p => {
                const slugPath = encodePublicSlugSegment(p.slug)
                return slugPath ? [`${baseUrl}/products/${slugPath}`] : []
            })

        const blogUrls = blogsResult.docs
            .flatMap(b => {
                const slugPath = encodePublicSlugSegment(b.slug)
                return slugPath ? [`${baseUrl}/blog/${slugPath}`] : []
            })

        // Keep this supplementary document bounded and deterministic. Round-robin
        // selection prevents pages or products from starving later content types
        // while retaining the oldest-first order within each candidate group.
        const keyUrls = selectKeyUrls(baseUrl, [pageUrls, productUrls, blogUrls])

        // F37-03 → #1312 score handoff: this published-only 200 response is
        // `llmsTxtReachable=true` (1 point). Failure here must not affect the
        // independent crawler-policy or sitemap facts.

        const siteName = markdownInline(site.name) || 'Storefront'
        const description = markdownInline(site.seo?.metaDescription) || `${siteName} — cửa hàng trực tuyến`

        const contactLines: string[] = []
        const phone = markdownInline(site.contactInfo?.phone)
        const email = markdownInline(site.contactInfo?.email)
        const address = markdownInline(site.contactInfo?.address)
        if (phone) contactLines.push(`- Phone: ${phone}`)
        if (email) contactLines.push(`- Email: ${email}`)
        if (address) contactLines.push(`- Address: ${address}`)

        // Opening hours: from US-F37-01's site.localBusiness.openingHours (Mo/Tu/../Su codes).
        const openingHoursLines = ((site.localBusiness?.openingHours || []) as Array<{
            dayOfWeek?: string
            opens?: string
            closes?: string
            isClosed?: boolean
        }>)
            .filter(h => h.dayOfWeek)
            .map(h => {
                const day = markdownInline(dayOfWeekToSchema(h.dayOfWeek) || h.dayOfWeek)
                if (h.isClosed) return `- ${day}: Closed`
                const opens = markdownInline(h.opens)
                const closes = markdownInline(h.closes)
                if (opens && closes) return `- ${day}: ${opens}–${closes}`
                return null
            })
            .filter((line): line is string => line !== null)

        const lines = [
            `# ${siteName}`,
            '',
            `> ${description}`,
            '',
            '## Key Pages',
            ...keyUrls.map(url => `- ${url}`),
        ]

        if (contactLines.length > 0) {
            lines.push('', '## Contact', ...contactLines)
        }

        if (openingHoursLines.length > 0) {
            lines.push('', '## Opening Hours', ...openingHoursLines)
        }

        lines.push(
            '',
            '<!-- llms.txt is an experimental, emerging standard — treat as a minor supplementary signal, not a primary discoverability channel. -->',
        )

        const body = lines.join('\n')

        return new Response(body, {
            headers: {
                // charset=utf-8 required: body can contain non-ASCII (Vietnamese fallback
                // description, en-dash in opening hours) — without it browsers guess the
                // encoding and mangle those bytes (e.g. "–" renders as "â€"").
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('[LLMs.txt Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

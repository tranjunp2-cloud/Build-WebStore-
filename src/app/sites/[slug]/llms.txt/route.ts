import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { resolveStorefrontOrigin } from '@/lib/seo/canonical'
import { dayOfWeekToSchema } from '@/lib/seo/schema-helpers'

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
            where: {
                and: [
                    { tenant: { equals: tenant.id } },
                    { status: { equals: 'published' } },
                ],
            },
            // Deterministic tie-break for tenants with 2+ published sites (schema
            // allows it, no unique constraint) — oldest site wins consistently
            // rather than an arbitrary DB-order pick. Real fix (domain-based
            // per-site resolution) tracked in OPEN_BLOCKERS.
            sort: 'createdAt',
            limit: 1,
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
                limit: 10,
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
                limit: 10,
            }),
            payload.find({
                collection: 'blogs',
                where: {
                    and: [
                        { site: { equals: site.id } },
                        { status: { equals: 'published' } },
                    ],
                },
                pagination: false,
                depth: 0,
                limit: 5,
            }),
        ])

        const baseUrl = resolveStorefrontOrigin(tenant as any, { fallbackHostname: slug === 'custom' ? hostname : null, slug })

        // ≥5 key URLs (AC-6): these 5 static storefront routes always exist regardless
        // of published-content count, guaranteeing the floor even for brand-new sites.
        const coreUrls = [baseUrl, `${baseUrl}/products`, `${baseUrl}/blogs`, `${baseUrl}/checkout`, `${baseUrl}/orders`]

        const pageUrls = pagesResult.docs
            .filter(p => !(p.isHomepage || p.slug === '/' || p.slug === 'home' || !p.slug))
            .map(p => `${baseUrl}/${(p.slug as string).replace(/^\//, '')}`)

        const productUrls = productsResult.docs
            .filter(p => typeof p.slug === 'string' && p.slug)
            .map(p => `${baseUrl}/products/${(p.slug as string).replace(/^\//, '')}`)

        const blogUrls = blogsResult.docs
            .filter(b => typeof b.slug === 'string' && b.slug)
            .map(b => `${baseUrl}/blog/${(b.slug as string).replace(/^\//, '')}`)

        const keyUrls = Array.from(new Set([...coreUrls, ...pageUrls, ...productUrls, ...blogUrls])).slice(0, 10)

        const description = site.seo?.metaDescription?.trim() || `${site.name} — cửa hàng trực tuyến`

        const contactLines: string[] = []
        if (site.contactInfo?.phone) contactLines.push(`- Phone: ${site.contactInfo.phone}`)
        if (site.contactInfo?.email) contactLines.push(`- Email: ${site.contactInfo.email}`)
        if (site.contactInfo?.address) contactLines.push(`- Address: ${site.contactInfo.address}`)

        // Opening hours: from US-F37-01's site.localBusiness.openingHours (Mo/Tu/../Su codes).
        const openingHoursLines = ((site.localBusiness?.openingHours || []) as Array<{
            dayOfWeek?: string
            opens?: string
            closes?: string
            isClosed?: boolean
        }>)
            .filter(h => h.dayOfWeek)
            .map(h => {
                const day = dayOfWeekToSchema(h.dayOfWeek) || h.dayOfWeek
                if (h.isClosed) return `- ${day}: Closed`
                if (h.opens && h.closes) return `- ${day}: ${h.opens}–${h.closes}`
                return null
            })
            .filter((line): line is string => line !== null)

        const lines = [
            `# ${site.name}`,
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
                'Cache-Control': 'public, max-age=300, s-maxage=300',
            },
        })
    } catch (error) {
        console.error('[LLMs.txt Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

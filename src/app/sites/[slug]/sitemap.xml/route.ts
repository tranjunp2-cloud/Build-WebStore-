import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { encodePublicSlugPath, encodePublicSlugSegment, hasActiveCustomDomain, resolveStorefrontOrigin } from '@/lib/seo/canonical'

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
            where: {
                and: [
                    { tenant: { equals: tenant.id } },
                    { status: { equals: 'published' } },
                ]
            },
            // A tenant may have more than one published site. Keep selection
            // stable until domain-to-site ownership is modelled explicitly.
            sort: 'createdAt',
            limit: 1,
        })

        const [site] = siteResults.docs
        if (!site) {
            return new Response('Not found', { status: 404 })
        }

        // Fetch all indexable content in parallel:
        //  - pages    → published, indexable, visible, not soft-deleted
        //  - products → status 'active' (mirrors PDP live filter), per site
        //  - blogs    → status 'published', per site
        // Functional routes (checkout, orders, order confirm) are intentionally
        // excluded — they are not indexable content.
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
                select: { slug: true, updatedAt: true, isHomepage: true },
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
                select: { slug: true, updatedAt: true },
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
                select: { slug: true, updatedAt: true },
            }),
        ])

        // F37-03 → #1312 score handoff: this published-only 200 response is
        // `sitemapPresent=true` (5 points). A 404/500 withholds only this fact;
        // crawler policy and llms.txt reachability remain independent.

        const baseUrl = resolveStorefrontOrigin(tenant as any, { fallbackHostname: slug === 'custom' ? hostname : null, slug })

        const isoOrNow = (d: unknown) => (d ? new Date(d as string).toISOString() : new Date().toISOString())
        // XML-escape & < > in URLs so a stray special char can't break the document.
        const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const urlNode = (path: string, lastMod: string) =>
            `    <url><loc>${xmlEscape(`${baseUrl}${path}`)}</loc><lastmod>${lastMod}</lastmod></url>`

        const pageNodes = pagesResult.docs.flatMap(p => {
            const isHome = p.isHomepage || p.slug === '/' || p.slug === 'home' || !p.slug
            if (isHome) return [urlNode('', isoOrNow(p.updatedAt))]
            const slugPath = encodePublicSlugPath(p.slug)
            return slugPath ? [urlNode(`/${slugPath}`, isoOrNow(p.updatedAt))] : []
        })

        // Products → /products/{slug} (PDP route). Blogs → /blog/{slug} (canonical
        // path the storefront links to via StorefrontBlogList).
        const productNodes = productsResult.docs
            .flatMap(p => {
                const slugPath = encodePublicSlugSegment(p.slug)
                return slugPath ? [urlNode(`/products/${slugPath}`, isoOrNow(p.updatedAt))] : []
            })

        const blogNodes = blogsResult.docs
            .flatMap(b => {
                const slugPath = encodePublicSlugSegment(b.slug)
                return slugPath ? [urlNode(`/blog/${slugPath}`, isoOrNow(b.updatedAt))] : []
            })

        // Blog index page (only when at least one published post exists).
        const blogIndexNode = blogNodes.length > 0 ? [urlNode('/blogs', new Date().toISOString())] : []

        const xmlLines = [...pageNodes, ...productNodes, ...blogIndexNode, ...blogNodes]

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines.join('\n')}\n</urlset>`

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('[Sitemap Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

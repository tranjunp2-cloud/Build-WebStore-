import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { resolveStorefrontOrigin } from '@/lib/seo/canonical'

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
                ]
            },
            limit: 1,
        })

        const [site] = siteResults.docs
        if (!site) {
            return new Response('Not found', { status: 404 })
        }

        // Fetch all indexable content in parallel:
        //  - pages    → published, indexable, visible, not soft-deleted
        //  - products → status 'active' (mirrors PDP live filter), per site
        //  - blogs    → status 'published', per tenant
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
            }),
            payload.find({
                collection: 'products',
                where: {
                    and: [
                        { site: { equals: site.id } },
                        { status: { equals: 'active' } },
                    ],
                },
                pagination: false,
                depth: 0,
            }),
            payload.find({
                collection: 'blogs',
                where: {
                    and: [
                        { tenant: { equals: tenant.id } },
                        { status: { equals: 'published' } },
                    ],
                },
                pagination: false,
                depth: 0,
            }),
        ])

        const baseUrl = resolveStorefrontOrigin(tenant as any, { fallbackHostname: slug === 'custom' ? hostname : null, slug })

        const isoOrNow = (d: unknown) => (d ? new Date(d as string).toISOString() : new Date().toISOString())
        // XML-escape & < > in URLs so a stray special char can't break the document.
        const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const urlNode = (path: string, lastMod: string) =>
            `    <url><loc>${xmlEscape(`${baseUrl}${path}`)}</loc><lastmod>${lastMod}</lastmod></url>`

        const pageNodes = pagesResult.docs.map(p => {
            const isHome = p.isHomepage || p.slug === '/' || p.slug === 'home' || !p.slug
            const pageSlug = typeof p.slug === 'string' ? p.slug.replace(/^\//, '') : ''
            const path = isHome || !pageSlug ? '' : `/${pageSlug}`
            return urlNode(path, isoOrNow(p.updatedAt))
        })

        // Products → /products/{slug} (PDP route). Blogs → /blog/{slug} (canonical
        // path the storefront links to via StorefrontBlogList).
        const productNodes = productsResult.docs
            .filter(p => typeof p.slug === 'string' && p.slug)
            .map(p => urlNode(`/products/${(p.slug as string).replace(/^\//, '')}`, isoOrNow(p.updatedAt)))

        const blogNodes = blogsResult.docs
            .filter(b => typeof b.slug === 'string' && b.slug)
            .map(b => urlNode(`/blog/${(b.slug as string).replace(/^\//, '')}`, isoOrNow(b.updatedAt)))

        // Blog index page (only when at least one published post exists).
        const blogIndexNode = blogNodes.length > 0 ? [urlNode('/blogs', new Date().toISOString())] : []

        const xmlLines = [...pageNodes, ...productNodes, ...blogIndexNode, ...blogNodes]

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlLines.join('\n')}\n</urlset>`

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            },
        })
    } catch (error) {
        console.error('[Sitemap Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

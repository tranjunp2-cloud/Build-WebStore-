import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params
        const payload = await getPayload({ config })
        
        const tenantsResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
        })
        const [tenant] = tenantsResult.docs
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

        const pagesResult = await payload.find({
            collection: 'pages',
            where: {
                and: [
                    { site: { equals: site.id } },
                    { _status: { equals: 'published' } },
                    { 'seo.noIndex': { not_equals: true } }
                ]
            },
            pagination: false,
        })

        const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        const baseUrl = `https://${slug}.${rootDomain}`

        const xmlLines = pagesResult.docs.map(p => {
            const isHome = p.isHomepage || p.slug === '/' || p.slug === 'home' || !p.slug
            const path = isHome ? '' : `/${p.slug}`
            const lastMod = p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString()
            return `    <url><loc>${baseUrl}${path}</loc><lastmod>${lastMod}</lastmod></url>`
        })

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

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'

const sitemapSchema = z.object({ siteId: z.string().min(1) })

/**
 * POST /api/seo/sitemap
 * Generates a sitemap.xml for all pages in a site.
 *
 * Body: { siteId: string }
 * Response: { sitemapUrl: string, pageCount: number }
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, sitemapSchema)
        if (errorResponse) return errorResponse

        const { siteId } = data!

        const payload = await getPayload({ config })

        // Get site info
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        // Get all published pages for this site
        const pagesResult = await payload.find({
            collection: 'pages',
            where: {
                site: { equals: siteId },
                _status: { equals: 'published' }
            },
            limit: 200,
            depth: 0,
        })

        const baseUrl = site.domain
            ? `https://${site.domain}`
            : `${process.env.NEXT_PUBLIC_SERVER_URL}/sites/${site.slug}`

        const now = new Date().toISOString()

        // Generate sitemap XML
        const urls = pagesResult.docs.map((page: any) => {
            const slug = page.slug === 'home' || page.slug === '/' ? '' : `/${page.slug}`
            return `
  <url>
    <loc>${baseUrl}${slug}</loc>
    <lastmod>${new Date(page.updatedAt || now).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.slug === 'home' || page.slug === '/' ? '1.0' : '0.8'}</priority>
  </url>`
        }).join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

        return NextResponse.json({
            success: true,
            data: {
                xml,
                pageCount: pagesResult.docs.length,
                sitemapUrl: `${baseUrl}/sitemap.xml`,
            }
        })
    } catch (error: any) {
        console.error('[SEO Sitemap Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Sitemap generation failed' } },
            { status: 500 }
        )
    }
})

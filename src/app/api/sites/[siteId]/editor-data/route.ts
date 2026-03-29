import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

/**
 * GET /api/sites/[siteId]/editor-data
 * Returns site + homepage data for the editor.
 * Uses Payload's Local API (no REST auth issues).
 */
export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (_user, _req, ctx) => {
    try {
        const payload = await getPayload({ config })
        const { siteId } = await ctx.params
        const numericSiteId = Number(siteId)

        // Fetch site
        const site: any = await payload.findByID({
            collection: 'sites',
            id: siteId,
        })

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }

        // Fetch homepage
        let pagesResult = await payload.find({
            collection: 'pages',
            where: {
                site: { equals: numericSiteId },
                isHomepage: { equals: true },
            },
            limit: 1,
        })

        // Fallback: get first page for this site
        if (pagesResult.docs.length === 0) {
            pagesResult = await payload.find({
                collection: 'pages',
                where: { site: { equals: numericSiteId } },
                limit: 1,
            })
        }

        const page = pagesResult.docs[0] || null

        return NextResponse.json({
            site: {
                id: site.id,
                name: site.name || 'Untitled',
                status: site.status || 'draft',
                theme: site.theme || {},
                siteType: site.siteType || 'business',
                locale: site.locale || 'ms',
                shippingConfig: site.shippingConfig || {},
            },
            page: page ? {
                id: page.id,
                title: (page as any).title || 'Homepage',
                layout: (page as any).layout || [],
            } : null,
        })

    } catch (error: any) {
        console.error('[Editor Data Error]', error)
        return NextResponse.json(
            { error: 'Failed to load editor data' },
            { status: 500 },
        )
    }
})

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

function normalizeEditorLayout(layout: unknown) {
    if (!Array.isArray(layout)) return []

    return layout.map(block => {
        if (block && typeof block === 'object' && (block as any).blockType === 'socialWidget') {
            return normalizeSocialWidgetConfig(block as Record<string, unknown>)
        }

        return block
    })
}

/**
 * GET /api/sites/[siteId]/editor-data
 * Returns site + homepage data for the editor.
 * Uses Payload's Local API (no REST auth issues).
 */
export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (_user, req, ctx) => {
    try {
        const payload = await getPayload({ config })
        const { siteId } = await ctx.params
        const numericSiteId = Number(siteId)
        const pageId = new URL(req.url).searchParams.get('pageId')

        // Fetch site
        const site: any = await payload.findByID({
            collection: 'sites',
            id: siteId,
        })

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }

        let page: any = null

        if (pageId) {
            const requestedPage = await payload.findByID({
                collection: 'pages',
                id: pageId,
                draft: true, // From staging: include drafts
            })

            const requestedPageSiteId =
                typeof requestedPage?.site === 'object' ? requestedPage.site?.id : requestedPage?.site

            if (requestedPage && Number(requestedPageSiteId) === numericSiteId) {
                page = requestedPage
            }
        }

        if (!page) {
            let pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: numericSiteId },
                    isHomepage: { equals: true },
                },
                limit: 1,
                draft: true, // From staging: include drafts
            })

            if (pagesResult.docs.length === 0) {
                pagesResult = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: numericSiteId } },
                    limit: 1,
                    draft: true, // From staging: include drafts
                })
            }

            page = pagesResult.docs[0] || null
        }

        return NextResponse.json({
            site: {
                id: site.id,
                name: site.name || 'Untitled',
                domain: site.domain || null,
                status: site.status || 'draft',
                theme: site.theme || {},
                siteType: site.siteType || 'business',
                locale: site.locale || 'ms',
                contactInfo: site.contactInfo || {},
                socialLinks: site.socialLinks || {},
                branding: site.branding || {},
                seo: site.seo || {},
                headerBlock: site.headerBlock || null,
                footerBlock: site.footerBlock || null,
                shippingConfig: site.shippingConfig || {},
            },
            page: page ? {
                id: page.id,
                title: (page as any).title || 'Homepage',
                layout: normalizeEditorLayout((page as any).layout),
                _status: (page as any)._status || 'published',
                updatedAt: (page as any).updatedAt,
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

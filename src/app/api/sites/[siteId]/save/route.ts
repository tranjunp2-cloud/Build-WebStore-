import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * PATCH /api/sites/[siteId]/save
 * Saves updated blocks (layout) and/or theme for a site.
 * Body: { blocks?: any[], theme?: any }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const payload = await getPayload({ config })
        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { siteId } = await params
        const body = await req.json()
        const { blocks, theme } = body

        // Update theme on site if provided
        if (theme) {
            await payload.update({
                collection: 'sites',
                id: siteId,
                data: { theme },
            })
        }

        // Update blocks on homepage if provided
        if (blocks) {
            const numericSiteId = Number(siteId)
            let pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: numericSiteId },
                    isHomepage: { equals: true },
                },
                limit: 1,
            })

            if (pagesResult.docs.length === 0) {
                pagesResult = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: numericSiteId } },
                    limit: 1,
                })
            }

            const page = pagesResult.docs[0]
            if (page) {
                await payload.update({
                    collection: 'pages',
                    id: page.id,
                    data: { layout: blocks },
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Saved successfully',
        })

    } catch (error: any) {
        console.error('[Save Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Save failed' },
            { status: 500 },
        )
    }
}

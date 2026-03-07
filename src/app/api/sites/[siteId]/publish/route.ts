import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

/**
 * PATCH /api/sites/[siteId]/publish
 * Sets site status to "published" and records publishedAt timestamp.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const payload = await getPayload({ config })

        // Authenticate
        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { siteId } = await params

        // Update site status
        const site = await payload.update({
            collection: 'sites',
            id: siteId,
            data: {
                status: 'published',
                publishedAt: new Date().toISOString(),
            },
        })

        return NextResponse.json({
            success: true,
            siteId: site.id,
            siteName: site.name,
            status: 'published',
            publishedAt: site.publishedAt,
        })

    } catch (error: any) {
        console.error('[Publish Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to publish' },
            { status: 500 },
        )
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

import { saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'

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

        // Try standard Payload auth first
        let user: any = null
        try {
            const authResult = await payload.auth({ headers: req.headers })
            user = authResult.user
        } catch (authErr) {
            console.warn('[Save] Standard auth failed, trying cookie fallback')
        }

        // Fallback: read payload-token from cookies
        if (!user) {
            const cookieStore = await cookies()
            const token = cookieStore.get('payload-token')?.value
            if (token) {
                try {
                    // Create new headers with Authorization bearer token
                    const authHeaders = new Headers(req.headers)
                    authHeaders.set('Authorization', `JWT ${token}`)
                    const authResult = await payload.auth({ headers: authHeaders })
                    user = authResult.user
                } catch (fallbackErr) {
                    console.warn('[Save] Cookie fallback auth failed too')
                }
            }
        }

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { siteId } = await params
        const { data, errorResponse } = await parseRequest(req, saveSiteSchema)
        if (errorResponse) return errorResponse

        const { blocks, theme, locale, shippingConfig } = data!

        // Update site-level fields if provided
        const siteUpdateData: any = {}
        if (theme) siteUpdateData.theme = theme
        if (locale) siteUpdateData.locale = locale
        if (shippingConfig) siteUpdateData.shippingConfig = shippingConfig

        if (Object.keys(siteUpdateData).length > 0) {
            await payload.update({
                collection: 'sites',
                id: siteId,
                data: siteUpdateData,
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
                    draft: true,
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

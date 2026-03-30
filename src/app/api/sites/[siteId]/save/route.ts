import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
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
        // Authenticate — handles both Payload JWT and custom Jose JWT (from verify-otp)
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })

        const { siteId } = await params

        // Verify site exists and check ownership (tenant isolation)
        const existingSite = await payload.findByID({ collection: 'sites', id: siteId })
        if (!existingSite) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }
        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existingSite.tenant as TenantRef)
        if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

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
            { error: 'Save failed' },
            { status: 500 },
        )
    }
}

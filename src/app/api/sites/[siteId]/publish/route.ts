import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

/**
 * PATCH /api/sites/[siteId]/publish
 * Sets site status to "published" and records publishedAt timestamp.
 *
 * DELETE /api/sites/[siteId]/publish
 * Unpublishes a site — sets status back to "draft".
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } },
                { status: 401 }
            )
        }

        const payload = await getPayload({ config })
        const { siteId } = await params

        // Verify site exists
        const existing = await payload.findByID({ collection: 'sites', id: siteId })
        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        // Verify ownership (tenant isolation)
        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef) => t == null ? '' : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existing.tenant as TenantRef)
        if (!userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Not your site' } },
                { status: 403 }
            )
        }

        if (existing.status === 'published') {
            return NextResponse.json(
                { success: false, error: { code: 'ALREADY_PUBLISHED', message: 'Site is already published' } },
                { status: 409 }
            )
        }

        // Publish the site
        const site = await payload.update({
            collection: 'sites',
            id: siteId,
            data: {
                status: 'published',
                publishedAt: new Date().toISOString(),
            },
        })

        // Get tenant slug for the domain URL
        let tenantSlug = 'site'
        const fullSite = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 1, // Populate tenant
        })
        
        if (fullSite.tenant && typeof fullSite.tenant === 'object') {
            tenantSlug = (fullSite.tenant as any).slug || 'site'
        }

        const domainUrl = `${tenantSlug}.primeweb.app`

        return NextResponse.json({
            success: true,
            data: {
                id: site.id,
                name: site.name,
                status: 'published',
                publishedAt: site.publishedAt,
                url: `https://${domainUrl}`,
                domain: domainUrl,
            },
        })

    } catch (error: any) {
        console.error('[Publish Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to publish' } },
            { status: 500 },
        )
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } },
                { status: 401 }
            )
        }

        const payload = await getPayload({ config })
        const { siteId } = await params

        const existing = await payload.findByID({ collection: 'sites', id: siteId })
        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        // Verify ownership (tenant isolation)
        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef) => t == null ? '' : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existing.tenant as TenantRef)
        if (!userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Not your site' } },
                { status: 403 }
            )
        }

        if (existing.status !== 'published') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_PUBLISHED', message: 'Site is not published' } },
                { status: 409 }
            )
        }

        // Unpublish
        const site = await payload.update({
            collection: 'sites',
            id: siteId,
            data: {
                status: 'draft',
            },
        })

        return NextResponse.json({
            success: true,
            data: {
                id: site.id,
                name: site.name,
                status: 'draft',
            },
        })

    } catch (error: any) {
        console.error('[Unpublish Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to unpublish' } },
            { status: 500 },
        )
    }
}

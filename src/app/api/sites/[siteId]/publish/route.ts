export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { revalidateTag } from 'next/cache'

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
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existing.tenant as TenantRef)
        if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Not your site' } },
                { status: 403 }
            )
        }

        // Re-publish is allowed — user may have edited content after initial publish.
        // Just update publishedAt timestamp to mark the latest version.

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
        
        let primaryDomain: string | null = null
        if (fullSite.tenant && typeof fullSite.tenant === 'object') {
            const tenant = fullSite.tenant as Record<string, unknown>
            tenantSlug = (tenant.slug as string) || 'site'
            const domains = Array.isArray(tenant.customDomains) ? tenant.customDomains : []
            const primary = domains.find(
                (d: Record<string, unknown>) => d.isPrimary === true && d.status === 'active'
            )
            primaryDomain = (primary as Record<string, unknown>)?.domain as string || null
        }

        // Invalidate cached site/page data so visitors see updated content
        try {
            revalidateTag(`site-${siteId}`)
            revalidateTag('tenants')
        } catch {
            // revalidateTag requires Next.js request context — skip in tests/non-Next environments
        }

        // Build public URL. Subdomain routing ({slug}.primeweb.app) only works
        // when DNS wildcards resolve — fine on staging/prod. On localhost there's
        // no wildcard DNS, so fall back to path-based routing which the middleware
        // already handles via `/sites/{slug}/...` (see src/middleware.ts:94-108).
        const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN!
        const isLocalPlatform = /^(localhost|127\.)/.test(platformDomain)

        let publicUrl: string
        let displayDomain: string
        if (primaryDomain) {
            // Custom domain always wins — HTTPS + apex as configured
            publicUrl = `https://${primaryDomain}`
            displayDomain = primaryDomain
        } else if (isLocalPlatform) {
            // Local dev → path-based http URL that middleware rewrites
            publicUrl = `http://${platformDomain}/sites/${tenantSlug}`
            displayDomain = `${platformDomain}/sites/${tenantSlug}`
        } else {
            // Staging / prod → subdomain routing
            publicUrl = `https://${tenantSlug}.${platformDomain}`
            displayDomain = `${tenantSlug}.${platformDomain}`
        }

        return NextResponse.json({
            success: true,
            data: {
                id: site.id,
                name: site.name,
                status: 'published',
                publishedAt: site.publishedAt,
                url: publicUrl,
                domain: displayDomain,
            },
        })

    } catch (error: unknown) {
        console.error('[Publish Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to publish' } },
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
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)
        const userTenants = (user as unknown as { tenants?: Array<{ tenant: TenantRef }> }).tenants ?? []
        const siteTenantId = resolveTenantId(existing.tenant as TenantRef)
        if (!siteTenantId || !userTenants.some(t => resolveTenantId(t.tenant) === siteTenantId)) {
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

    } catch (error: unknown) {
        console.error('[Unpublish Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to unpublish' } },
            { status: 500 },
        )
    }
}

// Alias PUT to PATCH for automated testing bot (Playwright) which uses PUT
export const PUT = PATCH

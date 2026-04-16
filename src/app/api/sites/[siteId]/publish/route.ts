export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'

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

        // BUG-F01-05: Rate limit publish — 5/min burst + 30/hr sustained
        const rateLimit = await checkTwoTierRateLimit(`publish:${user.id}`, 5, 30)
        if (!rateLimit.allowed) {
            const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
                    retryAfter,
                },
                { status: 429, headers: { 'Retry-After': String(retryAfter) } }
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

        // BUG-F05-01/03: Promote all draft pages to published.
        // Editor saves with isDraft:true, so pages only have draft versions.
        // Without this step, live site fetches get stale published versions.
        // Paginate to handle sites with >100 pages.
        const failedPageIds: string[] = []
        let hasMore = true
        let pageNum = 1
        while (hasMore) {
            const sitePages = await payload.find({
                collection: 'pages',
                where: { site: { equals: Number(siteId) } },
                limit: 50,
                page: pageNum,
                sort: 'id',
                draft: true,
            })

            for (const pg of sitePages.docs) {
                try {
                    await payload.update({
                        collection: 'pages',
                        id: pg.id,
                        data: { layout: pg.layout },
                        draft: false,
                    })
                } catch (err) {
                    console.warn(`[Publish] Failed to promote page ${pg.id}:`, err instanceof Error ? err.message : err)
                    failedPageIds.push(String(pg.id))
                }
            }

            hasMore = sitePages.hasNextPage ?? (sitePages.docs.length === 50)
            pageNum++
        }

        if (failedPageIds.length > 0) {
            console.error(`[Publish] ${failedPageIds.length} page(s) failed to promote:`, failedPageIds)
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PARTIAL_PUBLISH_FAILURE',
                        message: `Failed to publish ${failedPageIds.length} page(s). Please try again.`,
                        failedPages: failedPageIds,
                    },
                },
                { status: 207 },
            )
        }

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

        // BUG-F01-05: Rate limit unpublish — 5/min burst + 30/hr sustained
        const rateLimit = await checkTwoTierRateLimit(`unpublish:${user.id}`, 5, 30)
        if (!rateLimit.allowed) {
            const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
                    retryAfter,
                },
                { status: 429, headers: { 'Retry-After': String(retryAfter) } }
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

        // Invalidate cached site data so storefront shows maintenance page
        try {
            revalidateTag(`site-${siteId}`)
            revalidateTag('tenants')
        } catch (err) {
            console.warn('[Unpublish] revalidateTag failed:', err instanceof Error ? err.message : String(err))
        }

        return NextResponse.json({
            success: true,
            data: {
                id: site.id,
                name: site.name,
                status: 'draft',
                unpublishedAt: new Date().toISOString(),
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

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

        // BUG-F05-01/03: Promote all draft pages BEFORE publishing site.
        // This ensures site is only marked published when all pages are ready.
        // Editor saves with isDraft:true, so pages only have draft versions.
        // Paginate to handle sites with >100 pages.
        //
        // depth: 0 keeps relationships as IDs — passing populated objects back to
        // payload.update() on Payload 3.79 causes silent validation drops on nested
        // media/relationship fields, which previously made the promotion a no-op
        // for newly-created draft pages (BUG-F05: new page stayed draft after Update).
        const failedPageIds: string[] = []
        const failureDetails: Array<{ pageId: string; pgCode?: string; pgColumn?: string; pgTable?: string; causeMsg?: string }> = []
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
                depth: 0,
            })

            for (const pg of sitePages.docs) {
                const pageId = String(pg.id)
                try {
                    // Promote full draft doc — strip system/version fields, keep
                    // everything else so published version matches latest draft.
                    const SYSTEM_FIELDS = new Set([
                        'id', '_status', 'createdAt', 'updatedAt', 'sizes',
                        '_verificationToken', '_versionID', '_currentVersionId',
                        'publishedDoc', 'version', 'latest',
                    ])
                    const draft = pg as Record<string, unknown>
                    const data: Record<string, unknown> = {}
                    for (const [key, val] of Object.entries(draft)) {
                        if (SYSTEM_FIELDS.has(key)) continue
                        if (val === undefined) continue
                        data[key] = val
                    }
                    // Explicitly include _status: 'published'. Payload 3.79's
                    // update({ draft: false }) writes a new published *version*
                    // but does NOT set _status on the main pages row (verified
                    // in node_modules/payload/dist/collections/operations/
                    // utilities/update.js:29 — _status is only touched when
                    // isSavingDraft=true). Without this, the main row stays
                    // _status='draft' after promote, and list queries keep
                    // showing the Draft badge even though a published version
                    // exists in _pages_v.
                    data._status = 'published'
                    await payload.update({
                        collection: 'pages',
                        id: pg.id,
                        data,
                        draft: false,
                    })
                } catch (err) {
                    // Drizzle wraps the Postgres DatabaseError in .cause — the
                    // wrapper's .message is just "Failed query: <sql>". Real
                    // details (missing column, relation) live on .cause.code /
                    // .cause.column / .cause.table. Without extracting them, a
                    // schema-lag migration shows up as an opaque warning.
                    type PgErrLike = { code?: string; detail?: string; table?: string; column?: string; message?: string }
                    const cause = (err as { cause?: unknown })?.cause
                    const pgErr: PgErrLike | null = cause && typeof cause === 'object' ? (cause as PgErrLike) : null
                    const errMsg = err instanceof Error ? err.message : String(err)
                    console.warn('[Publish] Failed to promote page', JSON.stringify({
                        pageId,
                        errMsg: errMsg.slice(0, 300),
                        pgCode: pgErr?.code,
                        pgColumn: pgErr?.column,
                        pgTable: pgErr?.table,
                        causeMsg: pgErr?.message?.slice(0, 300),
                    }))
                    failedPageIds.push(pageId)
                    failureDetails.push({
                        pageId,
                        pgCode: pgErr?.code,
                        pgColumn: pgErr?.column,
                        pgTable: pgErr?.table,
                        causeMsg: pgErr?.message?.slice(0, 300),
                    })
                }
            }

            hasMore = sitePages.hasNextPage ?? (sitePages.docs.length === 50)
            pageNum++
        }

        if (failedPageIds.length > 0) {
            console.error(`[Publish] ${failedPageIds.length} page(s) failed to promote:`, failedPageIds)
            // 500 (not 207) so fetch `res.ok` is false and the client surfaces
            // the error to the user instead of cheerfully showing "published".
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PARTIAL_PUBLISH_FAILURE',
                        message: `Failed to publish ${failedPageIds.length} page(s). Please try again.`,
                        failedPages: failedPageIds,
                        failures: failureDetails,
                    },
                },
                { status: 500 },
            )
        }

        // Publish the site AFTER all pages promoted successfully
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

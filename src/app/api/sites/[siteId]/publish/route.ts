import { PW1_PUBLISH_HEADER } from '@/lib/migration/pw1-publish-grant'
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { z } from 'zod'
import { publishSite, type PublishSiteInput } from '@/lib/sites/publish-site'

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

        // Parse and validate optional pending fields from request body.
        // Client sends authoritative state (post-flush) so publish uses it directly,
        // bypassing pendingXxx DB reads which can silently return undefined if migration
        // is not yet applied on this environment.
        // Zod validates the same shapes as the save route — prevents malformed JSON from
        // being written to live site fields via the publish body.
        // Note: cannot use saveSiteSchema.pick() — .refine() wraps it as ZodEffects (no .pick).
        const publishBodySchema = z.object({
            // .passthrough() on the outer object preserves unknown keys (future floating block types)
            // so they are not silently dropped when a new widget type is added before schema is updated.
            globalBlocks: z.object({
                cartWidget: z.object({ blockType: z.literal('cartWidget') }).passthrough().nullable().optional(),
                whatsappButton: z.object({ blockType: z.literal('whatsapp-button') }).passthrough().nullable().optional(),
                socialWidget: z.object({ blockType: z.literal('socialWidget') }).passthrough().nullable().optional(),
            }).passthrough().nullable().optional(),
            headerBlock: z.record(z.unknown()).nullable().optional(),
            footerBlock: z.record(z.unknown()).nullable().optional(),
        }).partial()
        const publishBody: PublishSiteInput['body'] = {}
        try {
            const rawBody = await req.json()
            const parsed = publishBodySchema.safeParse(rawBody)
            if (parsed.success) {
                const pb = parsed.data
                if ('globalBlocks' in pb) publishBody.globalBlocks = pb.globalBlocks
                if ('headerBlock' in pb) publishBody.headerBlock = pb.headerBlock
                if ('footerBlock' in pb) publishBody.footerBlock = pb.footerBlock
            } else {
                console.warn('[publish] body schema validation failed — using DB fallback', parsed.error.flatten())
            }
        } catch {
            // Body not present or not JSON — proceed with DB fallback
        }

        const published = await publishSite({ payload, user, siteId, body: publishBody, pw1Grant: req.headers.get(PW1_PUBLISH_HEADER) })
        return NextResponse.json(published.body, { status: published.status })
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

        const existing = await payload.findByID({ collection: 'sites', id: siteId, disableErrors: true })
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

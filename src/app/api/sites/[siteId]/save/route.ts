export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { checkRateLimit } from '@/lib/rateLimit'
import { withPayloadRetry, classifyTransientError } from '@/lib/payload-retry'
import { stripOrphanMediaRefs, cleanupNonNumericImageFields } from '@/lib/ai/media-injector'
import { buildEnumSets } from '@/lib/theme/enums'
import { mergeGlobalBlocks } from '@/lib/sites/merge-global-blocks'


/** Only persist theme fields defined in the Sites collection schema.
 *  Extra keys (from AI or stale client state) are stripped so Payload
 *  does not throw a validation error (BUG-F05-025). */
const ALLOWED_THEME_KEYS = new Set([
    'primaryColor', 'secondaryColor', 'backgroundColor',
    'fontHeading', 'fontBody', 'borderRadius', 'colorMode',
    'accentColor', 'surfaceColor', 'textColor', 'mutedColor',
    'spacingPreset', 'shadowPreset',
])

/** Valid enum values for select fields — strip invalid selections so
 *  Payload does not throw "This field has an invalid selection".
 *  Sourced from `@/lib/theme/enums` so save + AI prompt stay in sync. */
const SELECT_FIELD_VALUES: Record<string, Set<string>> = buildEnumSets()

function sanitizeTheme(raw: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
        if (ALLOWED_THEME_KEYS.has(key) && value !== undefined && value !== null && value !== '') {
            // Validate select field values — drop invalid selections
            const validValues = SELECT_FIELD_VALUES[key]
            if (validValues && !validValues.has(String(value))) continue
            clean[key] = value
        }
    }
    return clean
}

/**
 * PATCH /api/sites/[siteId]/save
 * Saves updated blocks (layout) and/or theme for a site.
 * Body: { blocks?: unknown[], theme?: unknown }
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

        // BUG-F01-05: Rate limit save — 60/min per user (allows autosave at 1/sec)
        const rateLimit = await checkRateLimit(`save:${user.id}`, 60, 60_000)
        if (!rateLimit.allowed) {
            const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            return NextResponse.json(
                {
                    error: 'Too many save requests. Try again later.',
                    retryAfter,
                },
                { status: 429, headers: { 'Retry-After': String(retryAfter) } }
            )
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

        const pageId = req.nextUrl.searchParams.get('pageId')
        const { data, errorResponse } = await parseRequest(req, saveSiteSchema)
        if (errorResponse) return errorResponse
        const { blocks, theme, locale, shippingConfig, headerBlock, footerBlock, globalBlocks, siteName, contactInfo, socialLinks, branding, seo, isDraft } = data!
        // Navigation: allow draft links (empty/#) but reject malformed external URLs
        if (headerBlock && typeof headerBlock === 'object') {
            const hb = headerBlock as Record<string, unknown>
            if (Array.isArray(hb.links)) {
                for (const link of hb.links) {
                    const l = link as Record<string, unknown>
                    const url = typeof l.url === 'string' ? l.url.trim() : ''
                    if (!url || url.startsWith('#')) continue
                    if (url.startsWith('/') && !url.startsWith('//')) continue
                    if (url.startsWith('//')) return NextResponse.json({ error: `Invalid URL: protocol-relative URLs not allowed` }, { status: 400 })
                    try { const u = new URL(url); if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error() }
                    catch { return NextResponse.json({ error: `Invalid URL: "${url}"` }, { status: 400 }) }
                }
            }
        }
        const normalizedBlocks = blocks ? normalizeBlocksForPersistence(blocks as Record<string, unknown>[]) : undefined

        type SiteUpdateData = Partial<{
            theme: unknown;
            name: unknown;
            locale: "en" | "ms";
            shippingConfig: unknown;
            pendingHeaderBlock: unknown;
            pendingFooterBlock: unknown;
            pendingGlobalBlocks: unknown;
            contactInfo: unknown;
            socialLinks: unknown;
            branding: unknown;
            seo: unknown;
        }>;
        const siteUpdateData: SiteUpdateData = {}
        if (theme) siteUpdateData.theme = sanitizeTheme(theme as Record<string, unknown>)
        if (siteName) siteUpdateData.name = siteName as string
        if (locale) siteUpdateData.locale = locale
        if (shippingConfig) siteUpdateData.shippingConfig = shippingConfig
        // Draft saves write to pending fields — only promoted to live on publish.
        // Prevents in-progress header/footer edits from immediately affecting the live storefront.
        if (headerBlock !== undefined) siteUpdateData.pendingHeaderBlock = headerBlock
        if (footerBlock !== undefined) siteUpdateData.pendingFooterBlock = footerBlock
        if (globalBlocks !== undefined) {
            // Draft saves write to pendingGlobalBlocks — only promoted to globalBlocks on publish.
            // This prevents in-progress edits from immediately affecting the live storefront.
            const existingPending = existingSite.pendingGlobalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks
            const existingLive = existingSite.globalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks
            siteUpdateData.pendingGlobalBlocks = mergeGlobalBlocks(
                existingPending ?? existingLive,
                globalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks,
            )
        }
        if (contactInfo) siteUpdateData.contactInfo = contactInfo
        if (socialLinks) siteUpdateData.socialLinks = socialLinks
        if (branding) siteUpdateData.branding = branding
        if (seo) siteUpdateData.seo = seo

        if (Object.keys(siteUpdateData).length > 0) {
            await payload.update({
                collection: 'sites',
                id: siteId,
                data: siteUpdateData,
            })
        }

        // Update blocks on the selected page if provided
        if (normalizedBlocks) {
            const numericSiteId = Number(siteId)
            type PageDoc = NonNullable<Awaited<ReturnType<typeof payload.findByID>>>
            let page: PageDoc | null = null

            if (pageId) {
                if (!/^\d+$/.test(pageId)) {
                    return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
                }
                let requestedPage: PageDoc | null = null
                try {
                    requestedPage = await payload.findByID({
                        collection: 'pages',
                        id: pageId,
                        draft: true,
                    })
                } catch {
                    // Page not found
                }
                const requestedPageSiteId =
                    typeof requestedPage?.site === 'object' ? requestedPage.site?.id : requestedPage?.site

                if (requestedPage && Number(requestedPageSiteId) === numericSiteId) {
                    page = requestedPage
                } else {
                    // pageId was specified but page not found or belongs to different site —
                    // refuse rather than silently saving to the homepage (data integrity)
                    return NextResponse.json({ error: 'Page not found', pageId }, { status: 404 })
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
                    draft: true,
                })

                if (pagesResult.docs.length === 0) {
                    pagesResult = await payload.find({
                        collection: 'pages',
                        where: { site: { equals: numericSiteId } },
                        limit: 1,
                        draft: true,
                    })
                }

                page = pagesResult.docs[0]
            }

            if (page) {
                // Plan 260415 fix-500 — orphan media preflight. Client may send
                // layout with avatar_id/image_id refs to media rows that had
                // "Failed to persist upload data: g: Not Found" during upload
                // (half-written rows). Editor autosave saw ~14 hits/2h on
                // pages_blocks_testimonials_testimonials avatar_id inserts
                // failing. Strip orphan refs before update attempts.
                try {
                    const { stripped, checked } = await stripOrphanMediaRefs(
                        normalizedBlocks as Record<string, unknown>[],
                        payload as unknown as Parameters<typeof stripOrphanMediaRefs>[1],
                    )
                    if (stripped > 0) {
                        console.warn(`[Save] Stripped ${stripped}/${checked} orphan media refs`)
                    }
                } catch (stripErr) {
                    console.warn('[Save] stripOrphanMediaRefs failed (non-fatal):', stripErr instanceof Error ? stripErr.message : stripErr)
                }

                // Plan 260415 fix-500: wrap in retry — Payload drafts/versions
                // system races cause deadlocks + FK violations on _pages_v_blocks_*
                // under concurrent autosave. Transient — retry with backoff.
                try {
                    await withPayloadRetry(
                        () => payload.update({
                            collection: 'pages',
                            id: page!.id,
                            data: { layout: normalizedBlocks },
                            draft: isDraft ?? false,
                        }),
                        {
                            onRetry: (attempt, kind, err) => {
                                const msg = err instanceof Error ? err.message : String(err)
                                console.warn(`[Save Retry] attempt=${attempt} kind=${kind} pageId=${page!.id} msg=${msg.slice(0, 200)}`)
                            },
                        },
                    )
                } catch (updateErr) {
                    // Plan 260415 fix-500 — fallback for pages_blocks_*_images /
                    // _testimonials / avatar_id FK errors that slipped past the
                    // preflight. Strip ALL image refs + retry once.
                    const errMsg = updateErr instanceof Error ? updateErr.message : String(updateErr)
                    const isImageFkError = /pages_blocks_[a-z_]+(_images|_testimonials|_members|_projects|_logos)?|image_id|avatar_id|upload/i.test(errMsg)
                    if (!isImageFkError) throw updateErr

                    console.warn(`[Save] Retry without image refs after: ${errMsg.slice(0, 160)}`)
                    cleanupNonNumericImageFields(normalizedBlocks as Record<string, unknown>[])
                    for (const block of normalizedBlocks as Record<string, unknown>[]) {
                        for (const field of ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']) {
                            if (typeof block[field] === 'number') delete block[field]
                        }
                        for (const arrayField of ['images', 'projects', 'members', 'testimonials', 'logos', 'properties', 'doctors', 'events', 'posts', 'caseStudies']) {
                            const arr = block[arrayField]
                            if (!Array.isArray(arr)) continue
                            for (const item of arr as Record<string, unknown>[]) {
                                if (item && typeof item === 'object') {
                                    for (const f of ['image', 'logo', 'avatar']) {
                                        if (typeof item[f] === 'number') delete item[f]
                                    }
                                }
                            }
                        }
                        // menu-food: clean nested categories[].items[].image numeric Payload IDs
                        if (block.blockType === 'menu-food' && Array.isArray(block.categories)) {
                            for (const cat of block.categories as Record<string, unknown>[]) {
                                if (cat && Array.isArray(cat.items)) {
                                    for (const item of cat.items as Record<string, unknown>[]) {
                                        if (item && typeof item.image === 'number') delete item.image
                                    }
                                }
                            }
                        }
                    }
                    await payload.update({
                        collection: 'pages',
                        id: page!.id,
                        data: { layout: normalizedBlocks },
                        draft: isDraft ?? false,
                    })
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Saved successfully',
        })

    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error)
        const errName = error instanceof Error ? error.name : 'Unknown'
        const transientKind = classifyTransientError(error)

        // Plan 260415 fix-500 — structured log + debugId. If the error is a
        // transient deadlock/FK that survived the retry wrapper, surface as
        // 409 Conflict so the editor client can retry on its own without
        // showing "something went wrong".
        const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        console.error('[Save Error]', JSON.stringify({
            debugId,
            errName,
            errMsg: errMsg.slice(0, 500),
            transient: transientKind,
        }))
        if (error && typeof error === 'object' && 'data' in error) {
            console.error('[Save Error] Validation data:', debugId, JSON.stringify((error as Record<string, unknown>).data, null, 2).slice(0, 1000))
        }

        if (transientKind) {
            return NextResponse.json(
                {
                    error: 'Save conflicted with a concurrent edit. Please try again.',
                    debugId,
                    retryable: true,
                },
                { status: 409 },
            )
        }

        return NextResponse.json(
            { error: 'Save failed. Please try again in a moment.', debugId },
            { status: 500 },
        )
    }
}

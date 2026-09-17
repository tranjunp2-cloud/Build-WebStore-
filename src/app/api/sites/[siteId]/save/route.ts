export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { localBusinessSchema, saveSiteSchema } from '@/lib/validations/sites'
import { parseRequest } from '@/lib/validations/helpers'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { checkRateLimit } from '@/lib/rateLimit'
import { withPayloadRetry, classifyTransientError } from '@/lib/payload-retry'
import { stripOrphanMediaRefs, cleanupNonNumericImageFields } from '@/lib/ai/media-injector'
import { buildEnumSets } from '@/lib/theme/enums'
import { mergeGlobalBlocks } from '@/lib/sites/merge-global-blocks'
import { sanitizeLegacyOpeningHours } from '@/components/editor/local-business/opening-hours-utils'
import type { OpeningHourRow } from '@/components/editor/local-business/types'
import {
    executeTenantTransaction,
    lockTenantSiteRows,
    TenantSiteLockError,
    withTenantRowLock,
    type TenantTransactionRequest,
} from '@/lib/payload/tenant-row-lock'


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

class SavePageNotFoundError extends Error {
    readonly pageId: string

    constructor(pageId: string) {
        super('Page not found')
        this.name = 'SavePageNotFoundError'
        this.pageId = pageId
    }
}



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
        const existingSite = await payload.findByID({ collection: 'sites', id: siteId, disableErrors: true })
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

        const sub = await getActivePlanSubscription(payload, siteTenantId)
        if (!sub) {
            return NextResponse.json(
                { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } },
                { status: 403 },
            )
        }
        const builderAllowed = await canUse(payload, sub.plan as PlanCode, 'website_builder')
        if (!builderAllowed) {
            return NextResponse.json(
                { success: false, error: { code: 'FEATURE_LOCKED', message: 'This feature is not available on your current plan' } },
                { status: 403 },
            )
        }

        const pageId = req.nextUrl.searchParams.get('pageId')
        const { data, errorResponse } = await parseRequest(req, saveSiteSchema)
        if (errorResponse) return errorResponse
        const { blocks, theme, locale, shippingConfig, headerBlock, footerBlock, globalBlocks, siteName, contactInfo, localBusiness, socialLinks, branding, seo, isDraft, localeContent, pendingLocaleConfirm } = data!

        let validatedLocalBusiness: unknown
        if (localBusiness !== undefined) {
            const previousLocalBusiness = existingSite.localBusiness
            const previousGroup = previousLocalBusiness
                && typeof previousLocalBusiness === 'object'
                && !Array.isArray(previousLocalBusiness)
                ? previousLocalBusiness
                : {}
            const effectiveLocalBusiness: Record<string, unknown> = { ...previousGroup, ...localBusiness }
            if (Array.isArray(effectiveLocalBusiness.openingHours)) {
                effectiveLocalBusiness.openingHours = sanitizeLegacyOpeningHours(
                    effectiveLocalBusiness.openingHours as OpeningHourRow[],
                )
            }
            const result = localBusinessSchema.safeParse(effectiveLocalBusiness)
            if (!result.success) {
                return NextResponse.json(
                    { error: 'Invalid local business data', details: result.error.flatten() },
                    { status: 400 },
                )
            }
            validatedLocalBusiness = result.data
        }

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

        const numericSiteId = Number(siteId)
        if (!Number.isSafeInteger(numericSiteId) || numericSiteId < 1) {
            return NextResponse.json({ error: 'Invalid siteId' }, { status: 400 })
        }
        if (normalizedBlocks && pageId && !/^\d+$/.test(pageId)) {
            return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
        }

        type PageDoc = NonNullable<Awaited<ReturnType<typeof payload.findByID>>>
        type SiteUpdateData = Partial<{
            theme: unknown;
            themeCustomized: boolean;
            name: unknown;
            locale: "en" | "ms";
            shippingConfig: unknown;
            pendingHeaderBlock: unknown;
            pendingFooterBlock: unknown;
            pendingGlobalBlocks: unknown;
            contactInfo: unknown;
            localBusiness: unknown;
            socialLinks: unknown;
            branding: unknown;
            seo: unknown;
            pendingLocaleConfirm: boolean;
        }>;
        // Media preflight is read-only and runs before taking the tenant mutex so
        // the transaction only covers the consistency-critical site/page writes.
        if (normalizedBlocks) {
            try {
                const { stripped, checked } = await stripOrphanMediaRefs(
                    normalizedBlocks,
                    payload as unknown as Parameters<typeof stripOrphanMediaRefs>[1],
                )
                if (stripped > 0) console.warn(`[Save] Stripped ${stripped}/${checked} orphan media refs`)
            } catch (stripErr) {
                console.warn('[Save] stripOrphanMediaRefs failed (non-fatal):', stripErr instanceof Error ? stripErr.message : stripErr)
            }
        }

        const resolvePage = async (transactionReq: TenantTransactionRequest): Promise<PageDoc | null> => {
            if (!normalizedBlocks && !localeContent) return null

            if (pageId && /^\d+$/.test(pageId)) {
                let requestedPage: PageDoc | null = null
                try {
                    requestedPage = await payload.findByID({
                        collection: 'pages',
                        id: pageId,
                        draft: true,
                        depth: 0,
                        req: transactionReq,
                    }) as PageDoc
                } catch {
                    requestedPage = null
                }
                const requestedPageSiteId = typeof requestedPage?.site === 'object'
                    ? requestedPage.site?.id
                    : requestedPage?.site
                if (
                    !requestedPage
                    || Number(requestedPageSiteId) !== numericSiteId
                ) {
                    throw new SavePageNotFoundError(pageId)
                }
                return requestedPage
            }

            let pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: numericSiteId },
                    isHomepage: { equals: true },
                },
                limit: 1,
                draft: true,
                depth: 0,
                req: transactionReq,
            })
            if (pagesResult.docs.length === 0) {
                pagesResult = await payload.find({
                    collection: 'pages',
                    where: {
                        site: { equals: numericSiteId },
                    },
                    limit: 1,
                    draft: true,
                    depth: 0,
                    req: transactionReq,
                })
            }
            return (pagesResult.docs[0] as PageDoc | undefined) ?? null
        }

        const persistSave = () => withTenantRowLock(payload, siteTenantId, async (transactionReq) => {
            await lockTenantSiteRows(payload, siteTenantId, [numericSiteId], transactionReq)

            // Re-read after the lock. The initial lookup gives fast auth feedback;
            // this authoritative lookup closes the ownership/state TOCTOU window.
            const lockedSite = await payload.findByID({
                collection: 'sites',
                id: numericSiteId,
                depth: 0,
                disableErrors: true,
                req: transactionReq,
            })
            const lockedTenantId = resolveTenantId(lockedSite?.tenant as TenantRef)
            if (!lockedSite || lockedTenantId !== siteTenantId) {
                throw new TenantSiteLockError([numericSiteId])
            }

            // Resolve and validate an explicitly selected page before any site
            // fields are written, while holding the same lock as template swap.
            const page = await resolvePage(transactionReq)



            const siteUpdateData: SiteUpdateData = {}
            if (theme) siteUpdateData.theme = sanitizeTheme(theme as Record<string, unknown>)
            if (theme) siteUpdateData.themeCustomized = true
            if (siteName) siteUpdateData.name = siteName as string
            if (locale) siteUpdateData.locale = locale
            if (pendingLocaleConfirm !== undefined) siteUpdateData.pendingLocaleConfirm = pendingLocaleConfirm
            if (shippingConfig) siteUpdateData.shippingConfig = shippingConfig
            if (headerBlock !== undefined) siteUpdateData.pendingHeaderBlock = headerBlock
            if (footerBlock !== undefined) siteUpdateData.pendingFooterBlock = footerBlock
            if (globalBlocks !== undefined) {
                const existingPending = lockedSite.pendingGlobalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks
                const existingLive = lockedSite.globalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks
                siteUpdateData.pendingGlobalBlocks = mergeGlobalBlocks(
                    existingPending ?? existingLive,
                    globalBlocks as import('@/lib/sites/merge-global-blocks').GlobalBlocks,
                )
            }
            if (contactInfo) siteUpdateData.contactInfo = contactInfo
            if (validatedLocalBusiness !== undefined) siteUpdateData.localBusiness = validatedLocalBusiness
            if (socialLinks) siteUpdateData.socialLinks = socialLinks
            if (branding) siteUpdateData.branding = branding
            if (seo) siteUpdateData.seo = seo

            if (Object.keys(siteUpdateData).length > 0) {
                await payload.update({
                    collection: 'sites',
                    id: numericSiteId,
                    data: siteUpdateData,
                    req: transactionReq,
                })
            }

            if (normalizedBlocks && page) {
                await payload.update({
                    collection: 'pages',
                    id: page.id,
                    data: { layout: normalizedBlocks },
                    draft: isDraft ?? false,
                    req: transactionReq,
                })
            }

            if (localeContent && page) {
                await executeTenantTransaction(
                    payload,
                    transactionReq,
                    sql`
                        UPDATE pages
                        SET locale_content = ${JSON.stringify(localeContent)}::jsonb
                        WHERE id = ${page.id}
                          AND site_id = ${numericSiteId}
                    `,
                )
            }
        })

        try {
            await withPayloadRetry(persistSave, {
                onRetry: (attempt, kind, err) => {
                    const message = err instanceof Error ? err.message : String(err)
                    console.warn(`[Save Retry] attempt=${attempt} kind=${kind} pageId=${pageId ?? 'homepage'} msg=${message.slice(0, 200)}`)
                },
            })
        } catch (updateErr) {
            const errorMessage = updateErr instanceof Error ? updateErr.message : String(updateErr)
            const isImageFkError = /pages_blocks_[a-z_]+(_images|_testimonials|_members|_projects|_logos)?|image_id|avatar_id|upload/i.test(errorMessage)
            if (!normalizedBlocks || !isImageFkError) throw updateErr

            console.warn(`[Save] Retry without image refs after: ${errorMessage.slice(0, 160)}`)
            cleanupNonNumericImageFields(normalizedBlocks as Record<string, unknown>[])
            // Only strip logo-cloud logos[] image refs when the FK error is logo-related.
            // Stripping valid logo Media IDs due to an unrelated block FK error silently
            // destroys all logo images (200 response, data gone).
            const isLogoFkError = /pages_blocks_logo_cloud|pages_v_blocks_logo_cloud/i.test(errorMessage)
            // GH-1381: same guard for gallery images[] — an unrelated block's FK error must not
            // wipe valid gallery Media IDs (silent data loss: success response, image gone on reload).
            const isGalleryFkError = /pages_blocks_gallery|pages_v_blocks_gallery/i.test(errorMessage)
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
                                // Don't wipe valid logo Media IDs unless the FK error is logos-related
                                if (arrayField === 'logos' && f === 'logo' && !isLogoFkError) continue
                                // Don't wipe valid gallery image Media IDs unless the FK error is gallery-related
                                if (arrayField === 'images' && f === 'image' && !isGalleryFkError) continue
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
            await withPayloadRetry(persistSave)
        }

        return NextResponse.json({
            success: true,
            message: 'Saved successfully',
        })

    } catch (error: unknown) {

        if (error instanceof SavePageNotFoundError) {
            return NextResponse.json({ error: error.message, pageId: error.pageId }, { status: 404 })
        }
        if (error instanceof TenantSiteLockError) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

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

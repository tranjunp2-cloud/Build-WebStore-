export const dynamic = 'force-dynamic'
// Override vercel.json's 60s default — template application merges blocks,
// may re-run AI content generation, and persists 1 site + N pages + M blocks
// through Payload, which comfortably exceeds 60s in practice. Same root cause
// as generate-site 504s. Keeping parity to avoid another latency surprise.
export const maxDuration = 300
import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { notifyStepComplete } from '@/lib/sso/sso-api-client'
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { getActivePlanSubscription, canUse, canUseWithinLimit, recordUsage } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { checkRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'
import { mergeUserContent } from '@/lib/ai/merge-user-content'
import { resolveSiteType } from '@/lib/ai/site-type'
import { sanitizeBlocksForPayload } from '@/lib/ai/pages-schema'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { buildTemplateTheme } from '@/lib/ai/template-theme'
import { BLOCKS_TEMP_HIDDEN } from '@/lib/ai/unsupported-blocks'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'
import { ensureCartGlobalBlock } from '@/lib/ai/ensure-cart-global-block'
import { applyTemplateStructureToLayout, buildTemplateSystemBlocks } from '@/lib/editor/optimistic-template-swap'
import {
    executeTenantTransaction,
    lockTenantSiteRows,
    TenantSiteLockError,
    withTenantRowLock,
} from '@/lib/payload/tenant-row-lock'
import { bumpEditorRevision, formatDraftVersion, poolExec, readEditorRevision, txExec } from '@/lib/sites/editor-revision'

/** Recursively strip Payload system fields so Payload creates fresh records.
 *  Also normalizes populated relationship fields (objects with `id` + `url`/`filename`)
 *  back to just the numeric ID, which Payload expects for upload/relationship fields. */
const STRIP_KEYS = new Set(['id', '_order', '_parent_id', '_path', '_uuid', 'createdAt', 'updatedAt'])
const VALID_FIELD_TYPES = new Set(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number'])
const VALID_NAV_VARIANTS = new Set(['default', 'centered', 'mega', 'transparent', 'sidebar', 'floating'])
function stripSystemFields(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripSystemFields)
    if (obj && typeof obj === 'object') {
        const record = obj as Record<string, unknown>
        const result: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(record)) {
            if (STRIP_KEYS.has(key)) continue
            // Detect populated relationship/upload objects: { id: number, url: string, ... }
            // Normalize to just the ID so Payload accepts it
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const nested = val as Record<string, unknown>
                if (typeof nested.id === 'number' && (nested.url || nested.filename || nested.mimeType)) {
                    result[key] = nested.id
                    continue
                }
            }
            result[key] = stripSystemFields(val)
        }
        return result
    }
    return obj
}

function isStableBlockId(value: unknown): value is string {
    return typeof value === 'string' && (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        || /^[0-9a-f]{24}$/i.test(value)
    )
}

function successResponse(data: Record<string, unknown>): NextResponse {
    return NextResponse.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
    })
}

function errorResponse(
    status: number,
    code: string,
    message: string,
    details?: unknown,
): NextResponse {
    return NextResponse.json({
        success: false,
        error: {
            code,
            message,
            details: details ?? null,
            requestId: crypto.randomUUID(),
        },
    }, { status })
}

function prepareTemplateSwapLayout(layout: Record<string, unknown>[]): Record<string, unknown>[] {
    const normalizedLayout = normalizeBlocksForPersistence(
        layout.map(block => {
            const clean = stripSystemFields(block) as Record<string, unknown>
            return isStableBlockId(block.id) ? { ...clean, id: block.id } : clean
        })
            .filter(block => block.blockType !== 'google-maps')
            .filter(block => !BLOCKS_TEMP_HIDDEN.has(block.blockType as string)),
    )

    for (const block of normalizedLayout) {
        if (block.blockType === 'contact' && Array.isArray(block.formFields)) {
            block.formFields = (block.formFields as Record<string, unknown>[]).filter(field =>
                typeof field.fieldName === 'string' && field.fieldName.trim().length > 0 &&
                typeof field.label === 'string' && field.label.trim().length > 0 &&
                typeof field.fieldType === 'string' && VALID_FIELD_TYPES.has(field.fieldType),
            )
            if ((block.formFields as unknown[]).length === 0) {
                block.formFields = [
                    { fieldName: 'name', fieldType: 'text', label: 'Your Name', required: true },
                    { fieldName: 'email', fieldType: 'email', label: 'Email Address', required: true },
                    { fieldName: 'message', fieldType: 'textarea', label: 'Message', required: true },
                ]
            }
        }
        if (block.blockType === 'navigation' && (!block.variant || !VALID_NAV_VARIANTS.has(block.variant as string))) {
            block.variant = 'default'
        }
    }

    return normalizedLayout
}

function isTemplateSwapLayoutUnchanged(
    existingLayout: Record<string, unknown>[],
    nextLayout: Record<string, unknown>[],
): boolean {
    return JSON.stringify(stripSystemFields(existingLayout)) === JSON.stringify(stripSystemFields(nextLayout))
}

/**
 * POST /api/ai/apply-template
 * Creates a new site from a template's default blocks and theme.
 * Body: { templateId: string }
 */
export const POST = withAuth(async (user, req) => {
    let _siteId: string | number | null = null
    let _payload: Awaited<ReturnType<typeof getPayload>> | null = null
    let _createdPagesCount = 0

    try {
        // Rate Limit: 20 template applications per hour
        const rateLimit = await checkRateLimit(`ai:apply-template:${user.id}`, 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const payload = await getPayload({ config })
        _payload = payload

        const { data, errorResponse: validationErrorResponse } = await parseRequest(req, applyTemplateSchema)
        if (validationErrorResponse) return validationErrorResponse
        
        const { templateId, siteId, pageId } = data!

        // Find template
        let template: Record<string, unknown>
        try {
            template = await payload.findByID({
                collection: 'templates',
                id: templateId,
            }) as Record<string, unknown>
        } catch {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // Get tenant from user — auto-create if missing (same as generate-site)
        const userWithTenants = user as { id: number | string; firstName?: string; name?: string; tenants?: Array<{ tenant: unknown }> }
        let tenantId = userWithTenants.tenants?.[0]?.tenant
        if (typeof tenantId === 'object' && tenantId !== null) {
            tenantId = (tenantId as Record<string, unknown>).id
        }
        if (!tenantId) {
            // Try recovering orphaned tenant with legacy slug first
            const legacySlug = `store-${user.id}`
            const existing = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: legacySlug } },
                limit: 1,
            })
            if (existing.docs.length > 0) {
                const recoveredId = existing.docs[0].id as string | number
                // Provision FREEMIUM before linking user — fail-safe ordering:
                // if subscription create fails, user stays unlinked and retries cleanly.
                // Only provision when no row exists (expired sub = user must renew, not get FREEMIUM).
                // Known: check-then-create has a benign race if two concurrent requests hit
                // this path simultaneously → duplicate 'main' rows. Probability ~0 (first-time
                // onboarding). getActivePlanSubscription sort:-createdAt,limit:1 picks the newest.
                // Proper fix: unique constraint on (tenant_id, name) — deferred.
                const anySubRow = await payload.find({
                    collection: 'plan-subscriptions',
                    where: { and: [{ tenant: { equals: recoveredId } }, { name: { equals: 'main' } }] },
                    limit: 1,
                })
                if (anySubRow.totalDocs === 0) {
                    await payload.create({
                        collection: 'plan-subscriptions',
                        data: {
                            tenant: recoveredId,
                            name: 'main',
                            plan: 'FREEMIUM',
                            status: 'active',
                            startsAt: new Date().toISOString(),
                            endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                            packCode: 'FREEMIUM',
                        },
                    })
                }
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { tenants: [{ tenant: recoveredId, role: 'owner' }] } as Record<string, unknown>,
                })
                tenantId = recoveredId
            } else {
                // Smart slug from template name (F23), fallback to store-{id}
                const firstName = userWithTenants.firstName || userWithTenants.name || 'My'
                const templateName = (template.name as string) || ''
                const tenantName = templateName ? `${firstName}'s ${templateName}` : `${firstName}'s Store`
                const baseSlug = slugify(templateName || firstName)
                const tenantSlug = await ensureUniqueSlug(payload, baseSlug, user.id)

                const newTenant = await payload.create({
                    collection: 'tenants',
                    data: { name: tenantName, slug: tenantSlug, plan: 'free', status: 'active' },
                })
                // Provision FREEMIUM before linking user — fail-safe ordering.
                await payload.create({
                    collection: 'plan-subscriptions',
                    data: {
                        tenant: newTenant.id,
                        name: 'main',
                        plan: 'FREEMIUM',
                        status: 'active',
                        startsAt: new Date().toISOString(),
                        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        packCode: 'FREEMIUM',
                    },
                })
                tenantId = newTenant.id
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { tenants: [{ tenant: tenantId, role: 'owner' }] } as Record<string, unknown>,
                })
            }
        }

        // Hard-fail if tenant could not be resolved — avoids silent subscription bypass
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant could not be resolved' }, { status: 400 })
        }

        // Subscription check: website_builder must be enabled, then template_limit must not be exhausted
        const templateSub = await getActivePlanSubscription(payload, tenantId as string | number)
        if (!templateSub) {
            return NextResponse.json(
                { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } },
                { status: 403 },
            )
        }
        if (!await canUse(payload, templateSub.plan as PlanCode, 'website_builder')) {
            return NextResponse.json(
                { success: false, error: { code: 'FEATURE_LOCKED', message: 'Website builder is not available on your current plan.' } },
                { status: 403 },
            )
        }
        if (!await canUseWithinLimit(payload, templateSub.id, templateSub.plan as PlanCode, 'template_limit')) {
            return NextResponse.json(
                { success: false, error: { code: 'FEATURE_LOCKED', message: 'Template application not available on your current plan' } },
                { status: 403 },
            )
        }

        // F23: Auto-upgrade legacy store-{id} slug to smart slug from template name
        try {
            const tenant = await payload.findByID({ collection: 'tenants', id: tenantId as string | number })
            const currentSlug = tenant?.slug as string | undefined
            const templateName = (template.name as string) || ''
            if (currentSlug && /^store-\d+$/.test(currentSlug) && templateName) {
                const baseSlug = slugify(templateName)
                if (baseSlug && baseSlug !== currentSlug) {
                    const newSlug = await ensureUniqueSlug(payload, baseSlug, user.id)
                    await payload.update({
                        collection: 'tenants',
                        id: tenantId as string | number,
                        data: { slug: newSlug } as Record<string, unknown>,
                    })
                }
            }
        } catch {
            // Non-critical — slug upgrade failure shouldn't block template apply
        }

        const blocks = (template.defaultBlocks as Record<string, unknown>[]) || []

        // Block sanitization moved to `src/lib/ai/pages-schema.ts` — shared with
        // merge-user-content + unit-testable in isolation. See that file for
        // whitelist/schema/aliases rationale.
        const sanitizeBlocks = sanitizeBlocksForPayload

        // Auto-generate navigation links from template pages
        function injectNavLinks(
            sanitizedPages: Array<{ title: string; slug: string; isHomepage?: boolean; layout: Record<string, unknown>[] }>,
        ) {
            const navLinks = sanitizedPages
                .filter(p => p.slug !== '404')
                .map(p => ({
                    label: p.title,
                    url: p.isHomepage ? '/' : `/${p.slug}`,
                    newTab: false,
                }))

            for (const page of sanitizedPages) {
                for (const block of page.layout) {
                    if (block.blockType === 'navigation') {
                        // Only inject if no links already present
                        const existing = block.links as unknown[] | undefined
                        if (!existing || existing.length === 0) {
                            block.links = navLinks
                        }
                    }
                }
            }
        }

        const templateTheme = buildTemplateTheme(template.defaultTheme as Record<string, unknown> | null | undefined)

        // === APPLY TO EXISTING SITE (multi-page + transaction) ===
        if (siteId) {
            // Build template variant map: blockType → variant/style/layout from template
            const templatePages = (template.templatePages as Array<{ layout: unknown }>)
            const templateBlockList = templatePages?.length
                ? (templatePages.flatMap(p => (p.layout as Record<string, unknown>[]) || []))
                : blocks
            // GH-1266: coerce before sanitize — sanitizeBlocks maps unknown variants→'centered',
            // overwriting the coercion target. Coercing first preserves 'fullscreen'/'split-left'.
            coerceVideoVariants(templateBlockList as Record<string, unknown>[])
            const sanitizedTemplateBlocks = sanitizeBlocks(templateBlockList)

            const templateHomepagePage =
                templatePages?.find((page) => Boolean((page as { isHomepage?: boolean }).isHomepage))
                ?? templatePages?.[0]
            const templateHomepageLayout =
                (templateHomepagePage?.layout as Record<string, unknown>[] | undefined) ?? []
            const rawHomepageLayout = (templateHomepageLayout.length ? templateHomepageLayout : blocks) as Record<string, unknown>[]
            coerceVideoVariants(rawHomepageLayout)
            const templateBlocksClean = sanitizeBlocks(rawHomepageLayout)

            let existingSite: Record<string, unknown> | null = null
            let existingSiteName: unknown = null
            const allUnmatchedBlocks: Record<string, unknown>[] = []
            let appliedPage: { id: string | number; layout: Record<string, unknown>[] } | null = null
            let appliedSiteState: {
                theme: Record<string, unknown>
                headerBlock: Record<string, unknown> | null
                footerBlock: Record<string, unknown> | null
                globalBlocks: Record<string, unknown> | null
            } | null = null
            try {
                await withTenantRowLock(payload, tenantId as string | number, async (transactionReq) => {
                    await lockTenantSiteRows(payload, tenantId as string | number, [Number(siteId)], transactionReq)

                    existingSite = await payload.findByID({
                        collection: 'sites',
                        id: Number(siteId),
                        depth: 0,
                        req: transactionReq,
                    }) as Record<string, unknown> | null
                    if (!existingSite) throw new TenantSiteLockError([Number(siteId)])
                    existingSiteName = existingSite.name

                    // Read the homepage as context for canonical header/footer fallbacks,
                    // but update exactly the page the editor is showing. Implicitly changing
                    // the homepage while another page is active makes the editor's single
                    // undo snapshot incomplete. When no pageId is supplied, the homepage
                    // remains the backwards-compatible target.
                    const pageScope = pageId
                        ? sql`AND (pages.id = ${Number(pageId)} OR pages.is_homepage IS TRUE)`
                        : sql`AND pages.is_homepage IS TRUE`
                    const pageIdRows = await executeTenantTransaction<{ rows: Array<{ id: number }> }>(
                        payload,
                        transactionReq,
                        sql`SELECT pages.id
                            FROM pages
                            INNER JOIN sites ON sites.id = pages.site_id
                            WHERE pages.site_id = ${Number(siteId)}
                              AND sites.tenant_id = ${tenantId}
                              AND pages.deleted_at IS NULL
                              ${pageScope}
                            ORDER BY pages.id
                            FOR UPDATE OF pages`,
                    )
                    // The locked, tenant-scoped rows exclude deleted and foreign pages.
                    // Reject a stale editor target before changing the site.
                    if (pageId && !pageIdRows.rows.some(row => String(row.id) === pageId)) {
                        throw Object.assign(new Error('Page not found'), { code: 'PAGE_NOT_FOUND' })
                    }
                    const pageDocs = await Promise.all(pageIdRows.rows.map(row => payload.findByID({
                        collection: 'pages',
                        id: row.id,
                        depth: 0,
                        draft: true,
                        req: transactionReq,
                    })))

                    const reskinnedLayouts: Array<{ layout?: unknown[] }> = []
                    const pageUpdates: Array<{ id: string | number; layout: Record<string, unknown>[] }> = []

                    for (const page of pageDocs) {
                        const pageData = page as Record<string, unknown>
                        const isTargetPage = pageId
                            ? String(page.id) === pageId
                            : Boolean(pageData.isHomepage)
                        if (!isTargetPage) continue
                        const currentBlocks = (pageData.layout as Record<string, unknown>[]) || []
                        let newLayout: Record<string, unknown>[]

                        if (pageData.isHomepage && templateBlocksClean.length > 0) {
                            const { mergedBlocks, unmatchedUserBlocks } = mergeUserContent(
                                templateBlocksClean,
                                currentBlocks,
                                { returnDetails: true },
                            )
                            allUnmatchedBlocks.push(...unmatchedUserBlocks)
                            // AC2: sections with no destination slot are reported but are not
                            // injected into the new template. The previous draft remains in
                            // Payload versions and the editor's single undo batch.
                            newLayout = mergedBlocks
                        } else if (currentBlocks.length > 0) {
                            newLayout = applyTemplateStructureToLayout(sanitizedTemplateBlocks, currentBlocks)
                        } else {
                            continue
                        }

                        const footerIndex = newLayout.findIndex(block => block.blockType === 'footer')
                        if (footerIndex !== -1 && footerIndex < newLayout.length - 1) {
                            const [footer] = newLayout.splice(footerIndex, 1)
                            newLayout.push(footer)
                        }

                        const normalizedLayout = prepareTemplateSwapLayout(newLayout)
                        reskinnedLayouts.push({ layout: normalizedLayout })
                        if (pageId && String(page.id) === pageId) {
                            appliedPage = { id: page.id, layout: normalizedLayout }
                        }
                        if (!isTemplateSwapLayoutUnchanged(currentBlocks, normalizedLayout)) {
                            pageUpdates.push({ id: page.id, layout: normalizedLayout })
                        }
                    }

                    const homepage = pageDocs.find(page => Boolean((page as Record<string, unknown>).isHomepage)) as Record<string, unknown> | undefined
                    const homepageBlocks = (homepage?.layout as Record<string, unknown>[] | undefined) ?? []
                    const currentHeader = (existingSite.pendingHeaderBlock ?? existingSite.headerBlock
                        ?? homepageBlocks.find(block => block.blockType === 'navigation')) as Record<string, unknown> | null | undefined
                    const currentFooter = (existingSite.pendingFooterBlock ?? existingSite.footerBlock
                        ?? homepageBlocks.find(block => block.blockType === 'footer')) as Record<string, unknown> | null | undefined
                    const effectiveGlobalBlocks = (existingSite.pendingGlobalBlocks ?? existingSite.globalBlocks) as Record<string, unknown> | null | undefined
                    const { headerBlock: nextHeader, footerBlock: nextFooter, globalBlocks: nextGlobalBlocks } = buildTemplateSystemBlocks(
                        templateBlocksClean,
                        { headerBlock: currentHeader, footerBlock: currentFooter, globalBlocks: effectiveGlobalBlocks },
                        reskinnedLayouts.flatMap(page => page.layout ?? []) as Record<string, unknown>[],
                    )
                    appliedSiteState = {
                        theme: templateTheme,
                        headerBlock: nextHeader ?? null,
                        footerBlock: nextFooter ?? null,
                        globalBlocks: nextGlobalBlocks,
                    }

                    // Payload performs validation, hooks and version writes for every
                    // page. Start independent page operations together on the same
                    // transaction, then update the canonical site draft.
                    await Promise.all(pageUpdates.map(page => payload.update({
                        collection: 'pages',
                        id: page.id,
                        data: { layout: page.layout },
                        draft: true,
                        req: transactionReq,
                    })))
                    _createdPagesCount += pageUpdates.length

                    await payload.update({
                        collection: 'sites',
                        id: Number(siteId),
                        data: {
                            theme: templateTheme,
                            generationStatus: 'completed',
                            ...(nextHeader ? { pendingHeaderBlock: nextHeader } : {}),
                            ...(nextFooter ? { pendingFooterBlock: nextFooter } : {}),
                            ...(nextGlobalBlocks !== effectiveGlobalBlocks && nextGlobalBlocks !== null
                                ? { pendingGlobalBlocks: nextGlobalBlocks } : {}),
                        },
                        req: transactionReq,
                    })
                    // the theme / menu / footer and the reskinned pages changed: another editor tab still holding the
                    // old ones gets a 409 instead of saving them back over the template (see lib/sites/editor-revision)
                    await bumpEditorRevision(txExec(payload, transactionReq), Number(siteId), { site: true, pageIds: pageUpdates.map(page => page.id) })
                })
            } catch (applyError) {
                console.error('[Apply Template] Transaction failed:', applyError)
                if (applyError instanceof TenantSiteLockError) {
                    return errorResponse(404, 'SITE_NOT_FOUND', 'Site not found')
                }
                if (applyError instanceof Error && 'code' in applyError && applyError.code === 'PAGE_NOT_FOUND') {
                    return errorResponse(404, 'PAGE_NOT_FOUND', applyError.message)
                }
                return errorResponse(500, 'TEMPLATE_SWAP_FAILED', 'Failed to apply template. Your previous content has been restored.')
            }

            _siteId = Number(siteId)

            // Payload hooks run before an externally-owned transaction commits.
            // Bust cache again after the callback transaction has committed.
            try {
                revalidateTag(`site-${Number(siteId)}`)
                revalidateTag('tenants')
            } catch (cacheError) {
                // Non-Next test/runtime context — cache invalidation is best effort.
                console.warn('[Apply Template] Cache revalidation skipped:', cacheError)
            }

            // 5. Increment template usage count (non-critical — don't fail the whole apply)
            try {
                await payload.update({
                    collection: 'templates',
                    id: templateId,
                    data: { usageCount: (Number(template.usageCount) || 0) + 1 },
                })
            } catch (err) {
                console.warn('[Apply Template] Failed to increment usageCount:', templateId, err instanceof Error ? err.message : err)
            }

            try {
                await recordUsage(payload, templateSub.id, 'template_limit')
            } catch (err) {
                console.warn('[ApplyTemplate] Failed to record template_limit usage:', err)
            }

            // the revision the applying tab now holds (it renders the applied state), so its next save is not refused
            const draftPageId = appliedPage ? Number(appliedPage.id) : pageId && /^\d+$/.test(pageId) ? Number(pageId) : null
            const draftVersion = await readEditorRevision(poolExec(payload), Number(siteId), draftPageId)
                .then(revision => (draftPageId === null ? null : formatDraftVersion(revision)))
                .catch(() => null)

            const response = successResponse({
                siteId: Number(siteId),
                siteName: existingSiteName,
                ...(draftVersion ? { draftVersion } : {}),
                templateName: template.name,
                pagesUpdated: _createdPagesCount,
                applied: true,
                appliedState: appliedSiteState ? {
                    site: appliedSiteState,
                    page: appliedPage,
                } : undefined,
                unmatchedBlocks: allUnmatchedBlocks.length > 0
                    ? [...new Set(allUnmatchedBlocks.map(b => b.blockType as string))]
                    : undefined,
            })

            return response
        }

        // === CREATE NEW SITE FROM TEMPLATE (multi-page) ===
        const newSiteTemplatePages = (template.templatePages as Array<{ title: string; slug: string; isHomepage?: boolean; layout: unknown }>)
        const newSiteRawPages = newSiteTemplatePages?.length
            ? newSiteTemplatePages
            : [{ title: 'Home', slug: 'home', isHomepage: true, layout: blocks }]
        const pagesToCreate = newSiteRawPages.map(p => ({
            title: p.title,
            slug: p.slug,
            isHomepage: p.isHomepage,
            layout: sanitizeBlocks((p.layout as Record<string, unknown>[]) || [])
                .filter(b => !BLOCKS_TEMP_HIDDEN.has(b.blockType as string)), // GH-1024
        }))
        injectNavLinks(pagesToCreate)

        const site = await payload.create({
            collection: 'sites',
            data: {
                name: String(template.name || 'Untitled'),
                tenant: tenantId,
                status: 'draft',
                generationStatus: 'generating',
                siteType: resolveSiteType(
                    Array.isArray(template.category) ? template.category[0] : template.category,
                ),
                theme: templateTheme,
            },
        })
        _siteId = site.id as string | number

        // Create all template pages
        for (const [idx, page] of pagesToCreate.entries()) {
            await payload.create({
                collection: 'pages',
                data: {
                    title: page.title,
                    slug: page.slug,
                    site: site.id,
                    tenant: tenantId,
                    isHomepage: page.isHomepage ?? idx === 0,
                    _status: 'published',
                    layout: stripSystemFields(page.layout) as Record<string, unknown>[],
                },
            })
            _createdPagesCount++
        }

        // 404 Page (always created)
        await payload.create({
            collection: 'pages',
            data: {
                title: '404 Not Found',
                slug: '404',
                site: site.id,
                tenant: tenantId,
                isHomepage: false,
                _status: 'published',
                layout: [
                    { blockType: 'hero', variant: 'centered', headline: '404', subheadline: 'Page Not Found — The page you are looking for does not exist or has been moved.' },
                ],
                seo: {
                    title: '404 - Page Not Found',
                    description: 'The page you are looking for does not exist.',
                    noIndex: true,
                },
            },
        })
        _createdPagesCount++

        // Mark generation completed (+ auto-add floating cart when template
        // pages contain commerce blocks — fresh site, so no prior cart config)
        await payload.update({
            collection: 'sites',
            id: site.id as string | number,
            data: {
                generationStatus: 'completed',
                ...ensureCartGlobalBlock(null, pagesToCreate),
            },
        })

        // Increment template usage count (non-critical)
        try {
            await payload.update({
                collection: 'templates',
                id: templateId,
                data: { usageCount: (Number(template.usageCount) || 0) + 1 },
            })
        } catch (err) {
            console.warn('[Apply Template] Failed to increment usageCount:', templateId, err instanceof Error ? err.message : err)
        }

        try {
            await recordUsage(payload, templateSub.id, 'template_limit')
        } catch (err) {
            console.warn('[ApplyTemplate] Failed to record template_limit usage:', err)
        }

        // Notify SSO Hub: user picked a template (step 1)
        // after() runs post-response on Vercel; falls back to fire-and-forget outside request scope (tests).
        const _notifyStep1 = () =>
            notifyStepComplete(payload, user.id, 1).catch((err) =>
                console.error('[ApplyTemplate] SSO step 1 notify failed:', err),
            )
        try {
            after(_notifyStep1)
        } catch {
            void _notifyStep1()
        }

        return NextResponse.json({
            success: true,
            siteId: site.id,
            siteName: site.name,
            templateName: template.name,
            pagesCreated: pagesToCreate.length + 1, // +1 for 404
        })

    } catch (error: unknown) {
        // Smart status: partial success (≥1 page created) = completed, 0 pages = failed
        if (_siteId && _payload) {
            const status = _createdPagesCount > 0 ? 'completed' : 'failed'
            await _payload.update({
                collection: 'sites',
                id: _siteId,
                data: { generationStatus: status },
            }).catch((_e: unknown) => console.error('[Apply Template] Failed to update generation status:', _e))
        }

        const errMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Apply Template Error]', errMessage, error)
        return NextResponse.json(
            { error: `Failed to apply template: ${errMessage}` },
            { status: 500 },
        )
    }
}, { csrf: true, requireMfa: true })

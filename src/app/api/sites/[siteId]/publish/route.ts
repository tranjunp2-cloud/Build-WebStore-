export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { stripArrayItemIds } from '@/lib/payload/strip-block-ids'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { sanitizeBlocksRequiredFields } from '@/lib/ai/normalize-required-titles'
import { blockRegistry } from '@/blocks/registry'
import { revalidateTag } from 'next/cache'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

// GH-1621 P1: singular label for a nested-array item, keyed by its Payload field
// name — used to build a human-readable validation-error location like
// "Portfolio Grid → Project 5 → Title" instead of the raw path segment. Falls
// back to a capitalized field name for any array not listed here.
const ARRAY_ITEM_LABELS: Record<string, string> = {
    projects: 'Project',
    services: 'Service',
    members: 'Member',
    products: 'Product',
    properties: 'Property',
    doctors: 'Doctor',
    images: 'Image',
    reviews: 'Review',
    events: 'Event',
    posts: 'Post',
    classes: 'Class',
    videos: 'Video',
    caseStudies: 'Case Study',
    steps: 'Step',
    categories: 'Category',
    testimonials: 'Testimonial',
    plans: 'Plan',
    faqs: 'FAQ',
}

/**
 * Turns a raw Payload validation-error path (e.g. `layout.6.projects.4.title`)
 * into a human-readable location using the page's own layout (block type +
 * nested array field are only knowable from the actual data at the error site,
 * not from the path string alone). Returns `null` if the path doesn't match the
 * expected `layout.<blockIndex>...` shape (e.g. a top-level page field).
 */
function friendlyValidationLocation(path: string, layout: unknown[]): string | null {
    const segments = path.split('.')
    if (segments[0] !== 'layout') return null
    const blockIndex = Number(segments[1])
    if (!Number.isInteger(blockIndex)) return null
    const block = Array.isArray(layout) ? (layout[blockIndex] as Record<string, unknown> | undefined) : undefined
    const blockType = typeof block?.blockType === 'string' ? block.blockType : undefined
    const blockLabel = blockType ? (blockRegistry.getBlockMeta(blockType)?.name ?? blockType) : `Block ${blockIndex + 1}`

    // layout.<blockIndex>.<arrayField>.<itemIndex>.<fieldName> — exactly ONE
    // array level. Guarded to === 5 (not >=5): a doubly-nested array (e.g.
    // menu-food/menu-display's `categories[].items[].name`, 7 segments) would
    // otherwise read segments[4] ("items", the nested array's field name) as if
    // it were the leaf field — a confidently WRONG label, worse than falling
    // through to the field-name-only case below (which is always correct, just
    // less specific about which item).
    if (segments.length === 5) {
        const arrayField = segments[2]
        const itemIndex = Number(segments[3])
        const fieldName = segments[4]
        if (Number.isInteger(itemIndex)) {
            const itemLabel = ARRAY_ITEM_LABELS[arrayField] || (arrayField.charAt(0).toUpperCase() + arrayField.slice(1).replace(/s$/, ''))
            return `${blockLabel} → ${itemLabel} ${itemIndex + 1} → ${fieldName}`
        }
    }

    // layout.<blockIndex>.<fieldName> (top-level block field) OR deeper nesting
    // than this function resolves an item label for — the leaf field name (last
    // path segment) is always correct regardless of depth, so use that alone.
    const fieldName = segments[segments.length - 1]
    return `${blockLabel} → ${fieldName}`
}

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
        let bodyGlobalBlocks: unknown = undefined
        let hasBodyGlobalBlocks = false
        let bodyHeaderBlock: unknown = undefined
        let hasBodyHeaderBlock = false
        let bodyFooterBlock: unknown = undefined
        let hasBodyFooterBlock = false
        try {
            const rawBody = await req.json()
            const parsed = publishBodySchema.safeParse(rawBody)
            if (parsed.success) {
                const pb = parsed.data
                if ('globalBlocks' in pb) { bodyGlobalBlocks = pb.globalBlocks; hasBodyGlobalBlocks = true }
                if ('headerBlock' in pb) { bodyHeaderBlock = pb.headerBlock; hasBodyHeaderBlock = true }
                if ('footerBlock' in pb) { bodyFooterBlock = pb.footerBlock; hasBodyFooterBlock = true }
            } else {
                console.warn('[publish] body schema validation failed — using DB fallback', parsed.error.flatten())
            }
        } catch {
            // Body not present or not JSON — proceed with DB fallback
        }

        // Verify site exists
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

        const sub = await getActivePlanSubscription(payload, siteTenantId)
        if (!sub) {
            return NextResponse.json(
                { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } },
                { status: 403 }
            )
        }
        const builderAllowed = await canUse(payload, sub.plan as PlanCode, 'website_builder')
        if (!builderAllowed) {
            return NextResponse.json(
                { success: false, error: { code: 'FEATURE_LOCKED', message: 'Feature not available on your current plan' } },
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
        const failureDetails: Array<{
            pageId: string
            pageTitle?: string
            errName?: string
            errMsg?: string
            pgCode?: string
            pgColumn?: string
            pgTable?: string
            causeMsg?: string
            friendlyDetail?: string
            validationErrors?: Array<{ path?: string; message?: string }>
        }> = []
        // Soft-deleted pages must NEVER be promoted: writing their main row trips the
        // partial unique index pages_site_slug_uniq (site_id, slug) WHERE deleted_at IS
        // NULL → Payload surfaces it as a "site_id, slug must be unique" ValidationError
        // → 500. The deletedAt filter is unreliable through `draft: true` (it reads the
        // version snapshot, not the live row), so resolve the live page ids from a plain
        // (non-draft) query — that reads the main `pages` rows where deleted_at is accurate.
        // Resolve deleted ids from the DB deleted_at column (only reliable source: a
        // draft:true find reads stale version snapshots; a non-draft find can miss
        // draft-only pages). Skip exactly these — never a live page.
        const deletedPageIds = new Set<number>()
        try {
            const db = payload.db.drizzle as { execute: (q: unknown) => Promise<{ rows: Array<{ id: string | number }> }> }
            const res = await db.execute(sql`SELECT id FROM pages WHERE site_id = ${Number(siteId)} AND deleted_at IS NOT NULL`)
            res.rows.forEach((r) => deletedPageIds.add(Number(r.id)))
        } catch (err) {
            // Non-fatal: this is a safety filter, not core logic. A transient DB error
            // here must NOT block an otherwise-valid publish — degrade to the empty set
            // (pre-fix behavior). Worst case a soft-deleted page is promoted and trips
            // the partial unique index → that page lands in failedPageIds with detail,
            // which is strictly better than 500-ing the whole publish on a pool blip.
            console.warn('[Publish] deletedPageIds query failed — skipping soft-delete filter',
                err instanceof Error ? err.message : String(err))
        }

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
                // Orphaned draft version rows (parent_id NULL in _pages_v — left behind by a
                // hard-deleted/failed page create) surface through `draft: true` as docs with
                // id=null. They map to no live `pages` row, so `update({ id: null })` makes
                // Payload treat it as a bulk update and throw "Missing 'where' query of
                // documents to update." — which 500s the ENTIRE publish (all real pages too).
                // A promotable page always has a serial PK, so a null id is never a real page:
                // skip it. (Cleaning the orphan _pages_v rows is separate DB hygiene.)
                if (pg.id == null) {
                    console.warn(`[Publish] Skipping orphan version row with null id (site ${siteId})`)
                    continue
                }
                const pageId = String(pg.id)
                // Never promote a soft-deleted page (see deletedPageIds above).
                if (deletedPageIds.has(Number(pg.id))) continue
                try {
                    // Promote full draft doc — strip system/version fields, keep
                    // everything else so published version matches latest draft.
                    // `deletedAt` is stripped too: soft-delete state lives on the base
                    // `pages` row (written via raw SQL, never through promote). The
                    // draft snapshot carries deletedAt=null, so including it would reset
                    // deleted_at→NULL and trip pages_site_slug_uniq. This is the 2nd
                    // line of defence behind the deletedPageIds skip: even if a page is
                    // soft-deleted *mid-publish* (after the deletedPageIds query) and
                    // still reaches here, promote leaves deleted_at untouched → no 500.
                    const SYSTEM_FIELDS = new Set([
                        'id', '_status', 'createdAt', 'updatedAt', 'sizes', 'deletedAt',
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

                    // Drop block/array row `id` + `_uuid` before promote so
                    // Payload's live block tables regenerate fresh UUIDs,
                    // avoiding PG 23505 when AI-seeded block UUIDs collide
                    // across pages. See stripArrayItemIds doc for details.
                    if (Array.isArray(data.layout)) {
                        data.layout = stripArrayItemIds(data.layout)
                        // Normalize variants before Payload validates — DB records pre-PR#757
                        // may still have removed variant strings ('expanded', 'mega-footer')
                        // that cause ValidationError → 500 on publish.
                        data.layout = normalizeBlocksForPersistence(data.layout as Record<string, unknown>[])
                        // GH-1621: backfill/drop required array-item fields (portfolio-grid
                        // projects[].title, team members[].name, etc — see
                        // normalize-required-titles.ts for full coverage + rationale) right
                        // before this is validated by payload.update below. Deliberately
                        // placed HERE, not on every draft autosave — this is the one point
                        // where "the draft is about to become the live site" is actually
                        // true, so nothing gets silently rewritten while the user is still
                        // mid-edit.
                        data.layout = sanitizeBlocksRequiredFields(data.layout as Record<string, unknown>[])
                    }

                    await payload.update({
                        collection: 'pages',
                        id: pg.id,
                        data,
                        draft: false,
                    })
                } catch (err) {
                    // Two distinct failure shapes bubble up here, and the old
                    // handler only pulled out the first — so the second class
                    // of failure surfaced to the user as `{pageId}` with zero
                    // diagnostic detail.
                    //
                    //   1. Drizzle/pg errors — real detail on err.cause
                    //      (.code/.column/.table/.message).
                    //   2. Payload ValidationError — no .cause; detail lives
                    //      on err.data.errors[] as {path,message}. Triggers
                    //      whenever a nested required field on a block is
                    //      blank (common on industry blocks whose required
                    //      array rows were seeded empty by AI gen or an
                    //      older composer).
                    //
                    // Always capture name+message so any un-classified error
                    // type still gives the user something actionable.
                    type PgErrLike = { code?: string; detail?: string; table?: string; column?: string; message?: string }
                    type ValErrItem = { path?: string; message?: string }
                    const cause = (err as { cause?: unknown })?.cause
                    const pgErr: PgErrLike | null = cause && typeof cause === 'object' ? (cause as PgErrLike) : null
                    const errName = err instanceof Error ? err.name : 'UnknownError'
                    const errMsg = err instanceof Error ? err.message : String(err)
                    const data = (err as { data?: unknown })?.data
                    const rawErrors = data && typeof data === 'object' ? (data as { errors?: unknown }).errors : null
                    const validationErrors: ValErrItem[] = Array.isArray(rawErrors)
                        ? (rawErrors as ValErrItem[]).map(e => ({
                            path: typeof e?.path === 'string' ? e.path : undefined,
                            message: typeof e?.message === 'string' ? e.message : undefined,
                        }))
                        : []

                    // GH-1621 P1: build a human-readable location for the toast, e.g.
                    // "About Us → Portfolio Grid → Project 5 → Title" instead of the raw
                    // "title" field name — uses `pg.layout` (the ORIGINAL draft, not the
                    // `data.layout` derived from it above) to resolve the failing block's
                    // type + item index. Safe because blockType at a given index never
                    // changes across stripArrayItemIds/normalizeBlocksForPersistence/
                    // sanitizeBlocksRequiredFields (all pure, order-preserving `.map()`s —
                    // sanitizeTestimonialItems is the one exception that can drop items,
                    // but only for testimonials' OWN required fields, which by definition
                    // can no longer be the cause of a validation error reaching this catch
                    // block, since sanitizeBlocksRequiredFields already fixed them above).
                    // `pg.layout` is also simpler to reach here — `data` is try-block-scoped.
                    const firstPathSegments = validationErrors[0]?.path
                    const pageTitle = typeof (pg as Record<string, unknown>).title === 'string' ? (pg as Record<string, unknown>).title as string : undefined
                    const pageLayout = Array.isArray((pg as Record<string, unknown>).layout) ? (pg as Record<string, unknown>).layout as unknown[] : []
                    const location = firstPathSegments ? friendlyValidationLocation(firstPathSegments, pageLayout) : null
                    const friendlyDetail = location
                        ? `${pageTitle ? `${pageTitle} → ` : ''}${location}: ${validationErrors[0]?.message || 'This field is required.'}`
                        : undefined

                    console.warn('[Publish] Failed to promote page', JSON.stringify({
                        pageId,
                        pageTitle,
                        errName,
                        errMsg: errMsg.slice(0, 300),
                        pgCode: pgErr?.code,
                        pgColumn: pgErr?.column,
                        pgTable: pgErr?.table,
                        causeMsg: pgErr?.message?.slice(0, 300),
                        validationErrors,
                        friendlyDetail,
                    }))
                    failedPageIds.push(pageId)
                    failureDetails.push({
                        pageId,
                        pageTitle,
                        errName,
                        errMsg: errMsg.slice(0, 300),
                        pgCode: pgErr?.code,
                        pgColumn: pgErr?.column,
                        pgTable: pgErr?.table,
                        causeMsg: pgErr?.message?.slice(0, 300),
                        friendlyDetail,
                        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
                    })
                }
            }

            hasMore = sitePages.hasNextPage ?? (sitePages.docs.length === 50)
            pageNum++
        }

        if (failedPageIds.length > 0) {
            console.error(`[Publish] ${failedPageIds.length} page(s) failed to promote:`, failedPageIds)
            // Status by failure type (GH #1535): 409 ONLY when every failure is a
            // client/data ValidationError (a required nested block field left blank →
            // user fixes it). If ANY failure is a genuine server fault (pg error, missing
            // column, TypeError, Neon blip) keep 500 so it still surfaces in 5xx
            // monitoring. Either way it's non-2xx, so `res.ok` stays false and the client
            // surfaces the error unchanged; `failures[].validationErrors` says which field.
            const allValidation = failureDetails.every((f) => (f.validationErrors?.length ?? 0) > 0)
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
                { status: allValidation ? 409 : 500 },
            )
        }

        // Publish the site AFTER all pages promoted successfully.
        // Promote header/footer/globalBlocks from client body (primary — authoritative
        // post-flush state) or from pending DB fields (fallback for older clients).
        const publishData: Record<string, unknown> = {
            status: 'published',
            publishedAt: new Date().toISOString(),
        }

        // Reuse `existing` (fetched above for site-existence check) as the pending-fields source.
        // Avoids a redundant findByID round-trip and closes a tiny TOCTOU window.
        const sitePending = (!hasBodyGlobalBlocks || !hasBodyHeaderBlock || !hasBodyFooterBlock)
            ? (existing as Record<string, unknown>)
            : null

        if (hasBodyGlobalBlocks) {
            publishData.globalBlocks = bodyGlobalBlocks
            publishData.pendingGlobalBlocks = null
        } else {
            const pendingGb = sitePending?.pendingGlobalBlocks
            if (pendingGb !== undefined && pendingGb !== null) {
                publishData.globalBlocks = pendingGb
                publishData.pendingGlobalBlocks = null
            }
        }

        if (hasBodyHeaderBlock) {
            publishData.headerBlock = bodyHeaderBlock
            publishData.pendingHeaderBlock = null
        } else {
            const pendingHb = sitePending?.pendingHeaderBlock
            if (pendingHb !== undefined && pendingHb !== null) {
                publishData.headerBlock = pendingHb
                publishData.pendingHeaderBlock = null
            }
        }

        if (hasBodyFooterBlock) {
            publishData.footerBlock = bodyFooterBlock
            publishData.pendingFooterBlock = null
        } else {
            const pendingFb = sitePending?.pendingFooterBlock
            if (pendingFb !== undefined && pendingFb !== null) {
                publishData.footerBlock = pendingFb
                publishData.pendingFooterBlock = null
            }
        }

        const site = await payload.update({
            collection: 'sites',
            id: siteId,
            data: publishData,
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

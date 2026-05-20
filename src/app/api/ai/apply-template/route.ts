export const dynamic = 'force-dynamic'
// Override vercel.json's 60s default — template application merges blocks,
// may re-run AI content generation, and persists 1 site + N pages + M blocks
// through Payload, which comfortably exceeds 60s in practice. Same root cause
// as generate-site 504s. Keeping parity to avoid another latency surprise.
export const maxDuration = 300
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'
import { mergeUserContent } from '@/lib/ai/merge-user-content'
import { resolveSiteType } from '@/lib/ai/site-type'
import { sanitizeBlocksForPayload } from '@/lib/ai/pages-schema'
import { normalizeBlocksForPersistence } from '@/lib/block-normalization'
import { BLOCKS_TEMP_HIDDEN } from '@/lib/ai/unsupported-blocks'

/** Recursively strip Payload system fields so Payload creates fresh records.
 *  Also normalizes populated relationship fields (objects with `id` + `url`/`filename`)
 *  back to just the numeric ID, which Payload expects for upload/relationship fields. */
const STRIP_KEYS = new Set(['id', '_order', '_parent_id', '_path', '_uuid', 'createdAt', 'updatedAt'])
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
        const rateLimit = await checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const payload = await getPayload({ config })
        _payload = payload

        const { data, errorResponse } = await parseRequest(req, applyTemplateSchema)
        if (errorResponse) return errorResponse
        
        const { templateId, siteId } = data!

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
                tenantId = existing.docs[0].id
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { tenants: [{ tenant: tenantId, role: 'owner' }] } as Record<string, unknown>,
                })
            } else {
                // Smart slug from template name (F23), fallback to store-{id}
                const firstName = userWithTenants.firstName || userWithTenants.name || 'My'
                const templateName = (template.name as string) || ''
                const tenantName = templateName ? `${firstName}'s ${templateName}` : `${firstName}'s Store`
                const baseSlug = slugify(templateName || firstName)
                const tenantSlug = await ensureUniqueSlug(payload, baseSlug, user.id)

                const newTenant = await payload.create({
                    collection: 'tenants',
                    data: { name: tenantName, slug: tenantSlug },
                })
                tenantId = newTenant.id
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: { tenants: [{ tenant: tenantId, role: 'owner' }] } as Record<string, unknown>,
                })
            }
        }

        // F23: Auto-upgrade legacy store-{id} slug to smart slug from template name
        if (tenantId) {
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

        const rawTheme = (template.defaultTheme as Record<string, unknown>) || {}
        // Pick only valid theme fields — Payload select fields reject unknown values
        const VALID_HEADING_FONTS = new Set(['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway', 'Plus Jakarta Sans'])
        const VALID_BODY_FONTS = new Set(['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito', 'Poppins', 'Plus Jakarta Sans'])
        const VALID_COLOR_MODES = new Set(['light', 'dark'])
        const VALID_BORDER_RADIUS = new Set(['sharp', 'subtle', 'rounded', 'soft', 'pill'])
        const VALID_SPACING = new Set(['compact', 'default', 'relaxed'])
        const VALID_SHADOW = new Set(['none', 'subtle', 'medium', 'dramatic'])
        const rawHeading = String(rawTheme.fontHeading || '')
        const rawBody = String(rawTheme.fontBody || '')
        const rawColorMode = String(rawTheme.colorMode || '')
        const templateTheme: Record<string, unknown> = {
            primaryColor: String(rawTheme.primaryColor || '#0ea5e9'),
            secondaryColor: String(rawTheme.secondaryColor || '#d946ef'),
            fontHeading: VALID_HEADING_FONTS.has(rawHeading) ? rawHeading : 'Outfit',
            fontBody: VALID_BODY_FONTS.has(rawBody) ? rawBody : 'Inter',
            colorMode: VALID_COLOR_MODES.has(rawColorMode) ? rawColorMode : 'dark',
        }
        // Include optional theme fields if template defines them
        if (rawTheme.backgroundColor) templateTheme.backgroundColor = String(rawTheme.backgroundColor)
        if (rawTheme.accentColor) templateTheme.accentColor = String(rawTheme.accentColor)
        if (rawTheme.surfaceColor) templateTheme.surfaceColor = String(rawTheme.surfaceColor)
        if (rawTheme.textColor) templateTheme.textColor = String(rawTheme.textColor)
        if (rawTheme.mutedColor) templateTheme.mutedColor = String(rawTheme.mutedColor)
        const rawBorderRadius = String(rawTheme.borderRadius || '')
        if (VALID_BORDER_RADIUS.has(rawBorderRadius)) templateTheme.borderRadius = rawBorderRadius
        const rawSpacing = String(rawTheme.spacingPreset || '')
        if (VALID_SPACING.has(rawSpacing)) templateTheme.spacingPreset = rawSpacing
        const rawShadow = String(rawTheme.shadowPreset || '')
        if (VALID_SHADOW.has(rawShadow)) templateTheme.shadowPreset = rawShadow

        // === APPLY TO EXISTING SITE (multi-page + transaction) ===
        if (siteId) {
            let existingSite: Record<string, unknown>
            try {
                existingSite = await payload.findByID({ collection: 'sites', id: Number(siteId) }) as Record<string, unknown>
            } catch {
                return NextResponse.json({ error: 'Site not found' }, { status: 404 })
            }
            if (!existingSite) {
                return NextResponse.json({ error: 'Site not found' }, { status: 404 })
            }

            // Verify ownership: site must belong to user's tenant
            const siteTenantId = typeof existingSite.tenant === 'object'
                ? (existingSite.tenant as Record<string, unknown>).id
                : existingSite.tenant
            if (String(siteTenantId) !== String(tenantId)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
            }

            _siteId = Number(siteId)

            // Build template variant map: blockType → variant/style/layout from template
            const templatePages = (template.templatePages as Array<{ layout: unknown }>)
            const templateBlockList = templatePages?.length
                ? (templatePages.flatMap(p => (p.layout as Record<string, unknown>[]) || []))
                : blocks
            const sanitizedTemplateBlocks = sanitizeBlocks(templateBlockList)

            // Extract structural + visual fields per blockType from template (first match wins)
            // These fields define the template's look — user content (headlines, text, images) is preserved
            const TEMPLATE_FIELDS = [
                'variant', 'layout', 'style',           // structural
                'badge',                                  // hero badge config
                'showSocialLinks', 'showMap',             // toggle features
            ]
            const templateVariantMap: Record<string, Record<string, unknown>> = {}
            for (const tb of sanitizedTemplateBlocks) {
                const bt = tb.blockType as string
                if (!bt || templateVariantMap[bt]) continue
                const structural: Record<string, unknown> = {}
                for (const field of TEMPLATE_FIELDS) {
                    if (tb[field] !== undefined) structural[field] = tb[field]
                }
                templateVariantMap[bt] = structural
            }

            // Track unmatched blocks across all pages for notification
            const allUnmatchedBlocks: Record<string, unknown>[] = []

            // 2. Fetch existing pages + snapshot for rollback (BR-06)
            // MUST use draft: true — editor saves blocks as drafts,
            // reading published version would miss user's latest edits.
            // payload.find() generates aggregate SQL expecting "data" column that
            // doesn't exist in our pages_blocks_* tables — use SQL for IDs + findByID per page.
            const db = payload.db.drizzle
            const pageIdRows = await db.execute(sql`
                SELECT id FROM pages WHERE site_id = ${Number(siteId)} AND deleted_at IS NULL LIMIT 100
            `) as { rows: Array<{ id: number }> }
            const pageDocs = await Promise.all(
                pageIdRows.rows.map(row =>
                    payload.findByID({ collection: 'pages', id: row.id, depth: 0, draft: true })
                )
            )
            const existingPages = { docs: pageDocs }

            const rollbackData = {
                theme: existingSite.theme,
                pages: existingPages.docs.map((page) => ({
                    id: page.id,
                    layout: (page as Record<string, unknown>).layout,
                })),
            }

            // Mark as re-skinning
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { generationStatus: 'generating' },
            })

            try {
                // 1. Update site theme only
                await payload.update({
                    collection: 'sites',
                    id: Number(siteId),
                    data: { theme: templateTheme },
                })

                // Template has blocks for homepage only — sanitize them.
                // Pick the template's homepage layout (NOT flatMap across all pages,
                // which would duplicate navigation/footer that appear on every page
                // for multi-page templates — Professional=3 pages, Premium=5 pages).
                const templateHomepagePage =
                    templatePages?.find((p) =>
                        Boolean((p as { isHomepage?: boolean }).isHomepage),
                    ) ?? templatePages?.[0]
                const templateHomepageLayout =
                    (templateHomepagePage?.layout as Record<string, unknown>[] | undefined) ?? []
                const templateBlocksClean = sanitizeBlocks(
                    templateHomepageLayout.length ? templateHomepageLayout : blocks,
                )

                // Hoisted outside page loop — same values for every page
                const VALID_FIELD_TYPES = new Set(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number'])
                const VALID_NAV_VARIANTS = new Set(['default', 'centered', 'mega', 'transparent', 'sidebar', 'floating'])

                // 2. Smart Mapping: replace layout with template blocks, map user content
                //    PRD F07 US-F07-05: "mapping nội dung hiện tại sang block tương ứng của template mới"
                for (const page of existingPages.docs) {
                    const pageData = page as Record<string, unknown>
                    const currentBlocks = (pageData.layout as Record<string, unknown>[]) || []
                    if (currentBlocks.length === 0) continue

                    const isHomepage = Boolean(pageData.isHomepage)

                    let newLayout: Record<string, unknown>[]

                    if (isHomepage && templateBlocksClean.length > 0) {
                        // HOMEPAGE: Smart Mapping — replace layout with template blocks,
                        // merge user content into matching blockTypes
                        const { mergedBlocks: merged, unmatchedUserBlocks } = mergeUserContent(
                            templateBlocksClean, currentBlocks, { returnDetails: true }
                        )

                        // Track unmatched blocks for notification (FR-05)
                        if (unmatchedUserBlocks.length > 0) {
                            allUnmatchedBlocks.push(...unmatchedUserBlocks)
                        }

                        // Insert unmatched blocks before footer (PRD AC-2: don't lose content)
                        const footerIdx = merged.findIndex(b => b.blockType === 'footer')
                        if (footerIdx !== -1 && unmatchedUserBlocks.length > 0) {
                            merged.splice(footerIdx, 0, ...unmatchedUserBlocks)
                        } else if (unmatchedUserBlocks.length > 0) {
                            merged.push(...unmatchedUserBlocks)
                        }

                        newLayout = merged
                    } else {
                        // SUBPAGES: Re-skin only — keep all blocks, overlay template variant
                        newLayout = currentBlocks.map(block => {
                            const bt = block.blockType as string
                            if (!bt) return block
                            const templateVariant = templateVariantMap[bt]
                            if (!templateVariant || Object.keys(templateVariant).length === 0) return block
                            const cleanVariant = stripSystemFields(templateVariant) as Record<string, unknown>
                            return { ...block, ...cleanVariant }
                        })
                    }

                    // Ensure footer is always last
                    const footerIdx = newLayout.findIndex(b => b.blockType === 'footer')
                    if (footerIdx !== -1 && footerIdx < newLayout.length - 1) {
                        const footer = newLayout.splice(footerIdx, 1)[0]
                        newLayout.push(footer)
                    }

                    // Strip system fields — Payload rejects 'id' in layout block data
                    // GH-820: also drop google-maps — embedUrl cannot be auto-generated
                    // GH-1024: strip temp-hidden blocks (menu-display, property-card, pricing-table)
                    //   so DB-seeded templates don't smuggle them back into user pages
                    const cleanLayout = (stripSystemFields(newLayout) as Record<string, unknown>[])
                        .filter(b => b.blockType !== 'google-maps')
                        .filter(b => !BLOCKS_TEMP_HIDDEN.has(b.blockType as string))

                    // Normalize required fields: coerces service-cards titles, upload fields,
                    // contact email, footer variant aliases, etc. Covers data from currentBlocks
                    // (user's existing DB content) which may predate AI gen sanitization fixes.
                    const normalizedLayout = normalizeBlocksForPersistence(cleanLayout)

                    // Additional block-specific sanitization not covered by normalizeBlocksForPersistence
                    for (const block of normalizedLayout) {
                        // Contact: formFields array items need fieldName + label + fieldType
                        if (block.blockType === 'contact' && Array.isArray(block.formFields)) {
                            block.formFields = (block.formFields as Record<string, unknown>[]).filter(f =>
                                typeof f.fieldName === 'string' && f.fieldName.trim().length > 0 &&
                                typeof f.label === 'string' && f.label.trim().length > 0 &&
                                typeof f.fieldType === 'string' && VALID_FIELD_TYPES.has(f.fieldType)
                            )
                            if ((block.formFields as unknown[]).length === 0) {
                                block.formFields = [
                                    { fieldName: 'name', fieldType: 'text', label: 'Your Name', required: true },
                                    { fieldName: 'email', fieldType: 'email', label: 'Email Address', required: true },
                                    { fieldName: 'message', fieldType: 'textarea', label: 'Message', required: true },
                                ]
                            }
                        }
                        // Navigation: variant must be one of the valid enum values
                        if (block.blockType === 'navigation') {
                            if (!block.variant || !VALID_NAV_VARIANTS.has(block.variant as string)) {
                                block.variant = 'default'
                            }
                        }
                    }

                    await payload.update({
                        collection: 'pages',
                        id: page.id,
                        data: { layout: normalizedLayout },
                    })
                    _createdPagesCount++
                }

                // 3. Mark completed
                await payload.update({
                    collection: 'sites',
                    id: Number(siteId),
                    data: { generationStatus: 'completed' },
                })
            } catch (applyError) {
                // ROLLBACK (BR-06): restore previous theme + page layouts
                console.error('[Apply Template] Mutation failed, rolling back:', applyError)
                try {
                    await payload.update({
                        collection: 'sites',
                        id: Number(siteId),
                        data: { theme: rollbackData.theme, generationStatus: 'completed' } as Record<string, unknown>,
                    })
                    for (const page of rollbackData.pages) {
                        await payload.update({
                            collection: 'pages',
                            id: page.id,
                            data: { layout: page.layout } as Record<string, unknown>,
                        })
                    }
                } catch (rollbackError) {
                    console.error('[Apply Template] Rollback also failed:', rollbackError)
                    await payload.update({
                        collection: 'sites',
                        id: Number(siteId),
                        data: { generationStatus: 'failed' },
                    }).catch(() => {})
                }
                return NextResponse.json(
                    { error: 'Failed to apply template. Your previous content has been restored.' },
                    { status: 500 }
                )
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

            return NextResponse.json({
                success: true,
                siteId: Number(siteId),
                siteName: existingSite.name,
                templateName: template.name,
                pagesUpdated: _createdPagesCount,
                applied: true,
                unmatchedBlocks: allUnmatchedBlocks.length > 0
                    ? [...new Set(allUnmatchedBlocks.map(b => b.blockType as string))]
                    : undefined,
            })
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

        // Mark generation completed
        await payload.update({
            collection: 'sites',
            id: site.id as string | number,
            data: { generationStatus: 'completed' },
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
})

export const dynamic = 'force-dynamic'
// Override vercel.json's 60s default — template application merges blocks,
// may re-run AI content generation, and persists 1 site + N pages + M blocks
// through Payload, which comfortably exceeds 60s in practice. Same root cause
// as generate-site 504s. Keeping parity to avoid another latency surprise.
export const maxDuration = 300
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'
import { mergeUserContent } from '@/lib/ai/merge-user-content'
import { resolveSiteType } from '@/lib/ai/site-type'
import { sanitizeBlocksForPayload } from '@/lib/ai/pages-schema'

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
        const VALID_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
        const VALID_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']
        const VALID_COLOR_MODES = ['light', 'dark']
        const rawHeading = String(rawTheme.fontHeading || '')
        const rawBody = String(rawTheme.fontBody || '')
        const rawColorMode = String(rawTheme.colorMode || '')
        const templateTheme = {
            primaryColor: String(rawTheme.primaryColor || '#0ea5e9'),
            secondaryColor: String(rawTheme.secondaryColor || '#d946ef'),
            fontHeading: VALID_HEADING_FONTS.includes(rawHeading) ? rawHeading : 'Outfit',
            fontBody: VALID_BODY_FONTS.includes(rawBody) ? rawBody : 'Inter',
            colorMode: VALID_COLOR_MODES.includes(rawColorMode) ? rawColorMode : 'dark',
        }

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

            // Build pages list from templatePages or fallback to defaultBlocks
            const templatePages = (template.templatePages as Array<{ title: string; slug: string; isHomepage?: boolean; layout: unknown }>)
            const rawPages = templatePages?.length
                ? templatePages
                : [{ title: 'Home', slug: 'home', isHomepage: true, layout: blocks }]
            const pagesToCreate = rawPages.map(p => ({ ...p, layout: sanitizeBlocks((p.layout as Record<string, unknown>[]) || []) }))
            injectNavLinks(pagesToCreate)

            _siteId = Number(siteId)

            // Mark as generating before destructive operations
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { generationStatus: 'generating' },
            })

            // 1. Collect existing pages + their blocks (to preserve user content)
            const existingPages = await payload.find({
                collection: 'pages',
                where: { site: { equals: Number(siteId) } },
                limit: 100,
            })

            // Build lookup: homepage blocks + slug-matched blocks for content merging
            const existingPageMap: Record<string, Record<string, unknown>[]> = {}
            let homepageBlocks: Record<string, unknown>[] = []
            for (const page of existingPages.docs) {
                const pageData = page as Record<string, unknown>
                const blocks = (pageData.layout as Record<string, unknown>[]) || []
                const slug = pageData.slug as string
                if (pageData.isHomepage) homepageBlocks = blocks
                if (slug) existingPageMap[slug] = blocks
            }

            // 2. Delete old pages
            for (const page of existingPages.docs) {
                await payload.delete({ collection: 'pages', id: page.id })
            }

            // 3. Update site theme
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { theme: templateTheme },
            })

            // 4. Create new pages from template, merging user content where possible
            for (const [idx, page] of pagesToCreate.entries()) {
                // Find matching existing blocks: homepage→homepage, then slug match
                const matchingBlocks = page.isHomepage
                    ? homepageBlocks
                    : (existingPageMap[page.slug] || [])

                const mergedLayout = matchingBlocks.length > 0
                    ? mergeUserContent(page.layout, matchingBlocks)
                    : page.layout

                await payload.create({
                    collection: 'pages',
                    data: {
                        title: page.title,
                        slug: page.slug,
                        site: Number(siteId),
                        tenant: tenantId,
                        isHomepage: page.isHomepage ?? idx === 0,
                        _status: 'published',
                        layout: mergedLayout,
                    },
                })
                _createdPagesCount++
            }

            // 4. Mark generation completed
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { generationStatus: 'completed' },
            })

            // 5. Increment template usage count
            await payload.update({
                collection: 'templates',
                id: templateId,
                data: { usageCount: (Number(template.usageCount) || 0) + 1 },
            })

            return NextResponse.json({
                success: true,
                siteId: Number(siteId),
                siteName: existingSite.name,
                templateName: template.name,
                pagesCreated: pagesToCreate.length,
                applied: true,
            })
        }

        // === CREATE NEW SITE FROM TEMPLATE (multi-page) ===
        const newSiteTemplatePages = (template.templatePages as Array<{ title: string; slug: string; isHomepage?: boolean; layout: unknown }>)
        const newSiteRawPages = newSiteTemplatePages?.length
            ? newSiteTemplatePages
            : [{ title: 'Home', slug: 'home', isHomepage: true, layout: blocks }]
        const pagesToCreate = newSiteRawPages.map(p => ({ ...p, layout: sanitizeBlocks((p.layout as Record<string, unknown>[]) || []) }))
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
                    layout: page.layout,
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
                layout: [],
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

        // Increment template usage count
        await payload.update({
            collection: 'templates',
            id: templateId,
            data: { usageCount: (Number(template.usageCount) || 0) + 1 },
        })

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

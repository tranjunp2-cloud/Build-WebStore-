export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'

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

        // ── Sanitize blocks to match Pages.ts Payload schema (DB source of truth) ──
        // Only 14 block types have DB tables. Each has specific field names + enum values.

        const PAGES_BLOCK_WHITELIST = new Set([
            'navigation', 'hero', 'about', 'features', 'testimonials',
            'contact', 'gallery', 'footer', 'stats', 'pricing',
            'faq', 'team', 'socialWidget', 'cartWidget',
        ])

        // Pages.ts schema per block: which field holds variant, what values are valid
        // null = block has NO variant/layout field → strip any variant data
        const PAGES_SCHEMA: Record<string, { field: string; values: string[]; fallback: string } | null> = {
            hero:         { field: 'variant', values: ['centered', 'split-left', 'split-right', 'fullscreen', 'video'], fallback: 'centered' },
            navigation:   { field: 'style',   values: ['fixed', 'sticky', 'static', 'transparent'], fallback: 'fixed' },
            about:        { field: 'layout',  values: ['image-right', 'image-left', 'centered', 'cards'], fallback: 'image-right' },
            features:     { field: 'layout',  values: ['grid-3', 'grid-2', 'alternating', 'centered-list'], fallback: 'grid-3' },
            testimonials: { field: 'variant', values: ['carousel', 'grid', 'masonry', 'single'], fallback: 'carousel' },
            gallery:      { field: 'layout',  values: ['masonry', 'grid', 'carousel', 'lightbox'], fallback: 'masonry' },
            socialWidget: { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
            cartWidget:   { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
            contact: null, footer: null, stats: null, pricing: null, faq: null, team: null,
        }

        // Map blueprint variant names → Pages.ts valid values
        const ALIASES: Record<string, Record<string, string>> = {
            hero: {
                'split': 'split-left', 'split-image': 'split-left', 'editorial': 'centered',
                'fullscreen-image': 'fullscreen', 'fullscreen-video': 'video',
                'video-background': 'video', 'video-bg': 'video', 'overlay': 'fullscreen',
                'story': 'split-left', 'magazine': 'split-left', 'minimal': 'centered',
                'cards-overlay': 'fullscreen', 'gradient': 'centered', 'parallax': 'fullscreen',
                'slideshow': 'centered', 'split-video': 'video',
            },
            about: { 'simple': 'centered', 'split': 'image-right', 'story': 'image-right', 'single-column': 'centered', 'two-column': 'image-right', 'timeline': 'image-right' },
            features: { 'grid': 'grid-3', 'list': 'centered-list', 'icon-grid': 'grid-3', 'card-grid': 'grid-3', 'cards': 'grid-3', 'detailed': 'centered-list', 'detailed-list': 'centered-list', 'icon-top': 'grid-3', 'icon-left': 'grid-2', 'zigzag': 'alternating', 'carousel': 'grid-3', 'minimal-list': 'centered-list' },
            testimonials: { 'cards': 'grid', 'simple': 'carousel', 'spotlight': 'single', 'minimal-quote': 'single', 'avatar-row': 'carousel', 'video-text': 'carousel', 'featured': 'single', 'marquee': 'carousel', 'quote': 'single', 'single-highlight': 'single', 'slider': 'carousel' },
            gallery: { 'filmstrip': 'carousel', 'justified': 'grid', 'fullscreen-grid': 'grid', 'slider': 'carousel', 'spotlight': 'lightbox' },
            navigation: { 'simple': 'fixed', 'centered': 'fixed', 'mega-menu': 'fixed', 'sidebar': 'fixed', 'pill': 'fixed' },
        }

        // Strip each block to ONLY fields Pages.ts defines. Everything else → dropped.
        // This prevents Payload validation errors from unknown/invalid field values.
        const PAGES_FIELDS: Record<string, string[]> = {
            hero: ['variant', 'headline', 'subheadline', 'videoUrl'],
            navigation: ['style', 'logoText', 'links'],
            about: ['layout', 'sectionLabel', 'headline', 'body'],
            features: ['sectionLabel', 'headline', 'subheadline', 'layout', 'features'],
            testimonials: ['headline', 'variant', 'testimonials'],
            gallery: ['headline', 'layout'],
            contact: ['headline', 'subtext', 'email', 'phone', 'address', 'showMap', 'mapEmbedUrl'],
            footer: ['logoText', 'logo', 'tagline', 'columns', 'copyrightText', 'showSocialLinks'],
            stats: ['headline', 'stats'],
            pricing: ['headline', 'subheadline'],
            faq: ['headline', 'faqs'],
            team: ['headline'],
            socialWidget: ['variant', 'headline', 'links'],
            cartWidget: ['variant', 'label', 'showLabel'],
        }

        function sanitizeBlocks(blockList: Record<string, unknown>[]): Record<string, unknown>[] {
            return blockList
                .filter(b => PAGES_BLOCK_WHITELIST.has(b.blockType as string))
                .map(block => {
                    const bt = block.blockType as string
                    const schema = PAGES_SCHEMA[bt]
                    const allowedFields = PAGES_FIELDS[bt] || []

                    // Start with only blockType
                    const result: Record<string, unknown> = { blockType: bt }

                    // Copy only allowed fields from template data
                    for (const field of allowedFields) {
                        if (block[field] !== undefined) {
                            result[field] = block[field]
                        }
                    }

                    // Handle variant/layout field mapping + validation
                    if (schema) {
                        const raw = (block.variant ?? block.layout) as string | undefined
                        const aliased = raw && ALIASES[bt]?.[raw] ? ALIASES[bt]![raw]! : raw
                        const resolved = aliased && schema.values.includes(aliased) ? aliased : schema.fallback
                        result[schema.field] = resolved
                        // Remove the other field if it was copied
                        if (schema.field === 'variant') delete result.layout
                        if (schema.field === 'layout') delete result.variant
                    } else {
                        // No variant/layout schema → remove both
                        delete result.variant
                        delete result.layout
                    }

                    return result
                })
        }

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
        // Pick only valid theme fields — Payload groups may have extra metadata
        const templateTheme = {
            primaryColor: String(rawTheme.primaryColor || '#0ea5e9'),
            secondaryColor: String(rawTheme.secondaryColor || '#d946ef'),
            fontHeading: String(rawTheme.fontHeading || 'Outfit'),
            fontBody: String(rawTheme.fontBody || 'Inter'),
            colorMode: String(rawTheme.colorMode || 'dark'),
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

            // Delete old pages → update theme → create new pages (sequential)
            // 1. Delete all existing pages for this site
            const existingPages = await payload.find({
                collection: 'pages',
                where: { site: { equals: Number(siteId) } },
                limit: 100,
            })
            for (const page of existingPages.docs) {
                await payload.delete({ collection: 'pages', id: page.id })
            }

            // 2. Update site theme
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { theme: templateTheme },
            })

            // 3. Create new pages from template
            for (const [idx, page] of pagesToCreate.entries()) {
                await payload.create({
                    collection: 'pages',
                    data: {
                        title: page.title,
                        slug: page.slug,
                        site: Number(siteId),
                        tenant: tenantId,
                        isHomepage: page.isHomepage ?? idx === 0,
                        _status: 'published',
                        layout: page.layout,
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
                siteType: (() => {
                    const VALID_SITE_TYPES = new Set(['business', 'ecommerce', 'restaurant', 'tech', 'health', 'education', 'realestate', 'fitness', 'creative', 'beauty', 'blog'])
                    const raw = Array.isArray(template.category) ? String(template.category[0]) : String(template.category || 'business')
                    return VALID_SITE_TYPES.has(raw) ? raw : 'business'
                })(),
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

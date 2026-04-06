export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/ai/apply-template
 * Creates a new site from a template's default blocks and theme.
 * Body: { templateId: string }
 */
export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 template applications per hour
        const rateLimit = checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const payload = await getPayload({ config })

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

        // Get tenant from user object (same pattern as generate-site)
        const userWithTenants = user as { id: number | string; tenants?: Array<{ tenant: unknown }> }
        let tenantId = userWithTenants.tenants?.[0]?.tenant
        if (typeof tenantId === 'object' && tenantId !== null) {
            tenantId = (tenantId as Record<string, unknown>).id
        }
        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
        }

        const blocks = (template.defaultBlocks as Record<string, unknown>[]) || []
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
            const pagesToCreate = templatePages?.length
                ? templatePages
                : [{ title: 'Home', slug: 'home', isHomepage: true, layout: blocks }]

            // Transaction: delete old pages → update theme → create new pages
            const txReq = await payload.db.beginTransaction()
            try {
                // 1. Delete all existing pages for this site
                const existingPages = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: Number(siteId) } },
                    limit: 100,
                    req: txReq as never,
                })
                for (const page of existingPages.docs) {
                    await payload.delete({
                        collection: 'pages',
                        id: page.id,
                        req: txReq as never,
                    })
                }

                // 2. Update site theme
                await payload.update({
                    collection: 'sites',
                    id: Number(siteId),
                    data: { theme: templateTheme },
                    req: txReq as never,
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
                            status: 'draft',
                            layout: page.layout,
                        },
                        req: txReq as never,
                    })
                }

                // 4. Increment template usage count
                await payload.update({
                    collection: 'templates',
                    id: templateId,
                    data: { usageCount: (Number(template.usageCount) || 0) + 1 },
                    req: txReq as never,
                })

                if (txReq && typeof txReq === 'object' && 'commitTransaction' in txReq) {
                    await (txReq as { commitTransaction: () => Promise<void> }).commitTransaction()
                }
            } catch (txError) {
                if (txReq && typeof txReq === 'object' && 'rollbackTransaction' in txReq) {
                    await (txReq as { rollbackTransaction: () => Promise<void> }).rollbackTransaction()
                }
                throw txError
            }

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
        const templatePages = (template.templatePages as Array<{ title: string; slug: string; isHomepage?: boolean; layout: unknown }>)
        const pagesToCreate = templatePages?.length
            ? templatePages
            : [{ title: 'Home', slug: 'home', isHomepage: true, layout: blocks }]

        const site = await payload.create({
            collection: 'sites',
            data: {
                name: String(template.name || 'Untitled'),
                tenant: tenantId,
                status: 'draft',
                siteType: Array.isArray(template.category) ? String(template.category[0]) : String(template.category || 'business'),
                theme: templateTheme,
            },
        })

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
                    status: 'draft',
                    layout: page.layout,
                },
            })
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
                status: 'draft',
                layout: [],
                seo: {
                    title: '404 - Page Not Found',
                    description: 'The page you are looking for does not exist.',
                    noIndex: true,
                },
            },
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
        const errMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Apply Template Error]', errMessage, error)
        return NextResponse.json(
            { error: `Failed to apply template: ${errMessage}` },
            { status: 500 },
        )
    }
})

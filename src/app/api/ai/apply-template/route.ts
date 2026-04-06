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

        // === APPLY TO EXISTING SITE ===
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

            // Update site theme
            await payload.update({
                collection: 'sites',
                id: Number(siteId),
                data: { theme: templateTheme },
            })

            // Find and update homepage blocks
            const homepageResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: Number(siteId) },
                    isHomepage: { equals: true },
                },
                limit: 1,
            })

            if (homepageResult.docs[0]) {
                await payload.update({
                    collection: 'pages',
                    id: homepageResult.docs[0].id,
                    data: { layout: blocks },
                })
            }

            // Increment template usage count
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
                applied: true,
            })
        }

        // === CREATE NEW SITE FROM TEMPLATE ===
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

        // Homepage
        await payload.create({
            collection: 'pages',
            data: {
                title: 'Home',
                slug: 'home',
                site: site.id,
                tenant: tenantId,
                isHomepage: true,
                status: 'draft',
                layout: blocks,
            },
        })

        // 404 Page
        await payload.create({
            collection: 'pages',
            data: {
                title: '404 Not Found',
                slug: '404',
                site: site.id,
                tenant: tenantId,
                isHomepage: false,
                status: 'draft',
                layout: blocks,
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

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { applyTemplateSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'

/**
 * POST /api/ai/apply-template
 * Creates a new site from a template's default blocks and theme.
 * Body: { templateId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        // Auth
        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data, errorResponse } = await parseRequest(req, applyTemplateSchema)
        if (errorResponse) return errorResponse
        
        const { templateId } = data!

        // Find template
        const template: any = await payload.findByID({
            collection: 'templates',
            id: templateId,
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // Get tenant
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { 'users.user': { equals: user.id } },
            limit: 1,
        })
        const tenant = tenantResult.docs[0]
        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
        }

        // Create site from template
        const site: any = await payload.create({
            collection: 'sites',
            data: {
                name: template.name,
                tenant: tenant.id,
                status: 'draft',
                siteType: template.category?.[0] || 'business',
                theme: template.defaultTheme || {
                    primaryColor: '#0ea5e9',
                    fontHeading: 'Outfit',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
            },
        })

        // Create homepage with template blocks
        const blocks = template.defaultBlocks || []
        await payload.create({
            collection: 'pages',
            data: {
                title: 'Homepage',
                slug: 'home',
                site: site.id,
                tenant: tenant.id,
                isHomepage: true,
                status: 'draft',
                layout: blocks,
            },
        })

        // Increment template usage count
        await payload.update({
            collection: 'templates',
            id: templateId,
            data: { usageCount: (template.usageCount || 0) + 1 },
        })

        return NextResponse.json({
            success: true,
            siteId: site.id,
            siteName: site.name,
            templateName: template.name,
        })

    } catch (error: any) {
        console.error('[Apply Template Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to apply template' },
            { status: 500 },
        )
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { generateBlocks } from '@/lib/ai/generate-blocks'

/**
 * POST /api/ai/generate-site
 * Generate a website from a text prompt.
 * Creates Site + Page in Payload DB and returns the result.
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        // Authenticate user
        const cookieStore = await cookies()
        const token = cookieStore.get('payload-token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get tenant ID
        const tenantId = (user as any).tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json({ error: 'No tenant found' }, { status: 400 })
        }

        // Parse request body
        const { prompt } = await req.json()
        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        }

        // Generate blocks from prompt
        const result = generateBlocks(prompt)

        // Create Site in DB
        const site = await payload.create({
            collection: 'sites',
            data: {
                tenant: resolvedTenantId,
                name: result.siteName,
                status: 'draft',
                siteType: result.siteType,
                theme: {
                    primaryColor: result.theme.primaryColor,
                    secondaryColor: result.theme.secondaryColor,
                    fontHeading: result.theme.fontHeading,
                    fontBody: result.theme.fontBody,
                    colorMode: result.theme.colorMode,
                },
                seo: {
                    metaTitle: result.seo.title,
                    metaDescription: result.seo.description,
                },
                aiGenerationMetadata: {
                    generatedAt: new Date().toISOString(),
                    originalPrompt: prompt,
                    businessType: result.siteType,
                },
            },
        })

        // Create Homepage in DB with generated blocks
        const page = await payload.create({
            collection: 'pages',
            data: {
                title: 'Homepage',
                slug: '/',
                site: site.id,
                isHomepage: true,
                layout: result.blocks,
                seo: {
                    title: result.seo.title,
                    description: result.seo.description,
                },
            },
        })

        return NextResponse.json({
            success: true,
            siteId: site.id,
            pageId: page.id,
            siteName: result.siteName,
            siteType: result.siteType,
            blockCount: result.blocks.length,
            theme: result.theme,
        })

    } catch (error: any) {
        console.error('[AI Generate Site Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'
import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

const fixAllSchema = z.object({
    siteId: z.string().min(1),
    missingSeo: z.array(z.object({
        collection: z.enum(['pages', 'products']),
        id: z.union([z.string(), z.number()]),
        title: z.string(),
        context: z.string().optional(),
        missingFields: z.array(z.string()),
    }))
})

/**
 * POST /api/seo/fix-all
 * Proposes fixes for multiple missing SEO fields simultaneously using AI.
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, fixAllSchema)
        if (errorResponse) return errorResponse

        const { siteId, missingSeo } = data!
        const payload = await getPayload({ config })

        // 1. Fetch site name
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) return NextResponse.json({ success: false, error: { message: 'Site not found' } }, { status: 404 })

        // IDOR Protection: ensure user has access to this site's tenant
        const userTenantIds = _user.tenants?.map((t: any) =>
            t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        ).map(String) || []
        const siteTenantId = site.tenant && typeof site.tenant === 'object' ? site.tenant.id : site.tenant

        if (!_user.roles?.includes('super-admin') && !userTenantIds.includes(String(siteTenantId))) {
             return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 })
        }

        const siteName = site.businessName || site.name || 'Website'

        // 2. Map promises for AI parallel generation
        const proposalsPromise = Promise.all(
            missingSeo.map(async (item) => {
                const { title, description } = await generateAutoSEOMeta(
                    item.collection === 'products' ? 'product' : 'page',
                    item.title,
                    siteName,
                    item.context
                )

                return {
                    id: String(item.id),
                    targetId: String(item.id),
                    collection: item.collection,
                    name: item.title,
                    proposedTitle: item.missingFields.includes('title') ? title : undefined,
                    proposedDescription: item.missingFields.includes('description') ? description : undefined,
                }
            })
        )

        // 3. Setup strict timeout race (12s limit to allow 3s for API parsing)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI generation timed out')), 12000)
        )

        const results = await Promise.race([proposalsPromise, timeoutPromise])

        return NextResponse.json({ success: true, data: results })
    } catch (error: any) {
        console.error('[AI Fix All Error]', error)
        // If timeout, return 504 to trigger the prompt/toast
        const status = error.message?.includes('time') ? 504 : 500
        return NextResponse.json(
            { success: false, error: { code: 'AI_ERROR', message: 'AI fix failed' } },
            { status }
        )
    }
})

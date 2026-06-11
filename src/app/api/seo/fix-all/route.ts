import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'
import { generateAutoSEOMeta } from '@/lib/ai/generate-meta'

const fixAllSchema = z.object({
    siteId: z.string().min(1),
    missingSeo: z.array(z.object({
        collection: z.enum(['pages', 'products', 'blogs']),
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
export const POST = withFeatureGuard('content_management')(withAuth(async (_user, request) => {
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

        // Fetch tracked keywords from site (AC-15)
        const trackedKeywords = ((site as any)?.seo?.trackedKeywords as Array<{ keyword: string }> | undefined)
            ?.map(k => k.keyword).filter(Boolean) || []

        // 2. Setup SSE stream with 15s timeout (NFR)
        const encoder = new TextEncoder()
        const FIX_ALL_TIMEOUT_MS = 15_000

        const stream = new ReadableStream({
            async start(controller) {
                // Send retry directive so clients auto-reconnect on drop
                controller.enqueue(encoder.encode(`retry: 3000\n\n`))

                let timedOut = false
                const timeout = setTimeout(() => {
                    timedOut = true
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'timeout', message: 'AI Fix timed out after 15s' })}\n\n`))
                    controller.close()
                }, FIX_ALL_TIMEOUT_MS)

                const promises = missingSeo.map(async (item) => {
                    if (timedOut) return
                    try {
                        const { title, description } = await generateAutoSEOMeta(
                            item.collection === 'products' ? 'product' : 'page',
                            item.title,
                            siteName,
                            item.context,
                            trackedKeywords,
                        )

                        if (timedOut) return

                        const result = {
                            id: String(item.id),
                            targetId: String(item.id),
                            collection: item.collection,
                            name: item.title,
                            proposedTitle: item.missingFields.includes('title') ? title : undefined,
                            proposedDescription: item.missingFields.includes('description') ? description : undefined,
                        }

                        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`)) } catch { /* stream closed */ }
                    } catch (error: any) {
                        console.error('[AI Fix All Partial Error]', error)
                    }
                })

                await Promise.allSettled(promises)
                clearTimeout(timeout)
                if (!timedOut) controller.close()
            }
        })

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            },
        })
    } catch (error: any) {
        console.error('[AI Fix All Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'AI_ERROR', message: 'Failed to initialize AI stream' } },
            { status: 500 }
        )
    }
}))

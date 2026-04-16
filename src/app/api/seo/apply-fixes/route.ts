import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'

const applyFixesSchema = z.object({
    fixes: z.array(z.object({
        targetId: z.string(),
        collection: z.enum(['pages', 'products', 'blogs']),
        seo: z.object({
            title: z.string().optional(),
            description: z.string().optional(),
        })
    }))
})

/**
 * POST /api/seo/apply-fixes
 * Applies a batch array of SEO metadata updates to Pages and Products.
 * Also acts as the Undo endpoint by sending reversed values.
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const { data, errorResponse } = await parseRequest(request, applyFixesSchema)
        if (errorResponse) return errorResponse

        const { fixes } = data!
        const payload = await getPayload({ config })

        // IDOR Protection: pre-calculate user tenants
        const userTenantIds = _user.tenants?.map((t: any) =>
            t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        ).map(String) || []

        // Process all fixes — use allSettled so partial failures don't lose successful updates
        const results = await Promise.allSettled(fixes.map(async (fix) => {
            const current = await payload.findByID({
                collection: fix.collection,
                id: fix.targetId,
                depth: 1,
            })

            if (!current) throw new Error(`Document not found: ${fix.targetId}`)

            let recordTenantId = null
            if (fix.collection === 'products' || fix.collection === 'blogs') {
                recordTenantId = current.tenant?.id || current.tenant
            } else if (fix.collection === 'pages') {
                recordTenantId = current.site?.tenant?.id || current.site?.tenant
            }

            if (!_user.roles?.includes('super-admin') && !userTenantIds.includes(String(recordTenantId))) {
                throw new Error(`Forbidden access to ${fix.targetId}`)
            }

            const seoUpdate = fix.collection === 'blogs'
                ? {
                    ...(current.seo || {}),
                    ...(fix.seo.title && { metaTitle: fix.seo.title }),
                    ...(fix.seo.description && { metaDescription: fix.seo.description }),
                }
                : {
                    ...(current.seo || {}),
                    ...fix.seo,
                }

            await payload.update({
                collection: fix.collection,
                id: fix.targetId,
                data: { seo: seoUpdate }
            })

            return {
                targetId: fix.targetId,
                collection: fix.collection,
                seo: fix.collection === 'blogs'
                    ? {
                        title: current.seo?.metaTitle || '',
                        description: current.seo?.metaDescription || '',
                    }
                    : {
                        title: current.seo?.title || '',
                        description: current.seo?.description || '',
                    }
            }
        }))

        const undoData = results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<{ targetId: string; collection: string; seo: { title: string; description: string } }>).value)
        const failedCount = results.filter(r => r.status === 'rejected').length

        if (undoData.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'ALL_FAILED', message: `All ${failedCount} fixes failed` } },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, undoData, failedCount })
    } catch (error: any) {
        console.error('[AI Apply Fixes Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to apply fixes' } },
            { status: 500 }
        )
    }
})

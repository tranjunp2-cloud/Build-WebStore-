import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { z } from 'zod'
import { parseRequest } from '@/lib/validations/helpers'

const applyFixesSchema = z.object({
    fixes: z.array(z.object({
        targetId: z.string(),
        collection: z.enum(['pages', 'products']),
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

        // Process sequentially to avoid SQLite locking issues if using local DB,
        // or just Promise.all for Postgres. We use Promise.all for speed.
        const undoData = await Promise.all(fixes.map(async (fix) => {
            // First fetch current to merge
            const current = await payload.findByID({
                collection: fix.collection,
                id: fix.targetId,
                depth: 0,
            })
            
            await payload.update({
                collection: fix.collection,
                id: fix.targetId,
                data: {
                    seo: {
                        ...(current.seo || {}),
                        ...fix.seo,
                    }
                }
            })

            return {
                targetId: fix.targetId,
                collection: fix.collection,
                seo: {
                    title: current.seo?.title || '',
                    description: current.seo?.description || ''
                }
            }
        }))

        return NextResponse.json({ success: true, undoData })
    } catch (error: any) {
        console.error('[AI Apply Fixes Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'UPDATE_FAILED', message: error.message } },
            { status: 500 }
        )
    }
})

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

        // IDOR Protection: pre-calculate user tenants
        const userTenantIds = _user.tenants?.map((t: any) =>
            t.tenant && typeof t.tenant === 'object' ? t.tenant.id : t.tenant
        ).map(String) || []

        // Process sequentially to avoid SQLite locking issues if using local DB,
        // or just Promise.all for Postgres. We use Promise.all for speed.
        const undoData = await Promise.all(fixes.map(async (fix) => {
            // First fetch current to check access and merge
            const current = await payload.findByID({
                collection: fix.collection,
                id: fix.targetId,
                depth: 1,
            })

            if (!current) throw new Error(`Document not found: ${fix.targetId}`)

            let recordTenantId = null
            if (fix.collection === 'products') {
                recordTenantId = current.tenant?.id || current.tenant
            } else if (fix.collection === 'pages') {
                recordTenantId = current.site?.tenant?.id || current.site?.tenant
            }

            if (!_user.roles?.includes('super-admin') && !userTenantIds.includes(String(recordTenantId))) {
                throw new Error(`Forbidden access to ${fix.targetId}`)
            }
            
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

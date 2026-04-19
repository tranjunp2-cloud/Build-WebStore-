/**
 * GET /api/admin/templates/[id]/versions
 * Returns version history for a single template, newest first.
 * Super-admin only.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        const templateId = Number(id)
        if (isNaN(templateId)) {
            return NextResponse.json({ error: 'Invalid template id' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'template-versions',
            where: { template: { equals: templateId } },
            sort: '-versionNumber',
            limit: 50,
            depth: 1,
        })

        return NextResponse.json({ data: result.docs, totalDocs: result.totalDocs })
    })(req)
}

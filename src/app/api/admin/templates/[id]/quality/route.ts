/**
 * GET /api/admin/templates/[id]/quality
 * Returns latest score + history (last 20 runs) for a template.
 *
 * Response: { latest: QualityScore | null, history: QualityScore[] }
 * Auth: super-admin only.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'template-quality-scores',
            where: { template: { equals: Number(id) } },
            sort: '-scoredAt',
            limit: 20,
            depth: 0,
        })

        const scores = result.docs
        const latest = scores[0] ?? null

        return NextResponse.json({ data: { latest, history: scores } })
    })(req)
}

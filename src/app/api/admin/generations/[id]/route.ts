/**
 * GET /api/admin/generations/[id] — full record detail with hydrated site + user
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

        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        try {
            const record = await payload.findByID({
                collection: 'ai-generation-records',
                id: Number(id),
                depth: 2, // hydrate site + user relationships
            })
            return NextResponse.json({ data: record })
        } catch {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
    })(req)
}

/**
 * GET   /api/admin/templates/[id]  — single template detail
 * PATCH /api/admin/templates/[id]  — partial update
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin, UpdateTemplateSchema } from '@/lib/admin/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        // disableErrors: findByID throws NotFound on a missing id by default, which
        // withSuperAdmin has no catch for → 500. With disableErrors it returns null,
        // so the 404 branch below runs (GH #1535).
        const template = await payload.findByID({
            collection: 'templates',
            id,
            depth: 1,
            disableErrors: true,
        })

        if (!template) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({ data: template })
    })(req)
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        const body = await req.json().catch(() => null)

        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = UpdateTemplateSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })

        const updated = await payload.update({
            collection: 'templates',
            id,
            data: parsed.data,
        })

        return NextResponse.json({ data: updated })
    })(req)
}

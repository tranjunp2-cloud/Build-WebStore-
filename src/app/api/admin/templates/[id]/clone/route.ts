/**
 * POST /api/admin/templates/[id]/clone
 * Deep-copies a template document. templatePages are shallow-copied (array JSON).
 * New template gets status=draft and name suffix " (copy)".
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { z } from 'zod'

const CloneBodySchema = z.object({
    name: z.string().min(1).max(200).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        const body = await req.json().catch(() => ({}))
        const parsed = CloneBodySchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })

        const source = await payload.findByID({
            collection: 'templates',
            id,
            depth: 0,
        })

        if (!source) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        // Build clone data — strip system fields, reset status to draft
        const {
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            usageCount: _usageCount,
            name: sourceName,
            ...rest
        } = source as Record<string, unknown>

        void _id; void _createdAt; void _updatedAt; void _usageCount

        const clonedName = parsed.data.name ?? `${sourceName} (copy)`

        const cloned = await payload.create({
            collection: 'templates',
            data: {
                ...(rest as object),
                name: clonedName,
                status: 'draft',
                usageCount: 0,
                scheduledFor: undefined,
            } as Parameters<typeof payload.create>[0]['data'],
        })

        return NextResponse.json({ data: cloned }, { status: 201 })
    })(req)
}

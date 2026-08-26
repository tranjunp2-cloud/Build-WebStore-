/**
 * GET   /api/admin/issues/[id] — fetch single issue (depth=2)
 * PATCH /api/admin/issues/[id] — update status/severity/assignee/title/description
 *
 * Super-admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const UpdateIssueSchema = z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(10000).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    status: z.enum(['open', 'in-review', 'fixed', 'wont-fix']).optional(),
    category: z.enum(['accessibility', 'performance', 'content', 'ui', 'ai-quality', 'other']).optional(),
    assignedTo: z.union([z.string(), z.number()]).nullable().optional(),
})

export const GET = withSuperAdmin(async (_req: NextRequest, ctx) => {
    const id = ctx.params?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const payload = await getPayload({ config })
    try {
        const doc = await payload.findByID({ collection: 'template-issues', id, depth: 2 })
        return NextResponse.json({ data: doc })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
})

export const PATCH = withSuperAdmin(async (req: NextRequest, ctx) => {
    const id = ctx.params?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const parsed = UpdateIssueSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    // Build update data — omit undefined keys so Payload doesn't nullify them
    const updateData: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.data)) {
        if (v !== undefined) updateData[k] = v
    }

    try {
        const doc = await payload.update({ collection: 'template-issues', id, data: updateData, depth: 1 })
        return NextResponse.json({ data: doc })
    } catch {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
})

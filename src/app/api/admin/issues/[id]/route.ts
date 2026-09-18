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
    status: z.enum(['backlog', 'reopen', 'in_progress', 'dev_fixed', 'testing', 'done']).optional(),
    category: z.enum(['accessibility', 'performance', 'content', 'ui', 'ai-quality', 'other']).optional(),
    assignmentTarget: z.enum(['unassigned', 'dev']).optional(),
}).strict()

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
    // Assignment is intentionally team-based for this internal board. Clear
    // any legacy person relation so the UI can never imply a named owner.
    if (parsed.data.assignmentTarget !== undefined) updateData.assignedTo = null

    let before: Awaited<ReturnType<typeof payload.findByID>> | null = null
    let doc: Awaited<ReturnType<typeof payload.update>>
    try {
        before = parsed.data.status === undefined
            ? null
            : await payload.findByID({ collection: 'template-issues', id, depth: 0 })
        doc = await payload.update({ collection: 'template-issues', id, data: updateData, depth: 1 })
    } catch {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // “Done” means Dev completed its workflow. Return the related generation
    // to the operator queue for a human verification pass. The issue update
    // and the generation update are separate Payload writes, so compensate the
    // ticket if the second write fails instead of persisting a false Done.
    if (parsed.data.status !== undefined && before?.relatedType === 'generation' && before.status !== doc.status) {
        const targetRecoveryStatus = doc.status === 'done'
            ? 'ticket_verification_required'
            : before.status === 'done' ? 'ticket_created' : null
        if (targetRecoveryStatus) {
            try {
                await payload.update({
                    collection: 'ai-generation-records',
                    where: { or: [{ id: { equals: before.relatedId } }, { retryRootGeneration: { equals: before.relatedId } }] },
                    data: { recoveryStatus: targetRecoveryStatus },
                })
            } catch {
                try {
                    await payload.update({ collection: 'template-issues', id, data: { status: before.status }, depth: 1 })
                } catch {
                    // The API response makes this recoverable operationally;
                    // do not expose internal DB details to the browser.
                    console.error('[issues] generation sync rollback failed', { issueId: id })
                    return NextResponse.json({ error: 'Ticket và generation chưa đồng bộ. Cần kiểm tra lại ticket này.' }, { status: 503 })
                }
                return NextResponse.json({ error: 'Chưa thể đồng bộ generation. Ticket đã được trả về trạng thái trước đó.' }, { status: 503 })
            }
        }
    }
    return NextResponse.json({ data: doc })
})

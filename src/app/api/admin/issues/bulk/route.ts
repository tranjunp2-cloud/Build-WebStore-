/**
 * POST /api/admin/issues/bulk — bulk update issues.
 * Actions: assign | resolve | change-severity
 * Super-admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const BulkIssueSchema = z.object({
    ids: z.array(z.union([z.string(), z.number()])).min(1).max(100),
    action: z.enum(['assign', 'resolve', 'change-severity']),
    /** Required when action=assign */
    assignedTo: z.union([z.string(), z.number()]).optional(),
    /** Required when action=change-severity */
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
})

export const POST = withSuperAdmin(async (req: NextRequest) => {
    const body = await req.json().catch(() => null)
    const parsed = BulkIssueSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const { ids, action, assignedTo, severity } = parsed.data

    if (action === 'assign' && assignedTo === undefined) {
        return NextResponse.json({ error: 'assignedTo required for action=assign' }, { status: 422 })
    }
    if (action === 'change-severity' && severity === undefined) {
        return NextResponse.json({ error: 'severity required for action=change-severity' }, { status: 422 })
    }

    const payload = await getPayload({ config })

    const updateData: Record<string, unknown> =
        action === 'resolve' ? { status: 'fixed' } :
        action === 'assign' ? { assignedTo } :
        { severity: severity! }

    const results = await Promise.allSettled(
        ids.map((id) =>
            payload.update({ collection: 'template-issues', id, data: updateData, depth: 0 })
        ),
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    return NextResponse.json({
        data: { updated: succeeded, failed, total: ids.length },
    })
})

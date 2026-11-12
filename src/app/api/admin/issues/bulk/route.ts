/**
 * POST /api/admin/issues/bulk — bulk update issues.
 * Actions: assign | resolve | change-severity. `resolve` follows the same
 * terminal workflow state as the single-ticket UI.
 * Needs issue.bulk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withStudioPermission } from '@/lib/admin/api-utils'
import { SAFE_RELATION_POPULATE as ISSUE_POPULATE } from '@/lib/payload/safe-populate' // people as name / email, never user rows (TC-PERF-137)

const BulkIssueSchema = z.object({
    ids: z.array(z.union([z.string(), z.number()])).min(1).max(100),
    action: z.enum(['assign', 'resolve', 'change-severity']),
    /** Required when action=assign. Assignment is team-based, never a user ID. */
    assignmentTarget: z.enum(['unassigned', 'dev']).optional(),
    /** Required when action=change-severity */
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
})

export const POST = withStudioPermission('issue.bulk', async (req: NextRequest) => {
    const body = await req.json().catch(() => null)
    const parsed = BulkIssueSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const { ids, action, assignmentTarget, severity } = parsed.data

    if (action === 'assign' && assignmentTarget === undefined) {
        return NextResponse.json({ error: 'assignmentTarget required for action=assign' }, { status: 422 })
    }
    if (action === 'change-severity' && severity === undefined) {
        return NextResponse.json({ error: 'severity required for action=change-severity' }, { status: 422 })
    }

    const payload = await getPayload({ config })

    const updateData: Record<string, unknown> =
        action === 'resolve' ? { status: 'done' } :
        action === 'assign' ? { assignmentTarget, assignedTo: null } :
        { severity: severity! }

    const results = await Promise.allSettled(ids.map(async (id) => {
        const issue = await payload.findByID({ collection: 'template-issues', populate: ISSUE_POPULATE, id, depth: 0 })
        await payload.update({ collection: 'template-issues', populate: ISSUE_POPULATE, id, data: updateData, depth: 0 })
        if (action === 'resolve' && issue.relatedType === 'generation') {
            try {
                await payload.update({
                    collection: 'ai-generation-records',
                    where: { or: [{ id: { equals: issue.relatedId } }, { retryRootGeneration: { equals: issue.relatedId } }] },
                    data: { recoveryStatus: 'ticket_verification_required' },
                })
            } catch (error) {
                // Keep each bulk item internally consistent even when another
                // item in the same request succeeds independently.
                try {
                    await payload.update({ collection: 'template-issues', populate: ISSUE_POPULATE, id, data: { status: issue.status }, depth: 0 })
                } catch (rollbackError) {
                    // Do not hide a mismatch that needs manual repair. The item
                    // remains failed and the original sync error is preserved.
                    console.error('[admin/issues/bulk] failed to roll back issue after generation sync failure', {
                        issueId: id,
                        rollbackError,
                    })
                }
                throw error
            }
        }
    }))

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    return NextResponse.json({
        data: { updated: succeeded, failed, total: ids.length },
    })
})

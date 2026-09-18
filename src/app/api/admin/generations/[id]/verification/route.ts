import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const Body = z.object({ action: z.enum(['start', 'resolve', 'reopen']) }).strict()

/** Operator-only completion of a user-generation support flow. */
export const PATCH = withSuperAdmin(async (req: NextRequest, ctx) => {
    const id = ctx.params?.id
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!id || !parsed.success) return NextResponse.json({ error: 'Dữ liệu xác nhận không hợp lệ.' }, { status: 422 })

    const payload = await getPayload({ config })
    const record = await payload.findByID({ collection: 'ai-generation-records', id, depth: 0 }).catch(() => null)
    if (!record) return NextResponse.json({ error: 'Không tìm thấy generation.' }, { status: 404 })
    const allowed = parsed.data.action === 'start'
        ? record.recoveryStatus === 'ticket_verification_required'
        : record.recoveryStatus === 'operator_verifying'
    if (!allowed) return NextResponse.json({ error: 'Generation không ở trạng thái có thể xác nhận.' }, { status: 409 })

    const nextStatus = parsed.data.action === 'start' ? 'operator_verifying' : parsed.data.action === 'resolve' ? 'operator_resolved' : 'ticket_created'
    const issueStatus = parsed.data.action === 'start' ? 'testing' : parsed.data.action === 'resolve' ? 'done' : 'reopen'
    try {
        const issues = await payload.find({ collection: 'template-issues', where: { and: [{ relatedType: { equals: 'generation' } }, { relatedId: { equals: String(id) } }] }, depth: 0, limit: 1 })
        const issue = issues.docs[0]
        if (!issue) return NextResponse.json({ error: 'Không tìm thấy ticket liên quan.' }, { status: 409 })
        const previousIssueStatus = issue.status
        await payload.update({ collection: 'template-issues', id: issue.id, data: { status: issueStatus } })
        try {
            const updated = await payload.update({ collection: 'ai-generation-records', id, data: { recoveryStatus: nextStatus } })
            return NextResponse.json({ data: { id: String(updated.id), recoveryStatus: nextStatus } })
        } catch {
            await payload.update({ collection: 'template-issues', id: issue.id, data: { status: previousIssueStatus } }).catch(() => undefined)
            throw new Error('generation sync failed')
        }
    } catch {
        return NextResponse.json({ error: 'Chưa thể cập nhật xác nhận của người trực.' }, { status: 500 })
    }
})

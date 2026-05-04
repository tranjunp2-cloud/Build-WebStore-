/**
 * POST /api/admin/issues/[id]/comments — append comment to issue.
 * Rate-limited: 30/min per user (in-memory MVP).
 * Super-admin only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { checkRateLimit } from '@/lib/admin/api-utils'

const CommentSchema = z.object({
    body: z.string().min(1).max(5000),
})

export const POST = withSuperAdmin(async (req: NextRequest, ctx) => {
    const id = ctx.params?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const userId = String(ctx.user.id)
    if (!checkRateLimit(`comment:${userId}`, 30)) {
        return NextResponse.json({ error: 'Rate limit exceeded — max 30 comments/min' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const parsed = CommentSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    // Fetch existing doc to append comment (any: Payload generic constraint workaround)
    // eslint-disable-line
    let existing: Record<string, unknown>
    try {
        existing = await payload.findByID({ collection: 'template-issues', id, depth: 0 })
    } catch {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    const existingComments = Array.isArray(existing.comments) ? existing.comments : []
    const newComment = {
        author: Number(userId),
        body: parsed.data.body,
        createdAt: new Date().toISOString(),
    }

    const doc = await payload.update({
        collection: 'template-issues',
        id,
        data: { comments: [...existingComments, newComment] },
        depth: 0,
    })

    return NextResponse.json({ data: doc }, { status: 201 })
})

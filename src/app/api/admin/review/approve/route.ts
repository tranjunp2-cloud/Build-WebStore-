/**
 * POST /api/admin/review/approve
 * Approves a template: sets status=live, logs timeline event.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import type { PlatformUser } from '@/types/user'

const ApproveSchema = z.object({
    templateId: z.union([z.string(), z.number()]),
})

export const POST = withSuperAdmin(async (req: NextRequest, ctx) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = ApproveSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const { templateId } = parsed.data
    const payload = await getPayload({ config })

    // Verify template exists and is in review state
    let template: Record<string, unknown>
    try {
        template = await payload.findByID({
            collection: 'templates',
            id: templateId,
            depth: 0,
        }) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.status !== 'review') {
        return NextResponse.json(
            { error: `Template status is "${template.status}", expected "review"` },
            { status: 400 },
        )
    }

    try {
        const updated = await payload.update({
            collection: 'templates',
            id: templateId,
            data: { status: 'live' },
        })
        return NextResponse.json({ data: updated })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Approve failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})

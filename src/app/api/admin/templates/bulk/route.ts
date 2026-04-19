/**
 * POST /api/admin/templates/bulk
 * Bulk actions: publish | archive | schedule | delete (soft = set archived)
 * Rate-limited: 10 req/min/IP.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin, BulkActionSchema, checkRateLimit } from '@/lib/admin/api-utils'

export const POST = withSuperAdmin(async (req: NextRequest) => {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRateLimit(`bulk:${ip}`)) {
        return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = BulkActionSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 422 },
        )
    }

    const { ids, action, scheduledFor } = parsed.data

    if (action === 'schedule' && !scheduledFor) {
        return NextResponse.json({ error: 'scheduledFor is required for schedule action' }, { status: 422 })
    }

    const payload = await getPayload({ config })

    // Map action → status value
    const statusMap: Record<string, string> = {
        publish: 'live',
        archive: 'archived',
        delete: 'archived', // soft delete
        schedule: 'scheduled',
    }

    const newStatus = statusMap[action]
    const results: Array<{ id: string | number; ok: boolean; error?: string }> = []

    for (const id of ids) {
        try {
            const updateData: Record<string, unknown> = { status: newStatus }
            if (action === 'schedule' && scheduledFor) {
                updateData.scheduledFor = scheduledFor
            }

            await payload.update({
                collection: 'templates',
                id: id as string,
                data: updateData,
            })
            results.push({ id, ok: true })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            results.push({ id, ok: false, error: message })
        }
    }

    const succeeded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length

    return NextResponse.json({
        data: { succeeded, failed, results },
    })
})

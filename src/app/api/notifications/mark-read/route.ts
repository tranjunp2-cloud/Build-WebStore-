import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import type { MarkReadPayload } from '@/types/notification'

import { z } from 'zod'

const MarkReadSchema = z.object({
    mark_all: z.boolean().optional(),
    notificationIds: z.array(z.string()).max(100).optional(),
}).refine(data => data.mark_all || (data.notificationIds && data.notificationIds.length > 0), {
    message: "Must provide either mark_all=true or an array of notificationIds",
})

export const dynamic = 'force-dynamic'

// Postgres int4 upper bound — a larger id/value overflows `::integer[]` casts → 500.
const INT4_MAX = 2147483647

/**
 * POST /api/notifications/mark-read
 *
 * Mark one, many, or all notifications as read for the authenticated user.
 * Body: { notificationIds: string[] } | { mark_all: true }
 * Response: { success: true }
 */
export const POST = withAuth(async (user, request) => {
    try {
        // Rate limit: 10 requests per minute per user
        const rateCheck = await checkRateLimit(`notifications:mark-read:${user.id}`, 10, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000))) } },
            )
        }

        const payload = await getPayload({ config })
        const jsonBody = await request.json()
        const parsed = MarkReadSchema.safeParse(jsonBody)

        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
        }
        const body = parsed.data as MarkReadPayload

        // Resolve tenant ids. mark_all uses the first tenant (unchanged behavior);
        // specific-ids scope to ALL the user's tenants to match the collection update
        // access policy — a multi-tenant user must be able to mark a notification read
        // in any of their tenants, not just the first. (GH #1535 review)
        const userTenants = (user as unknown as {
            tenants?: Array<{ tenant: string | number | { id: string | number } }>
        }).tenants ?? []
        const tenantIds = userTenants
            .map((t) => (typeof t.tenant === 'object' && t.tenant ? t.tenant.id : t.tenant))
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0)

        if (tenantIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 400 })
        }

        const db = payload.db?.drizzle as
            | { execute: (q: unknown) => Promise<{ rowCount?: number }> }
            | undefined
        if (!db) {
            return NextResponse.json(
                { success: false, error: { code: 'INTERNAL_ERROR', message: 'Database not available' } },
                { status: 500 },
            )
        }

        const uid = Number(user.id)
        const tid = tenantIds[0]

        if (body.mark_all) {
            // Single batched UPDATE instead of one round-trip per row. The old code
            // ran up to 200 payload.update() calls in Promise.all → each grabbed a
            // Neon connection → pool exhaustion under load (GH #1535), plus a silent
            // 200-row cap that left the rest unread. Raw SQL bypasses Payload access,
            // so the WHERE replicates the exact ownership + tenant scope the collection
            // policy enforces — it can never touch another user's notifications.
            const result = await db.execute(sql`
                UPDATE notifications
                SET is_read = true, updated_at = now()
                WHERE user_id = ${uid} AND tenant_id = ${tid} AND is_read = false
            `)
            return NextResponse.json({ success: true, updated: Number(result?.rowCount ?? 0) })
        }

        if (!body.notificationIds || body.notificationIds.length === 0) {
            return NextResponse.json({ success: false, error: 'notificationIds required' }, { status: 400 })
        }

        // Specific ids: bind as a Postgres integer[] literal ('{1,2}'), not a JS array
        // (the pg driver serializes a JS array to a bare scalar → malformed array literal).
        // Cap at INT4_MAX so an out-of-range id can't overflow `::integer[]` → 500.
        // The user_id + tenant_id clause enforces ownership — a user cannot mark another
        // user's notifications even by guessing ids.
        const ids = body.notificationIds
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0 && n <= INT4_MAX)
        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'notificationIds required' }, { status: 400 })
        }
        const idArray = `{${ids.join(',')}}`
        const tenantArray = `{${tenantIds.join(',')}}`
        const result = await db.execute(sql`
            UPDATE notifications
            SET is_read = true, updated_at = now()
            WHERE id = ANY(${idArray}::integer[]) AND user_id = ${uid} AND tenant_id = ANY(${tenantArray}::integer[]) AND is_read = false
        `)
        return NextResponse.json({ success: true, updated: Number(result?.rowCount ?? 0) })
    } catch (error) {
        console.error('[Notifications Mark-Read Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notifications as read' } },
            { status: 500 }
        )
    }
})

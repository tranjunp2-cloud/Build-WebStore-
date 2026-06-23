import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { sendSSOStepNotification } from '@/lib/sso/sso-api-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_RETRIES = 5
const BATCH_SIZE = 20

/**
 * GET /api/cron/process-sso-steps
 *
 * Retries failed SSO step-status notifications from sso_step_events table.
 * Uses UPDATE...RETURNING with FOR UPDATE SKIP LOCKED to atomically claim rows —
 * prevents two concurrent cron instances from processing the same event.
 * Stuck 'processing' rows (cron crash) are reclaimed after 5 minutes.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const db = (payload.db as any)?.drizzle
    if (!db) {
        return NextResponse.json({ error: 'No DB connection' }, { status: 500 })
    }

    // Atomically claim pending rows (or stuck 'processing' rows older than 5 min).
    // Two concurrent crons cannot claim the same row — SKIP LOCKED skips rows already locked.
    const claimed = await db.execute(sql`
        UPDATE sso_step_events
        SET status = 'processing', updated_at = now()
        WHERE id IN (
            SELECT id FROM sso_step_events
            WHERE (
                status = 'pending'
                OR (status = 'processing' AND updated_at < now() - interval '5 minutes')
            )
            AND retry_count < ${MAX_RETRIES}
            ORDER BY created_at ASC
            LIMIT ${BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id, step
    `)

    const events = (claimed.rows ?? []) as Array<{ id: number; user_id: number; step: number }>
    let succeeded = 0
    let failed = 0

    for (const event of events) {
        try {
            // sendSSOStepNotification throws on failure — cron catch handles retry/fail state
            await sendSSOStepNotification(payload, event.user_id, event.step as 1 | 2 | 3)

            await db.execute(sql`
                UPDATE sso_step_events
                SET status = 'completed', updated_at = now()
                WHERE id = ${event.id}
            `)
            succeeded++
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)

            // retry_count + 1 >= MAX_RETRIES → mark permanently failed
            await db.execute(sql`
                UPDATE sso_step_events
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END,
                    last_error = ${errMsg},
                    updated_at = now()
                WHERE id = ${event.id}
            `)
            failed++
        }
    }

    return NextResponse.json({
        processed: events.length,
        succeeded,
        failed,
        timestamp: new Date().toISOString(),
    })
}

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
    let raced = 0

    for (const event of events) {
        try {
            // sendSSOStepNotification throws on failure — cron catch handles retry/fail state
            await sendSSOStepNotification(payload, event.user_id, event.step as 1 | 2 | 3)

            // GH-1293: guard on status='processing' — a concurrent user-triggered retry
            // (persistStepEvent's upsert) may have already moved this row to 'completed'
            // while this cron attempt was in flight. Without this guard, a stale cron
            // finalize would clobber that newer 'completed' state back to pending/failed.
            // Residual (accepted) gap: if that concurrent retry instead FAILS and moves
            // status to 'pending' while this cron attempt is succeeding, this UPDATE
            // no-ops (0 rows matched) and the success is "lost" for this cycle — the row
            // stays 'pending' and the next cron tick retries a call that already
            // succeeded server-side. Self-healing (SSO Hub's step-status flip is
            // idempotent) and narrow (requires both paths racing the same row within the
            // same in-flight window), so not worth a full CAS/version-token mechanism.
            // Check rowCount (not just "did the UPDATE run") so the response's counters
            // don't silently overreport when this exact race fires — a raced attempt is
            // tracked separately rather than miscounted as succeeded.
            const result = await db.execute(sql`
                UPDATE sso_step_events
                SET status = 'completed', updated_at = now()
                WHERE id = ${event.id} AND status = 'processing'
            `)
            if ((result.rowCount ?? 0) > 0) {
                succeeded++
            } else {
                raced++
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)

            // retry_count + 1 >= MAX_RETRIES → mark permanently failed
            // Same status='processing' guard and rowCount check as the success branch above.
            const result = await db.execute(sql`
                UPDATE sso_step_events
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END,
                    last_error = ${errMsg},
                    updated_at = now()
                WHERE id = ${event.id} AND status = 'processing'
            `)
            if ((result.rowCount ?? 0) > 0) {
                failed++
            } else {
                raced++
            }
        }
    }

    return NextResponse.json({
        processed: events.length,
        succeeded,
        failed,
        raced,
        timestamp: new Date().toISOString(),
    })
}

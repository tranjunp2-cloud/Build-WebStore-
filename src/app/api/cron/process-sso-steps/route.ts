import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { sendSSOStepNotification } from '@/lib/sso/sso-api-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_RETRIES = 5
const BATCH_SIZE = 2
const MAX_CONCURRENCY = 2
const WORKER_DEADLINE_MS = 50_000
const LOGIN_TIMEOUT_MS = 20_000
const PATCH_TIMEOUT_MS = 25_000
const FINALIZE_HEADROOM_MS = 5_000
const MAX_BACKOFF_MINUTES = 4

/**
 * GET /api/cron/process-sso-steps
 *
 * Retries failed SSO step-status notifications from sso_step_events table.
 * Uses UPDATE...RETURNING with FOR UPDATE SKIP LOCKED to atomically claim rows —
 * prevents two concurrent cron instances from processing the same event.
 * Stuck 'processing' rows (cron crash) are reclaimed after 5 minutes.
 */
export async function GET(req: Request) {
    const deadline = Date.now() + WORKER_DEADLINE_MS
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
        WITH candidates AS (
            SELECT id, user_id, step, status AS previous_status
            FROM sso_step_events
            WHERE (
                (status = 'pending' AND updated_at <= now() - (LEAST(retry_count, ${MAX_BACKOFF_MINUTES}) * interval '1 minute'))
                OR (status = 'processing' AND updated_at < now() - interval '5 minutes')
            )
            AND retry_count < ${MAX_RETRIES}
            ORDER BY retry_count ASC, created_at ASC
            LIMIT ${BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
        ), claimed AS (
            UPDATE sso_step_events AS events
            SET status = 'processing', updated_at = now()
            FROM candidates
            WHERE events.id = candidates.id
            RETURNING events.id, events.user_id, events.step, candidates.previous_status
        )
        SELECT id, user_id, step, (previous_status = 'processing') AS was_reclaimed
        FROM claimed
    `)

    const events = (claimed.rows ?? []) as Array<{
        id: number
        user_id: number
        step: number
        was_reclaimed?: boolean
    }>
    let succeeded = 0
    let failed = 0
    let raced = 0
    let deferred = 0
    const reclaimed = events.filter((event) => event.was_reclaimed).length

    const processEvent = async (event: (typeof events)[number]) => {
        if (deadline - Date.now() <= FINALIZE_HEADROOM_MS) {
            deferred++
            return
        }

        try {
            await sendSSOStepNotification(
                payload,
                event.user_id,
                event.step as 1 | 2 | 3,
                {
                    loginTimeoutMs: LOGIN_TIMEOUT_MS,
                    patchTimeoutMs: PATCH_TIMEOUT_MS,
                    deadlineMs: deadline - FINALIZE_HEADROOM_MS,
                },
            )

            // GH-1293: only the worker that still owns processing may finalize.
            const result = await db.execute(sql`
                UPDATE sso_step_events
                SET status = 'completed', updated_at = now()
                WHERE id = ${event.id} AND status = 'processing'
            `)
            if ((result.rowCount ?? 0) > 0) succeeded++
            else raced++
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            if (deadline - Date.now() <= FINALIZE_HEADROOM_MS) {
                deferred++
                return
            }

            const result = await db.execute(sql`
                UPDATE sso_step_events
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END,
                    last_error = ${errMsg},
                    updated_at = now()
                WHERE id = ${event.id} AND status = 'processing'
            `)
            if ((result.rowCount ?? 0) > 0) failed++
            else raced++
        }
    }

    await Promise.all(events.slice(0, MAX_CONCURRENCY).map(processEvent))

    let remaining = 0
    let oldestPendingAgeSeconds = 0
    try {
        const queueState = await db.execute(sql`
            SELECT
                COUNT(*) FILTER (WHERE status IN ('pending', 'processing') AND retry_count < ${MAX_RETRIES})::int AS remaining,
                COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status IN ('pending', 'processing') AND retry_count < ${MAX_RETRIES})))::int, 0) AS oldest_pending_age_seconds
            FROM sso_step_events
        `)
        const queueRow = (queueState.rows?.[0] ?? {}) as {
            remaining?: number
            oldest_pending_age_seconds?: number
        }
        remaining = Number(queueRow.remaining ?? 0)
        oldestPendingAgeSeconds = Number(
            queueRow.oldest_pending_age_seconds ?? 0,
        )
    } catch (queueError) {
        console.error(
            '[SSO Cron] Failed to read queue summary:',
            queueError instanceof Error ? queueError.message : 'unknown',
        )
    }

    return NextResponse.json({
        processed: events.length,
        succeeded,
        failed,
        raced,
        deferred,
        reclaimed,
        remaining,
        oldestPendingAgeSeconds,
        concurrency: Math.min(events.length, MAX_CONCURRENCY),
        timestamp: new Date().toISOString(),
    })
}

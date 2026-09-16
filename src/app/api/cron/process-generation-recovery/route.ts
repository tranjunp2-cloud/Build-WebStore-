import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { newRecoveryLeaseToken, runGenerationRecoveryJob } from '@/lib/ai/generation-recovery-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const MAX_ATTEMPTS = 2

type ClaimedJob = { id: number }
type DrizzleExecutor = { execute(query: ReturnType<typeof sql>): Promise<{ rows?: ClaimedJob[] }> }

/**
 * Vercel Cron durable worker. A lease lets a later invocation reclaim a job
 * after a crashed function without allowing two workers to execute it at once.
 */
export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await getPayload({ config })
    const db = (payload.db as { drizzle?: DrizzleExecutor }).drizzle
    if (!db) return NextResponse.json({ error: 'Recovery queue is unavailable.' }, { status: 503 })

    // A database interruption between child and job inserts cannot be made a
    // success. Reconcile the rare orphan after a grace period so it never
    // permanently occupies the one-active-child constraint.
    await db.execute(sql`
        WITH orphan AS (
            UPDATE ai_generation_records AS children
            SET lifecycle = 'terminal', outcome = 'cancelled', status = 'failed',
                recovery_status = 'ticket_required', terminal_at = now(),
                user_safe_message = 'Không thể xếp hàng gen lại. Cần tạo ticket để xử lý.'
            WHERE children.source = 'ops_retry' AND children.lifecycle = 'queued'
              AND children.created_at < now() - interval '2 minutes'
              AND NOT EXISTS (
                  SELECT 1 FROM generation_recovery_jobs AS jobs
                  WHERE jobs.child_generation_id = children.id
              )
            RETURNING children.parent_generation_id
        )
        UPDATE ai_generation_records AS parents
        SET recovery_status = 'ticket_required'
        FROM orphan WHERE parents.id = orphan.parent_generation_id
    `)

    // A timed-out function is retried once. A second expired lease becomes a
    // ticket-eligible terminal state instead of an unbounded provider-cost loop.
    await db.execute(sql`
        WITH exhausted AS (
            UPDATE generation_recovery_jobs
            SET status = 'failed', failure_code = 'RECOVERY_LEASE_EXHAUSTED',
                user_safe_message = 'Quá trình gen lại bị gián đoạn nhiều lần.',
                finished_at = now(), updated_at = now()
            WHERE status = 'running' AND lease_expires_at < now()
              AND attempt_count >= ${MAX_ATTEMPTS}
            RETURNING child_generation_id, source_generation_id
        ), child AS (
            UPDATE ai_generation_records AS records
            SET lifecycle = 'terminal', outcome = 'failed', status = 'failed',
                recovery_status = 'ticket_required', terminal_at = now(),
                user_safe_message = 'Quá trình gen lại bị gián đoạn nhiều lần.'
            FROM exhausted WHERE records.id = exhausted.child_generation_id
        )
        UPDATE ai_generation_records AS parents
        SET recovery_status = 'ticket_required'
        FROM exhausted WHERE parents.id = exhausted.source_generation_id
    `)

    const leaseToken = newRecoveryLeaseToken()
    const claimed = await db.execute(sql`
        WITH candidate AS (
            SELECT id FROM generation_recovery_jobs
            WHERE status = 'queued'
               OR (status = 'running' AND lease_expires_at < now())
            ORDER BY queued_at ASC, id ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        UPDATE generation_recovery_jobs AS jobs
        SET status = 'running', started_at = COALESCE(jobs.started_at, now()),
            lease_token = ${leaseToken}, lease_expires_at = now() + interval '90 seconds',
            last_heartbeat_at = now(), attempt_count = jobs.attempt_count + 1, updated_at = now()
        FROM candidate
        WHERE jobs.id = candidate.id
        RETURNING jobs.id
    `)
    const job = claimed.rows?.[0]
    if (!job) return NextResponse.json({ processed: 0, status: 'idle' })

    const result = await runGenerationRecoveryJob(payload, { jobId: job.id, leaseToken })
    return NextResponse.json({ processed: 1, jobId: String(job.id), ...result })
}

import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'

export type BroadcastTargetAudience = 'all' | 'free' | 'paid'

export interface CreateBroadcastParams {
    title: string
    message: string
    actionUrl?: string
    targetAudience?: BroadcastTargetAudience
    payload: Payload
}

export interface CreateBroadcastResult {
    notified: number
}

const BATCH_SIZE = 500
const MAX_RECIPIENTS = 10000

/**
 * Create broadcast notifications for all tenant owners.
 *
 * Uses raw SQL with INSERT...SELECT for performance — avoids N+1 Payload API calls.
 * Each inserted row triggers pg NOTIFY via the `after_notification_insert` trigger,
 * which the SSE stream endpoint picks up for realtime delivery.
 *
 * RBAC: Only users with role='owner' in users_tenants receive broadcasts.
 *
 * Batching: Inserts in chunks of BATCH_SIZE to avoid long-running transactions
 * and reduce pg NOTIFY storm pressure.
 */
export async function createBroadcastNotifications({
    title,
    message,
    actionUrl,
    targetAudience = 'all',
    payload,
}: CreateBroadcastParams): Promise<CreateBroadcastResult> {
    const db = payload.db?.drizzle

    if (!db) {
        throw new Error('Database connection not available')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    const expiresAtStr = expiresAt.toISOString()

    const resolvedActionUrl = actionUrl ?? null

    // Batch INSERT with pagination to avoid overwhelming the DB + pg NOTIFY
    let totalNotified = 0
    let offset = 0

    while (offset < MAX_RECIPIENTS) {
        const result = await db.execute(
            sql`INSERT INTO notifications (tenant_id, user_id, type, title, message, action_url, is_read, created_at, updated_at, expires_at)
                SELECT
                    ut.tenant_id,
                    ut._parent_id,
                    'SYSTEM_ALERT',
                    ${title},
                    ${message},
                    ${resolvedActionUrl},
                    false,
                    NOW(),
                    NOW(),
                    ${expiresAtStr}::timestamptz
                FROM users_tenants ut
                WHERE ut.role = 'owner'
                  AND ut.status = 'active'
                ORDER BY ut._parent_id
                LIMIT ${BATCH_SIZE}
                OFFSET ${offset}`
        )

        const inserted = Number(result?.rowCount ?? 0)
        totalNotified += inserted

        // If we got fewer rows than BATCH_SIZE, we've processed everyone
        if (inserted < BATCH_SIZE) break
        offset += BATCH_SIZE
    }

    return { notified: totalNotified }
}

import type { Payload } from 'payload'

/** One row of the "Recent access" table on /studio/merchant-access. Dates are ISO strings. */
export type RecentMerchantAccessEvent = {
    id: number
    createdAt: string
    actorEmail: string
    targetEmail: string
    expiresAt: string
    usedAt: string | null
}

export type RecentAccessStatus = 'opened' | 'expired' | 'unused'

type DrizzleLike = { execute: (query: unknown) => Promise<{ rows?: unknown[] }> }
type Row = {
    id: number | string
    created_at: Date | string
    actor_email: string
    target_email: string
    expires_at: Date | string
    used_at: Date | string | null
}

const iso = (v: Date | string): string => new Date(v).toISOString()

/** Opened beats expired: a link that was used stays "opened" after its 10 minutes pass. */
export function recentAccessStatus(event: Pick<RecentMerchantAccessEvent, 'usedAt' | 'expiresAt'>, now: Date = new Date()): RecentAccessStatus {
    if (event.usedAt) return 'opened'
    return new Date(event.expiresAt).getTime() <= now.getTime() ? 'expired' : 'unused'
}

/** Newest-first audit rows from merchant_access_events (same table the redeem route writes). */
export async function listRecentMerchantAccessEvents(payload: Payload, limit = 20): Promise<RecentMerchantAccessEvent[]> {
    const db = (payload.db as unknown as { drizzle?: DrizzleLike } | undefined)?.drizzle
    if (!db) throw new Error('merchant-access: database handle unavailable')
    const { sql } = await import('drizzle-orm')
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)))
    const result = await db.execute(sql`
        SELECT id, created_at, actor_email, target_email, expires_at, used_at
        FROM merchant_access_events
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit}
    `)
    return ((result.rows ?? []) as Row[]).map((r) => ({
        id: Number(r.id),
        createdAt: iso(r.created_at),
        actorEmail: r.actor_email,
        targetEmail: r.target_email,
        expiresAt: iso(r.expires_at),
        usedAt: r.used_at ? iso(r.used_at) : null,
    }))
}

import type { Payload } from 'payload'

/**
 * Audit + one-time-use store for merchant CMS access links (`merchant_access_events`, scripts/db-setup.js).
 * Every link writes a row when created; redeeming flips `used_at` exactly once, so a link cannot be replayed
 * and support can always answer "who opened this merchant's CMS, and when".
 */
type DrizzleLike = { execute: (query: unknown) => Promise<{ rows?: unknown[] }> }

function drizzle(payload: Payload): DrizzleLike {
    const db = (payload.db as unknown as { drizzle?: DrizzleLike } | undefined)?.drizzle
    if (!db) throw new Error('merchant-access: database handle unavailable')
    return db
}

export type MerchantAccessEventInput = {
    jti: string
    actor: { id: number; email: string }
    target: { id: number; email: string }
    expiresAt: Date
}

export async function recordMerchantAccessLink(payload: Payload, input: MerchantAccessEventInput): Promise<void> {
    const { sql } = await import('drizzle-orm')
    await drizzle(payload).execute(sql`
        INSERT INTO merchant_access_events (jti, actor_user_id, actor_email, target_user_id, target_email, expires_at)
        VALUES (${input.jti}, ${input.actor.id}, ${input.actor.email}, ${input.target.id}, ${input.target.email},
                ${input.expiresAt.toISOString()})
    `)
}

/**
 * Marks the link used and returns the actor's email only for the first redeem of an unexpired link (else null).
 * The single UPDATE … WHERE used_at IS NULL makes two concurrent redeems race safely: one wins.
 */
export async function redeemMerchantAccessLink(payload: Payload, jti: string, ip: string | null): Promise<{ actorEmail: string } | null> {
    const { sql } = await import('drizzle-orm')
    const result = await drizzle(payload).execute(sql`
        UPDATE merchant_access_events
        SET used_at = now(), used_ip = ${ip}
        WHERE jti = ${jti} AND used_at IS NULL AND expires_at > now()
        RETURNING actor_email
    `)
    const row = result.rows?.[0] as { actor_email?: unknown } | undefined
    return row ? { actorEmail: typeof row.actor_email === 'string' ? row.actor_email : '' } : null
}

import type { BasePayload } from 'payload'

/**
 * Guarded single-statement writes on `users` for the SSO avatar sync (GH-1723).
 *
 * `payload.update({ where })` is not guaranteed to be one atomic UPDATE (it can find ids first
 * and update by id), so the two writes that must not race — binding `sso_user_id` and
 * the compare-and-set of the avatar state — use one `UPDATE … WHERE … RETURNING` each.
 * Same raw-pool pattern as src/lib/media/register-media.ts.
 *
 * These writes bypass Payload hooks on purpose: this is a system sync (no `req.user`), so the
 * `setAuditFields` hook never set `updatedBy` for Local-API writes either, and the only users
 * afterChange hook (welcome email) is create-only. `updated_at` is maintained here.
 */

type UserPool = {
    query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ id: number }> }>
}

const getPool = (payload: BasePayload): UserPool => (payload.db as unknown as { pool: UserPool }).pool

const PG_UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err: unknown): boolean {
    const e = err as { code?: string; cause?: { code?: string } } | null
    return e?.code === PG_UNIQUE_VIOLATION || e?.cause?.code === PG_UNIQUE_VIOLATION
}

/**
 * Bind `ssoUserId` to a user that has none yet.
 * - 'bound'    → this call set it
 * - 'conflict' → the user already has an SSO id (a concurrent bind won) or the id belongs to
 *                another user (unique index). Any other database error is rethrown so the
 *                caller answers 5xx and SSO retries instead of dropping the sync.
 */
export async function bindSsoUserId(
    payload: BasePayload,
    userId: number | string,
    ssoUserId: number,
): Promise<'bound' | 'conflict'> {
    try {
        const res = await getPool(payload).query(
            'UPDATE users SET sso_user_id = $1, updated_at = NOW() WHERE id = $2 AND sso_user_id IS NULL RETURNING id',
            [ssoUserId, userId],
        )
        return res.rows.length > 0 ? 'bound' : 'conflict'
    } catch (err) {
        if (isUniqueViolation(err)) return 'conflict'
        throw err
    }
}

export type AvatarStateWrite = {
    avatarId: number | string | null
    avatarKey: string | null
    syncedAt: string
}

/**
 * Compare-and-set the avatar state: applies only while `sso_avatar_synced_at` still equals the
 * value the caller read (NULL-safe). Returns false when another sync won in between.
 */
export async function casSetAvatarState(
    payload: BasePayload,
    userId: number | string,
    expectedSyncedAt: string | null,
    next: AvatarStateWrite,
): Promise<boolean> {
    const res = await getPool(payload).query(
        `UPDATE users
            SET avatar_id = $1, sso_avatar_key = $2, sso_avatar_synced_at = $3::timestamptz, updated_at = NOW()
          WHERE id = $4 AND sso_avatar_synced_at IS NOT DISTINCT FROM $5::timestamptz
      RETURNING id`,
        [next.avatarId, next.avatarKey, next.syncedAt, userId, expectedSyncedAt],
    )
    return res.rows.length > 0
}

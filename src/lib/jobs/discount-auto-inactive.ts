import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

export interface DiscountAutoInactiveResult {
    flipped: number
    ids: number[]
}

/**
 * Auto-deactivate EXPIRED discounts (GH-1282).
 *
 * Flips `status` from 'active' → 'inactive' for every discount whose `expires_at < now()`.
 * `now()` is the Postgres transaction timestamp (UTC); `expires_at` is stored pinned to
 * end-of-day Asia/Kuala_Lumpur (Discounts beforeValidate hook), so a code stays active through
 * 23:59:59.999 KL of its expiry date — consistent with the admin badge and applyDiscount (BR-03).
 *
 * Runs across ALL tenants in one atomic statement. Idempotent: a second run matches nothing.
 *
 * Deliberately NOT flipped:
 *   - Scheduled (starts_at in the future) — meant to go live later.
 *   - USED UP (usage_count >= usage_limit) — a slot can be RETURNED on a terminal non-sale
 *     (cancel/refund/24h payment-expiry, see releaseDiscountRedemption). Flipping it inactive
 *     would strand a code that regains capacity. Instead, used-up is surfaced as Inactive only
 *     by the live badge (auto-recovers when a slot frees) and blocked at save by the form guard;
 *     the DB `status` stays active so capacity can reopen automatically. (GH-1282 decision: B.)
 *
 * Expiry is the only monotonic, irreversible condition — hence the only one persisted here.
 */
export async function discountAutoInactiveJob(payload: Payload): Promise<DiscountAutoInactiveResult> {
    const db = payload.db as unknown as {
        drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ id: number }> }> }
    }

    const res = await db.drizzle.execute(sql`
        UPDATE discounts
        SET status = 'inactive', updated_at = now()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < now()
        RETURNING id
    `)

    const ids = (res.rows ?? []).map((r) => Number(r.id))
    if (ids.length) {
        payload.logger.info({ flipped: ids.length, ids }, '[discount-auto-inactive] deactivated expired discounts')
    }
    return { flipped: ids.length, ids }
}

import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

/**
 * Reverse of {@link recordDiscountRedemption} — releases an order's redeemed discount slot.
 *
 * Deletes the order's `discount_usage_history` row and decrements `discounts.usage_count`, so a
 * cancelled / refunded order no longer consumes a promo slot (a limit-100 code stays usable after
 * its orders are cancelled). Single atomic statement: the DELETE drives the decrement.
 *
 * Idempotent + safe to call on ANY cancel path:
 *   - DELETE keyed by the unique `order_id` → at most one row removed; a second cancel deletes nothing.
 *   - No history row (e.g. a Stripe order cancelled while still pending — never redeemed) → no-op.
 *   - `GREATEST(0, usage_count - 1)` floors the counter so a double-release can never go negative.
 *
 * Non-throwing: cancellation/restock is the critical path; a usage-write failure must never abort it.
 * Failures are logged and swallowed.
 */
export async function releaseDiscountRedemption(
    payload: Payload,
    orderId: number,
): Promise<{ released: boolean }> {
    if (!orderId) return { released: false }

    try {
        const db = payload.db as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ released: number }> }> } }

        const res = await db.drizzle.execute(sql`
            WITH del AS (
                DELETE FROM discount_usage_history
                WHERE order_id = ${Number(orderId)}
                RETURNING discount_id
            ), dec AS (
                UPDATE discounts SET usage_count = GREATEST(0, usage_count - 1)
                WHERE id = (SELECT discount_id FROM del)
                  AND (SELECT discount_id FROM del) IS NOT NULL
                RETURNING id
            )
            SELECT (SELECT count(*) FROM del)::int AS released
        `)

        return { released: (res.rows?.[0]?.released ?? 0) > 0 }
    } catch (err) {
        console.error('[discount] releaseDiscountRedemption failed (non-fatal)', err)
        return { released: false }
    }
}

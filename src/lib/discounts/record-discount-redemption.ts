import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

/**
 * Idempotent, limit-capped discount redemption — the single writer of discount usage.
 *
 * INSERTs one `discount_usage_history` row guarded by `ON CONFLICT (order_id) DO NOTHING`,
 * then increments `discounts.usage_count` ONLY when a new row was inserted AND the discount is
 * still under its `usage_limit`. Idempotent under retries — Stripe webhook re-delivery,
 * confirm-poll, cron, or an admin re-save can all fire it without double-counting.
 *
 * USAGE CAP (F33 hardening): the bump carries `AND (usage_limit IS NULL OR usage_count < usage_limit)`.
 * A conditional UPDATE on a single row is row-lock serialized — Postgres re-evaluates the WHERE against
 * the latest committed `usage_count` after acquiring the lock — so `usage_count` can NEVER exceed
 * `usage_limit`, even when two checkouts pass the (stale) pre-create `applyDiscount` check concurrently.
 * Residual (accepted, "cap count" semantics): at the exact concurrency boundary two orders may both be
 * created at the discounted price; the history records both, but `usage_count` stops at the cap — so the
 * invariant softens to `usage_count == min(COUNT(history), usage_limit)`. No FUTURE order slips through.
 *
 * Snapshots `discount_code` + `discount_type` + `discount_value` so the audit report keeps full
 * fidelity (code, type, value) even after the discount row is hard-deleted (FK `ON DELETE SET NULL`).
 *
 * Non-throwing: the order is already placed/paid when this runs, so a usage-write failure must
 * never abort the caller. Failures are logged and swallowed.
 *
 * No-op when there is nothing to redeem (`amountApplied <= 0`, or missing discount/order id).
 */
export async function recordDiscountRedemption(
    payload: Payload,
    args: {
        tenantId: number
        discountId: number
        orderId: number
        amountApplied: number
        discountCode?: string | null
        discountType?: string | null
        discountValue?: number | null
        customerEmail?: string | null
    },
): Promise<{ recorded: boolean }> {
    if (!(args.discountId && args.orderId && args.amountApplied > 0)) return { recorded: false }

    try {
        const db = payload.db as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ inserted: number }> }> } }

        // Single atomic statement: the guarded INSERT and the capped usage_count bump run in one
        // round-trip / implicit transaction. The UPDATE fires ONLY when the INSERT actually added a row
        // (replay-safe) AND capacity remains, closing both the mid-call-crash window and the over-limit race.
        const res = await db.drizzle.execute(sql`
            WITH ins AS (
                INSERT INTO discount_usage_history
                    (tenant_id, discount_id, order_id, amount_applied, customer_email, discount_code, discount_type, discount_value, used_at, created_at, updated_at)
                VALUES (
                    ${Number(args.tenantId)},
                    ${Number(args.discountId)},
                    ${Number(args.orderId)},
                    ${args.amountApplied},
                    ${args.customerEmail ?? null},
                    ${args.discountCode ?? null},
                    ${args.discountType ?? null},
                    ${args.discountValue ?? null},
                    NOW(), NOW(), NOW()
                )
                ON CONFLICT (order_id) DO NOTHING
                RETURNING id
            ), bump AS (
                UPDATE discounts SET usage_count = usage_count + 1
                WHERE id = ${Number(args.discountId)}
                  AND EXISTS (SELECT 1 FROM ins)
                  AND (usage_limit IS NULL OR usage_count < usage_limit)
                RETURNING id
            )
            SELECT (SELECT count(*) FROM ins)::int AS inserted
        `)

        return { recorded: (res.rows?.[0]?.inserted ?? 0) > 0 }
    } catch (err) {
        console.error('[discount] recordDiscountRedemption failed (non-fatal)', err)
        return { recorded: false }
    }
}

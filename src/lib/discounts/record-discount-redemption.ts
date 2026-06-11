import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

/**
 * Idempotent discount redemption — the single writer of discount usage.
 *
 * INSERTs one `discount_usage_history` row guarded by `ON CONFLICT (order_id) DO NOTHING`,
 * then increments `discounts.usage_count` ONLY when a new row was actually inserted. This keeps
 * `usage_count == COUNT(history rows)` and makes the call safe under retries — Stripe webhook
 * re-delivery, confirm-poll, cron, or an admin re-save can all fire it without double-counting.
 *
 * Snapshots `discount_code` so the audit report still shows the code even after the discount row
 * is hard-deleted (the FK is `ON DELETE SET NULL`).
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
        customerEmail?: string | null
    },
): Promise<{ recorded: boolean }> {
    if (!(args.discountId && args.orderId && args.amountApplied > 0)) return { recorded: false }

    try {
        const db = payload.db as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ inserted: number }> }> } }

        // Single atomic statement: the guarded INSERT and the usage_count bump run in one round-trip /
        // implicit transaction. The UPDATE fires ONLY when the INSERT actually added a row (replay-safe),
        // closing the mid-call-crash window where a committed INSERT could leave usage_count un-bumped.
        const res = await db.drizzle.execute(sql`
            WITH ins AS (
                INSERT INTO discount_usage_history
                    (tenant_id, discount_id, order_id, amount_applied, customer_email, discount_code, used_at, created_at, updated_at)
                VALUES (
                    ${Number(args.tenantId)},
                    ${Number(args.discountId)},
                    ${Number(args.orderId)},
                    ${args.amountApplied},
                    ${args.customerEmail ?? null},
                    ${args.discountCode ?? null},
                    NOW(), NOW(), NOW()
                )
                ON CONFLICT (order_id) DO NOTHING
                RETURNING id
            ), bump AS (
                UPDATE discounts SET usage_count = usage_count + 1
                WHERE id = ${Number(args.discountId)} AND EXISTS (SELECT 1 FROM ins)
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

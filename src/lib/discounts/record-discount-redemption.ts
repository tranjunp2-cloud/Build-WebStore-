import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

/** Outcome of a reserve attempt. `recorded` stays for back-compat (true = slot is held by this order). */
export type ReserveStatus = 'reserved' | 'already-reserved' | 'at-limit' | 'no-discount' | 'error'
export interface ReserveResult {
    recorded: boolean
    status: ReserveStatus
}

/**
 * Reserve a discount usage slot for an order — the single writer of discount usage (F33 race fix #10/#11).
 *
 * RESERVE-AT-PLACE-ORDER (gateway-agnostic): the slot is taken the moment an order is placed — for COD,
 * bank-transfer AND Stripe alike — exactly like inventory. It is returned only on a terminal non-sale
 * (buyer cancel, seller cancel, refund, 24h payment-expiry) via {@link releaseDiscountRedemption}. This
 * closes the oversell window (#11) where Stripe previously redeemed only after payment success, and lets
 * the caller HARD-BLOCK a buyer whose code just sold out instead of silently charging full price (#10).
 *
 * ATOMIC GATE (UPDATE-first): the row-lock-serialized `UPDATE discounts ... WHERE usage_count < usage_limit`
 * is the authority — Postgres re-evaluates the WHERE against the latest committed `usage_count` after
 * acquiring the row lock, so two concurrent place-orders for DISTINCT orders on a 1-slot code can NEVER
 * both bump (capacity is serialized). The history INSERT fires ONLY when the bump fired, so an at-limit
 * attempt leaves NO history row (no phantom reserve).
 *   - `reserved`        — slot taken now (count bumped, history inserted).
 *   - `already-reserved`— this order already holds a slot (prior history row); idempotent no-op. Safe under
 *                         SEQUENTIAL retries (webhook re-delivery, confirm-poll, cron, double submit).
 *
 * CALLER CONTRACT (idempotency scope): the `prior` existence check reads the statement's MVCC snapshot, so
 * it does NOT serialize two CONCURRENT calls for the SAME `order_id` — both could observe empty `prior` and
 * both bump while only one history row lands. Capacity across distinct orders is still safe (above); only the
 * per-order idempotency guarantee is sequential-only. Every caller today reserves each `order_id` exactly
 * once, synchronously (checkout / stripe-checkout / free-order); `reconcileOrderPaid` is gated upstream by a
 * single-winner `status='pending'` CAS. Do NOT invoke this concurrently for one `order_id`. A truly
 * concurrent-safe rewrite (claim the unique `order_id` via INSERT-first, then bump only if the insert won)
 * is tracked as an F33 follow-up.
 *   - `at-limit`        — code sold out; nothing written. Caller MUST block + notify the buyer.
 *   - `no-discount`     — nothing to reserve (no discount / non-positive amount).
 *   - `error`          — unexpected DB error; caller should fail safe (do not let the order through silently).
 *
 * Idempotency key is the unique `discount_usage_history.order_id`. `usage_count` invariant holds:
 * `0 <= usage_count <= usage_limit`, and never exceeds COUNT(history) for the discount.
 *
 * Snapshots `discount_code` + `discount_type` + `discount_value` so the audit report keeps full fidelity
 * even after the discount row is hard-deleted (FK `ON DELETE SET NULL`).
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
): Promise<ReserveResult> {
    if (!(args.discountId && args.orderId && args.amountApplied > 0)) {
        return { recorded: false, status: 'no-discount' }
    }

    try {
        const db = payload.db as {
            drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ prior_count: number; bumped: number }> }> }
        }

        // Single atomic statement. `prior` snapshots whether this order already reserved (idempotency).
        // `bump` is the gate: it fires ONLY when capacity remains AND the order has no prior reservation —
        // the row-lock serializes capacity across DISTINCT orders (two can't both exceed the limit). Per-order
        // idempotency is sequential-only: `prior` reads the MVCC snapshot, so the caller MUST not reserve the
        // same order_id concurrently (see JSDoc CALLER CONTRACT). `ins` records history ONLY when the bump
        // fired, so an at-limit attempt writes nothing (no phantom slot to leak).
        const res = await db.drizzle.execute(sql`
            WITH prior AS (
                SELECT 1 FROM discount_usage_history WHERE order_id = ${Number(args.orderId)}
            ), bump AS (
                UPDATE discounts SET usage_count = usage_count + 1
                WHERE id = ${Number(args.discountId)}
                  AND (usage_limit IS NULL OR usage_count < usage_limit)
                  AND NOT EXISTS (SELECT 1 FROM prior)
                RETURNING id
            ), ins AS (
                INSERT INTO discount_usage_history
                    (tenant_id, discount_id, order_id, amount_applied, customer_email, discount_code, discount_type, discount_value, used_at, created_at, updated_at)
                SELECT
                    ${Number(args.tenantId)},
                    ${Number(args.discountId)},
                    ${Number(args.orderId)},
                    ${args.amountApplied},
                    ${args.customerEmail ?? null},
                    ${args.discountCode ?? null},
                    ${args.discountType ?? null},
                    ${args.discountValue ?? null},
                    NOW(), NOW(), NOW()
                WHERE EXISTS (SELECT 1 FROM bump)
                ON CONFLICT (order_id) DO NOTHING
                RETURNING id
            )
            SELECT
                (SELECT count(*) FROM prior)::int  AS prior_count,
                (SELECT count(*) FROM bump)::int   AS bumped
        `)

        const row = res.rows?.[0]
        if ((row?.prior_count ?? 0) > 0) return { recorded: true, status: 'already-reserved' }
        if ((row?.bumped ?? 0) > 0) return { recorded: true, status: 'reserved' }
        return { recorded: false, status: 'at-limit' }
    } catch (err) {
        console.error('[discount] recordDiscountRedemption (reserve) failed', err)
        return { recorded: false, status: 'error' }
    }
}

import type { CollectionBeforeDeleteHook } from 'payload'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'

/**
 * Releases the order's reserved discount slot BEFORE the order row is deleted (F33).
 *
 * The slot is reserved at place-order and keyed by `discount_usage_history.order_id`
 * (FK `ON DELETE SET NULL`) — deleting an order without releasing first orphans the history row
 * (`order_id = NULL`) while `discounts.usage_count` stays bumped, leaking that slot forever
 * (release is keyed by order_id, so an orphaned row can never be released).
 *
 * The API compensation paths (checkout/stripe-checkout failure rollbacks) already release explicitly
 * before their own `payload.delete` — this hook makes that release run twice there, which is safe:
 * the second DELETE removes no row, so nothing double-decrements. What this hook actually covers is
 * every OTHER delete: Payload admin single/bulk delete and any future programmatic delete.
 *
 * Idempotent + non-throwing (the helper logs and swallows failures) — an order with no discount is a
 * no-op, and a release failure must never block the delete itself.
 */
export const releaseDiscountOnDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
    await releaseDiscountRedemption(req.payload, Number(id))
}

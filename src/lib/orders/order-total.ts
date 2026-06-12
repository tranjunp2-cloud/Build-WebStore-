/**
 * Single source of truth for the checkout order total (F33).
 *
 * Formula after the phase-06 SST removal: `total = (subtotal − discount) + shipping`. There is no
 * tax term anymore. All money is handled in **sen** (integer) so the result carries no float
 * artifacts; `total` is the RM-float the order row stores.
 *
 * Shared by every gateway (COD / QR-banking / Stripe) so they all charge an identical amount —
 * gateway parity is guaranteed by construction, not by three copies of the same arithmetic.
 *
 * No clamp on the total: `applyDiscount` already clamps `discountSen ≤ subtotalSen` upstream, so a
 * positive cart can never go negative. The total is deliberately allowed to reach ≤ 0 so the Stripe
 * route's free-order branch (skip the gateway when nothing is owed) still triggers.
 */

/**
 * Subtotal after discount, clamped at ≥ 0 — the value the free-ship gate compares against.
 * Shipping is resolved on the POST-discount subtotal (phase-07): callers compute this first, feed it
 * to the shipping rate, then call `computeOrderTotal` with the resolved shipping fee. Clamped because
 * a negative number must never read as "above the free-ship threshold".
 */
export function effectiveSubtotalSen(subtotalSen: number, discountSen: number): number {
    return Math.max(0, subtotalSen - discountSen)
}

export interface OrderTotalInput {
    /** Cart subtotal in sen. */
    subtotalSen: number
    /** Discount applied in sen (0 when none / silently rejected; pre-clamped to ≤ subtotal by applyDiscount). */
    discountSen: number
    /** Shipping fee in sen — already resolved (zone rate or free-ship) by the caller. */
    shippingFeeSen: number
}

export interface OrderTotalResult {
    /** Grand total in sen. */
    totalSen: number
    /** Grand total in RM (2dp), what the order row stores. */
    total: number
}

export function computeOrderTotal({ subtotalSen, discountSen, shippingFeeSen }: OrderTotalInput): OrderTotalResult {
    const totalSen = subtotalSen - discountSen + shippingFeeSen
    return { totalSen, total: totalSen / 100 }
}

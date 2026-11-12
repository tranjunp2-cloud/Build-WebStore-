/**
 * Temporary kill switch for Xendit (GH-2132).
 * false = hidden in dashboard settings + storefront checkout, and new Xendit checkouts are rejected.
 * Existing Xendit orders (retry, webhook, reconcile, cancel, refund) are NOT affected.
 * Restore by flipping to true.
 */
export const XENDIT_ENABLED = false

import type { CollectionBeforeChangeHook } from 'payload'

/**
 * updatePaymentStatus — Orders beforeChange hook.
 *
 * Encapsulates the auto-mutation of `paymentStatus` based on order state:
 * - COD orders flipped to `completed` → paymentStatus = `paid`
 * - Any order transitioned to `cancelled` while still `unpaid` → paymentStatus = `cancelled`
 *
 * Extracted from inline anonymous hook in Orders.ts so unit tests can import
 * the named function directly instead of relying on `hooks.beforeChange[n]`
 * array indices (which shift when other hooks like `autoLinkCustomer` are
 * prepended).
 */
export const updatePaymentStatus: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
    // COD: seller marks completed → auto paymentStatus=paid
    if (
        data.status === 'completed' &&
        originalDoc?.status !== 'completed' &&
        originalDoc?.paymentMethod === 'cod'
    ) {
        data.paymentStatus = 'paid'
    }
    // Any method cancelled → paymentStatus=cancelled (if still unpaid)
    if (data.status === 'cancelled' && originalDoc?.status !== 'cancelled') {
        if (!data.paymentStatus || data.paymentStatus === 'unpaid') {
            data.paymentStatus = 'cancelled'
        }
    }
    return data
}

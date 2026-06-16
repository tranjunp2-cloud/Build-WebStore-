/**
 * Shared discount error messaging.
 *
 * `DISCOUNT_EXHAUSTED` is returned (HTTP 409) when a buyer tries to place an order with a code whose last
 * slot was just taken by a concurrent buyer (#10). The storefront should localise off the error CODE; this
 * English string is the API-level fallback. The storefront must NOT proceed to charge — it should surface
 * this, drop the discount from the cart, and let the buyer review the (full-price) total before retrying.
 */
export const DISCOUNT_EXHAUSTED_CODE = 'DISCOUNT_EXHAUSTED' as const

export const DISCOUNT_EXHAUSTED_MESSAGE =
    'This discount code has reached its usage limit. Please review your order total before continuing to payment.'

/**
 * Map a non-`recorded` reserve outcome to a checkout error response. `at-limit` (sold out) is a 409 the
 * storefront localises to drop the discount; a transient `error` (DB blip) is a 503 retry — NOT labelled
 * "exhausted", so a pool hiccup never misleads the buyer into thinking the code ran out.
 */
export function discountReserveErrorResponse(
    status: 'at-limit' | 'error' | string,
): { httpStatus: number; code: string; message: string } {
    if (status === 'error') {
        return {
            httpStatus: 503,
            code: 'DISCOUNT_RESERVE_FAILED',
            message: 'Could not verify the discount right now. Please try again.',
        }
    }
    return { httpStatus: 409, code: DISCOUNT_EXHAUSTED_CODE, message: DISCOUNT_EXHAUSTED_MESSAGE }
}

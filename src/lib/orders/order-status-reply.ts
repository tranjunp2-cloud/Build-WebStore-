/**
 * What an order write route answers with: the new state only. Those routes re-read the order with access off (for
 * emails / race checks); returned whole, the read handed staff the tenant's payment / courier secrets, the order's
 * magicLinkSecret and the verifier's otpHash / keyString (TC-PERF-135). The dashboard refetches the order after.
 */
export function orderStatusReply(order: unknown): { id: unknown; status: unknown; paymentStatus: unknown } {
    const o = (order ?? {}) as { id?: unknown; status?: unknown; paymentStatus?: unknown }
    return { id: o.id, status: o.status, paymentStatus: o.paymentStatus }
}

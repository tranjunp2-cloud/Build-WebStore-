import { EAST_MY_STATES } from './constants'

type OrderForCodCheck = {
    codAmount?: number | null
    shippingAddress?: { state?: string | null } | null
}

/**
 * Returns true when COD is not available for this order.
 * COD is blocked for East Malaysia states (Sabah, Sarawak, Labuan)
 * when a COD amount is set (codAmount > 0).
 *
 * Pure function — framework-agnostic, safe to import in both server and client code.
 */
export function isCodBlocked(order: OrderForCodCheck): boolean {
    if (!order.codAmount || order.codAmount <= 0) return false
    const state = order.shippingAddress?.state
    if (!state) return false
    return (EAST_MY_STATES as readonly string[]).includes(state)
}

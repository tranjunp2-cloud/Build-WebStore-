import { sql } from 'drizzle-orm'

/**
 * Single definition of the per-customer order metrics (#2086), shared by the customer detail,
 * the list sort, the CSV export and the ECH Agent:
 *   - Total orders   : every order, any status
 *   - Total spending : paid OR completed orders, never cancelled/refunded
 *   - Failed         : cancelled + payment_failed
 */
export const NON_SPENDING_STATUSES = ['cancelled', 'refunded'] as const
export const FAILED_STATUSES = ['cancelled', 'payment_failed'] as const

type OrderLike = { status?: unknown; paymentStatus?: unknown }

export function countsTowardSpending(order: OrderLike): boolean {
    if (typeof order.status === 'string' && (NON_SPENDING_STATUSES as readonly string[]).includes(order.status)) return false
    return order.paymentStatus === 'paid' || order.status === 'completed'
}

export function isFailedOrder(order: OrderLike): boolean {
    return typeof order.status === 'string' && (FAILED_STATUSES as readonly string[]).includes(order.status)
}

/** SQL twin of countsTowardSpending for aggregates over `orders o`. */
export const SPENDING_SQL_COND = sql`(o.status NOT IN ('cancelled', 'refunded') AND (o.payment_status = 'paid' OR o.status = 'completed'))`

/** SUM of spending orders; 0 when none. */
export const LIFETIME_SQL = sql`COALESCE(SUM(CASE WHEN ${SPENDING_SQL_COND} THEN o.total END), 0)::numeric`

/** COUNT of cancelled + payment_failed orders. */
export const FAILED_COUNT_SQL = sql`COUNT(CASE WHEN o.status IN ('cancelled', 'payment_failed') THEN 1 END)::int`

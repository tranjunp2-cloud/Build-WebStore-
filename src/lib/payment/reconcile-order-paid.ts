import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { getStripeClient } from '@/lib/payment/stripe-client'
import { sendOrderPaidEmailsAndNotify, type PaidOrderDoc } from './reconcile-order-paid-emails'

export interface ReconcileContext {
    orderId: number
    /** Full Stripe checkout.session object (must include payment_method_types + payment_intent). */
    session: Record<string, any>
    connectedAccountId: string
    source: 'webhook' | 'poll' | 'cron'
}

export type ReconcileStatus = 'reconciled' | 'already_processed' | 'not_found'

export interface ReconcileResult {
    status: ReconcileStatus
    oversell?: boolean
}

/**
 * Single source of truth for transitioning a pending order to paid. Called by the Stripe webhook,
 * the active-reconcile endpoint (confirm polling), and the reconcile cron.
 *
 * Idempotency: the atomic `UPDATE ... WHERE status='pending' RETURNING id` is the single-winner
 * guard. If 0 rows → already processed → returns immediately WITHOUT decrementing stock, emailing,
 * or notifying. Safe for webhook + poll + cron all firing on the same order.
 *
 * IMPORTANT: the caller is responsible for ownership/auth verification (webhook IDOR guard, endpoint
 * confirm-token, cron secret) BEFORE calling. This function trusts the context is already authorized.
 */
export async function reconcileOrderPaid(payload: Payload, ctx: ReconcileContext): Promise<ReconcileResult> {
    const { orderId, session, connectedAccountId, source } = ctx

    // Atomic single-winner transition.
    const transition = await payload.db.drizzle.execute(sql`
        UPDATE orders SET status = 'new', payment_status = 'paid'
        WHERE id = ${orderId} AND status = 'pending'
        RETURNING id
    `)
    if (!transition.rows?.length) {
        console.log(`[Reconcile:${source}] Order ${orderId} already transitioned — skipping`)
        return { status: 'already_processed' }
    }

    const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 1 })
        .catch(() => null) as unknown as PaidOrderDoc | null
    if (!order) {
        console.warn(`[Reconcile:${source}] Order ${orderId} not found after transition — unexpected`)
        return { status: 'not_found' }
    }
    console.log(`[Reconcile:${source}] Order ${orderId} marked as new/paid`)

    // Money-critical work FIRST — runs immediately after the commit with no network I/O in between,
    // so a later failure (e.g. the Stripe round-trip below timing out) cannot leave the order paid
    // with stock un-decremented. Decrement per item; flag for manual seller refund if any oversold.
    let oversell = false
    if (order.items) {
        for (const item of order.items) {
            const productId = typeof item.product === 'object' ? item.product.id : item.product
            const sold = await decrementStock(payload, productId, item.quantity)
            if (sold.oversold) oversell = true
        }
    }

    // AC-3: oversell AFTER capture → flag for manual seller refund (NO auto-refund, order stays paid).
    if (oversell) {
        await flagOversell(payload, order)
    }

    // Buyer/seller emails + notify (paymentMethod hardcoded 'stripe' — does not need card details).
    // Guarded: this helper does an unguarded user lookup that can throw, so isolate it — emails are
    // non-critical and must never abort the reconcile after stock is already decremented.
    try {
        await sendOrderPaidEmailsAndNotify(payload, order)
    } catch (err) {
        console.error(`[Reconcile:${source}] Order ${orderId} emails/notify failed (non-critical):`, err)
    }

    // Display-only metadata LAST: the Stripe round-trip is the slow/failure-prone step, so it runs
    // after all money-critical work is durably committed. A failure here only loses cosmetic card
    // details (stripeSessionId is already persisted at order creation); the order stays correctly paid.
    try {
        const { method: paymentMethod, cardBrand, cardLast4 } = await resolveActualPaymentMethod(session, connectedAccountId)
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                stripeSessionId: session.id,
                stripePaymentIntentId: typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : (session.payment_intent as { id?: string } | null)?.id ?? undefined,
                paymentMethod,
                ...(cardBrand ? { cardBrand } : {}),
                ...(cardLast4 ? { cardLast4 } : {}),
            },
        })
    } catch (err) {
        console.error(`[Reconcile:${source}] Failed to persist Stripe display metadata for order ${orderId} (non-critical):`, err)
    }

    return { status: 'reconciled', oversell }
}

/**
 * AC-3: mark the (already paid) order for manual seller review and alert the seller.
 * No auto-refund — the seller decides amount + method via the admin "Refund customer" button.
 */
async function flagOversell(payload: Payload, order: PaidOrderDoc): Promise<void> {
    try {
        await payload.update({
            collection: 'orders',
            id: order.id,
            data: { oversellReview: true } as Record<string, unknown>,
        })
    } catch (err) {
        console.error(`[Reconcile] Failed to set oversellReview for order ${order.id}:`, err)
    }
    const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    import('@/lib/notifications/notify-tenant-owners')
        .then(({ notifyTenantOwners }) => notifyTenantOwners(payload, tenantId, {
            type: 'SYSTEM_ALERT',
            title: `Order #${order.orderNumber} flagged for review — stock went negative`,
            message: `Order #${order.orderNumber} was paid but stock ran out. Review and decide on a manual refund.`,
            actionUrl: '/orders',
            metadata: { orderNumber: order.orderNumber, oversell: 'true' },
        }))
        .catch((err) => console.error('[Notification] oversell SYSTEM_ALERT failed', err))
}

/**
 * Atomically decrement product inventory — safe for concurrent deliveries.
 * Returns oversold=true when the requested quantity exceeded available stock, so the caller can
 * flag the order for manual seller review. Products with NULL inventory (untracked/unlimited)
 * never oversell.
 *
 * Two atomic statements:
 *  1. Decrement only if enough stock (`inventory >= qty`). If a row comes back → clean sale.
 *  2. Otherwise (stock < qty, tracked) → clamp to 0 and report oversell.
 */
export async function decrementStock(
    payload: Payload,
    productId: number | string,
    quantity: number,
): Promise<{ oversold: boolean }> {
    try {
        const clean = await (payload.db.drizzle as any).execute(sql`
            UPDATE products SET inventory = inventory - ${quantity}
            WHERE id = ${productId} AND inventory IS NOT NULL AND inventory >= ${quantity}
            RETURNING inventory
        `)
        if (clean.rows?.length) {
            console.log(`[Reconcile] Stock decremented: product ${productId} -${quantity}`)
            return { oversold: false }
        }

        // No clean decrement: either untracked (inventory NULL → skip) or oversell (tracked, < qty).
        const clamped = await (payload.db.drizzle as any).execute(sql`
            UPDATE products SET inventory = 0
            WHERE id = ${productId} AND inventory IS NOT NULL AND inventory < ${quantity}
            RETURNING inventory
        `)
        const oversold = (clamped.rows?.length ?? 0) > 0
        if (oversold) console.warn(`[Reconcile] OVERSELL: product ${productId} requested ${quantity}, clamped to 0`)
        return { oversold }
    } catch (err) {
        console.error(`[Reconcile] Failed to update stock for product ${productId}:`, err)
        return { oversold: false }
    }
}

export interface ResolvedPaymentMethod {
    method: 'card' | 'fpx'
    cardBrand?: string
    cardLast4?: string
}

/** Resolve the actual payment method + card details by expanding payment_intent.payment_method.
 *  Falls back to 'card' (no card details) if expansion fails or the intent is unavailable. */
export async function resolveActualPaymentMethod(
    session: Record<string, any>,
    connectedAccountId?: string,
): Promise<ResolvedPaymentMethod> {
    const enabledTypes: string[] = session.payment_method_types ?? []

    // Single-method FPX is unambiguous — no need to expand the intent, and there are no card details.
    if (enabledTypes.length === 1 && enabledTypes[0] === 'fpx') return { method: 'fpx' }

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id

    // No intent to expand → method is card (the only remaining single type / multi default); no details.
    if (!paymentIntentId) return { method: 'card' }

    try {
        const stripe = getStripeClient()
        const pi = await stripe.paymentIntents.retrieve(
            paymentIntentId,
            { expand: ['payment_method'] },
            connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
        )
        const pm = pi.payment_method as { type?: string; card?: { brand?: string; last4?: string } } | null
        if (pm?.type === 'fpx') return { method: 'fpx' }
        return { method: 'card', cardBrand: pm?.card?.brand ?? undefined, cardLast4: pm?.card?.last4 ?? undefined }
    } catch (err) {
        console.warn('[Reconcile] Could not expand payment_intent for method detection, defaulting to card:', err)
        return { method: 'card' }
    }
}

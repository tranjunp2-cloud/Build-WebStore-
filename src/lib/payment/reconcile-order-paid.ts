import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { getStripeClient } from '@/lib/payment/stripe-client'
import { sendOrderPaidEmailsAndNotify, type PaidOrderDoc } from './reconcile-order-paid-emails'
import { mapChannelToPaymentMethod } from '@/lib/payment/xendit'

export interface ReconcileContext {
    orderId: number
    /** Full Stripe checkout.session (Stripe only). Optional for non-Stripe providers. */
    session?: Record<string, any>
    /** Stripe Connect account id (Stripe only). Optional for non-Stripe providers. */
    connectedAccountId?: string
    /** Xendit payment metadata — optional, Xendit provider only */
    xenditData?: { paymentRequestId: string; channelCode: string }
    source: 'webhook' | 'poll' | 'cron'
}

export type ReconcileStatus = 'reconciled' | 'already_processed' | 'not_found'

export interface ReconcileResult {
    status: ReconcileStatus
}

/**
 * Single source of truth for transitioning a pending order to paid. Called by the Stripe webhook,
 * the active-reconcile endpoint (confirm polling), and the reconcile cron.
 *
 * Idempotency: the atomic `UPDATE ... WHERE status='pending' RETURNING id` is the single-winner
 * guard. If 0 rows → already processed → returns immediately WITHOUT decrementing stock, emailing,
 * or notifying. Safe for webhook + poll + cron all firing on the same order.
 *
 * STOCK NOTE: this function intentionally does NOT decrement stock. Stock is decremented at
 * Stripe session creation (stripe-checkout/route.ts). This function only transitions the order.
 *
 * DEPLOY GATE (migration, same class as cancel/route.ts BT note):
 * Pre-deploy Stripe orders (status='pending') had stock decremented here by the old reconcileOrderPaid
 * code. After deploy, reconcile no longer decrements — so paying an old pending Stripe order via
 * webhook/cron does NOT decrement stock (undersell risk). Similarly, cancelling an old pending Stripe
 * order will phantom-restock (shouldRestock=true in cancel route, but stock was decremented at webhook
 * not checkout). Drain all pending Stripe orders before deploying to production.
 *
 * IMPORTANT: the caller is responsible for ownership/auth verification (webhook IDOR guard, endpoint
 * confirm-token, cron secret) BEFORE calling. This function trusts the context is already authorized.
 */
export async function reconcileOrderPaid(payload: Payload, ctx: ReconcileContext): Promise<ReconcileResult> {
    const { orderId, session, connectedAccountId, xenditData, source } = ctx

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
    if (session) {
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
    }

    if (xenditData) {
        try {
            await payload.update({
                collection: 'orders',
                id: orderId,
                data: {
                    xenditPaymentRequestId: xenditData.paymentRequestId || undefined,
                    xenditChannelCode: xenditData.channelCode || undefined,
                    paymentProvider: 'xendit',
                    paymentMethod: mapChannelToPaymentMethod(xenditData.channelCode),
                } as Record<string, unknown>,
            })
        } catch (err) {
            console.error(`[Reconcile:${source}] Failed to persist Xendit metadata for order ${orderId} (non-critical):`, err)
        }
    }

    return { status: 'reconciled' }
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

import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { getStripeClient } from '@/lib/payment/stripe-client'
import { recordDiscountRedemption } from '@/lib/discounts/record-discount-redemption'
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
        // For webhook source: even when already reconciled, update xenditChannelCode if more specific
        // and send email (poll skips email, so webhook is the correct email sender for Xendit).
        if (source === 'webhook' && xenditData?.channelCode) {
            try {
                await payload.update({
                    collection: 'orders',
                    id: orderId,
                    data: {
                        xenditChannelCode: xenditData.channelCode,
                        paymentMethod: mapChannelToPaymentMethod(xenditData.channelCode),
                    } as Record<string, unknown>,
                })
                const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 1 })
                    .catch(() => null) as unknown as PaidOrderDoc | null
                if (order) {
                    // Inject channelCode directly so email reflects it even if DB read is stale
                    ;(order as any).xenditChannelCode = xenditData.channelCode
                    await sendOrderPaidEmailsAndNotify(payload, order).catch(err =>
                        console.error(`[Reconcile:webhook] Order ${orderId} email after channel update failed:`, err)
                    )
                }
            } catch (err) {
                console.error(`[Reconcile:webhook] Order ${orderId} channel update failed (non-critical):`, err)
            }
        }
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

    // Discount LEGACY BACKSTOP (F33 migration). As of the race fix (#10/#11) the slot is reserved at
    // PLACE ORDER (stripe-checkout/route.ts), so for new-flow orders this call is an idempotent no-op —
    // the unique order_id history row makes it return 'already-reserved' without touching usage_count.
    // It exists for orders placed BEFORE the reserve-at-place-order deploy (old flow redeemed here):
    // without it, a pre-deploy pending order that pays post-deploy would never hit usage_count or the
    // audit history. Runs only inside the single-winner block above. 'at-limit' is logged, not blocked —
    // payment already succeeded, matching the old cap semantics (count stops at the cap, no future order
    // slips through). Release still happens only on a terminal non-sale (cancel / refund / 24h expiry).
    const dRaw = (order as any).discount
    if (dRaw && Number((order as any).discountAmount) > 0) {
        const discId = typeof dRaw === 'object' ? dRaw.id : dRaw
        const tRaw = (order as any).tenant
        const tId = typeof tRaw === 'object' ? tRaw.id : tRaw
        const reserve = await recordDiscountRedemption(payload, {
            tenantId: Number(tId),
            discountId: Number(discId),
            orderId,
            amountApplied: Number((order as any).discountAmount),
            discountCode: (order as any).discountCode ?? null,
            discountType: typeof dRaw === 'object' ? (dRaw.type ?? null) : null,
            discountValue: typeof dRaw === 'object' && dRaw.value != null ? Number(dRaw.value) : null,
            customerEmail: (order as any).customerEmail ?? null,
        })
        if (reserve.status === 'at-limit') {
            console.warn(`[Reconcile:${source}] Order ${orderId} paid with a discount past its usage limit (legacy pre-reserve order) — not counted`)
        }
    }

    // Buyer/seller emails: skip for poll source — webhook will send with specific channel info.
    // Guarded: this helper does an unguarded user lookup that can throw, so isolate it — emails are
    // non-critical and must never abort the reconcile after the order is durably marked paid.
    if (source !== 'poll') {
        // For Xendit webhook: inject channelCode directly so email shows specific wallet before DB is updated
        if (xenditData?.channelCode) {
            ;(order as any).xenditChannelCode = xenditData.channelCode
        }
        try {
            await sendOrderPaidEmailsAndNotify(payload, order)
        } catch (err) {
            console.error(`[Reconcile:${source}] Order ${orderId} emails/notify failed (non-critical):`, err)
        }
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

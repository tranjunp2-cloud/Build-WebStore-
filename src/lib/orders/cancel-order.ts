import { sql } from 'drizzle-orm'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { getStripeClient } from '@/lib/payment/stripe'
import { createRefund } from '@/lib/payment/xendit'
import { restockItem, type RestockResult } from '@/app/api/orders/lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import { type ActionResult, respond } from './action-result'
import { sendCancelEmails } from './cancel-order-emails'

/**
 * Payment states in which nothing has been paid: the plain cancel moves them to 'cancelled' (see the CAS below).
 * 'pending_verification' is NOT here: the buyer uploaded a transfer proof and may have paid, so a cancelled order
 * keeps it (and its proof block) as a reminder that a manual refund may be owed.
 */
const UNPAID_PAYMENT_STATUSES = ['unpaid', 'awaiting_payment']

/**
 * Cancels an order with a required reason, as `user` (access-controlled read). The one implementation of
 * POST /api/orders/[id]/cancel and of the copilot: a paid Stripe / Xendit order is refunded first (the
 * order is cancelled in the same atomic step and put back if the refund fails), the stock is put back,
 * the discount slot released, the buyer emailed. Refuses when an EasyParcel label exists.
 */
export async function cancelOrderAs(user: User, id: string, reason: string): Promise<ActionResult> {
    const payload = await getPayload({ config })

    // Get current order
    const orderId = Number.isFinite(Number(id)) ? Number(id) : id
    const order = await payload.findByID({
        collection: 'orders',
        id: orderId,
        user,
        overrideAccess: false,
    })

    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 }
        )
    }

    // Sequential retry: already cancelled (first request completed before second arrived)
    if ((order.status as string) === 'cancelled') {
        return respond({ success: true, data: order, restock: [] })
    }

    // Validate that cancellation is allowed from current status
    const currentStatus = order.status as string
    const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || []
    if (!allowed.includes('cancelled')) {
        return respond(
            {
                success: false,
                error: {
                    code: 'INVALID_TRANSITION',
                    message: `Cannot cancel order in "${currentStatus}" status. Cancellation is only allowed for: ${Object.entries(ORDER_STATUS_TRANSITIONS)
                        .filter(([, v]) => v.includes('cancelled'))
                        .map(([k]) => k)
                        .join(', ')}`,
                },
            },
            { status: 422 }
        )
    }

    const db = (payload.db.drizzle as any)

    // --- Xendit paid orders: auto-refund atomically with cancel ---
    // Mirrors Stripe pattern in /refund: CAS-before-remote → call Xendit → rollback on failure.
    // This ensures cancel never succeeds without a corresponding refund for paid Xendit orders.
    let xenditRefundId: string | undefined
    let xenditCasDone = false
    let stripeRefundId: string | undefined
    let stripeCasDone = false
    if ((order as any).paymentProvider === 'xendit' && (order as any).paymentStatus === 'paid') {
        const tenantRawId = typeof (order as any).tenant === 'object'
            ? (order as any).tenant.id
            : (order as any).tenant
        const tenantWithKeys = await payload.findByID({
            collection: 'tenants', id: tenantRawId, depth: 0, overrideAccess: true,
        }).catch(() => null)
        const xenditSecretKey: string | undefined = (tenantWithKeys as any)?.xenditSecretKey
        const xenditPaymentRequestId = (order as any).xenditPaymentRequestId

        if (!xenditSecretKey || !xenditPaymentRequestId) {
            return respond(
                { success: false, error: { code: 'XENDIT_NOT_REFUNDABLE', message: 'Missing Xendit payment info — cancel blocked to protect buyer funds. Refund manually via Xendit dashboard first.' } },
                { status: 422 }
            )
        }

        // CAS: commit cancel + payment_status='refunded' atomically.
        // AND payment_status='paid' guard prevents double-refund under concurrent requests.
        // AND easy_parcel_order_no IS NULL (review #1582 round 2): a create-label claim or a
        // created EP shipment means wallet money is (about to be) committed — cancelling mid
        // claim→submit window would refund the buyer, then the label flow flips the order
        // back to ready_to_ship, resurrecting a refunded order. Cancel only label-free rows.
        const xenditCas = await db.execute(sql`
            UPDATE orders
            SET status = 'cancelled', cancel_reason = ${reason}, payment_status = 'refunded', updated_at = NOW()
            WHERE id = ${orderId} AND status = ${currentStatus} AND payment_status = 'paid'
              AND easy_parcel_order_no IS NULL
            RETURNING id
        `)

        if (!xenditCas.rows?.length) {
            const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
            if ((recheck as any)?.status === 'cancelled') {
                return respond({ success: true, data: recheck, restock: [] })
            }
            if ((recheck as any)?.easyParcelOrderNo) {
                // CAS missed on the label guard, not a status change. CLAIM: = a
                // create-label request in flight (transient — retry); a real shipment
                // number = wallet money committed (cancel the EP shipment first).
                const inFlight = String((recheck as any).easyParcelOrderNo).startsWith('CLAIM:')
                return respond(
                    {
                        success: false,
                        error: inFlight
                            ? { code: 'LABEL_IN_PROGRESS', message: 'Label creation is in progress for this order — retry in a moment' }
                            : { code: 'LABEL_EXISTS', message: 'A shipping label exists for this order — cancel the EasyParcel shipment first' },
                    },
                    { status: 409 }
                )
            }
            return respond(
                { success: false, error: { code: 'INVALID_TRANSITION', message: 'Order status changed — cancellation no longer valid' } },
                { status: 422 }
            )
        }

        xenditCasDone = true

        // CAS committed — now call Xendit. If it fails, roll back so order is unchanged.
        try {
            const xenditRefund = await createRefund({
                apiKey: xenditSecretKey,
                invoiceId: xenditPaymentRequestId,
                amount: (order as any).total,
                reason: 'REQUESTED_BY_CUSTOMER',
                // Idempotency key scoped to this order — Xendit returns cached result
                // for duplicate requests within 24h, preventing double-refund on retry.
                idempotencyKey: `cancel-${orderId}`,
            })
            xenditRefundId = xenditRefund.id
        } catch (xenditErr) {
            // Roll back CAS: restore original status + payment_status so order is unchanged.
            await db.execute(sql`
                UPDATE orders
                SET status = ${currentStatus}, payment_status = 'paid', updated_at = NOW()
                WHERE id = ${orderId}
            `).catch((rollbackErr: unknown) => {
                payload.logger.error(
                    { rollbackErr: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr), orderId },
                    '[Order Cancel] Xendit CAS rollback failed — DB state may be inconsistent'
                )
            })
            payload.logger.error(
                { err: xenditErr instanceof Error ? xenditErr.message : String(xenditErr), orderId },
                '[Order Cancel] Xendit refund failed — cancel aborted, CAS rolled back'
            )
            return respond(
                { success: false, error: { code: 'XENDIT_REFUND_ERROR', message: 'Refund could not be processed — cancellation aborted. Please try again or refund via Xendit dashboard.' } },
                { status: 502 }
            )
        }
    }

    // --- Stripe paid orders: auto-refund atomically with cancel ---
    // Mirrors the Xendit block above: CAS-before-remote → call Stripe → rollback on failure.
    // Detection: paid + not manual (BT/COD/free/qr_banking/bank) + not Xendit → implicit Stripe
    // (paymentProvider is never set for Stripe orders).
    if (
        !xenditCasDone &&
        (order as any).paymentStatus === 'paid' &&
        !['bank_transfer', 'cod', 'free', 'qr_banking', 'bank'].includes((order as any).paymentMethod ?? '') &&
        (order as any).paymentProvider !== 'xendit'
    ) {
        const tenantRawId = typeof (order as any).tenant === 'object'
            ? (order as any).tenant.id
            : (order as any).tenant
        const tenantWithKeys = await payload.findByID({
            collection: 'tenants', id: tenantRawId, depth: 0, overrideAccess: true,
        }).catch((err: unknown) => {
            payload.logger.error(
                { err: err instanceof Error ? err.message : String(err), tenantRawId, orderId },
                '[Order Cancel] Failed to fetch tenant for Stripe refund check'
            )
            return null
        })
        const stripeAccountId: string | undefined = (tenantWithKeys as any)?.stripeAccountId

        if (!stripeAccountId) {
            return respond(
                { success: false, error: { code: 'STRIPE_NOT_REFUNDABLE', message: 'Stripe account not configured — cancel blocked to protect buyer funds. Refund manually via Stripe dashboard first.' } },
                { status: 422 }
            )
        }

        let stripePaymentIntentId: string | undefined = (order as any).stripePaymentIntentId

        // Hoist client — reused for both session fallback and refund below.
        const stripe = getStripeClient()

        // If payment intent not cached (webhook may not have fired yet), fetch from Stripe session.
        if (!stripePaymentIntentId && (order as any).stripeSessionId) {
            try {
                const session = await stripe.checkout.sessions.retrieve(
                    (order as any).stripeSessionId,
                    { expand: ['payment_intent'] },
                    { stripeAccount: stripeAccountId },
                )
                const pi = session.payment_intent
                stripePaymentIntentId = typeof pi === 'string' ? pi : (pi as any)?.id
                if (stripePaymentIntentId) {
                    await payload.update({
                        collection: 'orders',
                        id: orderId,
                        data: { stripePaymentIntentId } as any,
                    }).catch(() => null)
                }
            } catch (err: any) {
                payload.logger.error({ err: err.message, orderId }, '[Order Cancel] Failed to retrieve Stripe session')
            }
        }

        if (!stripePaymentIntentId) {
            return respond(
                { success: false, error: { code: 'STRIPE_NOT_REFUNDABLE', message: 'Missing Stripe payment intent — cancel blocked to protect buyer funds. Refund manually via Stripe dashboard first.' } },
                { status: 422 }
            )
        }

        // CAS: commit cancel + payment_status='refunded' atomically before calling Stripe API.
        // AND payment_status='paid' guard prevents double-refund under concurrent requests.
        // AND easy_parcel_order_no IS NULL: see the Xendit CAS comment above (label race).
        const stripeCas = await db.execute(sql`
            UPDATE orders
            SET status = 'cancelled', cancel_reason = ${reason}, payment_status = 'refunded', updated_at = NOW()
            WHERE id = ${orderId} AND status = ${currentStatus} AND payment_status = 'paid'
              AND easy_parcel_order_no IS NULL
            RETURNING id
        `)

        if (!stripeCas.rows?.length) {
            const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
            if ((recheck as any)?.status === 'cancelled') {
                return respond({ success: true, data: recheck, restock: [] })
            }
            if ((recheck as any)?.easyParcelOrderNo) {
                // CAS missed on the label guard, not a status change. CLAIM: = a
                // create-label request in flight (transient — retry); a real shipment
                // number = wallet money committed (cancel the EP shipment first).
                const inFlight = String((recheck as any).easyParcelOrderNo).startsWith('CLAIM:')
                return respond(
                    {
                        success: false,
                        error: inFlight
                            ? { code: 'LABEL_IN_PROGRESS', message: 'Label creation is in progress for this order — retry in a moment' }
                            : { code: 'LABEL_EXISTS', message: 'A shipping label exists for this order — cancel the EasyParcel shipment first' },
                    },
                    { status: 409 }
                )
            }
            return respond(
                { success: false, error: { code: 'INVALID_TRANSITION', message: 'Order status changed — cancellation no longer valid' } },
                { status: 422 }
            )
        }

        stripeCasDone = true

        // CAS committed — now call Stripe. If it fails, roll back so order is unchanged.
        try {
            const refund = await stripe.refunds.create(
                { payment_intent: stripePaymentIntentId },
                { stripeAccount: stripeAccountId, idempotencyKey: `cancel-${orderId}` },
            )
            stripeRefundId = refund.id
        } catch (stripeErr: any) {
            if (stripeErr?.code === 'charge_already_refunded') {
                // Refund already exists on Stripe — idempotent success. CAS stands, buyer gets money.
            } else {
                // Genuine Stripe failure — roll back CAS so order is unchanged.
                await db.execute(sql`
                    UPDATE orders
                    SET status = ${currentStatus}, cancel_reason = NULL, payment_status = 'paid', updated_at = NOW()
                    WHERE id = ${orderId}
                `).catch((rollbackErr: unknown) => {
                    payload.logger.error(
                        { rollbackErr: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr), orderId },
                        '[Order Cancel] Stripe CAS rollback failed — DB state may be inconsistent'
                    )
                })
                payload.logger.error(
                    { err: stripeErr instanceof Error ? stripeErr.message : String(stripeErr), orderId },
                    '[Order Cancel] Stripe refund failed — cancel aborted, CAS rolled back'
                )
                return respond(
                    { success: false, error: { code: 'STRIPE_REFUND_ERROR', message: 'Refund could not be processed — cancellation aborted. Please try again or refund via Stripe dashboard.' } },
                    { status: 502 }
                )
            }
        }
    }

    // Atomic status transition — prevents concurrent double-restock.
    // Two concurrent cancel requests both pass the validation above, but only the
    // one whose CAS succeeds (RETURNING non-empty) proceeds to restock.
    // The loser sees 0 rows → rechecks order → returns idempotent success without restocking.
    // Skip if Xendit or Stripe branch already ran its own CAS above.
    let casResult: { rows?: Array<Record<string, unknown>> } = { rows: [{}] }
    if (!xenditCasDone && !stripeCasDone) {
        // AND easy_parcel_order_no IS NULL: see the Xendit CAS comment above (label race).
        // payment_status: nothing was paid, so it follows the order to 'cancelled' (the intent of the Orders
        // update-payment-status hook, which this raw CAS bypasses). A paid order keeps 'paid' and a
        // 'pending_verification' one (proof uploaded) keeps its state: the merchant pays the buyer back by hand.
        // The bare 'cancelled' literal takes the column's type (enum on some DBs, varchar in db-setup.js).
        casResult = await db.execute(sql`
            UPDATE orders
            SET status = 'cancelled', cancel_reason = ${reason},
                payment_status = CASE WHEN payment_status IN ('unpaid', 'awaiting_payment') THEN 'cancelled' ELSE payment_status END,
                updated_at = NOW()
            WHERE id = ${orderId} AND status = ${currentStatus}
              AND easy_parcel_order_no IS NULL
            RETURNING id
        `)
    }

    if (!xenditCasDone && !stripeCasDone && !casResult.rows?.length) {
        // CAS missed — status changed between our validation read and this write.
        // Two sub-cases: already cancelled (concurrent cancel WON) or advanced to
        // a non-cancellable state (e.g. ready_to_ship/shipped by seller).
        const recheck = await payload.findByID({
            collection: 'orders',
            id: orderId,
            overrideAccess: true,
            depth: 0,
        })
        if ((recheck as any)?.status === 'cancelled') {
            return respond({ success: true, data: recheck, restock: [] })
        }
        if ((recheck as any)?.easyParcelOrderNo) {
            // CAS missed on the label guard, not a status change. CLAIM: = a
            // create-label request in flight (transient — retry); a real shipment
            // number = wallet money committed (cancel the EP shipment first).
            const inFlight = String((recheck as any).easyParcelOrderNo).startsWith('CLAIM:')
            return respond(
                {
                    success: false,
                    error: inFlight
                        ? { code: 'LABEL_IN_PROGRESS', message: 'Label creation is in progress for this order — retry in a moment' }
                        : { code: 'LABEL_EXISTS', message: 'A shipping label exists for this order — cancel the EasyParcel shipment first' },
                },
                { status: 409 }
            )
        }
        // Status advanced to a non-cancellable state between validation and CAS
        return respond(
            { success: false, error: { code: 'INVALID_TRANSITION', message: 'Order status changed — cancellation no longer valid' } },
            { status: 422 }
        )
    }

    // CAS only wrote status + cancel_reason (+ payment_status for Xendit/Stripe); construct from pre-fetched.
    const updated = {
        ...(order as any),
        status: 'cancelled',
        cancelReason: reason,
        ...((xenditRefundId || stripeCasDone) ? { paymentStatus: 'refunded' } : {}),
        ...(!xenditCasDone && !stripeCasDone && UNPAID_PAYMENT_STATUSES.includes((order as any).paymentStatus) ? { paymentStatus: 'cancelled' } : {}),
    }

    // Release the reserved discount slot (F33) — runs only on the CAS winner so a concurrent cancel
    // can't double-release. The slot is reserved at PLACE ORDER for every gateway (incl. pending
    // Stripe), so this is a real release; idempotent + non-throwing if the order had no discount.
    await releaseDiscountRedemption(payload, Number(orderId))

    // Auto-restock inventory (variant-aware).
    const restockResults: RestockResult[] = []
    const items = (order as any).items || []

    // All payment methods decrement stock at checkout — always restock on cancel.
    // bank_transfer: stock decremented at checkout (not at approval) since 2026-06-03.
    // Migration note: BT orders created before that date had stock decremented at approval.
    // If any such orders were in-flight at deploy time, cancelling them now phantom-increments
    // their variant stock. Resolve in-flight BT orders before deploying to avoid this.
    const shouldRestock = true
    if (shouldRestock) {
        for (const item of items) {
            const rawProductId = typeof item.product === 'object' ? item.product?.id : item.product
            if (!rawProductId) {
                restockResults.push({ productId: 'unknown', restocked: 0, skipped: true, reason: 'product_not_found' })
                continue
            }
            const productId = Number.isFinite(Number(rawProductId)) ? Number(rawProductId) : rawProductId
            const result = await restockItem(payload, productId, item.variant, item.quantity)
            restockResults.push(result)
        }
    }

    // Alert ops if any restock item failed — requires manual inventory reconciliation.
    // write_failed: DB I/O error. product_not_found / variant_not_found: stock was decremented
    // at checkout/approve but the product/variant no longer exists — data integrity loss.
    const alertableRestocks = restockResults.filter(r =>
        r.skipped && (r.reason === 'write_failed' || r.reason === 'product_not_found' || r.reason === 'variant_not_found')
    )
    if (alertableRestocks.length > 0) {
        payload.logger.error(
            { orderId, failedProducts: alertableRestocks.map(r => ({ id: r.productId, reason: r.reason })) },
            '[Order Cancel] Restock failed — manual inventory reconciliation required'
        )
    }

    await sendCancelEmails(payload, updated, reason, xenditRefundId)

    return respond({
        success: true,
        data: updated,
        restock: restockResults,
        ...((xenditRefundId || stripeRefundId) ? { refundId: xenditRefundId ?? stripeRefundId } : {}),
    })
}

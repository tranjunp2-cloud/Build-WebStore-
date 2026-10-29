import { sql } from 'drizzle-orm'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { getStripeClient } from '@/lib/payment/stripe'
import { createRefund } from '@/lib/payment/xendit'
import { XenditError } from '@/lib/payment/xendit-client'
import { restockItem, type RestockResult } from '@/app/api/orders/lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import { type ActionResult, respond } from './action-result'
import { sendRefundEmail } from './refund-order-email'

// F1: Xendit /refunds `reason` is a fixed enum — passing free-text (or any other value)
// causes Xendit to 400 AFTER the DB CAS already flipped status='refunded', leaving the
// order marked refunded with no money actually moved. Whitelist against the enum.
const XENDIT_REFUND_REASONS = new Set(['REQUESTED_BY_CUSTOMER', 'FRAUDULENT', 'DUPLICATE', 'CANCELLATION', 'OTHERS'])

/** Any free text or unknown value becomes 'OTHERS' — raw input is never forwarded to Xendit's fixed reason enum. */
export function normalizeRefundReason(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) return 'REQUESTED_BY_CUSTOMER'
    const candidate = raw.trim().toUpperCase()
    return XENDIT_REFUND_REASONS.has(candidate) ? candidate : 'OTHERS'
}

/**
 * The Xendit idempotency key of one refund attempt: the order and the moment its refund CAS was won. Only one attempt
 * can hold the CAS at a time (an unknown outcome keeps the order refunded), so a new key only comes after a rollback.
 */
export function xenditRefundKey(orderId: string | number, casAt: unknown): string {
    const at = casAt instanceof Date ? casAt.getTime() : typeof casAt === 'string' || typeof casAt === 'number' ? new Date(casAt).getTime() : Number.NaN
    return Number.isFinite(at) ? `refund-${orderId}-${at}` : `refund-${orderId}-${Date.now()}`
}

/**
 * Whether a failed Xendit call is a DEFINITE rejection: the request never took effect, so the order may go back to
 * what it was. That is a 4xx answer (the refund was refused: bad invoice, amount over what was paid, …) or a missing
 * key (nothing was sent). A timeout (408), a repeated-key conflict (409, "already being processed / done"), a 5xx, a
 * network error or an unreadable answer leave it unknown whether the money moved, so those never roll back. Some 4xx
 * answers say a refund is already under way or was already made (`REFUND_IN_PROGRESS`, duplicates): unknown too.
 */
export function isDefiniteXenditRejection(err: unknown): boolean {
    if (!(err instanceof XenditError)) return false
    if (err.code === 'XENDIT_CONFIG_ERROR') return true
    const status = err.status ?? 0
    if (status < 400 || status >= 500 || status === 408 || status === 409) return false
    const errorCode = (err.raw as { error_code?: unknown } | undefined)?.error_code
    return !(typeof errorCode === 'string' && XENDIT_REFUND_UNDER_WAY_CODES.has(errorCode))
}

/** Xendit 4xx error codes that mean a refund for this payment is running or was already made (not a refusal). */
const XENDIT_REFUND_UNDER_WAY_CODES = new Set(['REFUND_IN_PROGRESS', 'DUPLICATE_ERROR', 'DUPLICATE_REFUND_ERROR'])

/**
 * Refunds a shipped / completed order in full (Stripe, Xendit, bank transfer or COD). The one
 * implementation of POST /api/orders/[id]/refund and of the copilot. Updates the order by SQL CAS,
 * puts the stock back (best-effort), releases the discount slot and emails the buyer.
 * The order must belong to a workspace of `user`. Bank transfer / COD move no money here: the
 * merchant pays the buyer back by hand.
 */
export async function refundOrderAs(user: User, id: string, refundReason: string): Promise<ActionResult> {
    const payload = await getPayload({ config })

    // Fetch order with tenant expanded (depth: 1)
    let order: any
    try {
        order = await payload.findByID({ collection: 'orders', id, depth: 1 })
    } catch {
        order = null
    }
    if (!order) {
        return respond(
            { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
            { status: 404 },
        )
    }

    // IDOR: verify the order belongs to the requesting user's tenant.
    // String() normalises numeric IDs (e.g. 1 vs '1') so includes() uses strict string equality.
    const userTenantIds: string[] = ((user as any).tenants ?? []).map((t: any) =>
        String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant),
    )
    const orderTenantId = String(typeof order.tenant === 'object' ? order.tenant.id : order.tenant)

    if (!userTenantIds.includes(orderTenantId)) {
        return respond(
            { success: false, error: { code: 'FORBIDDEN' } },
            { status: 403 },
        )
    }

    const emailSub = await getActivePlanSubscription(payload, orderTenantId)
    const canSendRefundEmail = !emailSub || await canUse(payload, emailSub.plan as PlanCode, 'email_confirmation')

    // Only shipped/completed orders can be refunded — mirrors the dashboard UI gate.
    if (order.status === 'refunded') {
        return respond(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }
    const refundableStatuses = ['shipped', 'completed']
    if (!refundableStatuses.includes(order.status)) {
        return respond(
            {
                success: false,
                error: { code: 'ORDER_NOT_REFUNDABLE', message: 'Order cannot be refunded in its current status' },
            },
            { status: 400 },
        )
    }

    // Fire the refund confirmation email (fire-and-forget)
    const fireRefundEmail = () => sendRefundEmail(payload, order)


    // Helper: restock all order items; logs warn/error for skipped cases.
    // Never throws — restockItem catches all SQL errors and returns { skipped: true }.
    async function runRestockForItems(items: any[]): Promise<RestockResult[]> {
        const results: RestockResult[] = []
        for (const [index, item] of (items ?? []).entries()) {
            const rawProductId = typeof item.product === 'object' ? (item.product as any)?.id : item.product
            if (!rawProductId) {
                results.push({ productId: `unknown:${index}`, restocked: 0, skipped: true, reason: 'product_not_found' })
                continue
            }
            const productId = Number.isFinite(Number(rawProductId)) ? Number(rawProductId) : rawProductId
            results.push(await restockItem(payload, productId, (item as any).variant, item.quantity))
        }
        // write_failed | product_not_found | variant_not_found → error (data integrity)
        const errorable = results.filter(r =>
            r.skipped && (r.reason === 'write_failed' || r.reason === 'product_not_found' || r.reason === 'variant_not_found'))
        if (errorable.length > 0) {
            payload.logger.error(
                { orderId: id, failedProducts: errorable.map(r => ({ id: r.productId, reason: r.reason })) },
                '[Order Refund] Restock failed — manual inventory reconciliation required')
        }
        // null_inventory → warn (tracking disabled, not an integrity error)
        const nullInv = results.filter(r => r.skipped && r.reason === 'null_inventory')
        if (nullInv.length > 0) {
            payload.logger.warn(
                { orderId: id, products: nullInv.map(r => r.productId) },
                '[Order Refund] Restock skipped — inventory tracking disabled')
        }
        return results
    }

    // Bank transfer / COD — manual refund, no Stripe call needed.
    // SQL CAS prevents double-restock under concurrent requests.
    if (['bank_transfer', 'cod'].includes(order.paymentMethod)) {
        let casResult: { rows?: Array<Record<string, unknown>> }
        try {
            casResult = await (payload.db.drizzle as any).execute(sql`
                UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
                WHERE id = ${order.id}
                AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
                RETURNING id
            `)
        } catch (err) {
            payload.logger.error({ err: err instanceof Error ? err.message : String(err), orderId: id }, '[Refund] Manual refund failed')
            return respond(
                { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
                { status: 502 },
            )
        }
        if (!casResult.rows?.length) {
            return respond(
                { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
                { status: 400 })
        }
        // --- refund financially committed via CAS; restock is best-effort ---
        // Release the reserved discount slot (F33) — refund frees the promo seat like cancel does.
        // Runs only on the CAS winner; idempotent + non-throwing (no-op when the order had no discount).
        await releaseDiscountRedemption(payload, Number(order.id))
        const restockResults = await runRestockForItems(order.items)
        if (canSendRefundEmail) void fireRefundEmail()
        return respond({ success: true, data: { refundId: null }, restock: restockResults })
    }

    // Xendit refund branch — keyed on paymentProvider field.
    // CAS-before-remote: mark refunded in DB FIRST to prevent double-refund under retry storms,
    // exactly like the Stripe branch below: the call carries an idempotency key (`refund-<id>`). If Xendit
    // REFUSES it (4xx) the status is rolled back so the order is unchanged and the refund can be asked for
    // again; if the outcome is unknown (timeout, network, 5xx, 409) the order stays refunded with a note.
    if (order.paymentProvider === 'xendit') {
        // Fetch tenant directly with overrideAccess to bypass field-level access.read on xenditSecretKey.
        // The order findByID above has no overrideAccess, so depth-populated tenant fields are filtered.
        const tenantRawId = typeof order.tenant === 'object' ? (order.tenant as any).id : order.tenant
        const tenantWithKeys = await payload.findByID({
            collection: 'tenants', id: tenantRawId, depth: 0, overrideAccess: true,
        }).catch(() => null)
        // Invoice checkout (Model C) uses merchant's own xenditSecretKey — NOT xenditAccountId/forUserId
        const xenditSecretKey: string | undefined = (tenantWithKeys as any)?.xenditSecretKey
        if (!xenditSecretKey || !order.xenditPaymentRequestId) {
            return respond(
                { success: false, error: { code: 'XENDIT_NOT_REFUNDABLE', message: 'Missing Xendit payment info for refund' } },
                { status: 422 },
            )
        }

        const xenditOriginalStatus = order.status
        const xenditOriginalPaymentStatus = (order.paymentStatus as string | undefined) ?? 'paid'

        let xenditCasResult: { rows?: Array<Record<string, unknown>> }
        try {
            xenditCasResult = await (payload.db.drizzle as any).execute(sql`
                UPDATE orders SET status = 'refunded'::enum_orders_status, payment_status = 'refunded', updated_at = NOW()
                WHERE id = ${order.id}
                AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
                RETURNING id, updated_at
            `)
        } catch (err) {
            payload.logger.error({ err: err instanceof Error ? err.message : String(err), orderId: id }, '[Refund] Xendit CAS failed')
            return respond(
                { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
                { status: 502 },
            )
        }
        if (!xenditCasResult.rows?.length) {
            return respond(
                { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
                { status: 400 },
            )
        }

        const refundKey = xenditRefundKey(order.id, xenditCasResult.rows[0]?.updated_at)
        let xenditRefund: { id: string; status: string }
        try {
            // Invoice API (v2): identify by invoice_id, auth via apiKey (Model C)
            xenditRefund = await createRefund({
                apiKey: xenditSecretKey,
                invoiceId: order.xenditPaymentRequestId,
                // Xendit MYR = major unit (RM). order.total already RM. NO *100.
                amount: order.total,
                reason: refundReason,
                // One key per refund attempt: a retry of this call gets the first answer back instead of a second refund,
                // and a new attempt after a definite refusal is not answered with that old refusal again.
                idempotencyKey: refundKey,
            })
        } catch (err) {
            const errText = err instanceof Error ? err.message : String(err)
            if (!isDefiniteXenditRejection(err)) {
                // Timeout / network / 5xx / repeated-key conflict: Xendit may well have refunded the buyer. Rolling back
                // would show a paid order whose money is gone, so the order STAYS refunded, an internal note says what
                // to check, and nothing else runs (no buyer email, no restock) until the merchant has looked.
                const note = `[${new Date().toISOString()}] Refund sent to Xendit; result unknown - check the Xendit dashboard (invoice ${order.xenditPaymentRequestId}, key ${refundKey}).`
                await (payload.db.drizzle as any).execute(sql`
                    UPDATE orders SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ${note} ELSE notes || E'\n' || ${note} END, updated_at = NOW()
                    WHERE id = ${order.id}
                `).catch((noteErr: unknown) => {
                    payload.logger.error({ noteErr: noteErr instanceof Error ? noteErr.message : String(noteErr), orderId: id }, '[Refund] Could not write the Xendit reconciliation note')
                })
                payload.logger.error({ err: errText, orderId: id }, '[Refund] Xendit createRefund result unknown - order kept as refunded, manual reconciliation required')
                return respond(
                    { success: false, error: { code: 'XENDIT_REFUND_UNKNOWN', message: 'The refund was sent to Xendit but Xendit did not answer, so it is not known whether the money went back. The order is kept as refunded (the buyer was not emailed and the stock was not put back); an internal note says so. Check the refund in the Xendit dashboard before doing anything else.' } },
                    { status: 502 },
                )
            }
            // Xendit refused it: put the order back, as the Stripe branch does.
            await (payload.db.drizzle as any).execute(sql`
                UPDATE orders SET status = ${xenditOriginalStatus}::enum_orders_status, payment_status = ${xenditOriginalPaymentStatus}, updated_at = NOW()
                WHERE id = ${order.id}
            `).catch((rollbackErr: unknown) => {
                payload.logger.error(
                    { rollbackErr: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr), orderId: id, originalStatus: xenditOriginalStatus },
                    '[Refund] Xendit status rollback failed — DB state may be inconsistent'
                )
            })
            payload.logger.error({ err: errText, orderId: id }, '[Refund] Xendit createRefund rejected — status rolled back')
            return respond(
                { success: false, error: { code: 'XENDIT_REFUND_ERROR', message: 'The Xendit refund could not be processed, so the order was left as it was. Try again, or refund it in the Xendit dashboard.' } },
                { status: 502 },
            )
        }

        await releaseDiscountRedemption(payload, Number(order.id))
        const restockResults = await runRestockForItems(order.items)
        if (canSendRefundEmail) void fireRefundEmail()
        return respond({ success: true, data: { refundId: xenditRefund.id }, restock: restockResults })
    }

    // Stripe orders — resolve connected account
    const stripeAccountId =
        typeof order.tenant === 'object' ? order.tenant.stripeAccountId : undefined
    if (!stripeAccountId) {
        return respond(
            { success: false, error: { code: 'PAYMENT_NOT_CONFIGURED' } },
            { status: 400 },
        )
    }

    let stripePaymentIntentId: string | undefined = order.stripePaymentIntentId

    // If payment intent not cached (e.g. webhook didn't fire yet), fetch it from Stripe via session
    if (!stripePaymentIntentId && order.stripeSessionId) {
        try {
            const stripe = getStripeClient()
            const session = await stripe.checkout.sessions.retrieve(
                order.stripeSessionId,
                { expand: ['payment_intent'] },
                { stripeAccount: stripeAccountId },
            )
            const pi = session.payment_intent
            stripePaymentIntentId = typeof pi === 'string' ? pi : (pi as any)?.id
            if (stripePaymentIntentId) {
                // Backfill so future calls don't need to fetch again
                await payload.update({
                    collection: 'orders',
                    id,
                    data: { stripePaymentIntentId } as any,
                })
            }
        } catch (err: any) {
            payload.logger.error({ err: err.message, orderId: id }, '[Refund] Failed to retrieve Stripe session')
        }
    }

    if (!stripePaymentIntentId) {
        return respond(
            {
                success: false,
                error: { code: 'NO_PAYMENT_INTENT', message: 'No Stripe payment found for this order' },
            },
            { status: 400 },
        )
    }

    const originalStatus = order.status
    const originalPaymentStatus = (order.paymentStatus as string | undefined) ?? 'paid'

    // Atomic CAS: only the first concurrent request wins — prevents double-email if merchant double-clicks.
    // Update DB to 'refunded' BEFORE calling Stripe so the charge.refunded webhook
    // (which fires moments after the Stripe API call) sees the order as already refunded
    // and skips sending a duplicate confirmation email.
    let casResult: { rows?: Array<Record<string, unknown>> }
    try {
        casResult = await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
            WHERE id = ${order.id}
            AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
            RETURNING id
        `)
    } catch (err) {
        payload.logger.error({ err: err instanceof Error ? err.message : String(err), orderId: id }, '[Refund] CAS failed')
        return respond(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
    if (!casResult.rows?.length) {
        return respond(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }

    try {
        const stripe = getStripeClient()
        const refund = await stripe.refunds.create(
            { payment_intent: stripePaymentIntentId },
            { stripeAccount: stripeAccountId, idempotencyKey: `refund-${id}` },
        )

        // Restock + discount-slot release ONLY after Stripe irreversibly succeeds — retry-safe
        // (CAS blocks 2nd refund). Releasing earlier would leak a slot if Stripe fails and the
        // status rolls back below. releaseDiscountRedemption is idempotent + non-throwing.
        await releaseDiscountRedemption(payload, Number(order.id))
        const restockResults = await runRestockForItems(order.items)
        if (canSendRefundEmail) void fireRefundEmail()
        return respond({ success: true, data: { refundId: refund.id }, restock: restockResults })
    } catch (err: any) {
        // 'charge_already_refunded' means the refund exists on Stripe — idempotent success.
        // Covers the network-timeout case where Stripe processed the refund but our request timed out.
        // CAS + idempotencyKey prevent any double-charge.
        if (err?.code === 'charge_already_refunded') {
            // Refund exists on Stripe → same irreversible-success semantics: release + restock.
            await releaseDiscountRedemption(payload, Number(order.id))
            const restockResults = await runRestockForItems(order.items)
            if (canSendRefundEmail) void fireRefundEmail()
            return respond({ success: true, data: { refundId: null }, restock: restockResults })
        }
        // Genuine Stripe failure — roll back our pre-set status.
        // Known race: if the charge.refunded webhook arrived WHILE status was already 'refunded'
        // (from our CAS), that webhook silently skips its own guard (AND status != 'refunded')
        // and won't fire again. Our rollback then resets to 'shipped' — a false negative.
        // Full fix requires a schema marker (e.g. refundedAt or stripeRefundId set by the webhook);
        // this is acceptable for now given the narrow timing window. The `charge_already_refunded`
        // path above handles the common Stripe-processed-but-we-timed-out case.
        await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET status = ${originalStatus}::enum_orders_status, payment_status = ${originalPaymentStatus}
            WHERE id = ${order.id}
        `).catch((rollbackErr: unknown) => {
            payload.logger.error(
                { rollbackErr: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr), orderId: id, originalStatus },
                '[Refund] Status rollback failed — DB state may be inconsistent'
            )
        })
        payload.logger.error({ err: err.message, orderId: id }, '[Refund] Stripe refund failed — status rolled back')
        return respond(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
}

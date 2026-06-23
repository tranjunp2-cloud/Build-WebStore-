import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCancelSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { getStripeClient } from '@/lib/payment/stripe'
import { createRefund } from '@/lib/payment/xendit'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { restockItem, type RestockResult } from '../../lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel an order with a required reason.
 * Auto-restocks inventory for each item in the order.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderCancelSchema)
        if (errorResponse) return errorResponse

        const { reason } = data!
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
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        // Sequential retry: already cancelled (first request completed before second arrived)
        if ((order.status as string) === 'cancelled') {
            return NextResponse.json({ success: true, data: order, restock: [] })
        }

        // Validate that cancellation is allowed from current status
        const currentStatus = order.status as string
        const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || []
        if (!allowed.includes('cancelled')) {
            return NextResponse.json(
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
                return NextResponse.json(
                    { success: false, error: { code: 'XENDIT_NOT_REFUNDABLE', message: 'Missing Xendit payment info — cancel blocked to protect buyer funds. Refund manually via Xendit dashboard first.' } },
                    { status: 422 }
                )
            }

            // CAS: commit cancel + payment_status='refunded' atomically.
            // AND payment_status='paid' guard prevents double-refund under concurrent requests.
            const xenditCas = await db.execute(sql`
                UPDATE orders
                SET status = 'cancelled', cancel_reason = ${reason}, payment_status = 'refunded', updated_at = NOW()
                WHERE id = ${orderId} AND status = ${currentStatus} AND payment_status = 'paid'
                RETURNING id
            `)

            if (!xenditCas.rows?.length) {
                const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
                if ((recheck as any)?.status === 'cancelled') {
                    return NextResponse.json({ success: true, data: recheck, restock: [] })
                }
                return NextResponse.json(
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
                return NextResponse.json(
                    { success: false, error: { code: 'XENDIT_REFUND_ERROR', message: 'Refund could not be processed — cancellation aborted. Please try again or refund via Xendit dashboard.' } },
                    { status: 502 }
                )
            }
        }

        // --- Stripe paid orders: auto-refund atomically with cancel ---
        // Mirrors the Xendit block above: CAS-before-remote → call Stripe → rollback on failure.
        // Detection: paid + not manual (BT/COD) + not Xendit → implicit Stripe (paymentProvider not set for Stripe).
        if (
            !xenditCasDone &&
            (order as any).paymentStatus === 'paid' &&
            !['bank_transfer', 'cod'].includes((order as any).paymentMethod ?? '') &&
            (order as any).paymentProvider !== 'xendit'
        ) {
            const tenantRawId = typeof (order as any).tenant === 'object'
                ? (order as any).tenant.id
                : (order as any).tenant
            const tenantWithKeys = await payload.findByID({
                collection: 'tenants', id: tenantRawId, depth: 0, overrideAccess: true,
            }).catch(() => null)
            const stripeAccountId: string | undefined = (tenantWithKeys as any)?.stripeAccountId

            if (!stripeAccountId) {
                return NextResponse.json(
                    { success: false, error: { code: 'STRIPE_NOT_REFUNDABLE', message: 'Stripe account not configured — cancel blocked to protect buyer funds. Refund manually via Stripe dashboard first.' } },
                    { status: 422 }
                )
            }

            let stripePaymentIntentId: string | undefined = (order as any).stripePaymentIntentId

            // If payment intent not cached (webhook may not have fired yet), fetch from Stripe session.
            if (!stripePaymentIntentId && (order as any).stripeSessionId) {
                try {
                    const stripe = getStripeClient()
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
                return NextResponse.json(
                    { success: false, error: { code: 'STRIPE_NOT_REFUNDABLE', message: 'Missing Stripe payment intent — cancel blocked to protect buyer funds. Refund manually via Stripe dashboard first.' } },
                    { status: 422 }
                )
            }

            // CAS: commit cancel + payment_status='refunded' atomically before calling Stripe API.
            // AND payment_status='paid' guard prevents double-refund under concurrent requests.
            const stripeCas = await db.execute(sql`
                UPDATE orders
                SET status = 'cancelled', cancel_reason = ${reason}, payment_status = 'refunded', updated_at = NOW()
                WHERE id = ${orderId} AND status = ${currentStatus} AND payment_status = 'paid'
                RETURNING id
            `)

            if (!stripeCas.rows?.length) {
                const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
                if ((recheck as any)?.status === 'cancelled') {
                    return NextResponse.json({ success: true, data: recheck, restock: [] })
                }
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_TRANSITION', message: 'Order status changed — cancellation no longer valid' } },
                    { status: 422 }
                )
            }

            stripeCasDone = true

            // CAS committed — now call Stripe. If it fails, roll back so order is unchanged.
            try {
                const stripe = getStripeClient()
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
                        SET status = ${currentStatus}, payment_status = 'paid', updated_at = NOW()
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
                    return NextResponse.json(
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
            casResult = await db.execute(sql`
                UPDATE orders
                SET status = 'cancelled', cancel_reason = ${reason}, updated_at = NOW()
                WHERE id = ${orderId} AND status = ${currentStatus}
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
                return NextResponse.json({ success: true, data: recheck, restock: [] })
            }
            // Status advanced to a non-cancellable state between validation and CAS
            return NextResponse.json(
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

        // Send email to customer.
        // Xendit/Stripe paid orders that were auto-refunded → send refund email (mentions refund amount + ETA).
        // All other orders → send standard cancellation email.
        const customerEmail = (updated as any).customerEmail
        if (customerEmail) {
            try {
                const tenantId = typeof (updated as any).tenant === 'object'
                    ? (updated as any).tenant.id
                    : (updated as any).tenant
                const siteLocale: 'en' | 'ms' = typeof (updated as any).site === 'object'
                    ? ((updated as any).site?.locale ?? 'ms')
                    : 'ms'
                const emailTemplate = (xenditRefundId || stripeCasDone) ? 'order-refunded' : 'order-cancelled'
                const [tenant, cmsConfig] = await Promise.all([
                    tenantId
                        ? payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                        : Promise.resolve(null),
                    tenantId
                        ? getTemplateConfig(tenantId, emailTemplate, 'buyer', siteLocale)
                        : Promise.resolve(null),
                ])

                if (cmsConfig?.enabled === false) {
                    console.log(`[Email] suppressed (disabled): ${emailTemplate} (cancel route)`)
                } else {
                    const shopName = (tenant as any)?.name ?? ''
                    const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
                    const shopUrl = buildStorefrontUrl(shopSlug)
                    const emailItems = ((updated as any).items ?? []).map((item: any) => ({
                        name: item.productName,
                        variant: item.variant || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.quantity * item.unitPrice,
                    }))

                    if (xenditRefundId || stripeCasDone) {
                        // Refund email: buyer knows money is coming back
                        const refundEmail = orderRefundedEmail({
                            shopName,
                            orderNumber: (updated as any).orderNumber ?? String(updated.id),
                            customerName: (updated as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (updated as any).customerPhone ?? null,
                            customerAddress: (updated as any).shippingAddress ?? null,
                            items: emailItems,
                            subtotal: (updated as any).subtotal ?? 0,
                            shippingFee: (updated as any).shippingFee ?? 0,
                            total: (updated as any).total ?? 0,
                            refundAmount: (updated as any).total ?? 0,
                            paymentMethod: (updated as any).paymentMethod ?? 'bank_transfer',
                            orderDate: (updated as any).createdAt,
                            refundDate: new Date().toISOString(),
                            shopUrl,
                            currency: (updated as any).currency ?? 'MYR',
                            locale: siteLocale,
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({ to: customerEmail, subject: refundEmail.subject, html: refundEmail.html })
                            .catch((err: unknown) => console.warn('[Order Cancel] Failed to send refund email:', err))
                    } else {
                        const cancelEmail = orderCancelledEmail({
                            shopName,
                            orderNumber: (updated as any).orderNumber ?? String(updated.id),
                            customerName: (updated as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (updated as any).customerPhone ?? null,
                            customerAddress: (updated as any).shippingAddress ?? null,
                            items: emailItems,
                            subtotal: (updated as any).subtotal ?? 0,
                            shippingFee: (updated as any).shippingFee ?? 0,
                            total: (updated as any).total ?? 0,
                            paymentMethod: (updated as any).paymentMethod ?? 'cod',
                            orderDate: (updated as any).createdAt,
                            cancellationDate: new Date().toISOString(),
                            cancellationNote: reason ?? null,
                            shopUrl,
                            currency: (updated as any).currency ?? 'MYR',
                            locale: siteLocale,
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                            .catch((err: unknown) => console.warn('[Order Cancel] Failed to send email:', err))
                    }
                }
            } catch (emailErr) {
                console.warn('[Order Cancel] Failed to build email:', emailErr)
            }
        }

        return NextResponse.json({
            success: true,
            data: updated,
            restock: restockResults,
            ...((xenditRefundId || stripeRefundId) ? { refundId: xenditRefundId ?? stripeRefundId } : {}),
        })
    } catch (error: any) {
        console.error('[Order Cancel Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order cancellation failed' } },
            { status: 500 }
        )
    }
}))

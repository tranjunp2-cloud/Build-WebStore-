import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { getStripeClient } from '@/lib/payment/stripe'
import { createRefund } from '@/lib/payment/xendit'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { restockItem, type RestockResult } from '../../lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import type { User } from 'payload'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/refund
 *
 * Initiates a refund for a paid order (Stripe, bank_transfer, or COD).
 * Updates order status via SQL CAS, restocks inventory (best-effort), and fires a refund email.
 * Auth required — only the tenant owner can refund their own orders (IDOR protection).
 *
 * Returns: { success, data: { refundId }, restock: RestockResult[] }
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user: User, request: Request, ctx: RouteContext) => {
    const { id } = await ctx.params
    const payload = await getPayload({ config })

    // Parse optional reason from body (guard non-JSON or missing body gracefully)
    let refundReason = 'REQUESTED_BY_CUSTOMER'
    try {
        const ct = request.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) {
            const body = await request.json()
            if (body?.reason && typeof body.reason === 'string' && body.reason.trim()) {
                refundReason = body.reason.trim()
            }
        }
    } catch {
        // Non-JSON or empty body — keep default reason
    }

    // Fetch order with tenant expanded (depth: 1)
    let order: any
    try {
        order = await payload.findByID({ collection: 'orders', id, depth: 1 })
    } catch {
        order = null
    }
    if (!order) {
        return NextResponse.json(
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
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN' } },
            { status: 403 },
        )
    }

    const emailSub = await getActivePlanSubscription(payload, orderTenantId)
    const canSendRefundEmail = !emailSub || await canUse(payload, emailSub.plan as PlanCode, 'email_confirmation')

    // Only shipped/completed orders can be refunded — mirrors the dashboard UI gate.
    if (order.status === 'refunded') {
        return NextResponse.json(
            { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
            { status: 400 },
        )
    }
    const refundableStatuses = ['shipped', 'completed']
    if (!refundableStatuses.includes(order.status)) {
        return NextResponse.json(
            {
                success: false,
                error: { code: 'ORDER_NOT_REFUNDABLE', message: 'Order cannot be refunded in its current status' },
            },
            { status: 400 },
        )
    }

    // Helper: build and fire refund confirmation email (fire-and-forget)
    async function fireRefundEmail() {
        if (!order.customerEmail) return
        const tenant = typeof order.tenant === 'object' ? order.tenant : null
        const tenantId = tenant ? String((tenant as any).id) : null
        const refundLocale: 'en' | 'ms' = (
            (order as any).locale
            ?? (typeof order.site === 'object' ? (order.site as any)?.locale : null)
            ?? 'en'
        ) as 'en' | 'ms'
        const cmsConfig = tenantId
            ? await getTemplateConfig(tenantId, 'order-refunded', 'buyer', refundLocale).catch(() => null)
            : null
        if (cmsConfig?.enabled === false) return
        const shopName = tenant?.name ?? 'Shop'
        const siteSlug = tenant?.slug ?? ''
        const email = orderRefundedEmail({
            shopName,
            orderNumber: order.orderNumber,
            customerName: order.customerName ?? '',
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone ?? null,
            customerAddress: order.shippingAddress ?? null,
            items: (order.items ?? []).map((item: any) => ({
                name: item.productName ?? item.name ?? '',
                variant: item.variant ?? null,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice ?? 0,
                lineTotal: item.lineTotal ?? 0,
            })),
            subtotal: order.subtotal ?? 0,
            shippingFee: order.shippingFee ?? 0,
            total: order.total ?? 0,
            refundAmount: order.total ?? 0,
            paymentMethod: order.paymentMethod ?? 'stripe',
            orderDate: order.createdAt,
            refundDate: new Date().toISOString(),
            shopUrl: buildStorefrontUrl(siteSlug),
            currency: order.currency ?? 'MYR',
            locale: refundLocale,
        }, cmsConfig ?? undefined)
        payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
            .catch((err: unknown) => payload.logger.error({ err }, '[Refund] sendEmail failed'))
    }

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
            return NextResponse.json(
                { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
                { status: 502 },
            )
        }
        if (!casResult.rows?.length) {
            return NextResponse.json(
                { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
                { status: 400 })
        }
        // --- refund financially committed via CAS; restock is best-effort ---
        // Release the reserved discount slot (F33) — refund frees the promo seat like cancel does.
        // Runs only on the CAS winner; idempotent + non-throwing (no-op when the order had no discount).
        await releaseDiscountRedemption(payload, Number(order.id))
        const restockResults = await runRestockForItems(order.items)
        if (canSendRefundEmail) void fireRefundEmail()
        return NextResponse.json({ success: true, data: { refundId: null }, restock: restockResults })
    }

    // Xendit refund branch — keyed on paymentProvider field.
    // CAS-before-remote: mark refunded in DB FIRST to prevent double-refund under retry storms,
    // mirroring the Stripe pattern. If the Xendit API call subsequently fails, ops must reconcile
    // via Xendit dashboard — we log the failure clearly and return 502.
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
            return NextResponse.json(
                { success: false, error: { code: 'XENDIT_NOT_REFUNDABLE', message: 'Missing Xendit payment info for refund' } },
                { status: 422 },
            )
        }

        let xenditCasResult: { rows?: Array<Record<string, unknown>> }
        try {
            xenditCasResult = await (payload.db.drizzle as any).execute(sql`
                UPDATE orders SET status = 'refunded'::enum_orders_status, payment_status = 'refunded', updated_at = NOW()
                WHERE id = ${order.id}
                AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
                RETURNING id
            `)
        } catch (err) {
            payload.logger.error({ err: err instanceof Error ? err.message : String(err), orderId: id }, '[Refund] Xendit CAS failed')
            return NextResponse.json(
                { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
                { status: 502 },
            )
        }
        if (!xenditCasResult.rows?.length) {
            return NextResponse.json(
                { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Order has already been refunded' } },
                { status: 400 },
            )
        }

        let xenditRefund: { id: string; status: string }
        try {
            // Invoice API (v2): identify by invoice_id, auth via apiKey (Model C)
            xenditRefund = await createRefund({
                apiKey: xenditSecretKey,
                invoiceId: order.xenditPaymentRequestId,
                // Xendit MYR = major unit (RM). order.total already RM. NO *100.
                amount: order.total,
                reason: refundReason,
            })
        } catch (err) {
            // CAS already committed — log clearly. Ops must handle via Xendit dashboard.
            payload.logger.error({ err: err instanceof Error ? err.message : String(err), orderId: id }, '[Refund] Xendit createRefund failed after CAS — manual reconciliation required')
            return NextResponse.json(
                { success: false, error: { code: 'XENDIT_REFUND_ERROR', message: 'Refund recorded locally but Xendit API call failed. Contact support.' } },
                { status: 502 },
            )
        }

        await releaseDiscountRedemption(payload, Number(order.id))
        const restockResults = await runRestockForItems(order.items)
        if (canSendRefundEmail) void fireRefundEmail()
        return NextResponse.json({ success: true, data: { refundId: xenditRefund.id }, restock: restockResults })
    }

    // Stripe orders — resolve connected account
    const stripeAccountId =
        typeof order.tenant === 'object' ? order.tenant.stripeAccountId : undefined
    if (!stripeAccountId) {
        return NextResponse.json(
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
        return NextResponse.json(
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
        return NextResponse.json(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
    if (!casResult.rows?.length) {
        return NextResponse.json(
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
        return NextResponse.json({ success: true, data: { refundId: refund.id }, restock: restockResults })
    } catch (err: any) {
        // 'charge_already_refunded' means the refund exists on Stripe — idempotent success.
        // Covers the network-timeout case where Stripe processed the refund but our request timed out.
        // CAS + idempotencyKey prevent any double-charge.
        if (err?.code === 'charge_already_refunded') {
            // Refund exists on Stripe → same irreversible-success semantics: release + restock.
            await releaseDiscountRedemption(payload, Number(order.id))
            const restockResults = await runRestockForItems(order.items)
            if (canSendRefundEmail) void fireRefundEmail()
            return NextResponse.json({ success: true, data: { refundId: null }, restock: restockResults })
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
        return NextResponse.json(
            { success: false, error: { code: 'REFUND_FAILED', message: 'Refund could not be processed' } },
            { status: 502 },
        )
    }
}))

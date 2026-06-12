import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { verifyConnectedAccountOwnership } from './verify-account-ownership'
import { restockItem } from '../../../orders/lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'

/**
 * Handles charge.refunded Stripe webhook event.
 * Triggered when a refund is issued directly from the Stripe Dashboard
 * (outside of ECH). Syncs order status and sends buyer email.
 */
export async function handleChargeRefunded(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const charge = event.data

    // Direct Charges: every legitimate charge.refunded must carry a connectedAccountId.
    if (!event.connectedAccountId) {
        payload.logger.error('[Stripe Webhook] SECURITY: charge.refunded without connectedAccountId — Direct Charges require connected account context; rejecting')
        return
    }

    const paymentIntentId = charge.payment_intent as string | undefined

    if (!paymentIntentId) {
        payload.logger.warn('[Stripe Webhook] charge.refunded has no payment_intent — skipping')
        return
    }

    const orders = await payload.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
        depth: 1,
    })

    if (orders.docs.length === 0) {
        payload.logger.warn(`[Stripe Webhook] No order found for payment_intent ${paymentIntentId}`)
        return
    }

    const order = orders.docs[0] as any

    // IDOR guard: connected merchant must own the payment intent they're claiming a refund on
    const tenantId = typeof order.tenant === 'object' ? (order.tenant as any).id : order.tenant
    if (!await verifyConnectedAccountOwnership(payload, event.connectedAccountId, tenantId, `charge.refunded order ${order.id}`)) return

    // Atomic guard: only the first concurrent delivery wins — prevents duplicate refund emails
    // under Stripe's at-least-once delivery guarantee.
    const updateResult = await (payload.db.drizzle as any).execute(sql`
        UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
        WHERE id = ${order.id} AND status != 'refunded'
        RETURNING id
    `)
    if (!updateResult.rows?.length) {
        payload.logger.info({ orderId: order.id }, '[Stripe Webhook] Order already refunded — skipping concurrent delivery')
        return
    }

    payload.logger.info({ orderId: order.id }, '[Stripe Webhook] Order marked refunded via charge.refunded')

    // Release the reserved discount slot (F33) — a Stripe Dashboard refund is a terminal non-sale, same as
    // the in-app refund route. Runs only on the CAS winner above; idempotent + non-throwing. Without this,
    // a dashboard refund would leak the slot forever (the slot is reserved at place-order for paid orders).
    await releaseDiscountRedemption(payload, Number(order.id))

    // Restock inventory (best-effort) — mirrors refund/route.ts for ECH-initiated refunds.
    // This path handles Stripe Dashboard refunds where the refund/route.ts path was not called.
    for (const [index, item] of ((order.items as any[]) ?? []).entries()) {
        const rawProductId = typeof item.product === 'object' ? (item.product as any)?.id : item.product
        if (!rawProductId) {
            payload.logger.error(
                { orderId: order.id, itemIndex: index },
                '[charge.refunded] Restock skipped — item has no product ID (data integrity concern)',
            )
            continue
        }
        const productId = Number.isFinite(Number(rawProductId)) ? Number(rawProductId) : rawProductId
        const result = await restockItem(payload, productId, (item as any).variant, item.quantity)
        if (result.skipped) {
            if (result.reason === 'null_inventory') {
                payload.logger.warn({ orderId: order.id, productId: result.productId }, '[charge.refunded] Restock skipped — inventory tracking disabled')
            } else {
                payload.logger.error(
                    { orderId: order.id, productId: result.productId, reason: result.reason },
                    '[charge.refunded] Restock failed — manual inventory reconciliation required',
                )
            }
        }
    }

    if (!order.customerEmail) return

    const tenant = typeof order.tenant === 'object' ? order.tenant : null
    const shopName = tenant?.name ?? 'Shop'
    const siteSlug = tenant?.slug ?? String((tenant as any)?.id ?? '')
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

    const cmsConfig = await getTemplateConfig(String(tenantId), 'order-refunded', 'buyer').catch(() => null)
    if (cmsConfig?.enabled === false) return

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
        refundAmount: (charge.amount_refunded ?? 0) / 100,
        paymentMethod: order.paymentMethod ?? 'stripe',
        orderDate: order.createdAt,
        refundDate: new Date().toISOString(),
        shopUrl: `${baseUrl}/sites/${siteSlug}`,
        currency: order.currency ?? 'MYR',
        locale: ((typeof order.site === 'object' ? (order.site as any)?.locale : null) ?? 'ms') as 'en' | 'ms',
    }, cmsConfig ?? undefined)

    payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
        .catch((err: unknown) => payload.logger.error({ err }, '[charge.refunded] sendEmail failed'))
}

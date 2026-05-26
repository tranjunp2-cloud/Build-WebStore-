import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'

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
    const paymentIntentId = charge.payment_intent as string | undefined

    if (!paymentIntentId) {
        console.warn('[Stripe Webhook] charge.refunded has no payment_intent — skipping')
        return
    }

    const orders = await payload.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
        depth: 1,
    })

    if (orders.docs.length === 0) {
        console.warn(`[Stripe Webhook] No order found for payment_intent ${paymentIntentId}`)
        return
    }

    const order = orders.docs[0] as any

    if (order.status === 'refunded') {
        console.log(`[Stripe Webhook] Order ${order.id} already refunded — skipping`)
        return
    }

    await payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'refunded' } as any,
    })

    console.log(`[Stripe Webhook] Order ${order.id} marked refunded via charge.refunded`)

    if (!order.customerEmail) return

    const tenant = typeof order.tenant === 'object' ? order.tenant : null
    const shopName = tenant?.name ?? 'Shop'
    const siteSlug = tenant?.slug ?? ''
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

    const email = orderRefundedEmail({
        shopName,
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? '',
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone ?? null,
        customerAddress: order.shippingAddress ?? null,
        items: (order.items ?? []).map((item: any) => ({
            name: item.productName ?? item.name ?? '',
            variant: item.variantName ?? null,
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
        locale: (order.locale as 'en' | 'ms') ?? 'ms',
    })

    payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
        .catch((err: unknown) => payload.logger.error({ err }, '[charge.refunded] sendEmail failed'))
}

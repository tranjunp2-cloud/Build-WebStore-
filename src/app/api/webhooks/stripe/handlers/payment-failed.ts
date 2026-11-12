import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'
import { verifyConnectedAccountOwnership } from './verify-account-ownership'
import { signOrderToken } from '@/lib/auth/order-token'
import { paymentRetryEmail } from '@/lib/email/templates/payment-retry'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'
import { runAfterResponse } from '@/lib/runtime/run-after-response'
import { orderActionUrl } from '@/lib/notifications/order-action-url'

/** Minimal shape of an order document used in payment-failed handler (depth:0 lookup). */
interface OrderDoc {
    id: number | string
    tenant: number | string | { id: number | string }
    orderNumber: string
    status: string
}

/** Extended order shape for email sending (depth:1 lookup — tenant populated). */
interface OrderDocDepth1 {
    id: number | string
    orderNumber: string
    customerEmail?: string | null
    customerName?: string
    total?: number
    currency?: string
    magicLinkSecret?: string | null
    tenant: number | string | { id: number | string; slug?: string; name?: string }
    site?: unknown
}

export async function handlePaymentFailed(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const paymentIntent = event.data

    // Direct Charges: every legitimate payment_intent.payment_failed must carry a connectedAccountId.
    if (!event.connectedAccountId) {
        console.error('[Stripe Webhook] SECURITY: payment_intent.payment_failed without connectedAccountId — Direct Charges require connected account context; rejecting')
        return
    }

    const paymentIntentId = paymentIntent.id

    // Try finding order by stripePaymentIntentId first
    let orders = await payload.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
    })

    // Fallback: search by the order ID stored in PaymentIntent metadata
    if (orders.docs.length === 0 && paymentIntent.metadata?.orderId) {
        const metaOrderId = String(paymentIntent.metadata.orderId)
        if (!/^\d+$/.test(metaOrderId)) {
            console.warn('[Stripe Webhook] payment_failed: non-numeric metadata.orderId:', metaOrderId)
        } else {
            orders = await payload.find({
                collection: 'orders',
                where: { id: { equals: parseInt(metaOrderId, 10) } },
                limit: 1,
            })
        }
    }

    if (orders.docs.length === 0) {
        console.warn(`[Stripe Webhook] No order found for payment_intent ${paymentIntentId}`)
        return
    }

    const order = orders.docs[0] as unknown as OrderDoc

    // IDOR guard: connected merchant must own the payment intent they're claiming failed
    const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    if (!await verifyConnectedAccountOwnership(payload, event.connectedAccountId, tenantId, `payment_intent.payment_failed order ${order.id}`)) return

    // Skip if order already moved past payment stage (late-arriving event, out-of-order delivery)
    const skipStatuses = ['new', 'confirmed', 'ready_to_ship', 'shipped', 'completed', 'refunded', 'payment_failed', 'cancelled']
    if (skipStatuses.includes(order.status)) {
        console.log(`[Stripe Webhook] Order ${order.id} already in ${order.status} — skipping payment_failed`)
        return
    }

    await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
            status: 'payment_failed',
            paymentStatus: 'failed',
            stripePaymentIntentId: paymentIntentId,
        },
    })

    console.log(`[Stripe Webhook] Order ${order.id} marked as payment_failed`)

    // Notify merchant of failed payment after the response is sent
    const tId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    runAfterResponse('Notification PAYMENT_FAILED', async () => {
        const { notifyTenantOwners } = await import('@/lib/notifications/notify-tenant-owners')
        await notifyTenantOwners(payload, tId, {
            type: 'SYSTEM_ALERT',
            title: `Payment Failed - Order #${order.orderNumber}`,
            message: `Payment for order #${order.orderNumber} has failed. Customer may retry.`,
            actionUrl: orderActionUrl(order.id),
            metadata: { orderNumber: order.orderNumber },
        })
    })

    // Fire-and-forget: send re-payment email to buyer with magic-link to retry
    sendPaymentRetryEmail(payload, order.id, order.orderNumber).catch((err) =>
        payload.logger.error({ err, orderId: order.id }, 'payment-retry email failed'),
    )
}

/**
 * Fetch order with depth:1 (tenant populated for slug), generate a 24h magic-link token,
 * and send the payment retry email to the buyer.
 */
async function sendPaymentRetryEmail(
    payload: Payload,
    orderId: number | string,
    orderNumber: string,
): Promise<void> {
    // Re-fetch with depth:1 to populate tenant slug and get email/total fields
    const full = await payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 1,
        overrideAccess: true,
    }) as unknown as OrderDocDepth1

    if (!full?.customerEmail) return

    const tenantObj = typeof full.tenant === 'object' ? full.tenant : null
    const siteSlug = (tenantObj as any)?.slug ?? ''

    const expSec = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)

    let payUrl = buildStorefrontUrl(siteSlug, `/orders/${orderNumber}`)

    if (full.magicLinkSecret) {
        const token = await signOrderToken({
            orderId: full.id,
            secret: full.magicLinkSecret,
            expSec,
        })
        payUrl = `${payUrl}?token=${token}`
    }

    const template = paymentRetryEmail({
        shopName: (tenantObj as any)?.name ?? siteSlug,
        orderNumber: full.orderNumber,
        customerName: full.customerName ?? '',
        total: full.total ?? 0,
        currency: full.currency ?? 'MYR',
        payUrl,
        locale: 'en',
    })

    payload
        .sendEmail({ to: full.customerEmail, subject: template.subject, html: template.html })
        .catch((e: unknown) =>
            payload.logger.error({ err: e, orderId: full.id }, 'payment-retry sendEmail failed'),
        )
}

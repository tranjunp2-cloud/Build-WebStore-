import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/** Minimal shape of an order document used in payment-failed handler. */
interface OrderDoc {
    id: number | string
    tenant: number | string | { id: number | string }
    orderNumber: string
    status: string
}

export async function handlePaymentFailed(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const paymentIntent = event.data
    const paymentIntentId = paymentIntent.id

    // Try finding order by stripePaymentIntentId first
    let orders = await payload.find({
        collection: 'orders',
        where: { stripePaymentIntentId: { equals: paymentIntentId } },
        limit: 1,
    })

    // Fallback: search by the order ID stored in PaymentIntent metadata
    if (orders.docs.length === 0 && paymentIntent.metadata?.orderId) {
        orders = await payload.find({
            collection: 'orders',
            where: { id: { equals: paymentIntent.metadata.orderId } },
            limit: 1,
        })
    }

    if (orders.docs.length === 0) {
        console.warn(`[Stripe Webhook] No order found for payment_intent ${paymentIntentId}`)
        return
    }

    const order = orders.docs[0] as unknown as OrderDoc

    // IDOR guard: connected merchant must own the payment intent they're claiming failed
    if (event.connectedAccountId) {
        const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
        const ownerTenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
        }).catch(() => null) as any
        if (ownerTenant?.stripeAccountId && ownerTenant.stripeAccountId !== event.connectedAccountId) {
            console.error(
                `[Stripe Webhook] SECURITY: forged payment_intent.payment_failed — account ${event.connectedAccountId} ≠ tenant ${String(tenantId)} account ${ownerTenant.stripeAccountId}`,
            )
            return
        }
    }

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
            stripePaymentIntentId: paymentIntentId,
        },
    })

    console.log(`[Stripe Webhook] Order ${order.id} marked as payment_failed`)

    // Fire-and-forget: notify merchant of failed payment
    import('@/lib/notifications/notify-tenant-owners')
        .then(({ notifyTenantOwners }) => {
            const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
            return notifyTenantOwners(payload, tenantId, {
                type: 'SYSTEM_ALERT',
                title: `Payment Failed - Order #${order.orderNumber}`,
                message: `Payment for order #${order.orderNumber} has failed. Customer may retry.`,
                actionUrl: '/orders',
                metadata: { orderNumber: order.orderNumber },
            })
        })
        .catch((err) => console.error('[Notification] PAYMENT_FAILED hook failed', err))
}

import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

export async function handleSubscriptionUpdated(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const subscription = event.data
    const stripeSubId = subscription.id

    const subs = await payload.find({
        collection: 'subscriptions',
        where: { stripeSubscriptionId: { equals: stripeSubId } },
        limit: 1,
    })

    if (subs.docs.length === 0) {
        console.warn(`[Stripe Webhook] No subscription found for ${stripeSubId}`)
        return
    }

    await payload.update({
        collection: 'subscriptions',
        id: subs.docs[0].id,
        data: {
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000).toISOString()
                : undefined,
            currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : undefined,
        },
    })

    console.log(`[Stripe Webhook] Subscription ${stripeSubId} updated to ${subscription.status}`)
}

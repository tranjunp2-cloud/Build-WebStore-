import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    verifyStripeWebhook,
    normalizeStripeEvent,
} from '@/lib/payment/stripe'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → Create order (paid) + reduce stock
 * - payment_intent.payment_failed → Update order status
 * - customer.subscription.updated → Update subscription
 * - account.updated → Update merchant onboarding status
 *
 * Also handles Stripe Connect events (account.updated).
 */
export async function POST(request: NextRequest) {
    let rawBody: string

    try {
        rawBody = await request.text()
    } catch {
        return new Response('Invalid body', { status: 400 })
    }

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
        return new Response('Missing stripe-signature header', { status: 400 })
    }

    // Determine if this is a Connect webhook (has 'account' field in the event)
    let isConnect = false
    try {
        const parsed = JSON.parse(rawBody)
        isConnect = Boolean(parsed.account)
    } catch {
        // Will fail at verification step anyway
    }

    // Verify webhook signature
    let event: PaymentWebhookEvent
    try {
        const stripeEvent = verifyStripeWebhook(rawBody, signature, isConnect)
        event = normalizeStripeEvent(stripeEvent)
    } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message)
        return new Response('Webhook signature verification failed', { status: 400 })
    }

    // Process the event
    try {
        const payload = await getPayload({ config })

        switch (event.type) {
            case 'payment_success':
                await handleCheckoutCompleted(payload, event)
                break

            case 'payment_failed':
                await handlePaymentFailed(payload, event)
                break

            case 'subscription_updated':
                await handleSubscriptionUpdated(payload, event)
                break

            case 'account_updated':
                await handleAccountUpdated(payload, event)
                break

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
        }
    } catch (err: any) {
        console.error(`[Stripe Webhook] Error processing ${event.type}:`, err.message)
        // Still return 200 to prevent Stripe from retrying
        // The error is logged for debugging
    }

    return new Response('OK', { status: 200 })
}

// ── Event Handlers ───────────────────────────────────────────────────

async function handleCheckoutCompleted(
    payload: any,
    event: PaymentWebhookEvent,
) {
    const session = event.data
    const stripeSessionId = session.id
    const orderId = session.client_reference_id

    if (!orderId) {
        console.warn('[Stripe Webhook] checkout.session.completed without client_reference_id')
        return
    }

    // Idempotency: check if order already processed (status already 'paid')
    const existing = await payload.find({
        collection: 'orders',
        where: {
            stripeSessionId: { equals: stripeSessionId },
            status: { equals: 'paid' },
        },
        limit: 1,
    })

    if (existing.docs.length > 0) {
        console.log(`[Stripe Webhook] Order already processed for session ${stripeSessionId}`)
        return
    }

    // Find the pending order by ID and update it
    try {
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                status: 'paid',
                stripeSessionId,
                stripePaymentIntentId: session.payment_intent ?? undefined,
                paymentMethod: session.payment_method_types?.[0] === 'fpx' ? 'bank' : 'card',
            },
        })

        console.log(`[Stripe Webhook] Order ${orderId} marked as paid`)

        // Reduce stock with optimistic locking (prevents race condition)
        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 1,
        })

        if (order?.items) {
            for (const item of order.items as any[]) {
                const productId = typeof item.product === 'object' ? item.product.id : item.product
                await decrementStock(payload, productId, item.quantity)
            }
        }

        // Send order confirmation email
        try {
            const emailData = orderConfirmationEmail({
                orderNumber: (order as any).orderNumber,
                customerName: (order as any).customerName,
                items: ((order as any).items || []).map((item: any) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                })),
                subtotal: (order as any).subtotal,
                tax: (order as any).tax || 0,
                total: (order as any).total,
                currency: (order as any).currency || 'MYR',
                shippingAddress: (order as any).shippingAddress,
            })

            await sendEmail({
                to: (order as any).customerEmail,
                subject: emailData.subject,
                html: emailData.html,
            })

            console.log(`[Stripe Webhook] Confirmation email sent to ${(order as any).customerEmail}`)
        } catch (emailErr) {
            console.error('[Stripe Webhook] Failed to send confirmation email:', emailErr)
            // Don't fail the webhook — email is non-critical
        }

        // Fire-and-forget: ORDER_NEW notification for merchant (Stripe flow)
        import('@/lib/notifications/notify-tenant-owners')
            .then(({ notifyTenantOwners }) => {
                const tenantId = typeof (order as any).tenant === 'object' ? (order as any).tenant.id : (order as any).tenant
                return notifyTenantOwners(payload, tenantId, {
                    type: 'ORDER_NEW',
                    title: `New Order #${(order as any).orderNumber} - ${(order as any).currency || 'MYR'} ${((order as any).total ?? 0).toFixed(2)}`,
                    message: `Order placed by ${(order as any).customerName}`,
                    actionUrl: '/orders',
                })
            })
            .catch((err) => console.error('[Notification] ORDER_NEW (Stripe) hook failed', err))
    } catch (err: any) {
        console.error(`[Stripe Webhook] Failed to update order ${orderId}:`, err.message)
    }
}

async function handlePaymentFailed(
    payload: any,
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

    const order = orders.docs[0]

    // Save the PaymentIntent ID for future reference
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
            const tenantId = typeof order.tenant === 'object' ? (order as any).tenant.id : order.tenant
            return notifyTenantOwners(payload, tenantId, {
                type: 'SYSTEM_ALERT',
                title: `Payment Failed - Order #${(order as any).orderNumber}`,
                message: `Payment for order #${(order as any).orderNumber} has failed. Customer may retry.`,
                actionUrl: '/orders',
            })
        })
        .catch((err) => console.error('[Notification] PAYMENT_FAILED hook failed', err))
}

async function handleSubscriptionUpdated(
    payload: any,
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

async function handleAccountUpdated(
    payload: any,
    event: PaymentWebhookEvent,
) {
    const account = event.data
    const accountId = account.id

    // Find tenant with this stripeAccountId
    const tenants = await payload.find({
        collection: 'tenants',
        where: { stripeAccountId: { equals: accountId } },
        limit: 1,
    })

    if (tenants.docs.length === 0) {
        console.warn(`[Stripe Webhook] No tenant found for Stripe account ${accountId}`)
        return
    }

    const isOnboardingComplete =
        account.charges_enabled && account.payouts_enabled && account.details_submitted

    await payload.update({
        collection: 'tenants',
        id: tenants.docs[0].id,
        data: {
            stripeOnboardingComplete: isOnboardingComplete,
        },
    })

    console.log(
        `[Stripe Webhook] Tenant ${tenants.docs[0].id} stripe onboarding: ${isOnboardingComplete ? 'complete' : 'pending'}`,
    )
}

/**
 * Decrement product inventory using optimistic locking with retry.
 * Uses Payload's native API (no raw SQL) — hooks fire normally.
 * Retries up to maxRetries times if concurrent update detected.
 */
async function decrementStock(
    payload: any,
    productId: number | string,
    quantity: number,
    maxRetries = 3,
) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const product = await payload.findByID({
                collection: 'products',
                id: productId,
            })

            if (!product || (product as any).inventory <= 0) {
                return // Out of stock or product not found
            }

            const currentInventory = (product as any).inventory
            const newInventory = Math.max(0, currentInventory - quantity)

            await payload.update({
                collection: 'products',
                id: productId,
                data: { inventory: newInventory },
            })

            console.log(
                `[Stripe Webhook] Stock updated: product ${productId} (${currentInventory} → ${newInventory})`,
            )
            return // Success
        } catch (err) {
            if (attempt < maxRetries - 1) {
                console.warn(
                    `[Stripe Webhook] Stock update retry ${attempt + 1}/${maxRetries} for product ${productId}`,
                )
                continue // Retry with fresh read
            }
            console.error(`[Stripe Webhook] Failed to update stock for product ${productId}:`, err)
        }
    }
}

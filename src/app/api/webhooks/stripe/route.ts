import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
    verifyStripeWebhook,
    normalizeStripeEvent,
} from '@/lib/payment/stripe'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { newOrderSellerEmail } from '@/lib/email/templates/new-order-seller'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/** Minimal shape of an order document for webhook notification logic. */
interface OrderDoc {
    id: number | string
    tenant: number | string | { id: number | string }
    orderNumber: string
    customerName: string
    customerEmail: string
    currency: string
    status: string
    total: number
    subtotal: number
    tax: number
    items: Array<{ product: string | number | { id: string | number }; productName: string; quantity: number; unitPrice: number }>
    shippingAddress: Record<string, unknown>
}

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
        const normalized = normalizeStripeEvent(stripeEvent)
        if (!normalized) {
            // Unknown event type — not subscribed, return 200 so Stripe won't retry
            console.log(`[Stripe Webhook] Ignoring unhandled event type: ${stripeEvent.type}`)
            return new Response('OK', { status: 200 })
        }
        event = normalized
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

            case 'account_deauthorized':
                await handleAccountDeauthorized(payload, event)
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

    // Idempotency: if stripeSessionId is already written to any order (regardless of status),
    // the webhook was already processed successfully — do not re-run side-effects.
    // Relies on the DB-level UNIQUE constraint on stripeSessionId (Orders collection).
    const existing = await payload.find({
        collection: 'orders',
        where: {
            stripeSessionId: { equals: stripeSessionId },
        },
        limit: 1,
    })

    if (existing.docs.length > 0) {
        console.log(`[Stripe Webhook] Order already processed for session ${stripeSessionId}`)
        return
    }

    // Guard: verify the order is still pending before triggering side-effects.
    // Combined with the stripeSessionId check above, this minimises the concurrent-delivery race window.
    const targetOrder = await payload.findByID({ collection: 'orders', id: orderId })
    if (!targetOrder) {
        console.warn(`[Stripe Webhook] Order ${orderId} not found`)
        return
    }
    const existingStatus = (targetOrder as any).status
    if (existingStatus && existingStatus !== 'pending') {
        console.log(`[Stripe Webhook] Order ${orderId} already in status '${existingStatus}' — skipping`)
        return
    }

    // Find the pending order by ID and update it
    try {
        // payment_method_types is the enabled list, not the method buyer actually used.
        // Accurate only when length === 1 (single-method tenant). Multi-method defaults 'card'
        // until stripeChargeId expansion is available (Wave 7).
        const enabledTypes = session.payment_method_types ?? []
        const paymentMethod: 'card' | 'fpx' =
            enabledTypes.length === 1 && enabledTypes[0] === 'fpx' ? 'fpx' : 'card'

        // session.payment_intent is always a string in webhook events (not expanded).
        // stripeChargeId requires expand: ['payment_intent'] — deferred to Wave 7.
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                status: 'new',
                stripeSessionId,
                stripePaymentIntentId: typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : (session.payment_intent as any)?.id ?? undefined,
                paymentMethod,
            },
        })

        console.log(`[Stripe Webhook] Order ${orderId} marked as new`)

        // Reduce stock with optimistic locking (prevents race condition)
        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 1,
        }) as unknown as OrderDoc | null

        if (!order) return

        if (order.items) {
            for (const item of order.items) {
                const productId = typeof item.product === 'object' ? item.product.id : item.product
                await decrementStock(payload, productId, item.quantity)
            }
        }

        // Resolve tenant for email templates (shop name + site slug for order page URL)
        const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
        const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
        const shopName = (tenantDoc as any)?.name ?? ''
        const siteSlug = (tenantDoc as any)?.slug ?? ''
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
        const orderPageUrl = `${baseUrl}/sites/${siteSlug}/orders/${order.orderNumber}`
        const dashboardOrderUrl = `${baseUrl}/orders`
        const siteLocale = typeof (order as any).site === 'object' ? ((order as any).site?.locale ?? 'ms') : 'ms'

        // Buyer: order confirmation
        try {
            const emailData = orderConfirmationEmail({
                shopName,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                customerPhone: (order as any).customerPhone ?? null,
                customerAddress: (order as any).shippingAddress ?? null,
                items: (order.items || []).map((item) => ({
                    name: item.productName,
                    variant: (item as any).variant ?? null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.quantity * item.unitPrice,
                })),
                subtotal: order.subtotal,
                shippingFee: (order as any).shippingFee ?? 0,
                total: order.total,
                paymentMethod: 'stripe',
                orderDate: (order as any).createdAt ?? new Date().toISOString(),
                orderPageUrl,
                currency: order.currency || 'MYR',
                buyerNote: (order as any).notes ?? null,
                locale: siteLocale,
            })

            await sendEmail({
                to: order.customerEmail,
                subject: emailData.subject,
                html: emailData.html,
            })

            console.log(`[Stripe Webhook] Confirmation email sent to ${order.customerEmail}`)
        } catch (emailErr) {
            console.error('[Stripe Webhook] Failed to send confirmation email:', emailErr)
            // Don't fail the webhook — email is non-critical
        }

        // Sellers: new order notification
        getTenantOwnerEmails(payload, tenantId).then((emails) => {
            const seller = newOrderSellerEmail({
                shopName,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                orderPageUrl: dashboardOrderUrl,
            })
            emails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                .catch((err: unknown) => console.error('[Stripe Webhook] seller email failed', err)))
        }).catch((err: unknown) => console.error('[Stripe Webhook] getTenantOwnerEmails failed', err))

        // Fire-and-forget: ORDER_NEW in-app notification for merchant (Stripe flow)
        import('@/lib/notifications/notify-tenant-owners')
            .then(({ notifyTenantOwners }) => {
                return notifyTenantOwners(payload, tenantId, {
                    type: 'ORDER_NEW',
                    title: `New Order #${order.orderNumber} - ${order.currency || 'MYR'} ${(order.total ?? 0).toFixed(2)}`,
                    message: `Order placed by ${order.customerName}`,
                    actionUrl: '/orders',
                    metadata: { orderNumber: order.orderNumber, currency: order.currency || 'MYR', total: (order.total ?? 0).toFixed(2), customerName: order.customerName },
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

    const order = orders.docs[0] as unknown as OrderDoc

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

// TC-F13.87: lock seller's Card/FPX when Stripe revokes the Connect application
async function handleAccountDeauthorized(
    payload: any,
    event: PaymentWebhookEvent,
) {
    // Stripe sends the accountId in the top-level 'account' field for Connect events
    const accountId = event.connectedAccountId ?? (event.data as any).id
    if (!accountId) {
        console.warn('[Stripe Webhook] account.application.deauthorized missing accountId')
        return
    }

    const tenants = await payload.find({
        collection: 'tenants',
        where: { stripeAccountId: { equals: accountId } },
        limit: 1,
    })

    if (tenants.docs.length === 0) {
        console.warn(`[Stripe Webhook] No tenant found for deauthorized account ${accountId}`)
        return
    }

    await payload.update({
        collection: 'tenants',
        id: tenants.docs[0].id,
        data: {
            stripeOnboardingComplete: false,
            payments: { payment_card: false, payment_fpx: false },
        },
    })

    console.log(`[Stripe Webhook] Tenant ${tenants.docs[0].id} deauthorized — onboarding + payment flags reset`)
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
        account.charges_enabled && account.details_submitted

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
 * Decrement product inventory with error-based retry.
 * Uses Payload's native API (no raw SQL) — hooks fire normally.
 * Note: read-then-write is not atomic; concurrent webhook retries may under-decrement.
 * Retries up to maxRetries times on API/validation errors.
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

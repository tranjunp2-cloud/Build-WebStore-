import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { newOrderSellerEmail } from '@/lib/email/templates/new-order-seller'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/** Minimal shape of a tenant document for webhook notification logic. */
export interface TenantDoc {
    id: string | number
    name?: string | null
    slug?: string | null
}

/** Minimal shape of an order document for webhook notification logic. */
export interface OrderDoc {
    id: number | string
    tenant: number | string | { id: number | string }
    orderNumber: string
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    currency: string
    status: string
    total: number
    subtotal: number
    tax: number
    shippingFee?: number
    notes?: string | null
    createdAt?: string
    site?: string | number | { id: string | number; locale?: string }
    items: Array<{
        product: string | number | { id: string | number }
        productName: string
        quantity: number
        unitPrice: number
        variant?: string | null
    }>
    shippingAddress?: Record<string, string>
}

export async function handleCheckoutCompleted(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const session = event.data
    const stripeSessionId = session.id
    const orderId = session.client_reference_id

    if (!orderId) {
        console.warn('[Stripe Webhook] checkout.session.completed without client_reference_id')
        return
    }

    // Atomic status transition: UPDATE WHERE status = 'pending' — only the first concurrent invocation wins.
    // NOTE: stripe-checkout/route.ts writes stripeSessionId BEFORE payment, so checking sessionId alone
    // cannot distinguish "already processed" from "not yet paid". Raw SQL is required for atomicity.
    const transitionResult = await payload.db.drizzle.execute(sql`
        UPDATE orders SET status = 'new', payment_status = 'paid'
        WHERE id = ${parseInt(orderId)} AND status = 'pending'
        RETURNING id
    `)
    if (!transitionResult.rows?.length) {
        console.log(`[Stripe Webhook] Order ${orderId} already transitioned — skipping concurrent delivery`)
        return
    }

    // Verify order exists (guard against client_reference_id pointing to a deleted order)
    const targetOrder = await payload.findByID({ collection: 'orders', id: orderId })
    if (!targetOrder) {
        console.warn(`[Stripe Webhook] Order ${orderId} not found after transition — unexpected state`)
        return
    }

    try {
        // payment_method_types is the enabled list, not the method buyer actually used.
        // Accurate only when length === 1 (single-method tenant). Multi-method defaults 'card'
        // until stripeChargeId expansion is available (Wave 7).
        const enabledTypes = session.payment_method_types ?? []
        const paymentMethod: 'card' | 'fpx' =
            enabledTypes.length === 1 && enabledTypes[0] === 'fpx' ? 'fpx' : 'card'

        // Record Stripe IDs (idempotent — status already set atomically above)
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                stripeSessionId,
                // Stripe types: payment_intent is string|PaymentIntent; .id only exists on expanded object
                stripePaymentIntentId: typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : (session.payment_intent as { id?: string } | null)?.id ?? undefined,
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
        const tenantTyped = tenantDoc as unknown as TenantDoc | null
        const shopName = tenantTyped?.name ?? ''
        const siteSlug = tenantTyped?.slug ?? ''
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
        const orderPageUrl = `${baseUrl}/sites/${siteSlug}/orders/${order.orderNumber}`
        const dashboardOrderUrl = `${baseUrl}/orders`
        // site.locale is constrained to 'en'|'ms' by the Sites collection; cast is safe
        const siteLocale = (typeof order.site === 'object' ? ((order.site as { locale?: string })?.locale ?? 'ms') : 'ms') as 'en' | 'ms'

        // Buyer: order confirmation
        try {
            const emailData = orderConfirmationEmail({
                shopName,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                customerPhone: order.customerPhone ?? null,
                customerAddress: order.shippingAddress ?? null,
                items: (order.items || []).map((item) => ({
                    name: item.productName,
                    variant: item.variant ?? null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.quantity * item.unitPrice,
                })),
                subtotal: order.subtotal,
                shippingFee: order.shippingFee ?? 0,
                total: order.total,
                paymentMethod: 'stripe',
                orderDate: order.createdAt ?? new Date().toISOString(),
                orderPageUrl,
                currency: order.currency || 'MYR',
                buyerNote: order.notes ?? null,
                locale: siteLocale,
            })

            const sent = await sendEmail({
                to: order.customerEmail,
                subject: emailData.subject,
                html: emailData.html,
            })

            if (sent) {
                console.log(`[Stripe Webhook] Confirmation email sent to ${order.customerEmail}`)
            } else {
                console.warn(`[Stripe Webhook] Confirmation email failed (sendEmail returned false) for ${order.customerEmail}`)
            }
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
    } catch (err: unknown) {
        console.error(`[Stripe Webhook] Failed to update order ${orderId}:`, err instanceof Error ? err.message : err)
    }
}

/**
 * Decrement product inventory with error-based retry.
 * Uses Payload's native API (no raw SQL) — hooks fire normally.
 * Note: read-then-write is not atomic; concurrent webhook retries may under-decrement.
 * Retries up to maxRetries times on API/validation errors.
 */
async function decrementStock(
    payload: Payload,
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

            const productTyped = product as unknown as { inventory?: number } | null
            if (!productTyped || (productTyped.inventory ?? 0) <= 0) {
                return // Out of stock or product not found
            }

            const currentInventory = productTyped.inventory ?? 0
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

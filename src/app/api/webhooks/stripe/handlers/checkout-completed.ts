import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { newOrderSellerEmail } from '@/lib/email/templates/new-order-seller'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import type { PaymentWebhookEvent } from '@/lib/payment/types'
import { verifyConnectedAccountOwnership } from './verify-account-ownership'

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

    // Direct Charges: every legitimate checkout.session.completed must carry a connectedAccountId.
    // A platform-level event for this handler is unexpected and likely misconfigured or forged.
    if (!event.connectedAccountId) {
        console.error('[Stripe Webhook] SECURITY: checkout.session.completed without connectedAccountId — Direct Charges require connected account context; rejecting')
        return
    }

    const stripeSessionId = session.id
    const orderId = session.client_reference_id

    if (!orderId) {
        console.warn('[Stripe Webhook] checkout.session.completed without client_reference_id')
        return
    }
    if (!/^\d+$/.test(orderId)) {
        console.warn('[Stripe Webhook] invalid client_reference_id (non-numeric):', orderId)
        return
    }
    const orderIdInt = parseInt(orderId, 10)

    // IDOR guard: verify the connected Stripe account that fired this webhook owns the order's tenant.
    // Runs before any writes — fail-closed (unknown order or missing stripeAccountId both reject).
    // Note: the connectedAccountId guard at the top of this function already ensures this block always runs.
    const preCheckResult = await payload.find({
        collection: 'orders',
        where: { id: { equals: orderIdInt } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
    }).catch(() => null)
    const preCheckDoc = preCheckResult?.docs[0] as any
    if (!preCheckDoc) {
        console.warn(`[Stripe Webhook] connected-account event for unknown order ${orderIdInt} — skipping`)
        return
    }
    const ownerTenantId = typeof preCheckDoc.tenant === 'object' ? preCheckDoc.tenant.id : preCheckDoc.tenant
    if (!ownerTenantId) {
        console.warn(`[Stripe Webhook] connected-account event for order ${orderIdInt} with no tenant — skipping`)
        return
    }
    const allowed = await verifyConnectedAccountOwnership(
        payload, event.connectedAccountId, ownerTenantId, `checkout.session.completed order ${orderIdInt}`,
    )
    if (!allowed) return

    // Atomic status transition: UPDATE WHERE status = 'pending' — only the first concurrent invocation wins.
    // NOTE: stripe-checkout/route.ts writes stripeSessionId BEFORE payment, so checking sessionId alone
    // cannot distinguish "already processed" from "not yet paid". Raw SQL is required for atomicity.
    const transitionResult = await payload.db.drizzle.execute(sql`
        UPDATE orders SET status = 'new', payment_status = 'paid'
        WHERE id = ${orderIdInt} AND status = 'pending'
        RETURNING id
    `)
    if (!transitionResult.rows?.length) {
        console.log(`[Stripe Webhook] Order ${orderId} already transitioned — skipping concurrent delivery`)
        return
    }

    // Verify order exists (guard against client_reference_id pointing to a deleted order)
    const targetOrder = await payload.findByID({ collection: 'orders', id: orderIdInt })
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
            id: orderIdInt,
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

        const order = await payload.findByID({
            collection: 'orders',
            id: orderIdInt,
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
            const [buyerCmsConfig, sellerCmsConfig] = await Promise.all([
                getTemplateConfig(tenantId, 'order-confirmation', 'buyer'),
                getTemplateConfig(tenantId, 'new-order-seller', 'seller'),
            ])

            if (buyerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-confirmation (Stripe)')
            } else {
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
                }, buyerCmsConfig ?? undefined)

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
            }

            // Sellers: new order notification
            if (sellerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): new-order-seller (Stripe)')
            } else {
                getTenantOwnerEmails(payload, tenantId).then((emails) => {
                    const seller = newOrderSellerEmail({
                        shopName,
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        orderPageUrl: dashboardOrderUrl,
                    }, sellerCmsConfig ?? undefined)
                    emails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                        .catch((err: unknown) => console.error('[Stripe Webhook] seller email failed', err)))
                }).catch((err: unknown) => console.error('[Stripe Webhook] getTenantOwnerEmails failed', err))
            }
        } catch (emailErr) {
            console.error('[Stripe Webhook] Failed to send confirmation email:', emailErr)
            // Don't fail the webhook — email is non-critical
        }

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

/** Atomically decrement product inventory — safe for concurrent webhook deliveries. */
async function decrementStock(
    payload: Payload,
    productId: number | string,
    quantity: number,
) {
    try {
        await (payload.db.drizzle as any).execute(sql`
            UPDATE products
            SET inventory = GREATEST(0, inventory - ${quantity})
            WHERE id = ${productId}
            AND inventory IS NOT NULL
        `)
        console.log(`[Stripe Webhook] Stock decremented: product ${productId} -${quantity}`)
    } catch (err) {
        console.error(`[Stripe Webhook] Failed to update stock for product ${productId}:`, err)
    }
}

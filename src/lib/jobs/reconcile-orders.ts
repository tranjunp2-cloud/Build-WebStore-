import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { reconcileOrderPaid } from '@/lib/payment/reconcile-order-paid'
import { retrieveCheckoutSession } from '@/lib/payment/stripe'
import { orderExpiredEmail } from '@/lib/email/templates/order-expired'

export async function reconcileOrdersJob(payload: Payload, opts = { limit: 200 }) {
    const now = Date.now()
    // Find Stripe pending orders older than 15 min (webhook grace window)
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString()

    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { status: { equals: 'pending' } },
                { paymentMethod: { in: ['card', 'fpx'] } },
                { createdAt: { less_than: fifteenMinAgo } },
            ],
        },
        depth: 1,           // resolve tenant.stripeAccountId
        limit: opts.limit,
        overrideAccess: true,
    })

    let reconciled = 0, expired = 0, skipped = 0, errors = 0

    for (const order of result.docs as any[]) {
        try {
            const connectedAccountId = order.tenant?.stripeAccountId  // depth:1 object
            const sessionId = order.stripeSessionId
            const ageMs = now - new Date(order.createdAt).getTime()

            if (sessionId && connectedAccountId) {
                const session = await retrieveCheckoutSession(sessionId, connectedAccountId)
                if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
                    const r = await reconcileOrderPaid(payload, {
                        orderId: Number(order.id),
                        session,
                        connectedAccountId,
                        source: 'cron',
                    })
                    if (r.status === 'reconciled') reconciled++; else skipped++
                    continue
                }
            }

            // Not paid at Stripe (or no session). Expire only if > 24h.
            if (ageMs > 24 * 60 * 60 * 1000) {
                // Atomic CAS — only first invocation transitions; mirrors payment-expiry.ts pattern.
                const upd = await (payload.db.drizzle as any).execute(sql`
                    UPDATE orders SET status = 'cancelled'::enum_orders_status,
                        payment_status = 'payment_failed',
                        cancel_reason = 'Auto-cancelled: payment not confirmed within 24h'
                    WHERE id = ${order.id} AND status = 'pending'
                      AND payment_status IN ('awaiting_payment', 'failed', 'payment_failed')
                    RETURNING id
                `)

                if (upd.rows?.length) {
                    expired++
                    // Resolve siteSlug/shopName from depth:1 tenant; fire-and-forget email.
                    const tenantObj = order.tenant && typeof order.tenant === 'object' ? order.tenant : null
                    const siteSlug = tenantObj?.slug ?? ''
                    const shopName = tenantObj?.name ?? siteSlug
                    // tenant has no locale — fall back to 'ms' (same default as payment-expiry.ts)
                    const siteLocale = 'ms'
                    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
                    const reorderUrl = siteSlug ? `${baseUrl}/sites/${siteSlug}/products` : `${baseUrl}/`

                    const cancellationDate = new Date().toISOString()
                    const elapsedMs = order.createdAt ? Date.now() - new Date(order.createdAt).getTime() : null
                    const elapsedTime = elapsedMs != null
                        ? `${Math.floor(elapsedMs / 3600000)} jam ${Math.floor((elapsedMs % 3600000) / 60000)} minit`
                        : null

                    const orderItems = ((order.items ?? []) as any[]).map((item: any) => ({
                        name: item.productName ?? item.name ?? '',
                        variant: item.variant ?? null,
                        quantity: item.quantity ?? 1,
                        unitPrice: item.unitPrice ?? 0,
                        lineTotal: (item.quantity ?? 1) * (item.unitPrice ?? 0),
                    }))

                    if (order.customerEmail) {
                        const emailTemplate = orderExpiredEmail({
                            shopName,
                            orderNumber: order.orderNumber,
                            customerName: order.customerName,
                            customerEmail: order.customerEmail ?? '',
                            customerPhone: order.customerPhone ?? null,
                            customerAddress: order.shippingAddress ?? null,
                            items: orderItems,
                            subtotal: order.subtotal ?? 0,
                            shippingFee: order.shippingFee ?? 0,
                            total: order.total,
                            currency: order.currency,
                            orderDate: order.createdAt,
                            cancellationDate,
                            elapsedTime,
                            reorderUrl,
                            locale: siteLocale,
                        })
                        payload
                            .sendEmail({ to: order.customerEmail, subject: emailTemplate.subject, html: emailTemplate.html })
                            .catch((e: unknown) =>
                                payload.logger.error({ err: e, orderId: order.id }, 'reconcile-orders expired email failed'),
                            )
                    }
                } else {
                    skipped++
                }
            } else {
                skipped++
            }
        } catch (e: unknown) {
            payload.logger.error({ err: e, orderId: order.id }, 'reconcile-orders failed')
            errors++
        }
    }

    if (result.totalDocs > opts.limit) {
        console.error(`[reconcile-orders] batch limit ${opts.limit} of ${result.totalDocs}`)
    }

    return { reconciled, expired, skipped, errors, total: result.totalDocs }
}

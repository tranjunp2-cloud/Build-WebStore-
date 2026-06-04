import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'
import { orderExpiredEmail } from '@/lib/email/templates/order-expired'
import { restockItem } from '@/app/api/orders/lib/stock-utils'

export async function paymentExpiryJob(payload: Payload, opts = { limit: 200 }) {
    const now = new Date().toISOString()
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { paymentMethod: { in: ['bank_transfer', 'card', 'fpx'] } },
                { paymentStatus: { in: ['awaiting_payment', 'pending_verification', 'payment_failed', 'failed'] } },
                { paymentExpiresAt: { less_than: now } },
            ],
        },
        sort: 'paymentExpiresAt',
        limit: opts.limit,
        depth: 2,           // depth:2 to resolve site.tenant.slug for productListUrl
        overrideAccess: true,
    })

    let processed = 0
    let errors = 0

    for (const order of result.docs as any[]) {
        try {
            // Atomic guard: only the first concurrent invocation wins.
            // status is a Postgres enum — cast explicitly; payment_status is varchar.
            const updateResult = await (payload.db.drizzle as any).execute(sql`
                UPDATE orders
                SET status = 'cancelled'::enum_orders_status,
                    payment_status = 'payment_failed',
                    cancel_reason = 'Auto-cancelled: payment not received within 24h'
                WHERE id = ${order.id}
                AND payment_status IN ('awaiting_payment', 'pending_verification', 'payment_failed', 'failed')
                AND status::text IN ('pending', 'new', 'payment_failed')
                AND payment_expires_at < ${now}
                RETURNING id
            `)
            if (!updateResult.rows?.length) {
                continue  // already processed by a concurrent cron invocation
            }

            // Restock items — stock was decremented at checkout for all payment methods.
            // Best-effort: failure logged but must not abort cancellation.
            for (const item of (order.items ?? []) as any[]) {
                const productId = typeof item.product === 'object' ? item.product?.id : item.product
                if (!productId) continue
                await restockItem(payload, productId, item.variant ?? null, item.quantity)
                    .catch((err) => payload.logger.error(
                        { err, orderId: order.id, productId },
                        '[payment-expiry] restock failed',
                    ))
            }

            // Slug lives on the tenant, not the site — sites collection has no slug field
            const siteObj = typeof order.site === 'object' ? order.site : null
            const tenantObj = siteObj?.tenant && typeof siteObj.tenant === 'object' ? siteObj.tenant : null
            const siteSlug = (tenantObj as any)?.slug ?? ''
            const shopName = (tenantObj as any)?.name ?? siteSlug
            const siteLocale = (siteObj as any)?.locale ?? 'ms'
            const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
            const reorderUrl = siteSlug ? `${baseUrl}/sites/${siteSlug}/products` : `${baseUrl}/`

            const cancellationDate = new Date().toISOString()
            const elapsedMs = order.createdAt ? Date.now() - new Date(order.createdAt).getTime() : null
            const elapsedTime = elapsedMs != null
                ? siteLocale === 'en'
                    ? `${Math.floor(elapsedMs / 3600000)} hours ${Math.floor((elapsedMs % 3600000) / 60000)} minutes`
                    : `${Math.floor(elapsedMs / 3600000)} jam ${Math.floor((elapsedMs % 3600000) / 60000)} minit`
                : null

            const orderItems = ((order.items ?? []) as any[]).map((item: any) => ({
                name: item.productName ?? item.name ?? '',
                variant: item.variant ?? null,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice ?? 0,
                lineTotal: (item.quantity ?? 1) * (item.unitPrice ?? 0),
            }))

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
            if (order.customerEmail) {
                payload
                    .sendEmail({ to: order.customerEmail, subject: emailTemplate.subject, html: emailTemplate.html })
                    .catch((e: unknown) =>
                        payload.logger.error({ err: e, orderId: order.id }, 'order-expired email failed'),
                    )
            }

            processed++
        } catch (e: unknown) {
            payload.logger.error({ err: e, orderId: order.id }, 'payment-expiry update failed')
            errors++
        }
    }

    if (result.totalDocs > opts.limit) {
        console.error(`[payment-expiry] Batch limit reached: processed ${opts.limit} of ${result.totalDocs} — ${result.totalDocs - opts.limit} orders skipped this run; increase limit or add pagination`)
    }

    return { processed, errors, total: result.totalDocs }
}

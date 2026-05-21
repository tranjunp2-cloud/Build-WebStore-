import type { Payload } from 'payload'
import { orderExpiredEmail } from '@/lib/email/templates/order-expired'

export async function paymentExpiryJob(payload: Payload, opts = { limit: 200 }) {
    const now = new Date().toISOString()
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { paymentMethod: { equals: 'bank_transfer' } },
                { paymentStatus: { in: ['awaiting_payment', 'pending_verification'] } },
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
            await payload.update({
                collection: 'orders',
                id: order.id,
                data: {
                    status: 'cancelled',
                    paymentStatus: 'cancelled',
                    cancelReason: 'Auto-cancelled: payment not received within 24h',
                },
                overrideAccess: true,
            })

            // Slug lives on the tenant, not the site — sites collection has no slug field
            const siteObj = typeof order.site === 'object' ? order.site : null
            const tenantObj = siteObj?.tenant && typeof siteObj.tenant === 'object' ? siteObj.tenant : null
            const siteSlug = (tenantObj as any)?.slug ?? ''
            const shopName = (tenantObj as any)?.name ?? siteSlug
            const siteLocale = (siteObj as any)?.locale ?? 'ms'
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
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
            payload
                .sendEmail({ to: order.customerEmail, subject: emailTemplate.subject, html: emailTemplate.html })
                .catch((e: unknown) =>
                    payload.logger.error({ err: e, orderId: order.id }, 'order-expired email failed'),
                )

            processed++
        } catch (e: unknown) {
            payload.logger.error({ err: e, orderId: order.id }, 'payment-expiry update failed')
            errors++
        }
    }

    return { processed, errors, total: result.totalDocs }
}

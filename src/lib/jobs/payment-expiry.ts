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
        depth: 1,
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

            const siteSlug = typeof order.site === 'object' ? order.site?.slug : ''
            payload
                .sendEmail(
                    orderExpiredEmail({
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        total: order.total,
                        currency: order.currency,
                        productListUrl: siteSlug
                            ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/sites/${siteSlug}/products`
                            : `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/`,
                    }),
                )
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

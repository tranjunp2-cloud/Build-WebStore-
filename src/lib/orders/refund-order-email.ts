import type { Payload } from 'payload'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

/** Builds and fires the refund confirmation email (fire-and-forget; the caller does not wait for delivery). */
export async function sendRefundEmail(payload: Payload, order: any): Promise<void> {
    if (!order.customerEmail) return
    const tenant = typeof order.tenant === 'object' ? order.tenant : null
    const tenantId = tenant ? String((tenant as any).id) : null
    const refundLocale: 'en' | 'ms' = (
        (order as any).locale
        ?? (typeof order.site === 'object' ? (order.site as any)?.locale : null)
        ?? 'en'
    ) as 'en' | 'ms'
    const cmsConfig = tenantId
        ? await getTemplateConfig(tenantId, 'order-refunded', 'buyer', refundLocale).catch(() => null)
        : null
    if (cmsConfig?.enabled === false) return
    const shopName = tenant?.name ?? 'Shop'
    const siteSlug = tenant?.slug ?? ''
    const email = orderRefundedEmail({
        shopName,
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? '',
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone ?? null,
        customerAddress: order.shippingAddress ?? null,
        items: (order.items ?? []).map((item: any) => ({
            name: item.productName ?? item.name ?? '',
            variant: item.variant ?? null,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            lineTotal: item.lineTotal ?? 0,
        })),
        subtotal: order.subtotal ?? 0,
        shippingFee: order.shippingFee ?? 0,
        total: order.total ?? 0,
        refundAmount: order.total ?? 0,
        paymentMethod: order.paymentMethod ?? 'stripe',
        orderDate: order.createdAt,
        refundDate: new Date().toISOString(),
        shopUrl: buildStorefrontUrl(siteSlug),
        currency: order.currency ?? 'MYR',
        locale: refundLocale,
    }, cmsConfig ?? undefined)
    payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
        .catch((err: unknown) => payload.logger.error({ err }, '[Refund] sendEmail failed'))
}

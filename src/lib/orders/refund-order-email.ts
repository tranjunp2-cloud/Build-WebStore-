import type { Payload } from 'payload'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'
import { refundEmailOrderLines } from './refund-email-order-lines'

/** Builds and fires the refund confirmation email (fire-and-forget; the caller does not wait for delivery). */
export async function sendRefundEmail(payload: Payload, order: any, refundNote: string | null = null): Promise<void> {
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
        ...refundEmailOrderLines(order),
        refundAmount: order.total ?? 0,
        paymentMethod: order.paymentMethod ?? 'stripe',
        orderDate: order.createdAt,
        refundDate: new Date().toISOString(),
        refundNote,
        shopUrl: buildStorefrontUrl(siteSlug),
        currency: order.currency ?? 'MYR',
        locale: refundLocale,
    }, cmsConfig ?? undefined)
    payload.sendEmail({ to: order.customerEmail, subject: email.subject, html: email.html })
        .catch((err: unknown) => payload.logger.error({ err }, '[Refund] sendEmail failed'))
}

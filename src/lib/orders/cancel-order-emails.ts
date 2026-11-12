import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderRefundedEmail } from '@/lib/email/templates/order-refunded'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'
import { refundEmailOrderLines } from './refund-email-order-lines'

/**
 * The buyer emails of a cancelled order. Always the order-cancelled email; a Xendit refund is confirmed
 * synchronously, so its order-refunded email goes now (Stripe's goes from the charge.refunded webhook).
 * Never throws: an email problem must not fail the cancellation.
 */
export async function sendCancelEmails(
    payload: import('payload').Payload,
    updated: Record<string, any>,
    reason: string,
    xenditRefundId: string | undefined,
): Promise<void> {
    // Xendit paid orders: also send order-refunded immediately (refund confirmed synchronously;
    // no Xendit refund webhook exists to send it later).
    // Stripe paid orders: charge.refunded webhook sends order-refunded after Stripe confirms.
    const customerEmail = (updated as any).customerEmail
    if (customerEmail) {
        try {
            const tenantId = typeof (updated as any).tenant === 'object'
                ? (updated as any).tenant.id
                : (updated as any).tenant
            const buyerLocale: 'en' | 'ms' = (
                (updated as any).locale
                ?? (typeof (updated as any).site === 'object' ? (updated as any).site?.locale : null)
                ?? 'en'
            ) as 'en' | 'ms'
            const [tenant, cancelCmsConfig] = await Promise.all([
                tenantId
                    ? payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                    : Promise.resolve(null),
                tenantId
                    ? getTemplateConfig(tenantId, 'order-cancelled', 'buyer', buyerLocale).catch(() => null)
                    : Promise.resolve(null),
            ])

            const shopName = (tenant as any)?.name ?? ''
            const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
            const shopUrl = buildStorefrontUrl(shopSlug)
            const emailItems = ((updated as any).items ?? []).map((item: any) => ({
                name: item.productName,
                variant: item.variant || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.quantity * item.unitPrice,
            }))

            if (cancelCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-cancelled (cancel route)')
            } else {
                const cancelEmail = orderCancelledEmail({
                    shopName,
                    orderNumber: (updated as any).orderNumber ?? String(updated.id),
                    customerName: (updated as any).customerName ?? '',
                    customerEmail,
                    customerPhone: (updated as any).customerPhone ?? null,
                    customerAddress: (updated as any).shippingAddress ?? null,
                    items: emailItems,
                    subtotal: (updated as any).subtotal ?? 0,
                    shippingFee: (updated as any).shippingFee ?? 0,
                    total: (updated as any).total ?? 0,
                    paymentMethod: (updated as any).paymentMethod ?? 'cod',
                    orderDate: (updated as any).createdAt,
                    cancellationDate: new Date().toISOString(),
                    cancellationNote: reason ?? null,
                    shopUrl,
                    currency: (updated as any).currency ?? 'MYR',
                    locale: buyerLocale,
                }, cancelCmsConfig ?? undefined)
                payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                    .catch((err: unknown) => console.warn('[Order Cancel] Failed to send cancelled email:', err))
            }

            // Xendit refund confirmed synchronously — send refund email immediately.
            // (Stripe refund email is sent by the charge.refunded webhook instead.)
            if (xenditRefundId) {
                const refundCmsConfig = tenantId
                    ? await getTemplateConfig(tenantId, 'order-refunded', 'buyer', buyerLocale).catch(() => null)
                    : null
                if (refundCmsConfig?.enabled !== false) {
                    const refundEmail = orderRefundedEmail({
                        shopName,
                        orderNumber: (updated as any).orderNumber ?? String(updated.id),
                        customerName: (updated as any).customerName ?? '',
                        customerEmail,
                        customerPhone: (updated as any).customerPhone ?? null,
                        customerAddress: (updated as any).shippingAddress ?? null,
                        ...refundEmailOrderLines(updated),
                        refundAmount: (updated as any).total ?? 0,
                        paymentMethod: (updated as any).paymentMethod ?? 'bank_transfer',
                        orderDate: (updated as any).createdAt,
                        refundDate: new Date().toISOString(),
                        shopUrl,
                        currency: (updated as any).currency ?? 'MYR',
                        locale: buyerLocale,
                    }, refundCmsConfig ?? undefined)
                    payload.sendEmail({ to: customerEmail, subject: refundEmail.subject, html: refundEmail.html })
                        .catch((err: unknown) => console.warn('[Order Cancel] Failed to send refunded email (Xendit):', err))
                }
            }
        } catch (emailErr) {
            console.warn('[Order Cancel] Failed to build email:', emailErr)
        }
    }
}

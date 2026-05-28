// NOTE: This file uses `(order as any)` and `(tenant as any)` casts throughout because
// payload-types.ts is not yet generated (Payload CMS generated types do not exist in this project).
// These casts are intentional and will be removed once `npx payload generate:types` is integrated
// into the build pipeline. See docs/tracking/OPEN_BLOCKERS.md for tracking.
import type { Payload } from 'payload'
import { orderStatusEmail } from '@/lib/email/templates/order-status'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderShippedEmail } from '@/lib/email/templates/order-shipped'
import { getTemplateConfig } from '@/lib/email/get-template-config'

interface SendEmailOptions {
    notes?: string
    trackingNumber?: string
}

/**
 * Sends a buyer notification email for a relevant order status change.
 * Fire-and-forget: email failure never rejects — all send calls use .catch().
 */
export async function sendOrderStatusEmail(
    payload: Payload,
    order: any,
    newStatus: string,
    { notes, trackingNumber }: SendEmailOptions,
): Promise<void> {
    const customerEmail = (order as any).customerEmail
    const orderNumber = (order as any).orderNumber

    if (!customerEmail) return

    if (newStatus === 'cancelled' || newStatus === 'shipped' || newStatus === 'confirmed' || newStatus === 'completed') {
        const tenantId = typeof (order as any).tenant === 'object'
            ? (order as any).tenant.id
            : (order as any).tenant
        const tenant = tenantId
            ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
            : null
        const shopName = (tenant as any)?.name ?? ''
        const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
        const siteLocale = typeof (order as any).site === 'object'
            ? ((order as any).site?.locale ?? 'ms')
            : 'ms'

        const orderItems = ((order as any).items ?? [] as Array<{ productName: string; variant?: string | null; quantity: number; unitPrice: number }>).map(
            (item: { productName: string; variant?: string | null; quantity: number; unitPrice: number }) => ({
                name: item.productName,
                variant: item.variant || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.quantity * item.unitPrice,
            }),
        )

        if (newStatus === 'confirmed' || newStatus === 'completed') {
            const cmsConfig = await getTemplateConfig(tenantId, 'order-confirmation', 'buyer')
            if (cmsConfig?.enabled === false) {
                console.log(`[Email] suppressed (disabled): order-confirmation (${newStatus})`)
            } else {
                const richEmail = orderConfirmationEmail({
                    shopName,
                    orderNumber,
                    customerName: (order as any).customerName ?? '',
                    customerEmail,
                    customerPhone: (order as any).customerPhone ?? null,
                    customerAddress: (order as any).shippingAddress ?? null,
                    items: orderItems,
                    subtotal: (order as any).subtotal ?? 0,
                    shippingFee: (order as any).shippingFee ?? 0,
                    total: (order as any).total ?? 0,
                    paymentMethod: (order as any).paymentMethod === 'cod' ? 'cod' : (order as any).paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'stripe',
                    orderDate: (order as any).createdAt,
                    orderPageUrl: `${baseUrl}/sites/${shopSlug}/orders/${orderNumber}`,
                    currency: (order as any).currency ?? 'MYR',
                    locale: siteLocale,
                    event: newStatus as 'confirmed' | 'completed',
                }, cmsConfig ?? undefined)
                payload.sendEmail({ to: customerEmail, subject: richEmail.subject, html: richEmail.html })
                    .catch((err: unknown) => console.error(`[Email ${newStatus} notify]`, err))
            }
        } else if (newStatus === 'cancelled') {
            const cmsConfig = await getTemplateConfig(tenantId, 'order-cancelled', 'buyer')
            if (cmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-cancelled')
            } else {
                const cancelEmail = orderCancelledEmail({
                    shopName,
                    orderNumber,
                    customerName: (order as any).customerName ?? '',
                    customerEmail,
                    customerPhone: (order as any).customerPhone ?? null,
                    customerAddress: (order as any).shippingAddress ?? null,
                    items: orderItems,
                    subtotal: (order as any).subtotal ?? 0,
                    shippingFee: (order as any).shippingFee ?? 0,
                    total: (order as any).total ?? 0,
                    paymentMethod: (order as any).paymentMethod ?? 'cod',
                    orderDate: (order as any).createdAt,
                    cancellationDate: new Date().toISOString(),
                    cancellationNote: notes ?? (order as any).cancelReason ?? null,
                    shopUrl: `${baseUrl}/sites/${shopSlug}`,
                    currency: (order as any).currency ?? 'MYR',
                    locale: siteLocale,
                }, cmsConfig ?? undefined)
                payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                    .catch((err: unknown) => console.error('[Email cancel notify]', err))
            }
        } else {
            // newStatus === 'shipped'
            const cmsConfig = await getTemplateConfig(tenantId, 'order-shipped', 'buyer')
            if (cmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-shipped')
            } else {
                const shippedEmail = orderShippedEmail({
                    shopName,
                    orderNumber,
                    customerName: (order as any).customerName ?? '',
                    customerEmail,
                    customerPhone: (order as any).customerPhone ?? null,
                    customerAddress: (order as any).shippingAddress ?? null,
                    items: orderItems,
                    subtotal: (order as any).subtotal ?? 0,
                    shippingFee: (order as any).shippingFee ?? 0,
                    total: (order as any).total ?? 0,
                    paymentMethod: (order as any).paymentMethod ?? 'cod',
                    shippingProvider: (order as any).shippingProvider ?? null,
                    orderDate: (order as any).createdAt,
                    shippedDate: new Date().toISOString(),
                    orderPageUrl: `${baseUrl}/sites/${shopSlug}/orders/${orderNumber}`,
                    currency: (order as any).currency ?? 'MYR',
                    locale: siteLocale,
                }, cmsConfig ?? undefined)
                payload.sendEmail({ to: customerEmail, subject: shippedEmail.subject, html: shippedEmail.html })
                    .catch((err: unknown) => console.error('[Email shipped notify]', err))
            }
        }
    } else {
        const tenantId = typeof (order as any).tenant === 'object'
            ? (order as any).tenant.id
            : (order as any).tenant
        const cmsConfig = tenantId
            ? await getTemplateConfig(tenantId, 'order-status', 'buyer')
            : null
        if (cmsConfig?.enabled === false) {
            console.log('[Email] suppressed (disabled): order-status')
        } else {
            const statusEmailData = orderStatusEmail({
                customerName: (order as any).customerName ?? '',
                orderNumber,
                status: newStatus as any,
                trackingNumber: trackingNumber ?? (order as any).trackingNumber ?? undefined,
            }, cmsConfig ?? undefined)
            payload.sendEmail({ to: customerEmail, subject: statusEmailData.subject, html: statusEmailData.html })
                .catch((err: unknown) => console.error('[Email status notify]', err))
        }
    }
}

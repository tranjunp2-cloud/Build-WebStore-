import type { Payload } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

/** Minimal tenant shape for email templates. */
interface TenantDoc {
    id: string | number
    name?: string | null
    slug?: string | null
}

/** Order shape needed to build buyer/seller emails (depth:1 — tenant/site resolved). */
export interface PaidOrderDoc {
    id: number | string
    tenant: number | string | { id: number | string }
    orderNumber: string
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    currency: string
    total: number
    subtotal: number
    tax: number
    shippingFee?: number
    discountCode?: string | null
    /** Discount amount in sen (order snapshot); converted to RM before the email template. */
    discountAmount?: number | null
    notes?: string | null
    createdAt?: string
    /** Locale snapshot at order creation — used for buyer emails. */
    locale?: string | null
    site?: string | number | { id: string | number; locale?: string }
    items: Array<{
        product: string | number | { id: string | number }
        productName: string
        quantity: number
        unitPrice: number
        variant?: string | null
    }>
    shippingAddress?: Record<string, string>
    paymentMethod?: string | null
    xenditChannelCode?: string | null
}

/**
 * Send buyer order-confirmation + seller new-order emails and fire the ORDER_NEW notification
 * for a freshly-paid order. Non-critical: failures are logged, never thrown (caller already
 * committed the paid transition). Shared by webhook, active-reconcile endpoint, and cron.
 */
export async function sendOrderPaidEmailsAndNotify(payload: Payload, order: PaidOrderDoc): Promise<void> {
    const tenantId = typeof order.tenant === 'object' ? order.tenant.id : order.tenant
    const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
    const tenantTyped = tenantDoc as unknown as TenantDoc | null
    const shopName = tenantTyped?.name ?? ''
    const supportEmail = (await getTenantOwnerEmails(payload, tenantId))[0] ?? ''
    const siteSlug = tenantTyped?.slug ?? ''
    const orderPageUrl = buildStorefrontUrl(siteSlug, `/orders/${order.orderNumber}`)
    // Buyer locale: immutable snapshot at checkout. Fallback for legacy orders without field.
    const buyerLocale: 'en' | 'ms' = (
        order.locale
        ?? (typeof order.site === 'object' ? (order.site as { locale?: string })?.locale : null)
        ?? 'en'
    ) as 'en' | 'ms'
    try {
        const buyerCmsConfig = await getTemplateConfig(tenantId, 'order-confirmation', 'buyer', buyerLocale).catch(() => null)

        if (buyerCmsConfig?.enabled === false) {
            console.log('[Reconcile] suppressed (disabled): order-confirmation')
        } else {
            const emailData = orderConfirmationEmail({
                shopName,
                supportEmail,
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
                // Discount line — order snapshot is in sen; template formats RM via fp()
                discountCode: order.discountCode ?? null,
                discountAmount: order.discountAmount ? order.discountAmount / 100 : null,
                paymentMethod: (order.paymentMethod as any) ?? 'stripe',
                xenditChannelCode: order.xenditChannelCode ?? null,
                orderDate: order.createdAt ?? new Date().toISOString(),
                orderPageUrl,
                currency: order.currency || 'MYR',
                buyerNote: order.notes ?? null,
                locale: buyerLocale,
            }, buyerCmsConfig ?? undefined)

            const sent = await sendEmail({ to: order.customerEmail, subject: emailData.subject, html: emailData.html })
            console.log(sent
                ? `[Reconcile] Confirmation email sent to ${order.customerEmail}`
                : `[Reconcile] Confirmation email failed for ${order.customerEmail}`)
        }

    } catch (emailErr) {
        console.error('[Reconcile] Failed to send confirmation email:', emailErr)
    }

    // Fire-and-forget: ORDER_NEW in-app notification for merchant
    import('@/lib/notifications/notify-tenant-owners')
        .then(({ notifyTenantOwners }) => notifyTenantOwners(payload, tenantId, {
            type: 'ORDER_NEW',
            title: `New Order #${order.orderNumber} - ${order.currency || 'MYR'} ${(order.total ?? 0).toFixed(2)}`,
            message: `Order placed by ${order.customerName}`,
            actionUrl: '/orders',
            metadata: { orderNumber: order.orderNumber, currency: order.currency || 'MYR', total: (order.total ?? 0).toFixed(2), customerName: order.customerName },
            dedupeKey: `ORDER_NEW:${order.orderNumber}`,
        }))
        .catch((err) => console.error('[Notification] ORDER_NEW hook failed', err))
}

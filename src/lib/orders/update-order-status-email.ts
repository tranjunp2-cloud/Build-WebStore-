import type { Payload } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { orderCompletedEmail } from '@/lib/email/templates/order-completed'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

// Statuses that trigger a buyer notification email (shipped removed — no email template for it)
const BUYER_EMAIL_STATUSES = new Set(['confirmed', 'completed', 'cancelled', 'refunded'])

/**
 * The buyer's email for a status change (confirmed, completed, cancelled), when the plan allows it.
 * Never throws: an email problem must not fail the status update.
 */
export async function sendStatusEmail(
    payload: Payload,
    order: any,
    id: string,
    newStatus: string,
    notes: string | undefined,
): Promise<void> {
    // Send buyer notification for relevant status changes — isolated so email failure never fails the update response
    if (BUYER_EMAIL_STATUSES.has(newStatus) && (order as any).customerEmail) {
        try {
            const customerEmail = (order as any).customerEmail
            const orderNumber = (order as any).orderNumber ?? id
            const tenantId = typeof (order as any).tenant === 'object'
                ? (order as any).tenant.id
                : (order as any).tenant

            const emailSub = await getActivePlanSubscription(payload, tenantId)
            const canSendConfirmation = !emailSub || await canUse(payload, emailSub.plan as PlanCode, 'email_confirmation')

            if (canSendConfirmation && (newStatus === 'cancelled' || newStatus === 'confirmed' || newStatus === 'completed')) {
                const tenant = tenantId
                    ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                    : null
                const shopName = (tenant as any)?.name ?? ''
                const ownerEmails = await getTenantOwnerEmails(payload, tenantId ?? '')
                const supportEmail = ownerEmails[0] ?? ''
                const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
                const buyerLocale: 'en' | 'ms' = (
                    (order as any).locale
                    ?? (typeof (order as any).site === 'object' ? (order as any).site?.locale : null)
                    ?? 'en'
                ) as 'en' | 'ms'

                const orderItems = ((order as any).items ?? [] as Array<{ productName: string; variant?: string | null; quantity: number; unitPrice: number }>).map((item: { productName: string; variant?: string | null; quantity: number; unitPrice: number }) => ({
                    name: item.productName,
                    variant: item.variant || null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.quantity * item.unitPrice,
                }))

                if (newStatus === 'confirmed') {
                    const cmsConfig = await getTemplateConfig(tenantId, 'order-confirmation', 'buyer', buyerLocale)
                    if (cmsConfig?.enabled === false) {
                        console.log('[Email] suppressed (disabled): order-confirmation (confirmed)')
                    } else {
                        const richEmail = orderConfirmationEmail({
                            shopName,
                            supportEmail,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            // discountAmount snapshot is in sen → /100 for RM (template formats with fp())
                            discountAmount: (order as any).discountAmount ? (order as any).discountAmount / 100 : null,
                            discountCode: (order as any).discountCode ?? null,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod === 'cod' ? 'cod' : (order as any).paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'stripe',
                            orderDate: (order as any).createdAt,
                            orderPageUrl: buildStorefrontUrl(shopSlug, `/orders/${orderNumber}`),
                            currency: (order as any).currency ?? 'MYR',
                            locale: buyerLocale,
                            event: 'confirmed',
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({ to: customerEmail, subject: richEmail.subject, html: richEmail.html })
                            .catch((err: unknown) => console.error('[Email confirmed notify]', err))
                    }
                } else if (newStatus === 'completed') {
                    const cmsConfig = await getTemplateConfig(tenantId, 'order-completed', 'buyer', buyerLocale)
                    if (cmsConfig?.enabled === false) {
                        console.log('[Email] suppressed (disabled): order-completed')
                    } else {
                        const completedEmail = orderCompletedEmail({
                            shopName,
                            supportEmail,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            // discountAmount snapshot is in sen → /100 for RM (template formats with fp())
                            discountAmount: (order as any).discountAmount ? (order as any).discountAmount / 100 : null,
                            discountCode: (order as any).discountCode ?? null,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod === 'cod' ? 'cod' : (order as any).paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'stripe',
                            completedDate: new Date().toISOString(),
                            orderPageUrl: buildStorefrontUrl(shopSlug, `/orders/${orderNumber}`),
                            currency: (order as any).currency ?? 'MYR',
                            buyerNote: (order as any).notes ?? null,
                            locale: buyerLocale,
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({ to: customerEmail, subject: completedEmail.subject, html: completedEmail.html })
                            .catch((err: unknown) => console.error('[Email completed notify]', err))
                    }
                } else if (newStatus === 'cancelled') {
                    const cmsConfig = await getTemplateConfig(tenantId, 'order-cancelled', 'buyer', buyerLocale)
                    if (cmsConfig?.enabled === false) {
                        console.log('[Email] suppressed (disabled): order-cancelled')
                    } else {
                        const cancelEmail = orderCancelledEmail({
                            shopName,
                            supportEmail,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            // discountAmount snapshot is in sen → /100 for RM (template formats with fp())
                            discountAmount: (order as any).discountAmount ? (order as any).discountAmount / 100 : null,
                            discountCode: (order as any).discountCode ?? null,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod ?? 'cod',
                            orderDate: (order as any).createdAt,
                            cancellationDate: new Date().toISOString(),
                            cancellationNote: notes ?? (order as any).cancelReason ?? null,
                            shopUrl: buildStorefrontUrl(shopSlug),
                            currency: (order as any).currency ?? 'MYR',
                            locale: buyerLocale,
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                            .catch((err: unknown) => console.error('[Email cancel notify]', err))
                    }
                }
            }
        } catch (emailErr) {
            payload.logger.error({ emailErr, orderId: id, status: newStatus }, '[order-update] email construction failed')
        }
    }
}

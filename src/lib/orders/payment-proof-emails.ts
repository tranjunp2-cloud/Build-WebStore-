import type { Payload } from 'payload'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import { paymentConfirmedEmail } from '@/lib/email/templates/payment-confirmed'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

/**
 * The buyer's emails after a payment proof was approved: "payment confirmed", and the order confirmation
 * when the approval confirmed the order. Never throws: an email problem must not undo the approval.
 */
export async function sendPaymentApprovedEmails(
    payload: Payload,
    updated: any,
    newStatus: string,
    orderId: string | number,
): Promise<void> {
    // Slug lives on the tenant, not the site — sites collection has no slug field
    const siteObj = typeof (updated as any)?.site === 'object' ? (updated as any).site : null
    const tenantObj = siteObj?.tenant && typeof siteObj.tenant === 'object' ? siteObj.tenant : null
    const siteSlug = tenantObj?.slug ?? ''
    const orderPageUrl = buildStorefrontUrl(siteSlug, `/orders/${(updated as any)?.orderNumber ?? ''}`)

    const emailPayload = paymentConfirmedEmail({
        orderNumber: (updated as any)?.orderNumber as string,
        customerName: (updated as any)?.customerName as string,
        total: (updated as any)?.total as number,
        currency: ((updated as any)?.currency as string) ?? 'MYR',
        orderPageUrl,
    })

    payload.sendEmail({
        to: (updated as any)?.customerEmail as string,
        subject: emailPayload.subject,
        html: emailPayload.html,
    }).catch((err) => payload.logger.error({ err }, '[approve-payment] sendEmail failed'))

    // When approve-payment transitions order to 'confirmed', also send orderConfirmationEmail.
    // The PATCH /api/orders/[id] route (which normally sends this) is blocked by INVALID_TRANSITION
    // after approve-payment already committed the status change via SQL CAS.
    if (newStatus === 'confirmed' && (updated as any)?.customerEmail) {
        // Resolve tenant: prefer site.tenant (already fetched at depth:2), fall back to order.tenant
        // so orders without a site relationship still get the email (matches PATCH route behaviour).
        const resolvedTenant = tenantObj ?? (
            typeof (updated as any)?.tenant === 'object' ? (updated as any).tenant : null
        )
        const tenantId = resolvedTenant ? String((resolvedTenant as any).id) : null
        if (tenantId) {
            try {
                const emailSub = await getActivePlanSubscription(payload, tenantId)
                const canSend = !emailSub || await canUse(payload, emailSub.plan as PlanCode, 'email_confirmation')
                if (canSend) {
                    const buyerLocale: 'en' | 'ms' = (
                        (updated as any)?.locale
                        ?? (siteObj as any)?.locale
                        ?? 'en'
                    ) as 'en' | 'ms'
                    const cmsConfig = await getTemplateConfig(tenantId, 'order-confirmation', 'buyer', buyerLocale).catch(() => null)
                    if (cmsConfig?.enabled !== false) {
                        const ownerEmails = await getTenantOwnerEmails(payload, tenantId)
                        const orderItems = ((updated as any).items ?? []).map((item: any) => ({
                            name: item.productName ?? item.name ?? '',
                            variant: item.variant || null,
                            quantity: item.quantity ?? 1,
                            unitPrice: item.unitPrice ?? 0,
                            lineTotal: (item.quantity ?? 1) * (item.unitPrice ?? 0),
                        }))
                        const confirmEmail = orderConfirmationEmail({
                            shopName: (resolvedTenant as any)?.name ?? '',
                            supportEmail: ownerEmails[0] ?? '',
                            orderNumber: (updated as any)?.orderNumber ?? String(orderId),
                            customerName: (updated as any)?.customerName ?? '',
                            customerEmail: (updated as any)?.customerEmail as string,
                            customerPhone: (updated as any)?.customerPhone ?? null,
                            customerAddress: (updated as any)?.shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (updated as any)?.subtotal ?? 0,
                            discountAmount: (updated as any)?.discountAmount ? (updated as any).discountAmount / 100 : null,
                            discountCode: (updated as any)?.discountCode ?? null,
                            shippingFee: (updated as any)?.shippingFee ?? 0,
                            total: (updated as any)?.total ?? 0,
                            paymentMethod: 'bank_transfer',
                            orderDate: (updated as any)?.createdAt,
                            orderPageUrl,
                            currency: (updated as any)?.currency ?? 'MYR',
                            locale: buyerLocale,
                            event: 'confirmed',
                        }, cmsConfig ?? undefined)
                        payload.sendEmail({
                            to: (updated as any)?.customerEmail as string,
                            subject: confirmEmail.subject,
                            html: confirmEmail.html,
                        }).catch((err) => payload.logger.error({ err }, '[approve-payment] orderConfirmationEmail failed'))
                    }
                }
            } catch (err) {
                payload.logger.error({ err }, '[approve-payment] failed to queue orderConfirmationEmail')
            }
        }
    }
}

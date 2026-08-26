import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { paymentConfirmedEmail } from '@/lib/email/templates/payment-confirmed'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]/approve-payment
 * Seller approves a bank-transfer payment proof.
 * Guards: paymentMethod==='bank_transfer' + paymentStatus==='pending_verification' + status !== 'cancelled'
 */
export const PATCH = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id

        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 2,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        if (
            order.paymentMethod !== 'bank_transfer' ||
            order.paymentStatus !== 'pending_verification' ||
            (order.status as string) === 'cancelled'
        ) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_STATE', message: 'Order is not awaiting payment verification' } },
                { status: 422 }
            )
        }

        const newStatus = (order.status as string) === 'pending' ? 'confirmed' : (order.status as string)

        // Atomic CAS: prevents concurrent double-approve AND cancel+approve race.
        // If two sellers click Approve simultaneously, only the first CAS succeeds (one write wins).
        // If cancel CAS already set status='cancelled', the WHERE clause excludes it → 0 rows → 409.
        const db = (payload.db.drizzle as any)
        const casResult = await db.execute(sql`
            UPDATE orders
            SET payment_status = 'paid',
                payment_verified_at = NOW(),
                payment_verified_by_id = ${user.id},
                verification_source = 'manual',
                status = ${newStatus},
                updated_at = NOW()
            WHERE id = ${orderId}
              AND payment_status = 'pending_verification'
              AND status NOT IN ('cancelled', 'refunded')
            RETURNING id, status, payment_status
        `)

        if (!casResult.rows?.length) {
            // CAS missed — concurrent cancel or double-approve
            const recheck = await payload.findByID({
                collection: 'orders',
                id: orderId,
                depth: 0,
                overrideAccess: true,
            })
            if ((recheck as any)?.status === 'cancelled') {
                return NextResponse.json(
                    { success: false, error: { code: 'CONFLICT', message: 'Order was cancelled before payment could be verified' } },
                    { status: 409 }
                )
            }
            if ((recheck as any)?.paymentStatus === 'paid') {
                return NextResponse.json({ success: true, data: recheck })
            }
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_STATE', message: 'Order is not awaiting payment verification' } },
                { status: 422 }
            )
        }

        // Fetch full updated order for email + response (CAS only returns id/status/payment_status)
        const updated = await payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 2,
            overrideAccess: true,
        })

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

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        console.error('[approve-payment] error', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Approval failed' } },
            { status: 500 }
        )
    }
}))
